import { useState } from "react";
import { formatDate, type ExperienceKind, type ItemExperience } from "../api";
import { ErrorLine } from "./shared";

/** What each kind is called where it is read, and what the button offers. */
const KIND_LABELS: Record<ExperienceKind, string> = {
  experience: "Experience",
  tip: "Tip",
  extra: "Something extra",
};

/**
 * The one-line count on a listing card, so a member can see that other people have
 * tried this before opening it. Nothing is drawn when nobody has.
 */
export function ExperienceCount({ experiences }: { experiences: ItemExperience[] | undefined }) {
  const count = experiences?.length ?? 0;
  if (count === 0) return null;
  return (
    <p className="experience-count">
      💬 {count} {count === 1 ? "experience or tip" : "experiences and tips"}
    </p>
  );
}

/**
 * What happened when somebody actually tried it. A recipe collects experiences and
 * tips; a remedy collects the same plus whatever else a member added, which is what
 * "Something extra" is for.
 *
 * Adding one is a contribution rather than an edit, so any member who can see the
 * share may write here. Whoever wrote a note may take it back, and so may the
 * member who shared the recipe or remedy it sits on and whoever keeps a circle it
 * went into.
 */
export function ExperienceSection({
  title,
  ownerId,
  canManage,
  experiences,
  userId,
  onAdd,
  onRemove,
  onError,
}: {
  /** "Experiences & Tips" on a recipe; remedies say it their own way. */
  title: string;
  /** Who shared the recipe or remedy, who may also remove what others wrote. */
  ownerId: string;
  /**
   * Whether the reader answers for the share — its author, a keeper of a circle it
   * went into, or the app admin. Passed in rather than worked out here, because the
   * caller already has the share and the store and this component has neither.
   */
  canManage: boolean;
  experiences: ItemExperience[] | undefined;
  userId: string | null;
  onAdd: (values: { kind: ExperienceKind; body: string }) => Promise<unknown>;
  onRemove: (experienceId: number) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<ExperienceKind>("experience");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const written = experiences ?? [];
  const canAdd = Boolean(userId);
  // A remedy takes anything a member added; a recipe is experiences and tips.
  const kinds: ExperienceKind[] = ["experience", "tip", "extra"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ kind, body: body.trim() });
      setBody("");
      setKind("experience");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That could not be added.");
    } finally {
      setBusy(false);
    }
  }

  const form = adding && (
    <form className="experience-form" onSubmit={submit}>
      <div className="experience-kinds">
        {kinds.map((option) => (
          <button
            type="button"
            key={option}
            className={kind === option ? "chip-button chip-active" : "chip-button"}
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
          >
            {KIND_LABELS[option]}
          </button>
        ))}
      </div>
      <label className="field">
        <span>
          {kind === "tip"
            ? "Your tip for whoever tries this next"
            : kind === "extra"
              ? "Anything else worth adding"
              : "How it went when you tried it"}
        </span>
        <textarea
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <ErrorLine message={error} />
      <div className="experience-form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </button>
        <button type="button" className="btn-text" onClick={() => setAdding(false)}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="experience-section">
      <p className="experience-label">{title}</p>
      {written.length === 0 ? (
        <p className="muted">
          Nothing here yet — the first person to try this can say how it went.
        </p>
      ) : (
        <ul className="experience-list">
          {written.map((entry) => (
            <li className="experience" key={entry.id}>
              <span className="tag">{KIND_LABELS[entry.kind]}</span>
              <p className="experience-body">{entry.body}</p>
              <p className="experience-byline">
                {entry.memberName} · {formatDate(entry.createdAt)}
              </p>
              {(entry.memberId === userId || ownerId === userId || canManage) && (
                <button
                  className="connection-remove"
                  aria-label={`Remove ${entry.memberName}'s note`}
                  onClick={() => onRemove(entry.id).catch(onError)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && !adding && (
        <button className="btn btn-ghost" onClick={() => setAdding(true)}>
          {written.length === 0 ? "Share your experience" : "+ Add your experience"}
        </button>
      )}
      {form}
    </div>
  );
}
