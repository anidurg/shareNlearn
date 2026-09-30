// netlify/lib/orphans.ts
// The blobs nothing points at any more, and what can honestly be said about them.
//
// Every store in this app is written from one route and read from a column: a
// photo's key is on `item_photos`, a cover's on `circles`, a recording's on
// `songs`, and a document's inside the `post_field_values` answer that holds it.
// Deleting any of those sweeps its bytes up, so the store and the column agree
// nearly all of the time. What breaks the agreement is a form abandoned after the
// upload: a member picks four photos, reads the page again and closes the tab, and
// four blobs are left with no row that will ever name them. Nothing in the app
// deletes those, which is why they are the only part of storage that grows without
// anybody sharing anything.
//
// This is deliberately a *report* rather than a sweeper. A sweeper has to decide
// on its own whether a key is really abandoned, and the one input that would make
// that decision safe — how old the blob is — is the one thing Blobs does not give
// back: `list()` answers `{ key, etag }` and nothing else, no size and no date. So
// a sweeper would either delete an upload that is thirty seconds old and still on
// its way to a save, or wait out a grace period it has no clock for. An app admin
// reading a list and pressing a button has the context the code does not, and the
// same absence of dates is why the numbers below are counts of keys rather than
// bytes — there is no way to add up a store without downloading it.
import type { Store } from "@netlify/blobs";
import { isNotNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import { circles, itemPhotos, postFieldValues, songs } from "../../db/schema.js";
import { attachmentKeysIn, attachmentStore } from "./attachments.js";
import { audioPartStore, audioStore } from "./audio-uploads.js";
import { coverStore } from "./circles.js";
import { photoStore } from "./photos.js";

/**
 * How many keys one store's report carries. The count above it is the whole
 * store, so a truncated list understates what is there and never overstates it —
 * and a group with more than this many strays has a bigger story than a list of
 * keys can tell anyway. Deleting is by key, so a long list is worked through a
 * page at a time rather than in one press.
 */
export const MAX_ORPHANS_LISTED = 200;

export type OrphanStoreId =
  | "item-photos"
  | "field-files"
  | "circle-covers"
  | "song-audio"
  | "song-audio-parts";

export type OrphanStoreReport = {
  id: OrphanStoreId;
  /** What the store holds, in the words a member would use. */
  label: string;
  /** What a stray in this particular store means, and what deleting one costs. */
  note: string;
  /** Every key in the store. */
  total: number;
  /** How many of those a row still names. */
  live: number;
  /** The keys nothing names, up to `MAX_ORPHANS_LISTED` of them. */
  orphans: string[];
  /** True when there are more strays than the list above carries. */
  truncated: boolean;
};

type StoreSpec = {
  id: OrphanStoreId;
  label: string;
  note: string;
  store: () => Store;
  /** Every key a row still points at, or null where no row ever points at one. */
  liveKeys: (() => Promise<string[]>) | null;
};

/**
 * The five stores and where each one's live keys are read from. It is a table
 * rather than five functions because the diff is identical in every case and the
 * only thing that differs is the column — which is also the check on adding a
 * sixth store to the app: a store with no entry here is a store that leaks
 * silently, and one with the wrong entry here would report live blobs as strays.
 */
const STORES: StoreSpec[] = [
  {
    id: "item-photos",
    label: "Photos on shares",
    note: "A stray here is a picture uploaded into a form that was never saved. Nothing on screen reads it.",
    store: photoStore,
    liveKeys: async () => {
      const rows = await db.select({ key: itemPhotos.blobKey }).from(itemPhotos);
      return rows.map((row) => row.key);
    },
  },
  {
    id: "field-files",
    label: "Documents answering a category's questions",
    note: "A stray here is a PDF, Word or Excel file uploaded into a share that was never saved.",
    store: attachmentStore,
    liveKeys: async () => {
      // A document's key travels inside the answer rather than in a column of its
      // own, which is why this one store is read through a parser.
      const rows = await db.select({ value: postFieldValues.value }).from(postFieldValues);
      return attachmentKeysIn(rows.map((row) => row.value));
    },
  },
  {
    id: "circle-covers",
    label: "Circle cover images",
    note: "A stray here is a cover picked while starting or editing a circle that was then abandoned.",
    store: coverStore,
    liveKeys: async () => {
      const rows = await db
        .select({ key: circles.coverKey })
        .from(circles)
        .where(isNotNull(circles.coverKey));
      return rows.map((row) => row.key as string);
    },
  },
  {
    id: "song-audio",
    label: "Recordings",
    note: "A stray here is a stitched recording whose song row is gone. These are the largest blobs in the app.",
    store: audioStore,
    liveKeys: async () => {
      const rows = await db
        .select({ key: songs.blobKey })
        .from(songs)
        .where(isNotNull(songs.blobKey));
      return rows.map((row) => row.key as string);
    },
  },
  {
    id: "song-audio-parts",
    /* No row anywhere ever names a part: the browser PUTs them, the claim route
       stitches them and deletes them, and what is left is an upload that stopped
       halfway. So the whole store is the report, and `liveKeys` is null rather
       than a query that would answer nothing — which is also the one entry here
       where the list can catch something still in use, a member's fifth part
       arriving while the page is being read. That is what the note says. */
    label: "Unfinished uploads",
    note: "Parts of a recording or a document that never finished arriving. An upload happening right now looks exactly like one that stopped, so leave these unless the number is large.",
    store: audioPartStore,
    liveKeys: null,
  },
];

/** Every key in a store, walked a page at a time so a big store still answers. */
async function keysIn(store: Store): Promise<string[]> {
  const keys: string[] = [];
  for await (const page of store.list({ paginate: true })) {
    for (const blob of page.blobs) keys.push(blob.key);
  }
  return keys;
}

/** One store's diff: what is in it, what a row still names, and the difference. */
async function reportFor(spec: StoreSpec): Promise<OrphanStoreReport> {
  const keys = await keysIn(spec.store());
  const live = spec.liveKeys ? new Set(await spec.liveKeys()) : new Set<string>();
  const strays = keys.filter((key) => !live.has(key));

  return {
    id: spec.id,
    label: spec.label,
    note: spec.note,
    total: keys.length,
    live: keys.length - strays.length,
    orphans: strays.slice(0, MAX_ORPHANS_LISTED),
    truncated: strays.length > MAX_ORPHANS_LISTED,
  };
}

/** The whole report, one entry per store, in the order the table above lists them. */
export async function orphanReport(): Promise<OrphanStoreReport[]> {
  const reports: OrphanStoreReport[] = [];
  for (const spec of STORES) reports.push(await reportFor(spec));
  return reports;
}

/**
 * Deletes some of one store's strays, having worked out for itself which keys
 * those are.
 *
 * The keys the admin sends are read as a *selection* and never as a licence: the
 * diff is taken again here and anything the fresh answer calls live is skipped
 * rather than deleted. That is the whole reason the delete lives beside the
 * report — a page read ten minutes ago, or left open while somebody shared a
 * recipe, would otherwise be able to delete a photo that is now on a share.
 */
export async function deleteOrphans(
  storeId: string,
  keys: string[],
): Promise<{ deleted: number; skipped: number } | null> {
  const spec = STORES.find((entry) => entry.id === storeId);
  if (!spec) return null;

  const live = spec.liveKeys ? new Set(await spec.liveKeys()) : new Set<string>();
  const store = spec.store();
  const present = new Set(await keysIn(store));

  let deleted = 0;
  let skipped = 0;
  for (const key of keys) {
    if (!present.has(key) || live.has(key)) {
      skipped += 1;
      continue;
    }
    try {
      await store.delete(key);
      deleted += 1;
    } catch {
      // A blob that would not go is worth reporting as skipped rather than as an
      // error on the whole batch: the rest of the selection is still wanted.
      skipped += 1;
    }
  }

  return { deleted, skipped };
}
