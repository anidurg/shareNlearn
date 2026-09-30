// netlify/functions/identity.mts
// The front door, and it is open. Anybody may create an account and start
// contributing to Discover, the circle every member is joined to, so a signup
// carries no invitation and is turned away for nothing.
//
// Invites still exist and still matter — they are how somebody is brought
// straight into a particular circle, and how a friend arrives already knowing
// whose group this is — but they are a shortcut rather than the price of entry.
//
// What this function still does is the two things Identity cannot: stamp the
// server's own idea of a role onto a new account, and refuse a login from an
// account an admin has paused. The rest of the app checks standing again on
// every request in `netlify/lib/access.ts`, because accounts can also appear
// from the Netlify UI or an external provider without passing through here.
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { members } from "../../db/schema.js";

/**
 * The two events this function subscribes to, described here rather than
 * imported: the platform passes them at runtime, and the version of
 * `@netlify/functions` this project depends on does not export their types yet.
 * Only the fields actually read are named, so the shape cannot drift out of step
 * with what the code below does.
 */
interface IdentityUser {
  id?: string;
  email?: string | null;
  appMetadata?: Record<string, unknown>;
}

interface IdentityEvent {
  user: IdentityUser;
  /** The canonical refusal: the member gets a 401 and nothing is logged as an error. */
  deny: () => unknown;
}

export default {
  /**
   * Everybody starts as a plain member. Roles are app metadata precisely because
   * they are the server's to set — the signup form has no say in them, and the
   * global admin is a decision recorded in the `members` table besides.
   */
  userSignup(event: IdentityEvent) {
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          roles: ["member"],
        },
      },
    };
  },

  /**
   * A suspension is only worth having if it holds at the door as well as inside
   * the app. The rest of the app turns a suspended member away request by
   * request; this stops the session being created in the first place.
   */
  async userLogin(event: IdentityEvent) {
    const id = event.user.id;
    if (!id) return;
    const [row] = await db
      .select({ status: members.status })
      .from(members)
      .where(eq(members.id, id));
    if (row?.status === "suspended") return event.deny();
  },
};
