import { useState } from "react";
import type { Invite, NewInvite } from "../api";
import { itemLink } from "../router";
import { ErrorLine, Modal } from "./shared";
import { InstallButton } from "./InstallPrompt";

/** One person the member is inviting. Both fields are optional — a link works bare. */
interface Contact {
  name: string;
  email: string;
}

function blankContact(): Contact {
  return { name: "", email: "" };
}

/**
 * How many people one trip through the form may invite. The server keeps 30
 * invites waiting per member, so this stays well under it and a slip of the
 * finger cannot spend the whole allowance at once.
 */
const MAX_CONTACTS_AT_ONCE = 10;

/**
 * Two steps: say who the invites are for, then send the links. The link is the
 * whole invitation — the group has no directory of email addresses, so a member
 * passes each one on however they normally talk to that friend. An invite is
 * single use and belongs to one person, so inviting three people is three links
 * rather than one shared around, which is what "+ Add contact" makes.
 */
export function InviteModal({
  onClose,
  onCreate,
  inviterName,
}: {
  onClose: () => void;
  onCreate: (input: NewInvite) => Promise<Invite>;
  inviterName: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>([blankContact()]);
  const [note, setNote] = useState("");
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** A row nobody typed in is not a person, so it asks for no link. */
  const named = contacts.filter(
    (contact) => contact.name.trim() !== "" || contact.email.trim() !== "",
  );

  function change(index: number, changes: Partial<Contact>) {
    setContacts((prev) =>
      prev.map((contact, at) => (at === index ? { ...contact, ...changes } : contact)),
    );
  }

  function drop(index: number) {
    setContacts((prev) =>
      prev.length === 1 ? [blankContact()] : prev.filter((_, at) => at !== index),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // An empty form still makes one link — a member who just wants a link to hand
    // out has always been able to.
    const wanted = named.length > 0 ? named : [blankContact()];
    const made: Invite[] = [];
    try {
      for (const contact of wanted) {
        made.push(
          await onCreate({
            inviteeName: contact.name.trim(),
            inviteeEmail: contact.email.trim(),
            note,
          }),
        );
      }
      setInvites(made);
    } catch (err) {
      // Whatever links were made are real invites already, so they are shown
      // rather than thrown away — the message says which ones did not happen.
      setError(err instanceof Error ? err.message : "Could not create that invite.");
      if (made.length > 0) setInvites(made);
    } finally {
      setBusy(false);
    }
  }

  if (invites) {
    const first = invites[0];
    return (
      <Modal
        eyebrow={invites.length === 1 ? "Invite ready" : `${invites.length} invites ready`}
        title={
          invites.length === 1
            ? `Send it to ${first.inviteeName ?? "your friend"}`
            : "Send each person their own link"
        }
        onClose={onClose}
      >
        <ErrorLine message={error} />
        {invites.map((invite, index) => (
          <div className="invite-result" key={invite.token}>
            {invites.length > 1 && (
              <p className="invite-result-name">{invite.inviteeName ?? "Your friend"}</p>
            )}
            <InviteShare
              invite={invite}
              inviterName={inviterName}
              showInstall={index === 0}
            />
          </div>
        ))}
        <p className="card-meta">
          {invites.length === 1
            ? "When they open the link they will see that you invited them, and once they join, a welcome lands in their notifications — and yours tells you they arrived."
            : "Each link belongs to one person and works once, so give everybody their own. As each of them joins, a welcome lands in their notifications — and yours tells you they arrived."}
          {first.circle && ` They also land in ${first.circle.icon} ${first.circle.name}.`}
        </p>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </Modal>
    );
  }

  return (
    <Modal eyebrow="Invite a friend" title="Bring someone into the group" onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit}>
        {contacts.map((contact, index) => (
          <fieldset className="field invite-contact" key={index}>
            <legend>
              {contacts.length === 1 ? "Who is it for?" : `Contact ${index + 1}`}
              {contacts.length > 1 && (
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => drop(index)}
                  aria-label={`Remove contact ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </legend>
            <label className="field">
              <span>Their name</span>
              <input
                value={contact.name}
                onChange={(e) => change(index, { name: e.target.value })}
              />
              <span className="field-hint">Only so you can tell your invites apart.</span>
            </label>
            <label className="field">
              <span>Their email (optional)</span>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => change(index, { email: e.target.value })}
              />
              <span className="field-hint">
                Fills in the email option on the next step. Nobody else in the group sees it.
              </span>
            </label>
          </fieldset>
        ))}

        {contacts.length < MAX_CONTACTS_AT_ONCE ? (
          <button
            type="button"
            className="btn-text"
            onClick={() => setContacts((prev) => [...prev, blankContact()])}
          >
            + Add contact
          </button>
        ) : (
          <p className="field-hint">
            {MAX_CONTACTS_AT_ONCE} people at a time. Send these, then invite the rest.
          </p>
        )}

        <label className="field">
          <span>A line from you (optional)</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {named.length > 1 && (
            <span className="field-hint">Everybody you are inviting gets this same line.</span>
          )}
        </label>
        <ErrorLine message={error} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy
            ? "Making the links…"
            : named.length > 1
              ? `Create ${named.length} invite links`
              : "Create invite link"}
        </button>
      </form>
    </Modal>
  );
}

/**
 * The share row, reused by the Profile tab for invites that are still waiting.
 * `showInstall` is off for all but the first of a batch, since one row of links
 * does not need five copies of the same install button under it.
 */
export function InviteShare({
  invite,
  inviterName,
  showInstall = true,
}: {
  invite: Invite;
  inviterName: string;
  showInstall?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = itemLink("join", invite.token);
  const message = [
    invite.circle
      ? `${inviterName} invited you to ${invite.circle.icon} ${invite.circle.name} on Share & Learn — our room for songs, recipes, books, words and things worth knowing.`
      : `${inviterName} invited you to Share & Learn — our room for songs, recipes, books, words and things worth knowing.`,
    invite.note ? `“${invite.note}”` : null,
    `Join here: ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function shareSheet() {
    if (!navigator.share) {
      copy();
      return;
    }
    try {
      await navigator.share({ title: "Share & Learn", text: message, url });
    } catch {
      // The share sheet was dismissed — nothing to report.
    }
  }

  const mailto = `mailto:${invite.inviteeEmail ?? ""}?subject=${encodeURIComponent(
    `${inviterName} invited you to Share & Learn`,
  )}&body=${encodeURIComponent(message)}`;

  return (
    <div className="invite-share">
      <p className="invite-link" title={url}>
        {url}
      </p>
      <div className="invite-share-actions">
        <button className="chip-button chip-strong" onClick={shareSheet}>
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
        <a className="chip-button" href={mailto}>
          Email
        </a>
        <a className="chip-button" href={`sms:?&body=${encodeURIComponent(message)}`}>
          Message
        </a>
      </div>
      {showInstall && <InstallButton label="Install the app yourself" className="btn-text" />}
    </div>
  );
}
