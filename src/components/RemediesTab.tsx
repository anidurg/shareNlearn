import { useMemo, useState } from "react";
import { formatDate, type Circle, type Remedy } from "../api";
import { inCircle } from "../feed";
import { canManageShare, deleteNote } from "../manage";
import type { ShareAndLearn } from "../store";
import {
  Byline,
  EmptyState,
  ErrorLine,
  HealthNote,
  OwnerActions,
  PhotoGallery,
  PrivateTag,
  SaveButton,
  SearchField,
  TabHeader,
  toLines,
} from "./shared";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { backFromOrigin, ItemTrail, MissingItemBack } from "./ItemLocation";
import type { ItemOrigin } from "../item-location";
import { RemedyModal } from "./RemedyModal";
import { useGuidelinesGate } from "./Guidelines";
import { ExperienceCount, ExperienceSection } from "./Experiences";

/**
 * Traditional remedies: what a family reaches for before anything else. The list
 * is grouped by what each remedy is used for, because that is how anyone looks —
 * "something for a sore throat", not "something with ginger in it".
 */
export function RemediesTab({
  store,
  userId,
  currentCircle,
  openRemedyId,
  origin,
  onOpenRemedy,
  onOpenPlace,
  onBackToList,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle in view; the listing is what that circle holds, not everything. */
  currentCircle: Circle | null;
  openRemedyId: number | null;
  /** The circle and folder the reader opened this remedy from, off the route. */
  origin: ItemOrigin;
  onOpenRemedy: (id: number) => void;
  /** Open a place in the app: a folder of a circle, or the circle itself. */
  onOpenPlace: (circleId: number, folderId: number | null) => void;
  onBackToList: () => void;
  onNeedsLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [usedFor, setUsedFor] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  // Asked once, before a member's first share of anything.
  const guidelines = useGuidelinesGate(store);
  const [editing, setEditing] = useState<Remedy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One remedy opened by id is looked up across everything the member may see: a
  // link is a link, and it should not break because another circle is in view.
  const open = openRemedyId ? store.remedies.find((item) => item.id === openRemedyId) : undefined;

  const circleId = currentCircle?.id ?? null;
  const here = useMemo(() => inCircle(store.remedies, circleId), [store.remedies, circleId]);

  /** Every complaint this circle has a remedy for, so the filter row writes itself. */
  const uses = useMemo(() => {
    const seen = new Map<string, number>();
    for (const remedy of here) {
      const label = remedy.usedFor.trim();
      if (label) seen.set(label, (seen.get(label) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [here]);

  const remedies = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return here.filter((remedy) => {
      if (usedFor !== "all" && remedy.usedFor.trim() !== usedFor) return false;
      if (!needle) return true;
      return [
        remedy.title,
        remedy.usedFor,
        remedy.ingredients,
        remedy.passedDownFrom,
        remedy.memberName,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [here, query, usedFor]);

  /* Where Delete lands: the folder the reader came through, since the remedy's
     own filing goes with it. */
  const leaveItem = backFromOrigin(origin, onOpenPlace, onBackToList);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const modals = (
    <>
      {guidelines.gate}

      {adding && (
        <RemedyModal
          circles={store.circles}
          categories={store.categories}
          onClose={() => setAdding(false)}
          onSave={async (values) => {
            await store.addRemedy(values);
            setAdding(false);
          }}
        />
      )}
      {editing && (
        <RemedyModal
          remedy={editing}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await store.editRemedy(editing.id, values);
            setEditing(null);
          }}
        />
      )}
    </>
  );

  if (openRemedyId && !open) {
    return (
      <>
        <EmptyState glyph="◦" title="That remedy is not available">
          It may have been removed, or kept private by whoever shared it.
        </EmptyState>
        <MissingItemBack
          store={store}
          origin={origin}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All remedies"
        />
      </>
    );
  }

  if (open) {
    return (
      <>
        {/* Where this remedy sits — the circle and the folders down to it —
            rather than the listing its kind belongs to. */}
        <ItemTrail
          store={store}
          item={open}
          origin={origin}
          circleInView={circleId}
          onOpenPlace={onOpenPlace}
          onBackToList={onBackToList}
          listLabel="All remedies"
        />
        <ErrorLine message={error} />
        <article className="recipe-detail remedy-detail">
          <p className="remedy-used-for">
            <span aria-hidden="true">🌱</span> Used for: {open.usedFor}
          </p>
          <h1 className="tab-title">
            {open.title}
            <PrivateTag visibility={open.visibility} />
          </h1>
          <Byline
            memberName={open.memberName}
            createdAt={formatDate(open.createdAt)}
            circleIds={open.circleIds}
            circleById={store.circleById}
          />
          {open.passedDownFrom && (
            <p className="remedy-lineage">Passed down from {open.passedDownFrom}</p>
          )}

          <h2 className="section-title">Ingredients</h2>
          <ul className="bullet-list">
            {toLines(open.ingredients).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>

          <h2 className="section-title">Preparation</h2>
          <ol className="step-list">
            {toLines(open.preparation).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>

          {open.howToUse && (
            <>
              <h2 className="section-title">How to use</h2>
              <p className="recipe-notes">{open.howToUse}</p>
            </>
          )}

          {open.notes && (
            <>
              <h2 className="section-title">Notes</h2>
              <p className="recipe-notes">{open.notes}</p>
            </>
          )}

          <PhotoGallery photos={open.photos} title={open.title} />

          <ExperienceSection
            title="Experiences & anything else added"
            ownerId={open.memberId}
            canManage={canManageShare(store, userId, open)}
            experiences={open.experiences}
            userId={userId}
            onAdd={(values) => store.addExperience("remedy", open.id, values)}
            onRemove={(experienceId) => store.removeExperience("remedy", open.id, experienceId)}
            onError={showError}
          />

          <div className="card-actions">
            <ShareLinkButton
              itemType="remedy"
              itemId={open.id}
              name={open.title}
              blurb={`${open.memberName} shared a remedy for ${open.usedFor}: ${open.title} on Share & Learn.`}
              circleId={circleId}
            />
            <SaveButton
              saved={store.savedKeys.has(`remedy:${open.id}`)}
              canSave={Boolean(userId)}
              onToggle={() => store.toggleSave("remedy", open.id).catch(showError)}
              label="Save to My Library"
              savedLabel="In My Library"
            />
            <PostActions store={store} userId={userId} itemType="remedy" item={open} />
            {/*
              The author, and whoever keeps a circle this remedy went into: a
              circle's owner and its admins answer for what is in it, which on a
              remedy matters more than most.
            */}
            {canManageShare(store, userId, open) && (
              <OwnerActions
                onEdit={() => setEditing(open)}
                onDelete={() =>
                  store
                    .removeRemedy(open.id)
                    .then(leaveItem)
                    .catch(showError)
                }
                confirmNote={deleteNote(open.memberId === userId, "remedy", open.memberName)}
              />
            )}
          </div>

          <HealthNote />
        </article>
        {modals}
      </>
    );
  }

  return (
    <>
      <TabHeader
        title="🌱 Traditional Remedies"
        subtitle={
          currentCircle
            ? `The things ${currentCircle.name} reaches for first — written down before they are forgotten.`
            : "The things families reach for first — written down before they are forgotten."
        }
        actions={
          userId ? (
            <button
              className="btn btn-primary"
              onClick={() => guidelines.guard(() => setAdding(true))}
            >
              Share a remedy
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onNeedsLogin}>
              Log in to share
            </button>
          )
        }
      />

      <HealthNote />

      {here.length > 0 && (
        <>
          <div className="collection-bar">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search by remedy, ailment, or ingredient…"
            />
            <p className="collection-count">
              {remedies.length} {remedies.length === 1 ? "remedy" : "remedies"}
            </p>
          </div>

          {uses.length > 1 && (
            <div className="sub-tabs" role="tablist" aria-label="Filter by what it is used for">
              <button
                role="tab"
                aria-selected={usedFor === "all"}
                className={usedFor === "all" ? "sub-tab sub-tab-active" : "sub-tab"}
                onClick={() => setUsedFor("all")}
              >
                Everything ({here.length})
              </button>
              {uses.map(([label, count]) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={usedFor === label}
                  className={usedFor === label ? "sub-tab sub-tab-active" : "sub-tab"}
                  onClick={() => setUsedFor(label)}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <ErrorLine message={error} />

      {here.length === 0 && (
        <EmptyState
          glyph="🌱"
          title={currentCircle ? `No remedies in ${currentCircle.name} yet` : "No remedies yet"}
        >
          {userId
            ? "Start with the one you were given as a child — honey and ginger for a sore throat counts."
            : "Log in to see the remedies members have shared, and to add your own."}
        </EmptyState>
      )}

      {here.length > 0 && remedies.length === 0 && (
        <EmptyState glyph="◦" title="Nothing matches that">
          Try another ailment, ingredient, or member.
        </EmptyState>
      )}

      <div className="card-list">
        {remedies.map((remedy) => (
          <article className="card remedy-card" key={remedy.id}>
            <p className="remedy-used-for">
              <span aria-hidden="true">🌱</span> Used for: {remedy.usedFor}
            </p>
            <h3 className="card-title">
              {remedy.title}
              <PrivateTag visibility={remedy.visibility} />
            </h3>
            <p className="card-meta">
              {[
                `${toLines(remedy.ingredients).length} ingredients`,
                `${toLines(remedy.preparation).length} steps`,
              ].join(" · ")}
            </p>
            {remedy.passedDownFrom && (
              <p className="remedy-lineage">Passed down from {remedy.passedDownFrom}</p>
            )}
            <Byline
              memberName={remedy.memberName}
              createdAt={formatDate(remedy.createdAt)}
              circleIds={remedy.circleIds}
              circleById={store.circleById}
            />
            <PhotoGallery photos={remedy.photos} title={remedy.title} compact />
            <ExperienceCount experiences={remedy.experiences} />
            <div className="card-actions">
              <button className="chip-button chip-strong" onClick={() => onOpenRemedy(remedy.id)}>
                View remedy
              </button>
              <ShareLinkButton
                itemType="remedy"
                itemId={remedy.id}
                name={remedy.title}
                blurb={`${remedy.memberName} shared a remedy for ${remedy.usedFor}: ${remedy.title} on Share & Learn.`}
                circleId={circleId}
              />
              <SaveButton
                saved={store.savedKeys.has(`remedy:${remedy.id}`)}
                canSave={Boolean(userId)}
                onToggle={() => store.toggleSave("remedy", remedy.id).catch(showError)}
              />
              {canManageShare(store, userId, remedy) && (
                <OwnerActions
                  onEdit={() => setEditing(remedy)}
                  onDelete={() => store.removeRemedy(remedy.id).catch(showError)}
                  confirmNote={deleteNote(
                    remedy.memberId === userId,
                    "remedy",
                    remedy.memberName,
                  )}
                />
              )}
              <PostActions store={store} userId={userId} itemType="remedy" item={remedy} />
            </div>
          </article>
        ))}
      </div>
      {modals}
    </>
  );
}
