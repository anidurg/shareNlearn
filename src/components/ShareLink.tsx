// src/components/ShareLink.tsx
// Handing one item to somebody, which is not the same thing as inviting them.
//
// "Invite a friend" says *come and join this circle*, and is still exactly where
// it was. This says *I thought you would like this particular thing*, and the
// difference shows in what the link opens: an invite lands on a door, and a share
// lands on the item itself — readable, listenable, whole — with the circle
// offered underneath it afterwards. The content is the invitation.
//
// Two things it deliberately does not do. It does not copy the address bar: the
// route a member is standing on carries their own circle and folder context and
// answers nothing at all to somebody without an account, so the link is minted
// (`POST /api/shares`) and is a token that names one item. And it does not hide
// behind an icon: the chip says "Share" beside the glyph, because a bare arrow on
// a card already carrying a bookmark, a menu and a folder is one more thing to
// guess at.

import { useEffect, useState } from "react";
import {
  createItemShare,
  type ItemType,
} from "../api";
import { sharedItemLink } from "../router";
import { Icon } from "./Icons";
import { ErrorLine, Modal } from "./shared";

/**
 * What the sheet calls the thing being handed over. The heading names the kind so
 * a recipient's "what am I being sent?" is answered before the link is read, and
 * a category a circle invented has no built-in word for itself, so a post falls
 * back to the plain one.
 */
const KIND_WORDS: Record<ItemType, string> = {
  song: "song",
  recipe: "recipe",
  fact: "fun fact",
  word: "word",
  book: "book",
  remedy: "remedy",
  bookmark: "bookmark",
  post: "post",
};

/**
 * The worded chip that sits on a card immediately after its primary action.
 *
 * `blurb` is the sentence that travels in a message, which each surface writes
 * for itself — "Anita shared a recipe for Genasina Holige on Share & Learn" reads
 * better than anything this component could assemble from an item it does not
 * know the shape of. `circleId` says which of the item's audiences the link
 * speaks for, and is what the recipient is offered at the end of it; leaving it
 * out lets the server pick one the sharer is actually in.
 */
export function ShareLinkButton({
  itemType,
  itemId,
  name,
  blurb,
  circleId,
  kindWord,
}: {
  itemType: ItemType;
  itemId: number;
  name: string;
  blurb: string;
  circleId?: number | null;
  kindWord?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="chip-button" onClick={() => setOpen(true)}>
        <Icon name="share" /> Share
      </button>
      {open && (
        <ShareLinkModal
          itemType={itemType}
          itemId={itemId}
          name={name}
          blurb={blurb}
          circleId={circleId}
          kindWord={kindWord}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The sheet itself: one link and the four ways of passing it on.
 *
 * The link is minted as the sheet opens rather than when a button on it is
 * pressed, because every one of those buttons needs the address in hand — the
 * native sheet, the clipboard, and the three `href`s, which cannot wait on a
 * promise. Asking twice for the same item answers the same token, so opening and
 * closing this leaves no trail of dead links behind it.
 */
export function ShareLinkModal({
  itemType,
  itemId,
  name,
  blurb,
  circleId,
  kindWord,
  onClose,
}: {
  itemType: ItemType;
  itemId: number;
  name: string;
  blurb: string;
  circleId?: number | null;
  kindWord?: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    createItemShare(itemType, itemId, circleId)
      .then((minted) => {
        if (live) setToken(minted);
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [itemType, itemId, circleId]);

  const word = kindWord ?? KIND_WORDS[itemType];
  const url = token === null ? "" : sharedItemLink(token);
  const message = [blurb, `Have a look: ${url}`].join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  /* The native sheet where the device has one — which on a phone is the whole
     point, since that is where WhatsApp and Messages actually live — and the
     clipboard where it does not. A dismissed sheet is not a failure and says
     nothing. */
  async function nativeShare() {
    if (!navigator.share) {
      copy();
      return;
    }
    try {
      await navigator.share({ title: name, text: message, url });
    } catch {
      // The share sheet was dismissed — nothing to report.
    }
  }

  return (
    <Modal eyebrow="Pass it on" title={`Share this ${word}`} onClose={onClose}>
      <p className="share-item-name">{name}</p>
      <p className="field-hint">
        This link opens this one {word} and nothing else in the circle, and offers the circle
        itself underneath it. Whoever you send it to reads it straight away with no account
        needed — unless the circle is invite only, where they are told what you sent and asked
        for an invitation before they can read it.
      </p>
      <ErrorLine message={error} />
      {token === null && error === null && <p className="muted">Making the link…</p>}
      {token !== null && (
        <div className="invite-share">
          <p className="invite-link" title={url}>
            {url}
          </p>
          <div className="invite-share-actions">
            <button className="chip-button chip-strong" onClick={nativeShare}>
              Share
            </button>
            <button className="chip-button" onClick={copy}>
              {copied ? "✓ Copied" : "Copy link"}
            </button>
            <a
              className="chip-button"
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a
              className="chip-button"
              href={`mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(
                message,
              )}`}
            >
              Email
            </a>
            <a className="chip-button" href={`sms:?&body=${encodeURIComponent(message)}`}>
              Messages
            </a>
          </div>
        </div>
      )}
    </Modal>
  );
}
