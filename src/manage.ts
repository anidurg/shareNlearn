import type { ShareAndLearn } from "./store";

/**
 * Who may correct or take down a share, which is no longer only the person who
 * made it.
 *
 * A share is two things at once: somebody's own work, and something said in
 * somebody's circle. The author can always change or delete their own — that has
 * never moved. What is added here is the room: whoever keeps a circle a share went
 * into, its owner or an admin they chose, answers for what is in it, and so can fix
 * a wrong title or take a bad recording down without waiting on a member who may
 * never open the app again. The app admin stands in for the same reason, everywhere.
 *
 * A share that names no circle reaches the whole group and has no local keeper, so
 * only its author and the app admin answer for it.
 *
 * The server enforces exactly this rule, so hiding the buttons is a courtesy rather
 * than the check: `moderatesItem()` in `netlify/lib/moderation.ts` is its other half.
 */
export function canManageShare(
  store: ShareAndLearn,
  userId: string | null,
  item: { memberId: string; circleIds?: number[] | null },
): boolean {
  if (!userId) return false;
  if (item.memberId === userId) return true;
  if (store.access.role === "app_admin") return true;
  return (item.circleIds ?? []).some((circleId) => store.moderating.has(circleId));
}

/**
 * The question asked before a delete goes through, which is not the same question
 * when the thing being deleted is not yours.
 *
 * Deleting your own share needs no more than "are you sure?". Deleting somebody
 * else's is a different act and should read like one, so it names them: a circle's
 * owner tidying up should know whose work is about to go, and the one thing that
 * makes that clear on a confirm button is the author's name.
 */
export function deleteNote(mine: boolean, what: string, memberName: string): string {
  return mine
    ? `Are you sure you want to delete this ${what}?`
    : `${memberName} shared this ${what}. Deleting it removes it for everyone — are you sure?`;
}
