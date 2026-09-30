// src/components/MoveToFolder.tsx
// Moving something already shared into one of its circle's folders — the other
// half of folders, and the half that was missing.
//
// A share names its folder on the form that made it, which is fine for everything
// shared since the folder existed and no answer at all for everything shared
// before it: a member who tidies a circle into Recipes, Books and Home remedies
// afterwards had no way to put the existing shares in them. So this is the
// "Move to folder" the line under a share already promised — on the share itself
// rather than buried in an edit form, because moving something is not the same
// act as rewriting it, and a member who wants one very rarely wants the other.
//
// Three things about it are deliberate:
//
//   * It carries `folderId` and nothing else, so it cannot touch the words, the
//     photos, the pictures, the shelf or who the share went to. Every per-item
//     route fills the rest in from the row that is already there.
//   * It is drawn for whoever may manage the share — its author, a keeper of one
//     of its circles, or the app admin — which is the same answer the server
//     gives, so the button and the rule agree.
//   * It decides for itself whether to exist, like `ManageFieldsButton` does, so
//     a listing that wants it is one line and a circle with no folders yet sees
//     no button rather than an empty picker.
import { useState } from "react";
import type { CircleFiling, ItemType } from "../api";
import { folderIn, folderOptions, visibleFolders } from "../folders";
import { canManageShare } from "../manage";
import type { ShareAndLearn } from "../store";
import { IconButton } from "./Icons";
import { Modal } from "./shared";

/** What the picker needs to know about the thing being moved. */
export interface MovableShare {
  itemType: ItemType;
  id: number;
  title: string;
  memberId: string;
  memberName: string;
  /** The circles it reaches, which is what `canManageShare` reads. */
  circleIds?: number[] | null;
  /** Where it sits in each of them, which is what the picker opens on. */
  filings?: CircleFiling[];
}

/** The name of one folder, indented by how deep it sits, for a flat `<select>`. */
function optionLabel(path: string[], depth: number) {
  const name = path[path.length - 1] ?? "";
  return `${"\u00a0\u00a0".repeat(Math.max(0, depth - 1))}${name}`;
}

/**
 * The button and the dialog behind it. Answers null when there is nothing to
 * offer — a reader who may not manage this share, or a circle with no folders —
 * so every caller is one line and nothing has to work out the permission twice.
 */
export function MoveToFolderButton({
  store,
  userId,
  circleId,
  item,
  onMoved,
  onError,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle the share is being filed in, since a folder belongs to one. */
  circleId: number;
  item: MovableShare;
  onMoved?: () => void;
  onError?: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const folders = visibleFolders(store.circleFolders[circleId] ?? []);
  if (!canManageShare(store, userId, item)) return null;
  if (folders.length === 0) return null;
  return (
    <>
      <IconButton
        icon="folder"
        label={`Move ${item.title} to a folder`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      />
      {open && (
        <MoveToFolderModal
          store={store}
          circleId={circleId}
          item={item}
          onClose={() => setOpen(false)}
          onMoved={() => {
            setOpen(false);
            onMoved?.();
          }}
          onError={onError}
        />
      )}
    </>
  );
}

/**
 * The dialog itself: where the share is now, everywhere in this circle it could
 * go instead, and one button. "Top of the circle" is a real answer rather than a
 * placeholder — it is what a share filed nowhere already says, and the way back
 * out of a folder somebody put something in by mistake.
 */
export function MoveToFolderModal({
  store,
  circleId,
  item,
  onClose,
  onMoved,
  onError,
}: {
  store: ShareAndLearn;
  circleId: number;
  item: MovableShare;
  onClose: () => void;
  onMoved: () => void;
  onError?: (message: string | null) => void;
}) {
  const folders = visibleFolders(store.circleFolders[circleId] ?? []);
  const current = folderIn(item, circleId);
  const [chosen, setChosen] = useState<number | null>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = folders.find((folder) => folder.id === current) ?? null;

  async function move() {
    setBusy(true);
    setError(null);
    onError?.(null);
    try {
      await store.moveToFolder(item.itemType, item.id, chosen, circleId);
      onMoved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "That could not be moved.";
      // Said on the dialog rather than only on the page behind it, since the
      // dialog stays open: a refusal the member cannot see is a button that
      // looks broken.
      setError(message);
      onError?.(message);
      setBusy(false);
    }
  }

  return (
    <Modal eyebrow="Move" title="Move to a folder" onClose={onClose} busy={busy}>
      <p className="form-note">
        {here
          ? `“${item.title}” is in ${here.path.join(" › ")}.`
          : `“${item.title}” sits at the top of the circle.`}{" "}
        Moving it changes where it is read and nothing else — the words, the
        pictures and who it was shared with all stay as they are.
      </p>

      <label className="field">
        <span className="field-label">Where should it go?</span>
        <select
          value={chosen === null ? "" : String(chosen)}
          onChange={(event) =>
            setChosen(event.target.value === "" ? null : Number(event.target.value))
          }
          disabled={busy}
        >
          <option value="">Top of the circle</option>
          {folderOptions(folders).map((option) => (
            <option key={option.id ?? "top"} value={option.id === null ? "" : String(option.id)}>
              {optionLabel(option.path, option.depth)}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="modal-actions">
        <button className="btn-text" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-primary" onClick={move} disabled={busy || chosen === current}>
          {busy ? "Moving…" : "Move it"}
        </button>
      </div>
    </Modal>
  );
}
