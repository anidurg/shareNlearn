import { useMemo, useState, type ReactNode } from "react";
import {
  audioUrl,
  formatDate,
  formatDuration,
  type Circle,
  type Song,
} from "../api";
import type { ShareAndLearn } from "../store";
import { inCircle } from "../feed";
import { canManageShare, deleteNote } from "../manage";
import {
  Byline,
  EmptyState,
  ErrorLine,
  OwnerActions,
  PhotoGallery,
  PrivateTag,
  SaveButton,
  SearchField,
  TabHeader,
} from "./shared";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { backFromOrigin, ItemTrail, MissingItemBack } from "./ItemLocation";
import type { ItemOrigin } from "../item-location";
import { FieldAnswers } from "./CategoryFields";
import { BuiltInFieldsButton } from "./ManageFields";
import { IconButton } from "./Icons";
import { SongConversation } from "./Discussions";
import { SongLyricsPanel } from "./SongLyrics";
import { useGuidelinesGate } from "./Guidelines";
import { ADD_A_SONG_NOTE, SongModal } from "./SongModal";

/**
 * Songs, in two surfaces rather than one.
 *
 * The list is deliberately thin — a title, who shared it, when, and two things to do
 * with it. Everything a song carries used to sit on its card, which meant that eight
 * recordings with thirty lines of lyrics apiece were a page nobody could scan: the
 * question a list answers is "which one?", and the answer to that is a title and a name.
 *
 * Everything else lives on the song's own page, reached by **Details** and linkable,
 * because that is where somebody has already chosen this song: the player, the words,
 * the scripts they can be read in, the pictures, the discussion, and — for the member
 * who shared it and for whoever keeps a circle it went into — Edit and Delete.
 */
export function SongsTab({
  store,
  userId,
  currentCircle,
  openSongId,
  origin,
  onOpenSong,
  onOpenPlace,
  onBackToList,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle in view; the listing is what that circle holds, not everything. */
  currentCircle: Circle | null;
  openSongId: number | null;
  /** The circle and folder the reader opened this song from, off the route. */
  origin: ItemOrigin;
  onOpenSong: (id: number) => void;
  /** Open a place in the app: a folder of a circle, or the circle itself. */
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  onBackToList: () => void;
  onNeedsLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  // Asked once, before a member's first share of anything.
  const guidelines = useGuidelinesGate(store);
  const [editing, setEditing] = useState<Song | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which row is playing, so tapping ▶ on a second song stops the first rather than
  // leaving two recordings going at once.
  const [playing, setPlaying] = useState<number | null>(null);

  // One song opened by id is looked up across everything the member may see: a link is
  // a link, and it should not break because another circle is in view.
  const open = openSongId ? store.songs.find((item) => item.id === openSongId) : undefined;

  const circleId = currentCircle?.id ?? null;
  const here = useMemo(() => inCircle(store.songs, circleId), [store.songs, circleId]);

  const songs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return here;
    return here.filter((song) =>
      [song.songName, song.memberName, song.composer, song.raga]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle)),
    );
  }, [here, query]);

  /* Where Delete lands: the folder the reader came through, since the song's own
     filing goes with it. */
  const leaveItem = backFromOrigin(origin, onOpenPlace, onBackToList);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const modals = (
    <>
      {guidelines.gate}

      {adding && (
        <SongModal
          store={store}
          userId={userId}
          circles={store.circles}
          categories={store.categories}
          presetCircleIds={circleId ? [circleId] : []}
          onClose={() => setAdding(false)}
          onSaved={store.addSong}
        />
      )}
      {editing && (
        <SongModal
          song={editing}
          store={store}
          userId={userId}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </>
  );

  if (openSongId && !open) {
    return (
      <>
        <EmptyState glyph="◦" title="That song is not available">
          It may have been removed, or kept private by whoever shared it.
        </EmptyState>
        <MissingItemBack
          store={store}
          origin={origin}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All songs"
        />
      </>
    );
  }

  if (open) {
    // The author, and whoever keeps a circle it went into — its owner, an admin they
    // chose, or the app admin stepping in. Both get Edit and Delete, because a circle's
    // people answer for what is in it and a wrong title left standing is not an answer.
    // What differs is what the confirm says: deleting somebody else's work names them.
    const isOwner = open.memberId === userId;
    const canManage = canManageShare(store, userId, open);
    const duration = formatDuration(open.durationSeconds);
    const details = [open.composer, open.raga && `Raga ${open.raga}`].filter(Boolean).join(" · ");

    return (
      <>
        {/* Where this recording sits — the circle and the folders down to it —
            rather than the listing its kind belongs to. */}
        <ItemTrail
          store={store}
          item={open}
          origin={origin}
          circleInView={circleId}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All songs"
        />
        <ErrorLine message={error} />
        <article className="song-detail">
          <h1 className="tab-title">
            <span aria-hidden="true">🎵</span> {open.songName}
            <PrivateTag visibility={open.visibility} />
          </h1>
          <Byline
            memberName={open.memberName}
            createdAt={formatDate(open.createdAt)}
            circleIds={open.circleIds}
            circleById={store.circleById}
          />
          {(details || duration) && (
            <p className="card-meta">{[details, duration].filter(Boolean).join(" · ")}</p>
          )}

          {/*
            Whatever the circle's own category asked about this recording — which is
            where an uploaded document is read, a file being no use if the form takes
            one and nothing ever shows it.
          */}
          <FieldAnswers values={open.fieldValues} />

          {/* A song may be words alone, in which case there is nothing to play. */}
          {open.blobKey && (
            <audio controls preload="none" src={audioUrl(open.id, open.blobKey)} className="song-detail-audio" />
          )}

          <SongLyricsPanel song={open} store={store} canEdit={canManage} />

          <PhotoGallery photos={open.photos} title={open.songName} />

          <SongConversation song={open} userId={userId} store={store} onError={showError} />

          <div className="card-actions">
            <ShareLinkButton
              itemType="song"
              itemId={open.id}
              name={open.songName}
              blurb={`${open.memberName} shared “${open.songName}” on Share & Learn.`}
              circleId={circleId}
              kindWord="recording"
            />
            <SaveButton
              saved={store.savedKeys.has(`song:${open.id}`)}
              canSave={Boolean(userId)}
              onToggle={() => store.toggleSave("song", open.id).catch(showError)}
              label="Save to My Library"
              savedLabel="In My Library"
            />
            <PostActions store={store} userId={userId} itemType="song" item={open} />
            {canManage && (
              <OwnerActions
                onEdit={() => setEditing(open)}
                onDelete={() =>
                  store.removeSong(open.id).then(leaveItem).catch(showError)
                }
                confirmNote={deleteNote(isOwner, "song", open.memberName)}
              />
            )}
          </div>
        </article>
        {modals}
      </>
    );
  }

  return (
    <>
      <TabHeader
        title="Songs"
        subtitle={
          currentCircle
            ? `Sing something for ${currentCircle.name}, or share a recording you already have.`
            : "Sing something now, or share a recording you already have."
        }
        actions={
          userId ? (
            <>
              {/* What this circle's Songs form asks — a keeper's door, drawn for
                  nobody else, and the same wide/narrow pair Books carries. */}
              <BuiltInFieldsButton
                store={store}
                itemType="song"
                circleId={circleId}
                className="btn btn-ghost tab-header-wide-action"
                label="Manage fields"
              />
              <BuiltInFieldsButton
                store={store}
                itemType="song"
                circleId={circleId}
                className="btn btn-ghost section-head-narrow-action"
                label="Fields"
              />
              <button
                className="btn btn-primary"
                onClick={() => guidelines.guard(() => setAdding(true))}
              >
                + Add a Song
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onNeedsLogin}>
              Log in to share
            </button>
          )
        }
      />

      {/* One button, three ways in — so it says which three. */}
      {userId && <p className="tab-note">{ADD_A_SONG_NOTE}</p>}

      {here.length > 0 && (
        <div className="collection-bar">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search songs, singers, composers…"
          />
          <p className="collection-count">
            {songs.length} {songs.length === 1 ? "song" : "songs"}
          </p>
        </div>
      )}

      <ErrorLine message={error} />

      {here.length === 0 && (
        <EmptyState
          glyph="🎵"
          title={currentCircle ? `No songs in ${currentCircle.name} yet` : "No songs yet"}
        >
          {userId
            ? "Tap “+ Add a Song” to sing one, upload a recording, or simply write the words down."
            : "Log in to hear what members have recorded, and to add your own."}
        </EmptyState>
      )}

      {here.length > 0 && songs.length === 0 && (
        <EmptyState glyph="◦" title={`Nothing matches “${query.trim()}”`}>
          Try another title, singer, or composer.
        </EmptyState>
      )}

      {songs.length > 0 && (
        <ul className="song-rows">
          {/* The column heads the rows line up under. Hidden on a phone, where the
              row stacks and each value says what it is by where it sits. */}
          <li className="song-rows-head" aria-hidden="true">
            <span>Title</span>
            <span>Uploaded by</span>
            <span>Date</span>
            <span>Actions</span>
          </li>
          {songs.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              playing={playing === song.id}
              onPlay={() => setPlaying(playing === song.id ? null : song.id)}
              onOpen={() => onOpenSong(song.id)}
              share={
                <ShareLinkButton
                  itemType="song"
                  itemId={song.id}
                  name={song.songName}
                  blurb={`${song.memberName} shared “${song.songName}” on Share & Learn.`}
                  circleId={circleId}
                  kindWord="recording"
                />
              }
              menu={<PostActions store={store} userId={userId} itemType="song" item={song} />}
            />
          ))}
        </ul>
      )}

      {modals}
    </>
  );
}

/**
 * One line of the list: the title, who shared it, when, and the two things worth doing
 * from here.
 *
 * **▶ Play** opens the player under the row rather than navigating, because somebody
 * scanning a list of recordings usually wants to hear one and stay where they are; only
 * one plays at a time, which is the tab's business rather than the row's. A song shared
 * as words alone has nothing to play and so gets no button — an inert ▶ would be a
 * promise the row cannot keep. **Details** is the way to everything else.
 */
function SongRow({
  song,
  playing,
  onPlay,
  onOpen,
  share,
  menu,
}: {
  song: Song;
  playing: boolean;
  onPlay: () => void;
  onOpen: () => void;
  /** The worded Share chip, rendered by the tab because it needs the circle in view. */
  share?: ReactNode;
  /** The ⋮ menu, rendered by the tab because it needs the store. */
  menu?: ReactNode;
}) {
  return (
    <li className="song-row">
      <button className="song-row-title" onClick={onOpen}>
        <span aria-hidden="true">🎵</span> {song.songName}
        <PrivateTag visibility={song.visibility} />
      </button>
      <span className="song-row-by">{song.memberName}</span>
      <span className="song-row-date">{formatDate(song.createdAt)}</span>
      <span className="song-row-actions">
        {song.blobKey && (
          <IconButton
            icon={playing ? "stop" : "play"}
            label={playing ? "Stop the recording" : "Play the recording"}
            pressed={playing}
            onClick={onPlay}
          />
        )}
        <button className="chip-button chip-strong" onClick={onOpen}>
          Details
        </button>
        {share}
        {menu}
      </span>
      {playing && song.blobKey && (
        <audio controls autoPlay src={audioUrl(song.id, song.blobKey)} className="song-row-audio" />
      )}
    </li>
  );
}
