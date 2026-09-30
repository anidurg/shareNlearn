// netlify/functions/word-connection.mts
// Removing a language connection. Whoever added it may take it back, and so may
// the author of the word it hangs on — it sits on their entry, so they keep the
// last word on what it says — and so may whoever keeps a circle the word went into.
// Nobody else can touch it.
import type { Config, Context } from "@netlify/functions";
import { admittedAccess } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { wordConnections } from "../../db/schema.js";
import { badRequest, idFrom, notFound, notYours, unauthorized } from "../lib/items.js";
import { moderatesItem } from "../lib/moderation.js";
import { visibleWord } from "../lib/words.js";

export default async (req: Request, context: Context) => {
  const wordId = idFrom({ id: context.params.id });
  const connectionId = idFrom({ id: context.params.connectionId });
  if (wordId === null || connectionId === null) return badRequest("Invalid connection id.");

  const access = await admittedAccess();
  if (!access) return unauthorized();
  const user = access.user;

  const word = await visibleWord(wordId, user);
  if (!word) return notFound("Word");

  const [connection] = await db
    .select()
    .from(wordConnections)
    .where(and(eq(wordConnections.id, connectionId), eq(wordConnections.wordId, wordId)));
  if (!connection) return notFound("Connection");

  const mayRemove =
    connection.memberId === user.id ||
    word.memberId === user.id ||
    (await moderatesItem("word", wordId, access));
  if (!mayRemove) return notYours("language connections");

  await db.delete(wordConnections).where(eq(wordConnections.id, connectionId));

  return Response.json({ ok: true });
};

export const config: Config = {
  path: "/api/words/:id/connections/:connectionId",
  method: ["DELETE"],
};
