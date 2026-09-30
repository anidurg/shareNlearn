import { useEffect, useRef, useState } from "react";
import type { User } from "@netlify/identity";
import {
  formatBytes,
  formatDate,
  type AppRole,
  type CircleRoll,
  type CircleRollEntry,
  type Invite,
  type LyricScript,
  type MemberBlocks,
  type MemberRecord,
  type OrphanReport,
  type OrphanStore,
  type UsageReport,
} from "../api";
import type { TabName } from "../router";
import type { ShareAndLearn } from "../store";
import { EmptyState, ErrorLine, SearchField, TabHeader } from "./shared";
import { AccountSettings } from "./AccountSettings";
import { logoutUser } from "./Auth";
import { MyCircles } from "./CircleSwitcher";
import { GuidelinesList } from "./Guidelines";
import { InstallCard } from "./InstallPrompt";
import { InviteShare } from "./InviteModal";
import { ScriptPicker } from "./ScriptPicker";

export function ProfileTab({
  store,
  user,
  currentCircleId,
  onSwitchCircle,
  onOpenCircle,
  onOpenCircles,
  onStartCircle,
  onNeedsLogin,
  onNavigate,
  onInviteFriend,
}: {
  store: ShareAndLearn;
  user: User | null;
  /** The circle in view, so this list can mark it and move it. */
  currentCircleId: number | null;
  onSwitchCircle: (circleId: number) => void;
  onOpenCircle: (circleId: number) => void;
  onOpenCircles: () => void;
  onStartCircle: () => void;
  onNeedsLogin: () => void;
  onNavigate: (tab: TabName) => void;
  onInviteFriend: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <>
        <TabHeader title="Profile" />
        <EmptyState glyph="☺" title="You are not logged in">
          <button className="btn-text" onClick={onNeedsLogin}>
            Log in
          </button>{" "}
          to share, save, and keep track of what you have added.
        </EmptyState>
      </>
    );
  }

  const mine = {
    songs: store.songs.filter((item) => item.memberId === user.id).length,
    recipes: store.recipes.filter((item) => item.memberId === user.id).length,
    facts: store.facts.filter((item) => item.memberId === user.id).length,
    words: store.words.filter((item) => item.memberId === user.id).length,
    books: store.books.filter((item) => item.memberId === user.id).length,
    remedies: store.remedies.filter((item) => item.memberId === user.id).length,
  };
  const shared =
    mine.songs + mine.recipes + mine.facts + mine.words + mine.books + mine.remedies;

  async function handleLogout() {
    setBusy(true);
    setError(null);
    try {
      await logoutUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out.");
      setBusy(false);
    }
  }

  return (
    <>
      <TabHeader title="Profile" subtitle="Your account and what you have added so far." />

      <section className="profile-card">
        <p className="profile-avatar" aria-hidden="true">
          {(user.name || user.email || "?").trim().charAt(0).toUpperCase()}
        </p>
        <div className="profile-details">
          <h2 className="profile-name">{user.name || "Member"}</h2>
          {user.email && <p className="card-meta">{user.email}</p>}
          {user.createdAt && <p className="card-meta">Member since {formatDate(user.createdAt)}</p>}
          <StandingTags store={store} />
          {/* The login itself, changed where the login is read. Identity owns both
              halves of it, so this is the one part of Profile that talks to
              Identity rather than to the app's own API. */}
          <AccountSettings user={user} />
        </div>
      </section>

      <MyCircles
        circles={store.circles}
        circleId={currentCircleId}
        categoriesByCircle={store.categoriesByCircle}
        onChoose={onSwitchCircle}
        onOpen={onOpenCircle}
        onStartCircle={onStartCircle}
        onOpenCircles={onOpenCircles}
      />

      <section className="home-section">
        <h2 className="section-title">Your contributions</h2>
        <div className="stat-grid">
          <Stat label="Songs" value={mine.songs} onClick={() => onNavigate("songs")} />
          <Stat label="Recipes" value={mine.recipes} onClick={() => onNavigate("recipes")} />
          <Stat label="Fun facts" value={mine.facts} onClick={() => onNavigate("learn")} />
          <Stat label="Words" value={mine.words} onClick={() => onNavigate("learn")} />
          <Stat label="Books" value={mine.books} onClick={() => onNavigate("books")} />
          <Stat label="Remedies" value={mine.remedies} onClick={() => onNavigate("remedies")} />
        </div>
        <p className="card-meta">
          {shared === 0
            ? "You have not shared anything yet — the group is waiting."
            : `${shared} ${shared === 1 ? "thing" : "things"} shared in total.`}
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">Your library</h2>
        <div className="stat-grid">
          <Stat label="Saved items" value={store.saves.length} onClick={() => onNavigate("library")} />
          <Stat
            label="Words learned"
            value={store.learnedWordIds.size}
            onClick={() => onNavigate("learn")}
          />
        </div>
        <p className="card-meta">
          Removing something from your library never removes it for anyone else. Only the member who
          shared an item can delete it for everyone.
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">Friends you invited</h2>
        <p className="card-meta">
          An invite is a link only you have. Send it however you like — whoever opens it can create
          an account and join the group, and you both get a notification when they do.
        </p>
        <button className="btn btn-primary" onClick={onInviteFriend}>
          Invite a friend
        </button>
        <InviteList
          invites={store.invites}
          inviterName={user.name || user.email || "A member"}
          onRevoke={async (token) => {
            setError(null);
            try {
              await store.cancelInvite(token);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not withdraw that invite.");
            }
          }}
        />
      </section>

      <section className="home-section">
        <h2 className="section-title">Community Guidelines</h2>
        {/* Agreed to once before the first share, and readable ever after — the
            three lines are what the group asks of everybody, not fine print. */}
        <GuidelinesList />
        <p className="muted">
          {store.access.acceptedGuidelines
            ? "You agreed to these."
            : "You will be asked to agree to these before your first share."}
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-title">The app on this device</h2>
        <InstallCard />
      </section>

      <QuietList store={store} onError={setError} />
      <SongScriptsPanel store={store} onError={setError} />
      <AppAdminPanel store={store} userId={user.id} onError={setError} />
      <AdminCirclesPanel store={store} onError={setError} />
      <AdminOrphansPanel store={store} onError={setError} />
      <AdminUsagePanel store={store} onError={setError} />

      <ErrorLine message={error} />
      <button className="btn btn-ghost" onClick={handleLogout} disabled={busy}>
        {busy ? "Logging out…" : "Log out"}
      </button>
    </>
  );
}

/** Pending invites keep their share row; accepted and withdrawn ones are just history. */
function InviteList({
  invites,
  inviterName,
  onRevoke,
}: {
  invites: Invite[];
  inviterName: string;
  onRevoke: (token: string) => void;
}) {
  if (invites.length === 0) {
    return (
      <p className="card-meta">
        You have not invited anyone yet. The group is more fun with one more person in it.
      </p>
    );
  }

  return (
    <ul className="invite-list">
      {invites.map((invite) => (
        <li key={invite.token} className="invite-row">
          <div className="invite-row-head">
            <p className="invite-who">
              {invite.inviteeName ?? invite.inviteeEmail ?? "Invite link"}
            </p>
            <span className={`tag invite-tag-${invite.status}`}>
              {invite.status === "pending"
                ? "Waiting"
                : invite.status === "accepted"
                  ? "Joined"
                  : "Withdrawn"}
            </span>
          </div>
          <p className="card-meta">
            {invite.status === "accepted" && invite.acceptedAt
              ? `${invite.acceptedMemberName ?? "They"} joined on ${formatDate(invite.acceptedAt)}`
              : `Created ${formatDate(invite.createdAt)}`}
            {/* A link made from a circle says so, since it does more than join the group. */}
            {invite.circle && ` · into ${invite.circle.icon} ${invite.circle.name}`}
          </p>
          {invite.status === "pending" && (
            <>
              <InviteShare invite={invite} inviterName={inviterName} />
              <button className="btn-text" onClick={() => onRevoke(invite.token)}>
                Withdraw this invite
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button className="stat" onClick={onClick}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}

/**
 * Where this account stands. Worth saying out loud rather than only enforcing,
 * because "you cannot start a circle yet" is a great deal easier to live with when
 * it comes with the reason and the date it stops being true.
 *
 * It reads the standing again on the way in, because this is the screen somebody
 * comes to *after* being told an admin has approved them — and the answer the app
 * has been holding since startup was taken before that happened.
 */
function StandingTags({ store }: { store: ShareAndLearn }) {
  const { access } = store;
  const { loadAccess } = store;
  useEffect(() => {
    loadAccess();
  }, [loadAccess]);
  if (!store.accessLoaded) return null;
  return (
    <p className="standing-tags">
      {access.role === "app_admin" && <span className="tag tag-done">App admin</span>}
      {/* Worth a tag of its own rather than nothing, because the one thing being an
          App Manager does is put a panel on this page and a member who was named
          one should be able to see that they were. */}
      {access.role === "app_manager" && <span className="tag tag-done">App manager</span>}
      {access.suspended ? (
        <span className="tag tag-warn">Suspended</span>
      ) : access.canCreateCircle ? (
        <span className="tag tag-done">Can start circles</span>
      ) : (
        <span className="tag">
          {access.circleCount === 0
            ? "Join a circle to start your own"
            : access.trustedInDays > 0
              ? `Join a circle, or start your own in ${access.trustedInDays} ${
                  access.trustedInDays === 1 ? "day" : "days"
                }`
              : "Ask an admin to vouch for your account"}
        </span>
      )}
    </p>
  );
}

/**
 * The two things a member does for themselves and tells nobody: posts they hid,
 * and members they blocked. Both are undone from here, because a decision with no
 * way back is a decision people are afraid to make.
 */
function QuietList({
  store,
  onError,
}: {
  store: ShareAndLearn;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: Promise<unknown>) {
    setBusy(key);
    onError(null);
    try {
      await action;
    } catch (err) {
      onError(err instanceof Error ? err.message : "That could not be undone.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="home-section">
      <h2 className="section-title">Hidden and blocked</h2>
      <p className="card-meta">
        Hiding and blocking are yours alone. Nothing is deleted, nobody is told, and both can be
        undone here.
      </p>

      <h3 className="subsection-title">Posts you hid ({store.hidden.length})</h3>
      {store.hidden.length === 0 ? (
        <p className="muted">Nothing hidden. The ⋮ on a post is where you hide one.</p>
      ) : (
        <ul className="quiet-list">
          {store.hidden.map((row) => (
            <li className="quiet-row" key={`${row.itemType}:${row.itemId}`}>
              <span>A {row.itemType} you hid</span>
              <button
                className="chip-button"
                disabled={busy === `hidden:${row.itemType}:${row.itemId}`}
                onClick={() =>
                  run(
                    `hidden:${row.itemType}:${row.itemId}`,
                    store.unhidePost(row.itemType, row.itemId),
                  )
                }
              >
                {busy === `hidden:${row.itemType}:${row.itemId}` ? "Showing…" : "Show it again"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="subsection-title">Members you blocked ({store.blocked.length})</h3>
      {store.blocked.length === 0 ? (
        <p className="muted">Nobody blocked.</p>
      ) : (
        <ul className="quiet-list">
          {store.blocked.map((row) => (
            <li className="quiet-row" key={row.memberId}>
              <span>
                {row.memberName ?? "A member"} · blocked {formatDate(row.createdAt)}
              </span>
              <button
                className="chip-button"
                disabled={busy === `block:${row.memberId}`}
                onClick={() => run(`block:${row.memberId}`, store.unblockPerson(row.memberId))}
              >
                {busy === `block:${row.memberId}` ? "Unblocking…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The global admin's panel, which exists for abuse and technical support and
 * nothing else — so it holds only the levers those two situations need: vouch for
 * an account so it can start circles, stop one that is causing harm, and hand the
 * role itself on. It is not a moderation queue: a circle moderates its own posts.
 */
function AppAdminPanel({
  store,
  userId,
  onError,
}: {
  store: ShareAndLearn;
  userId: string;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState<string | null>(null);

  if (store.access.role !== "app_admin") return null;

  const rows = store.directory.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function change(
    memberId: string,
    changes: { trusted?: boolean; status?: "active" | "suspended"; role?: AppRole },
  ) {
    setBusy(memberId);
    onError(null);
    try {
      await store.setMemberStanding(memberId, changes);
    } catch (err) {
      onError(err instanceof Error ? err.message : "That change did not go through.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="home-section admin-panel">
      <h2 className="section-title">
        App admin <span className="tag tag-warn">Exceptional use</span>
      </h2>
      <p className="card-meta">
        For abuse and technical support. Circles moderate their own posts, so nothing here removes
        anybody&apos;s work — it only changes what an account may do.
      </p>
      <SearchField value={query} onChange={setQuery} placeholder="Find a member" />
      <ul className="admin-list">
        {rows.map((row) => (
          <li className="admin-row" key={row.id}>
            <div>
              <p className="admin-name">
                {row.name}
                {row.role === "app_admin" && <span className="tag tag-done">App admin</span>}
                {row.role === "app_manager" && (
                  <span className="tag tag-done">App manager</span>
                )}
                {row.status === "suspended" && <span className="tag tag-warn">Suspended</span>}
                {row.trustedAt && <span className="tag">Trusted</span>}
                {row.id === userId && <span className="tag">You</span>}
              </p>
              <p className="card-meta">
                Joined {formatDate(row.createdAt)}
                {row.admittedAt ? "" : " · never admitted"}
                {row.lastSeenAt ? ` · last seen ${formatDate(row.lastSeenAt)}` : ""}
              </p>
            </div>
            {/* An admin cannot suspend or demote themselves, so the group is never left without one. */}
            <span className="owner-actions">
              <button
                className="chip-button"
                onClick={() => setLooking(looking === row.id ? null : row.id)}
              >
                {looking === row.id ? "Close" : "Who can see them?"}
              </button>
              {row.id !== userId && (
                <>
                  <button
                    className="chip-button"
                    disabled={busy === row.id}
                    onClick={() => change(row.id, { trusted: !row.trustedAt })}
                  >
                    {row.trustedAt ? "Withdraw trust" : "Vouch for them"}
                  </button>
                  <button
                    className={
                      row.status === "suspended" ? "chip-button" : "chip-button chip-danger"
                    }
                    disabled={busy === row.id}
                    onClick={() =>
                      change(row.id, {
                        status: row.status === "suspended" ? "active" : "suspended",
                      })
                    }
                  >
                    {row.status === "suspended" ? "Let them back in" : "Suspend"}
                  </button>
                  <button
                    className="chip-button"
                    disabled={busy === row.id}
                    onClick={() =>
                      change(row.id, { role: row.role === "app_admin" ? "member" : "app_admin" })
                    }
                  >
                    {row.role === "app_admin" ? "Take the role back" : "Make an app admin"}
                  </button>
                  {/* Not offered on an app admin's row, and that is the whole of how
                      the two buttons are kept from contradicting each other: an admin
                      already reads the report, so "make them an app manager" would be
                      a demotion wearing the words of a promotion. Standing down to a
                      manager is done by taking the role back and then naming them. */}
                  {row.role !== "app_admin" && (
                    <button
                      className="chip-button"
                      disabled={busy === row.id}
                      onClick={() =>
                        change(row.id, {
                          role: row.role === "app_manager" ? "member" : "app_manager",
                        })
                      }
                    >
                      {row.role === "app_manager"
                        ? "Take the report back"
                        : "Make an app manager"}
                    </button>
                  )}
                </>
              )}
            </span>
            {looking === row.id && (
              <MemberBlocksPanel
                store={store}
                member={row}
                onError={onError}
                key={`blocks:${row.id}`}
              />
            )}
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="muted">Nobody matches that.</p>}
    </section>
  );
}

/**
 * Why one member cannot see another, and the one lever that puts it right.
 *
 * Two members of the same group become invisible to each other for exactly two
 * reasons, and neither of them says anything on screen. A block is mutual and
 * silent — it was designed that way, so somebody who blocks is never argued with
 * and somebody who is blocked is never told — which is right until a block was a
 * mistap, at which point half the group's shares vanish for somebody with no
 * explanation and no way to undo a row they did not write. And a share only ever
 * reaches the circles it named, so two members in no circle together see nothing
 * of each other's however hard they look.
 *
 * So the panel answers both at once, and lifts a block from either side. Nothing
 * here deletes anything: a block is a preference, and lifting one restores what
 * was already there.
 */
function MemberBlocksPanel({
  store,
  member,
  onError,
}: {
  store: ShareAndLearn;
  member: MemberRecord;
  onError: (message: string | null) => void;
}) {
  const [blocks, setBlocks] = useState<MemberBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // The store is rebuilt on every render, so its actions are new functions each
  // time. Depending on one directly would re-run the read forever; a ref keeps
  // the latest without making it a dependency.
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    let live = true;
    setLoading(true);
    storeRef.current
      .memberBlocks(member.id)
      .then((answer) => {
        if (live) setBlocks(answer);
      })
      .catch((err: unknown) => {
        if (live) onError(err instanceof Error ? err.message : "Could not read that.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // onError is a setState from the page above and never changes identity in a
    // way that should re-read the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id]);

  async function lift(otherId: string) {
    setBusy(otherId);
    onError(null);
    try {
      setBlocks(await store.liftBlock(member.id, otherId));
    } catch (err) {
      onError(err instanceof Error ? err.message : "That block is still there.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="card-meta">Reading…</p>;
  if (!blocks) return null;

  const rows = [
    ...blocks.blocking.map((row) => ({ ...row, direction: "blocking" as const })),
    ...blocks.blockedBy.map((row) => ({ ...row, direction: "blockedBy" as const })),
  ];

  return (
    <div className="admin-detail">
      <p className="card-meta">
        {member.name} is in{" "}
        {blocks.circles.length === 0
          ? "no circle at all"
          : blocks.circles.map((circle) => `${circle.icon} ${circle.name}`).join(", ")}
        .
      </p>
      {blocks.outsideDefault && (
        <p className="card-meta warn-note">
          They are not in the circle everybody starts in, which is why what they share may not
          reach anybody. Opening the app again puts them back in it.
        </p>
      )}
      {blocks.uncircled.length > 0 && (
        <p className="card-meta warn-note">
          {blocks.uncircled.map((row) => `${row.total} ${row.itemType}`).join(", ")} of theirs
          name no circle. Those reach the whole group but appear on no circle&apos;s page, so they
          are found through search and the feed rather than through a category. Editing the share
          and ticking a circle puts it where people look.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="card-meta">No blocks either way — nothing here is hiding anything.</p>
      ) : (
        <ul className="quiet-list">
          {rows.map((row) => (
            <li key={`${row.direction}:${row.memberId}`} className="quiet-row">
              <span>
                {row.direction === "blocking"
                  ? `${member.name} blocked ${row.memberName ?? "a member"}`
                  : `${row.memberName ?? "A member"} blocked ${member.name}`}{" "}
                · {formatDate(row.createdAt)}
              </span>
              <button
                className="chip-button"
                disabled={busy === row.memberId}
                onClick={() => lift(row.memberId)}
              >
                {busy === row.memberId ? "Lifting…" : "Lift this block"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="card-meta">
        Whoever placed a block is told when it is lifted. The member it was placed on is not, since
        they were never told it existed.
      </p>
    </div>
  );
}

/**
 * Every circle in the group, for the one person who can see across all of them.
 *
 * This is not a way into what circles contain — a circle is moderated by its own
 * people, and nothing here reads a post. It exists for the two things nobody
 * inside a circle can do: closing one whose owner has gone, and repairing a
 * duplicated Discover.
 *
 * That second one is worth spelling out, because it is invisible from inside the
 * app and produces exactly the symptom that led here. Discover is created the
 * first time anybody needs it rather than by a migration, so two members arriving
 * at the same moment could each make one, and every check afterwards asks whether
 * a member is in *a* default circle rather than *the* one — so both were left
 * where they landed. Two circles with the same name and icon, different ids, and
 * the members of one unable to see a word the others wrote. Merging folds the
 * strays back in, keeping every share and every membership.
 */
function AdminCirclesPanel({
  store,
  onError,
}: {
  store: ShareAndLearn;
  onError: (message: string | null) => void;
}) {
  const [roll, setRoll] = useState<CircleRoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const isAppAdmin = store.access.role === "app_admin";
  // Same reason as the panel above: the store's actions are new functions each
  // render, so a ref is what keeps this read from repeating forever.
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    // Hooks run for everybody, so the check is here as well as in the early
    // return below: an ordinary member must not fire a request the server is
    // only ever going to refuse.
    if (!isAppAdmin) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    storeRef.current
      .circleRoll()
      .then((answer) => {
        if (live) setRoll(answer);
      })
      .catch((err: unknown) => {
        if (live) onError(err instanceof Error ? err.message : "Could not read the circles.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppAdmin, tick]);

  if (!isAppAdmin) return null;

  async function remove(circle: CircleRollEntry) {
    const sure = window.confirm(
      `Delete ${circle.icon} ${circle.name}? Its ${circle.memberCount} member${
        circle.memberCount === 1 ? "" : "s"
      } are told, and anything shared only into it becomes private to whoever wrote it. Nothing is deleted.`,
    );
    if (!sure) return;
    setBusy(`delete:${circle.id}`);
    onError(null);
    try {
      await store.removeCircle(circle.id);
      setNote(`${circle.name} is closed.`);
      setTick((count) => count + 1);
    } catch (err) {
      onError(err instanceof Error ? err.message : "That circle is still there.");
    } finally {
      setBusy(null);
    }
  }

  async function merge() {
    setBusy("merge");
    onError(null);
    try {
      const result = await store.mergeDefaultCircles();
      setRoll(result);
      setNote(
        `Folded ${result.merged} stray Discover ${
          result.merged === 1 ? "circle" : "circles"
        } back in: ${result.shares} share${result.shares === 1 ? "" : "s"} and ${
          result.members
        } membership${result.members === 1 ? "" : "s"} moved across.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Nothing was merged.");
    } finally {
      setBusy(null);
    }
  }

  const strays = roll?.duplicateDefaults ?? [];

  return (
    <section className="home-section admin-panel">
      <h2 className="section-title">Circles in the group</h2>
      <p className="card-meta">
        Circles look after themselves. This is for the two things they cannot: closing one nobody
        is left to close, and putting a duplicated Discover back together.
      </p>
      {strays.length > 0 && (
        <div className="admin-detail warn-note">
          <p>
            There {strays.length === 1 ? "is" : "are"} {strays.length} extra circle
            {strays.length === 1 ? "" : "s"} marked as the one everybody starts in. Members landed
            in different copies and cannot read each other&apos;s shares.
          </p>
          <button className="btn btn-primary" disabled={busy === "merge"} onClick={merge}>
            {busy === "merge" ? "Merging…" : "Fold them back into one"}
          </button>
        </div>
      )}
      {note && <p className="card-meta">{note}</p>}
      {loading ? (
        <p className="card-meta">Reading…</p>
      ) : (
        <ul className="admin-list">
          {(roll?.circles ?? []).map((circle) => (
            <li className="admin-row" key={circle.id}>
              <div>
                <p className="admin-name">
                  {circle.icon} {circle.name}
                  {circle.isDefault && (
                    <span className="tag tag-done">
                      {circle.id === roll?.defaultCircleId ? "Discover" : "Stray Discover"}
                    </span>
                  )}
                  <span className="tag">{PRIVACY_WORDS[circle.privacy] ?? circle.privacy}</span>
                </p>
                <p className="card-meta">
                  {circle.ownerId === "system" ? "The app" : circle.ownerName} · {circle.memberCount}{" "}
                  member{circle.memberCount === 1 ? "" : "s"} · {circle.shareCount} share
                  {circle.shareCount === 1 ? "" : "s"} · started {formatDate(circle.createdAt)}
                </p>
              </div>
              {/* Discover is the circle every account is joined to, so it is nobody's to delete. */}
              {!circle.isDefault && (
                <span className="owner-actions">
                  <button
                    className="chip-button chip-danger"
                    disabled={busy === `delete:${circle.id}`}
                    onClick={() => remove(circle)}
                  >
                    {busy === `delete:${circle.id}` ? "Closing…" : "Delete this circle"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The three doors a circle can have, in the words a member reads. */
const PRIVACY_WORDS: Record<string, string> = {
  private: "Private",
  discoverable: "Ask to Join",
  public: "Open to All",
};

/**
 * Which scripts the Songs category offers, decided once for the whole group.
 *
 * The list used to be five names in the code, which meant that a group who wanted
 * Malayalam wanted a deploy. It is a setting now, and this is where it is set: tick the
 * scripts this group actually reads and every song offers them that afternoon, on the
 * form the author fills in and under every recording already shared.
 *
 * Nothing here is written into a component. The catalogue is whatever the converter
 * knows, sent down beside the enabled list, so a script added to the tables is on this
 * panel the day it lands — which is the entire reason the enabled list is a row in the
 * database rather than an array in a file. Ticking a script never rewrites anybody's
 * lyrics: there is one original per song, and every script here is generated from it on
 * demand, so switching one on adds a link and switching it off takes the link away.
 */
function SongScriptsPanel({
  store,
  onError,
}: {
  store: ShareAndLearn;
  onError: (message: string | null) => void;
}) {
  const settings = store.songScripts;
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Read afresh whenever this page is opened, so an admin who changed it on their
  // laptop is not looking at what their phone remembered.
  useEffect(() => {
    store.loadSongScripts();
  }, [store.loadSongScripts]);

  // Every member reads this setting — the share form ticks it — but only the app admin
  // decides it, and a panel nobody can use is a panel nobody should see.
  if (!settings?.canEdit) return null;

  async function save(next: LyricScript[]) {
    setBusy(true);
    setSaved(false);
    onError(null);
    try {
      await store.saveSongScripts(next);
      setSaved(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : "That setting did not save.");
    } finally {
      setBusy(false);
    }
  }

  const isDefault =
    settings.scripts.length === settings.defaults.length &&
    settings.scripts.every((id) => settings.defaults.includes(id));

  return (
    <section className="home-section admin-panel">
      <h2 className="section-title">
        Scripts for songs <span className="tag">App admin</span>
      </h2>
      <p className="card-meta">
        The scripts a member can offer their lyrics in. Whoever shares a recording picks
        from these, and readers see a link for each one they picked — the words
        themselves are never copied or rewritten, only converted from the original when
        somebody asks.
      </p>

      <ScriptPicker
        options={settings.catalogue}
        chosen={settings.scripts}
        onChange={(next) => save(next as LyricScript[])}
        emptyNote="None switched on — songs are offered in no other script at all."
      />

      <p className="muted">
        {busy
          ? "Saving…"
          : saved
            ? "Saved. Every song offers these from now on."
            : isDefault
              ? "These are the defaults."
              : `${settings.scripts.length} of ${settings.catalogue.length} switched on.`}
      </p>
    </section>
  );
}

/**
 * The bytes nothing points at, listed so somebody can decide about them.
 *
 * Uploading a picture and saving the share it goes on are two requests, so a form
 * abandoned between them leaves a blob with no row that will ever name it. That
 * is the one part of storage that grows without anybody sharing anything, and
 * nothing in the app sweeps it up — deliberately, because the one fact that would
 * make a sweep safe is the one Netlify Blobs does not hand back. A listing
 * answers keys and etags: no sizes, and no dates. So a sweeper could not tell a
 * photo uploaded last month from one that is thirty seconds old and still on its
 * way to a save, and the difference between those two is somebody's share.
 *
 * An admin reading a list has exactly that context, which is why this is a report
 * with a delete on it rather than a scheduled job. Two consequences are visible
 * on screen and both are honest rather than tidy: the numbers count blobs and
 * never megabytes, since adding a store up would mean downloading it; and the
 * unfinished-uploads store is presented as the one nobody should be quick with,
 * an upload in flight looking exactly like one that stopped.
 *
 * Nothing here trusts the page it is drawn from. The keys travel as a selection
 * and the server works the orphan set out again before deleting one, so a tab
 * left open while somebody shared a recipe can only ever delete less than it
 * offered — which is what `skipped` in the answer is counting.
 */
function AdminOrphansPanel({
  store,
  onError,
}: {
  store: ShareAndLearn;
  onError: (message: string | null) => void;
}) {
  const [report, setReport] = useState<OrphanReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const isAppAdmin = store.access.role === "app_admin";
  // Same reason as the panels above: the store's actions are new functions on
  // every render, so a ref is what keeps this read from repeating forever.
  const storeRef = useRef(store);
  storeRef.current = store;

  // Reading this means listing five stores in full, which is the most expensive
  // read in the app and is of no interest to anybody who has not asked for it —
  // so unlike the other admin panels it waits to be opened rather than fetching
  // on mount.
  useEffect(() => {
    if (!isAppAdmin || !opened) return;
    let live = true;
    setLoading(true);
    storeRef.current
      .orphanBlobs()
      .then((answer) => {
        if (live) setReport(answer);
      })
      .catch((err: unknown) => {
        if (live) onError(err instanceof Error ? err.message : "Could not read the stores.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppAdmin, opened]);

  if (!isAppAdmin) return null;

  function toggle(storeId: string, key: string) {
    setPicked((prev) => {
      const chosen = prev[storeId] ?? [];
      return {
        ...prev,
        [storeId]: chosen.includes(key)
          ? chosen.filter((one) => one !== key)
          : [...chosen, key],
      };
    });
  }

  function tickAll(entry: OrphanStore, on: boolean) {
    setPicked((prev) => ({ ...prev, [entry.id]: on ? [...entry.orphans] : [] }));
  }

  async function remove(entry: OrphanStore) {
    const keys = picked[entry.id] ?? [];
    if (keys.length === 0) return;
    const sure = window.confirm(
      `Delete ${keys.length} ${keys.length === 1 ? "file" : "files"} from ${entry.label}? ` +
        "The bytes go for good. Anything a share has since started using is skipped rather than deleted.",
    );
    if (!sure) return;

    setBusy(entry.id);
    onError(null);
    setNote(null);
    try {
      const answer = await store.deleteOrphanBlobs(entry.id, keys);
      setReport({ stores: answer.stores, listLimit: answer.listLimit });
      setPicked((prev) => ({ ...prev, [entry.id]: [] }));
      setNote(
        `Deleted ${answer.deleted} of ${keys.length}.` +
          (answer.skipped > 0
            ? ` ${answer.skipped} ${answer.skipped === 1 ? "was" : "were"} left alone — in use, or already gone.`
            : ""),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Nothing was deleted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="home-section admin-panel">
      <h2 className="section-title">
        Files nothing points at <span className="tag">App admin</span>
      </h2>
      <p className="card-meta">
        A picture or a document is uploaded before the share it goes on is saved, so a form
        somebody closed halfway leaves bytes behind that no post will ever name. Nothing
        deletes them on its own: a listing gives no dates, so an upload from last month and
        one still on its way look the same from here. This is the list, and the decision is
        yours.
      </p>

      {!opened ? (
        <button className="btn btn-primary" onClick={() => setOpened(true)}>
          Read the stores
        </button>
      ) : loading && !report ? (
        <p className="card-meta">Listing every file — this takes a moment…</p>
      ) : (
        <>
          {note && <p className="card-meta">{note}</p>}
          <ul className="admin-list">
            {(report?.stores ?? []).map((entry) => {
              const chosen = picked[entry.id] ?? [];
              const strays = entry.total - entry.live;
              return (
                <li className="admin-row" key={entry.id}>
                  <div>
                    <p className="admin-name">{entry.label}</p>
                    <p className="card-meta">
                      {entry.total} file{entry.total === 1 ? "" : "s"} · {entry.live} still in use ·{" "}
                      {strays === 0 ? "nothing spare" : `${strays} nothing points at`}
                    </p>
                    <p className="card-meta">{entry.note}</p>
                  </div>

                  {entry.orphans.length > 0 && (
                    <div className="admin-detail">
                      {entry.truncated && (
                        <p className="warn-note">
                          Showing the first {report?.listLimit} of {entry.total - entry.live}.
                          Delete these and read the stores again for the next lot.
                        </p>
                      )}
                      <ul className="orphan-keys">
                        {entry.orphans.map((key) => (
                          <li key={key}>
                            <label className="orphan-key">
                              <input
                                type="checkbox"
                                checked={chosen.includes(key)}
                                onChange={() => toggle(entry.id, key)}
                              />
                              <span>{key}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <span className="admin-actions">
                        <button
                          className="chip-button"
                          onClick={() => tickAll(entry, chosen.length !== entry.orphans.length)}
                        >
                          {chosen.length === entry.orphans.length ? "Untick all" : "Tick all"}
                        </button>
                        <button
                          className="chip-button chip-danger"
                          disabled={busy === entry.id || chosen.length === 0}
                          onClick={() => remove(entry)}
                        >
                          {busy === entry.id
                            ? "Deleting…"
                            : `Delete ${chosen.length} selected`}
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            className="btn btn-ghost"
            disabled={loading}
            onClick={() => {
              setPicked({});
              setNote(null);
              setOpened(false);
              setReport(null);
            }}
          >
            {loading ? "Reading…" : "Close the list"}
          </button>
        </>
      )}
    </section>
  );
}

/** `2026-09` as somebody reads it, in whatever the device calls September. */
function monthLabel(month: string): string {
  const at = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return month;
  return at.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * What the app is costing, member by member — and the one screen in the app that
 * is not the app admin's alone.
 *
 * It exists because the only honest answer to "will this deployment stay inside
 * its credits?" is arithmetic over what members actually did, and the platform
 * cannot give it: a Blobs listing carries no sizes, and nothing anywhere records
 * that a recording was played. So `netlify/lib/usage.ts` writes a row per member
 * per day at the three choke points, and this reads a month of it back.
 *
 * The **App Manager** role exists for this page and for nothing else. Showing it
 * to somebody would otherwise have meant making them an app admin, which hands
 * over abuse and support as well — a great deal more than "have a look at what we
 * are spending" asks for. So the gate here is `isAppManager`, which is the one
 * predicate in the app wider than `isAppAdmin` and is wider by exactly this
 * screen; every other panel above it stays the admin's.
 *
 * Three things the figures do *not* say travel with them from the route rather
 * than being written here, because a caveat is worth nothing if it is not read
 * where the number is: egress is charged to whoever uploaded the bytes, only
 * origin reads are counted at all, and an AI call is a call and not a token.
 */
function AdminUsagePanel({
  store,
  onError,
}: {
  store: ShareAndLearn;
  onError: (message: string | null) => void;
}) {
  const [report, setReport] = useState<UsageReport | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isAppManager =
    store.access.role === "app_admin" || store.access.role === "app_manager";
  // Same reason as the panels above: the store's actions are new functions on
  // every render, so a ref is what keeps this read from repeating forever.
  const storeRef = useRef(store);
  storeRef.current = store;

  // The month is what the effect is keyed on, so picking one re-reads and there
  // is no separate refresh to keep in step. Null means "whichever month the
  // server thinks is current", which is the only answer the browser should not
  // be deciding for itself.
  useEffect(() => {
    // Hooks run for everybody, so the check is here as well as in the early
    // return below: an ordinary member must not fire a request the server is
    // only ever going to refuse.
    if (!isAppManager) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    storeRef.current
      .usageReport(month ?? undefined)
      .then((answer) => {
        if (live) setReport(answer);
      })
      .catch((err: unknown) => {
        if (live) onError(err instanceof Error ? err.message : "Could not read the usage.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppManager, month]);

  if (!isAppManager) return null;

  const rows = report?.members ?? [];
  const served = rows.reduce((sum, row) => sum + row.servedBytes, 0);
  const uploaded = rows.reduce((sum, row) => sum + row.uploadBytes, 0);
  const asked = rows.reduce((sum, row) => sum + row.aiCalls, 0);

  return (
    <section className="home-section admin-panel">
      <h2 className="section-title">
        What the app is costing <span className="tag">App managers</span>
      </h2>
      <p className="card-meta">
        A month of what members actually did: the bytes their uploads arrived as, the bytes
        those uploads have been served back as, and how often they asked the AI Gateway for
        something. Nothing here changes an account — it is a reading, and the heaviest month
        is the one worth reading.
      </p>

      {report && report.months.length > 0 && (
        <label className="feed-sort">
          <span>Month</span>
          <select
            value={report.month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={loading}
          >
            {report.months.map((one) => (
              <option key={one} value={one}>
                {monthLabel(one)}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading && !report ? (
        <p className="card-meta">Adding it up…</p>
      ) : rows.length === 0 ? (
        <p className="muted">
          Nothing was recorded in {report ? monthLabel(report.month) : "that month"}. The
          counters start the first time somebody uploads, plays or translates something after
          this was switched on.
        </p>
      ) : (
        <>
          <p className="admin-name">
            {formatBytes(served)} served · {formatBytes(uploaded)} uploaded · {asked} AI{" "}
            {asked === 1 ? "call" : "calls"}
          </p>
          <ul className="admin-list">
            {rows.map((row) => (
              <li className="admin-row" key={row.memberId}>
                <div>
                  {/* A row whose account has gone is listed against its id rather
                      than dropped: the bytes still cost what they cost. */}
                  <p className="admin-name">{row.name ?? row.memberId}</p>
                  <p className="card-meta">
                    {formatBytes(row.servedBytes)} served over {row.servedRequests}{" "}
                    {row.servedRequests === 1 ? "request" : "requests"}
                  </p>
                  <p className="card-meta">
                    {formatBytes(row.uploadBytes)} uploaded in {row.uploadCount}{" "}
                    {row.uploadCount === 1 ? "upload" : "uploads"}
                    {row.aiCalls > 0 &&
                      ` · ${row.aiCalls} AI ${row.aiCalls === 1 ? "call" : "calls"}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {report && rows.length >= report.listLimit && (
            <p className="warn-note">
              Showing the {report.listLimit} heaviest. Anybody below that is lighter than
              every row above.
            </p>
          )}
        </>
      )}

      {/* The route sends these rather than the panel holding a copy, so what the
          figures mean is written by whatever wrote them. */}
      {(report?.notes ?? []).map((note) => (
        <p className="card-meta" key={note}>
          {note}
        </p>
      ))}
    </section>
  );
}
