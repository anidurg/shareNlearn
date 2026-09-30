import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCircle,
  fetchMyMembers,
  formatDate,
  type Circle,
  type CircleDetail,
  type GroupMember,
} from "../api";
import type { ShareAndLearn } from "../store";
import { EmptyState, ErrorLine, SearchField, TabHeader } from "./shared";

/**
 * Who is in the circle in view, and who is still at the door.
 *
 * This is the one section that is purely about people rather than about what they
 * shared, and it is now the **only** one: the circle's own page used to carry a
 * smaller roll of its own, which was this list with the search box, the waiting
 * room and the role buttons taken off it, so it has gone and the head count in
 * that page's header points here instead. The circle in view decides who this
 * page is about, so it moves when the header dropdown moves — and it is reachable
 * without opening a circle at all.
 *
 * What a member may do here depends on what they are. Everybody in the circle can
 * read the roll. Whoever moderates it — the owner, the admins they chose, or the
 * app admin stepping in — also sees the waiting room, and answers it: approving
 * somebody who asked, turning them down, withdrawing an invitation that was never
 * answered, removing a plain member, and handing out the circle's admin role.
 *
 * **All circles is a roll of its own rather than a page that cannot answer.** The
 * app opens on all of them, so this tab is most often reached with nothing
 * narrowed, and it used to say so and stop — a heading, and a button asking the
 * member to go and pick a circle before it would tell them anything. It now
 * answers the question at the width it was asked: everybody the member shares a
 * circle with, once each, with the circles they share hanging off the row. What
 * belongs to one room stays in that room — roles, the waiting list and the
 * controls that answer it are a circle's own, and a tap on a circle's name is how
 * a reader gets to them.
 */
export function MembersTab({
  store,
  userId,
  currentCircle,
  onOpenCircle,
  onChooseCircle,
  onOpenCircles,
  onInviteFriend,
  onNeedsLogin,
}: {
  store: ShareAndLearn;
  userId: string | null;
  /** The circle the header dropdown is pointing at, or null when in none. */
  currentCircle: Circle | null;
  onOpenCircle: (circleId: number) => void;
  /**
   * Narrows the scope to one circle without leaving Members, which is what a
   * circle's name on a consolidated row is for: the same page about one room.
   */
  onChooseCircle: (circleId: number) => void;
  onOpenCircles: () => void;
  onInviteFriend: () => void;
  onNeedsLogin: () => void;
}) {
  const [detail, setDetail] = useState<CircleDetail | null>(null);
  const [roll, setRoll] = useState<GroupMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const circleId = currentCircle?.id ?? null;

  const load = useCallback(async () => {
    if (circleId === null) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      setDetail(await fetchCircle(circleId));
      setError(null);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Those members could not be read.");
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    // Switching circles switches who this page is about, so it is read again.
    setQuery("");
    load();
  }, [load]);

  /*
   * The consolidated roll, which is what "All circles" means here: everybody the
   * member shares a circle with. It is read only while that is the scope, so
   * narrowing to one circle costs the request it always did and nothing more.
   */
  useEffect(() => {
    if (circleId !== null || !userId) return;
    let live = true;
    setLoading(true);
    fetchMyMembers()
      .then((rows) => {
        if (!live) return;
        setRoll(rows);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setRoll(null);
        setError(err instanceof Error ? err.message : "Those members could not be read.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [circleId, userId]);

  function run(key: string, action: Promise<unknown>) {
    setBusy(key);
    setError(null);
    action
      .then(load)
      .catch((err) => setError(err instanceof Error ? err.message : "That did not work."))
      .finally(() => setBusy(null));
  }

  const needle = query.trim().toLowerCase();
  const members = useMemo(
    () =>
      (detail?.members ?? []).filter(
        (member) => !needle || member.memberName.toLowerCase().includes(needle),
      ),
    [detail, needle],
  );

  /* The same search, one width up: a name, or the name of a circle they are in. */
  const shared = useMemo(
    () =>
      (roll ?? []).filter(
        (member) =>
          !needle ||
          member.memberName.toLowerCase().includes(needle) ||
          member.circles.some((circle) => circle.circleName.toLowerCase().includes(needle)),
      ),
    [roll, needle],
  );

  if (!userId) {
    return (
      <>
        <TabHeader title="Members" subtitle="Who is in the circle you are looking at." />
        <EmptyState glyph="🧑‍🤝‍🧑" title="Log in to see who is here">
          <button className="btn btn-primary" onClick={onNeedsLogin}>
            Log in
          </button>
        </EmptyState>
      </>
    );
  }

  /*
   * All circles in view, which is where the app opens and so the ordinary way
   * this tab is reached: the consolidated roll — everybody the member shares a
   * circle with, once each, with the circles they share on the row. Somebody in
   * no circle at all has nobody to list and is sent to find a circle instead,
   * which is the one case this page genuinely cannot answer.
   */
  if (!currentCircle) {
    const anyCircles = store.circles.some((circle) => circle.role);
    if (!anyCircles) {
      return (
        <>
          <TabHeader title="Members" subtitle="The people in the circles you are in." />
          <EmptyState glyph="👥" title="No circle yet">
            Members are the people you share a circle with, so there has to be one to look at. Find
            a circle to join, and its people are here.
            <span className="empty-actions">
              <button className="btn btn-primary" onClick={onOpenCircles}>
                Find a circle
              </button>
            </span>
          </EmptyState>
        </>
      );
    }

    return (
      <>
        <TabHeader
          title="Members"
          subtitle="Everybody in the circles you are in. Pick a circle to see its roles and who is waiting."
          actions={
            <button className="btn btn-primary" onClick={onInviteFriend}>
              Invite a friend
            </button>
          }
        />

        <ErrorLine message={error} />

        <section className="circle-section">
          <h2 className="section-title">
            Members
            {roll && <span className="tag">{roll.length}</span>}
          </h2>

          {loading && !roll && <p className="muted">Reading who is here…</p>}

          {roll && roll.length > 5 && (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search members by name or circle"
            />
          )}

          {roll && roll.length > 0 && shared.length === 0 && (
            <p className="muted">Nobody here matches “{query.trim()}”.</p>
          )}

          {roll && roll.length === 0 && (
            <p className="muted">
              Nobody else is in your circles yet. Invite somebody, and they are here.
            </p>
          )}

          <ul className="member-list">
            {shared.map((member) => (
              <li key={member.memberId} className="member-row">
                <span>
                  {member.memberName}
                  {member.memberId === userId && <span className="tag">You</span>}
                  {/* Which rooms the two of them share, and the way into each
                      one: a circle's own roll is where its roles, its waiting
                      list and the controls that answer it live. */}
                  <span className="member-circles">
                    {member.circles.map((circle) => (
                      <button
                        key={circle.circleId}
                        className="chip-button"
                        onClick={() => onChooseCircle(circle.circleId)}
                        title={`See who is in ${circle.circleName}`}
                      >
                        <span aria-hidden="true">{circle.circleIcon} </span>
                        {circle.circleName}
                      </button>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  /**
   * The waiting room and the roll's own controls belong to whoever looks after the
   * circle — its owner and the admins they chose — and to nobody else. An admin of
   * a circle manages the circle, so there is no narrower question to ask here.
   */
  const moderating = detail?.moderating ?? null;
  const requests = detail?.requests ?? [];
  const invitations = detail?.invitations ?? [];

  return (
    <>
      <TabHeader
        title="Members"
        subtitle={`Who is in ${currentCircle.icon} ${currentCircle.name}${
          moderating ? ", and who is waiting to be let in." : "."
        }`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => onOpenCircle(currentCircle.id)}>
              Circle page
            </button>
            <button className="btn btn-primary" onClick={onInviteFriend}>
              Invite a friend
            </button>
          </>
        }
      />

      <ErrorLine message={error} />

      {/* Waiting first: it is the only part of this page that is asking for an
          answer, and it stops being on screen the moment it is given one. */}
      {moderating && (
        <section className="circle-section">
          <h2 className="section-title">
            Waiting for approval
            {requests.length > 0 && <span className="tag tag-warn">{requests.length}</span>}
          </h2>
          {requests.length === 0 ? (
            <p className="muted">
              Nobody is waiting. When somebody asks to join {currentCircle.name}, they appear here.
            </p>
          ) : (
            <ul className="pending-list">
              {requests.map((request) => (
                <li key={request.memberId} className="pending-row">
                  <span>
                    <strong>{request.memberName}</strong> · asked {formatDate(request.createdAt)}
                  </span>
                  <span className="owner-actions">
                    <button
                      className="chip-button chip-strong"
                      disabled={busy === `approve:${request.memberId}`}
                      onClick={() =>
                        run(
                          `approve:${request.memberId}`,
                          store.approveCircleRequest(currentCircle.id, request.memberId),
                        )
                      }
                    >
                      {busy === `approve:${request.memberId}` ? "Letting in…" : "Approve"}
                    </button>
                    <button
                      className="chip-button"
                      disabled={busy === `turndown:${request.memberId}`}
                      onClick={() =>
                        run(
                          `turndown:${request.memberId}`,
                          store.removeCircleMember(currentCircle.id, request.memberId),
                        )
                      }
                    >
                      Turn down
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {moderating && invitations.length > 0 && (
        <section className="circle-section">
          <h2 className="section-title">Invited, not answered yet</h2>
          <ul className="pending-list">
            {invitations.map((pending) => (
              <li key={pending.memberId} className="pending-row">
                <span>
                  <strong>{pending.memberName}</strong> · invited {formatDate(pending.createdAt)}
                </span>
                <button
                  className="chip-button"
                  disabled={busy === `uninvite:${pending.memberId}`}
                  onClick={() =>
                    run(
                      `uninvite:${pending.memberId}`,
                      store.removeCircleMember(currentCircle.id, pending.memberId),
                    )
                  }
                >
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="circle-section">
        <h2 className="section-title">
          Members
          <span className="tag">{detail?.members.length ?? currentCircle.memberCount}</span>
        </h2>

        {loading && !detail && <p className="muted">Reading who is here…</p>}

        {detail && detail.members.length === 0 && (
          <EmptyState glyph="🔒" title="Only members can see the roll">
            Join {currentCircle.name} to see who else is in it.
          </EmptyState>
        )}

        {detail && detail.members.length > 5 && (
          <SearchField value={query} onChange={setQuery} placeholder="Search members by name" />
        )}

        {detail && detail.members.length > 0 && members.length === 0 && (
          <p className="muted">Nobody here matches “{query.trim()}”.</p>
        )}

        <ul className="member-list">
          {members.map((member) => (
            <li key={member.memberId} className="member-row">
              <span>
                {member.memberName}
                {member.role === "owner" && <span className="tag">Owner</span>}
                {member.role === "admin" && <span className="tag">Admin</span>}
                {member.memberId === userId && <span className="tag">You</span>}
              </span>
              {/* Both of these are looking after the room, so an admin may do
                  either — including to another admin. The owner's row carries
                  neither, and neither does the reader's own. */}
              {moderating && member.role !== "owner" && member.memberId !== userId && (
                <span className="owner-actions">
                  <button
                    className="chip-button"
                    disabled={busy === `role:${member.memberId}`}
                    onClick={() =>
                      run(
                        `role:${member.memberId}`,
                        store.setCircleRole(
                          currentCircle.id,
                          member.memberId,
                          member.role === "admin" ? "member" : "admin",
                        ),
                      )
                    }
                  >
                    {member.role === "admin" ? "Step down as admin" : "Make an admin"}
                  </button>
                  <button
                    className="chip-button"
                    disabled={busy === `remove:${member.memberId}`}
                    onClick={() =>
                      run(
                        `remove:${member.memberId}`,
                        store.removeCircleMember(currentCircle.id, member.memberId),
                      )
                    }
                  >
                    Remove
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
