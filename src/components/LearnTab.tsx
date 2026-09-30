import { useMemo, useState } from "react";
import { formatDate, type Circle, type Fact } from "../api";
import { inCircle } from "../feed";
import { canManageShare, deleteNote } from "../manage";
import type { ShareAndLearn } from "../store";
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
import { FactModal } from "./FactModal";
import { useGuidelinesGate } from "./Guidelines";
import { PostActions } from "./PostMenu";
import { ShareLinkButton } from "./ShareLink";
import { WordExplorer } from "./WordExplorer";
import { WordModal } from "./WordModal";

export type LearnSection = "facts" | "vocabulary";

/** Fun Facts and Word Explorer share one tab so the navigation stays short. */
export function LearnTab({
  store,
  userId,
  currentCircle,
  section,
  onSection,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle in view; both sections show what that circle holds. */
  currentCircle: Circle | null;
  section: LearnSection;
  onSection: (next: LearnSection) => void;
  onNeedsLogin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [addingFact, setAddingFact] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  // Asked once, before a member's first share of anything.
  const guidelines = useGuidelinesGate(store);
  const [editingFact, setEditingFact] = useState<Fact | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  const circleId = currentCircle?.id ?? null;
  const hereFacts = useMemo(() => inCircle(store.facts, circleId), [store.facts, circleId]);
  const hereWords = useMemo(() => inCircle(store.words, circleId), [store.words, circleId]);

  const needle = query.trim().toLowerCase();
  const facts = useMemo(
    () =>
      needle
        ? hereFacts.filter((fact) =>
            [fact.fact, fact.category, fact.memberName, fact.source]
              .filter(Boolean)
              .some((field) => field!.toLowerCase().includes(needle)),
          )
        : hereFacts,
    [hereFacts, needle],
  );
  const onFacts = section === "facts";

  return (
    <>
      <TabHeader
        title="Learn"
        subtitle={
          currentCircle
            ? `Fun facts and new words ${currentCircle.name} picked up.`
            : "Fun facts and new words the group picked up."
        }
        actions={
          !userId ? (
            <button className="btn btn-primary" onClick={onNeedsLogin}>
              Log in to share
            </button>
          ) : (
            onFacts && (
              <button
                className="btn btn-primary"
                onClick={() => guidelines.guard(() => setAddingFact(true))}
              >
                Add fun fact
              </button>
            )
          )
        }
      />

      <div className="sub-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={onFacts}
          className={onFacts ? "sub-tab sub-tab-active" : "sub-tab"}
          onClick={() => onSection("facts")}
        >
          Fun Facts ({hereFacts.length})
        </button>
        <button
          role="tab"
          aria-selected={!onFacts}
          className={!onFacts ? "sub-tab sub-tab-active" : "sub-tab"}
          onClick={() => onSection("vocabulary")}
        >
          Word Explorer ({hereWords.length})
        </button>
      </div>

      {onFacts && hereFacts.length > 0 && (
        <div className="collection-bar">
          <SearchField value={query} onChange={setQuery} placeholder="Search fun facts…" />
        </div>
      )}

      <ErrorLine message={error} />

      {onFacts ? (
        <>
          {hereFacts.length === 0 && (
            <EmptyState
              glyph="💡"
              title={
                currentCircle ? `No fun facts in ${currentCircle.name} yet` : "No fun facts yet"
              }
            >
              {userId
                ? "Learned something surprising today? Write it down."
                : "Log in to see the fun facts members have shared, and to add your own."}
            </EmptyState>
          )}
          {hereFacts.length > 0 && facts.length === 0 && (
            <EmptyState glyph="◦" title={`Nothing matches “${query.trim()}”`} />
          )}
          <div className="card-list">
            {facts.map((fact) => (
              <article className="card fact-card" key={fact.id}>
                <p className="fact-eyebrow">
                  Did you know? <span className="tag">{fact.category}</span>
                  <PrivateTag visibility={fact.visibility} />
                </p>
                <p className="fact-body">{fact.fact}</p>
                <Byline
                  memberName={fact.memberName}
                  createdAt={formatDate(fact.createdAt)}
                  circleIds={fact.circleIds}
                  circleById={store.circleById}
                />
                {fact.source && <p className="card-meta">Learned from {fact.source}</p>}
                <PhotoGallery photos={fact.photos} title="This fun fact" compact />
                <div className="card-actions">
                  <ShareLinkButton
                    itemType="fact"
                    itemId={fact.id}
                    name={fact.fact}
                    blurb={`${fact.fact} — shared by ${fact.memberName} on Share & Learn.`}
                    circleId={circleId}
                  />
                  <SaveButton
                    saved={store.savedKeys.has(`fact:${fact.id}`)}
                    canSave={Boolean(userId)}
                    onToggle={() => store.toggleSave("fact", fact.id).catch(showError)}
                  />
                  {/* The author, and whoever keeps a circle this fact went into. */}
                  {canManageShare(store, userId, fact) && (
                    <OwnerActions
                      onEdit={() => setEditingFact(fact)}
                      onDelete={() => store.removeFact(fact.id).catch(showError)}
                      confirmNote={deleteNote(
                        fact.memberId === userId,
                        "fun fact",
                        fact.memberName,
                      )}
                    />
                  )}
                  <PostActions store={store} userId={userId} itemType="fact" item={fact} />
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <WordExplorer
          store={store}
          userId={userId}
          words={hereWords}
          onAddWord={userId ? () => guidelines.guard(() => setAddingWord(true)) : null}
        />
      )}

      {guidelines.gate}

      {addingFact && (
        <FactModal
          circles={store.circles}
          categories={store.categories}
          onClose={() => setAddingFact(false)}
          onSave={async (values) => {
            await store.addFact(values);
            setAddingFact(false);
          }}
        />
      )}
      {editingFact && (
        <FactModal
          fact={editingFact}
          circles={store.circles}
          categories={store.categories}
          onClose={() => setEditingFact(null)}
          onSave={async (values) => {
            await store.editFact(editingFact.id, values);
            setEditingFact(null);
          }}
        />
      )}
      {addingWord && (
        <WordModal
          circles={store.circles}
          categories={store.categories}
          onClose={() => setAddingWord(false)}
          onSave={async (values) => {
            await store.addWord(values);
            setAddingWord(false);
          }}
        />
      )}
    </>
  );
}
