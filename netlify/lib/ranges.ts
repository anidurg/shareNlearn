// netlify/lib/ranges.ts
// Serving bytes a player asks for a piece at a time.
//
// This began inside `audio.mts` and moved out when a category could invent an
// upload field that takes audio: the answer to one of those is a blob in the
// attachments store rather than a song, and `file.mts` serves it — but the two
// reasons for range requests are the same wherever the bytes came from. A
// buffered response caps out at 6 MB, so a slice is bounded and anything bigger
// streams; and Safari refuses to play audio at all from a route that does not
// answer `Range`.

/**
 * A buffered response caps out at 6 MB, so a `206` never carries more than one
 * slice of this size and anything larger goes back as a stream instead (streamed
 * responses may run to 20 MB, which is the ceiling on a single recording).
 */
export const MAX_SLICE_BYTES = 4 * 1024 * 1024;

/** Streams the bytes when they are too big to return buffered in one piece. */
export function stream(bytes: Uint8Array) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Parses a single-range `bytes=start-end` header; anything else is ignored. */
export function parseRange(header: string | null, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header ?? "").trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;
  if (!rawStart) {
    // "bytes=-500" asks for the last 500 bytes.
    const suffix = Number(rawEnd);
    if (suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }

  if (start >= size || start > end) return "unsatisfiable" as const;
  return { start, end: Math.min(end, start + MAX_SLICE_BYTES - 1) };
}

/**
 * The whole answer to one `GET` of some bytes: the slice a player asked for, the
 * refusal when it asked for one that is not there, or the file itself — buffered
 * while it fits and streamed once it does not.
 *
 * `headers` are added to every one of those, which is how a document keeps the
 * name and the caching a photo-shaped route gives it while still being seekable.
 */
export function bytesResponse(
  bytes: Uint8Array,
  contentType: string,
  rangeHeader: string | null,
  headers: Record<string, string> = {},
) {
  const size = bytes.byteLength;
  const range = parseRange(rangeHeader, size);

  if (range === "unsatisfiable") {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { ...headers, "Accept-Ranges": "bytes", "Content-Range": `bytes */${size}` },
    });
  }

  if (range) {
    // Bounded to MAX_SLICE_BYTES above, so this fits in a buffered response and
    // can carry an accurate Content-Length.
    const slice = bytes.subarray(range.start, range.end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(slice.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }

  // No Range header — a player that asked for the whole file. Small recordings go
  // back buffered; a bigger one has to stream to clear the 6 MB buffered cap.
  if (size <= MAX_SLICE_BYTES) {
    return new Response(bytes, {
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(size),
      },
    });
  }

  return new Response(stream(bytes), {
    headers: { ...headers, "Content-Type": contentType, "Accept-Ranges": "bytes" },
  });
}

/**
 * How many bytes an answer from `bytesResponse()` will actually carry, which is
 * the number worth counting: bandwidth is charged on what went out rather than on
 * how big the file was, and a player seeking through a recording asks for one
 * slice at a time.
 *
 * It re-derives the answer from `parseRange()` rather than reading `Content-Length`
 * back off the Response, because two of the four exits above deliberately carry no
 * such header — the streamed `200`, whose length is not known when the headers are
 * written, and the `416`, which carries no body at all.
 */
export function servedByteCount(bytes: Uint8Array, rangeHeader: string | null): number {
  const size = bytes.byteLength;
  const range = parseRange(rangeHeader, size);
  if (range === "unsatisfiable") return 0;
  return range ? range.end - range.start + 1 : size;
}
