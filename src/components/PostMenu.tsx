// src/components/PostMenu.tsx
// The ⋮ on a post, which is where a member deals with something they would rather
// not have read. Three things live behind it and they are deliberately different
// from one another:
//
//   Report      — tells the circle's admins, changes nothing on screen.
//   Hide        — this reader's own view, silent, reversible from Profile.
//   Block user  — mutual and silent, and everything that member wrote goes at once.
//
// None of them deletes anybody's work. Deleting is the author's own button, and it
// is somewhere else entirely.
import { useEffect, useRef, useState } from "react";
import { REPORT_REASONS, type ItemType, type ReportReason } from "../api";
import { Modal } from "./shared";

export interface PostMenuProps {
  itemType: ItemType;
  itemId: number;
  /** Who shared it, so "Block user" knows whom, and so a member's own post opts out. */
  memberId: string;
  memberName: string;
  /** The signed-in member, or null: an anonymous reader gets no menu at all. */
  viewerId: string | null;
  /** The circle it was read in, which is who a report goes to. */
  circleId?: number | null;
  onReport: (input: {
    itemType: ItemType;
    itemId: number;
    reason: ReportReason;
    details?: string;
    circleId?: number | null;
  }) => Promise<unknown>;
  onHide: (itemType: ItemType, itemId: number) => Promise<void>;
  onBlock: (memberId: string, memberName: string) => Promise<void>;
}

/**
 * The menu itself. Answers null for the reader's own post and for anybody not
 * signed in, because there is nothing on it either of them can use.
 */
export function PostMenu({
  itemType,
  itemId,
  memberId,
  memberName,
  viewerId,
  circleId = null,
  onReport,
  onHide,
  onBlock,
}: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);

  // A menu that stays open after the tap that opened something else is a menu in
  // the way, so a click anywhere outside it and Escape both close it.
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!viewerId || viewerId === memberId) return null;

  async function hide() {
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      await onHide(itemType, itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hide that.");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    setError(null);
    try {
      await onBlock(memberId, memberName);
      setConfirmBlock(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block that member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="post-menu" ref={wrapper}>
      <button
        className="post-menu-button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${memberName}'s post`}
        disabled={busy}
      >
        ⋮
      </button>

      {open && (
        <span className="post-menu-list" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setReporting(true);
            }}
          >
            🚩 Report
          </button>
          <button role="menuitem" onClick={hide}>
            🙈 Hide
          </button>
          <button
            role="menuitem"
            className="post-menu-danger"
            onClick={() => {
              setOpen(false);
              setConfirmBlock(true);
            }}
          >
            🚫 Block user
          </button>
        </span>
      )}

      {note && <span className="post-menu-note">{note}</span>}
      {error && <span className="post-menu-note post-menu-error">{error}</span>}

      {reporting && (
        <ReportDialog
          memberName={memberName}
          onClose={() => setReporting(false)}
          onSubmit={async (reason, details) => {
            await onReport({ itemType, itemId, reason, details, circleId });
            setReporting(false);
            setNote("Reported. The circle's admins will take a look.");
            setTimeout(() => setNote(null), 6000);
          }}
        />
      )}

      {confirmBlock && (
        <Modal
          eyebrow="Block"
          title={`Block ${memberName}?`}
          onClose={() => setConfirmBlock(false)}
          busy={busy}
        >
          <p className="form-note">
            You stop seeing what {memberName} shares and writes, and they stop seeing yours.
            Nothing is deleted, they are not told, and you can undo this from your profile at
            any time.
          </p>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button className="btn-text" onClick={() => setConfirmBlock(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary btn-danger" onClick={block} disabled={busy}>
              {busy ? "Blocking…" : `Block ${memberName}`}
            </button>
          </div>
        </Modal>
      )}
    </span>
  );
}

/**
 * The three store actions the menu needs, named as a shape of their own so a
 * surface can hand over the store it already has instead of wiring three props.
 */
export interface PostMenuActions {
  reportPost: PostMenuProps["onReport"];
  hidePost: PostMenuProps["onHide"];
  blockPerson: (memberId: string, memberName?: string | null) => Promise<void>;
}

/**
 * The menu as every listing wants it: the store, the reader, and the thing being
 * read. Saves each tab from repeating the same three handlers.
 */
export function PostActions({
  store,
  userId,
  itemType,
  item,
  circleId = null,
}: {
  store: PostMenuActions;
  userId: string | null;
  itemType: ItemType;
  item: { id: number; memberId: string; memberName: string };
  circleId?: number | null;
}) {
  return (
    <PostMenu
      itemType={itemType}
      itemId={item.id}
      memberId={item.memberId}
      memberName={item.memberName}
      viewerId={userId}
      circleId={circleId}
      onReport={store.reportPost}
      onHide={store.hidePost}
      onBlock={store.blockPerson}
    />
  );
}

/** Why it is being reported, and anything the reporter wants the admins to know. */
function ReportDialog({
  memberName,
  onClose,
  onSubmit,
}: {
  memberName: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason, details.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that report.");
      setBusy(false);
    }
  }

  return (
    <Modal eyebrow="Report" title="Tell the circle's admins" onClose={onClose} busy={busy}>
      <p className="form-note">
        This goes to whoever moderates the circle you read it in — not to {memberName}. They
        decide whether it stays.
      </p>

      <fieldset className="report-reasons">
        <legend className="field-label">What is wrong with it?</legend>
        {REPORT_REASONS.map((option) => (
          <label key={option.value} className="radio-row">
            <input
              type="radio"
              name="report-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span className="field-label">Anything to add? (optional)</span>
        <textarea
          rows={3}
          value={details}
          maxLength={1000}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="What the admins should know."
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn-text" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </Modal>
  );
}
