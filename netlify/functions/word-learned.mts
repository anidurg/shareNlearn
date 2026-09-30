// netlify/functions/word-learned.mts
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { learnedWords } from "../../db/schema.js";
import { badRequest, idFrom, unauthorized } from "../lib/items.js";

// "Learned" is personal progress: it says nothing about the word itself, so any
// member can mark any word they can see.
export default async (req: Request, context: Context) => {
  const wordId = idFrom({ id: context.params.id });
  if (wordId === null) return badRequest("Invalid word id.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  if (req.method === "POST") {
    await db
      .insert(learnedWords)
      .values({ memberId: user.id, wordId })
      .onConflictDoNothing();
    return Response.json({ learned: true }, { status: 201 });
  }

  await db
    .delete(learnedWords)
    .where(and(eq(learnedWords.memberId, user.id), eq(learnedWords.wordId, wordId)));

  return Response.json({ learned: false });
};

export const config: Config = {
  path: "/api/words/:id/learned",
  method: ["POST", "DELETE"],
};
