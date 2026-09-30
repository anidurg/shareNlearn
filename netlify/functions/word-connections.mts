// netlify/functions/word-connections.mts
// The same word in another language: Greek osteon, German Knochen, Hindi अस्थि.
// Adding one is not an edit of the word, so it is not restricted to the author —
// any member the word reaches may add what they know, the same rule that decides
// who may save it, and the same exception subcategories make for the share form.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { badRequest, idFrom, jsonBody, notFound, unauthorized } from "../lib/items.js";
import { unsafeText } from "../lib/safety.js";
import {
  addConnection,
  connectionFrom,
  MAX_CONNECTIONS_PER_WORD,
  visibleWord,
} from "../lib/words.js";

export default async (req: Request, context: Context) => {
  const wordId = idFrom({ id: context.params.id });
  if (wordId === null) return badRequest("Invalid word id.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  const word = await visibleWord(wordId, user);
  if (!word) return notFound("Word");

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const values = connectionFrom(body);
  if (!values) return badRequest("A connection needs a language and the word in that language.");

  const refused = unsafeText(values.language, values.term, values.note);
  if (refused) return refused;

  const connection = await addConnection(wordId, values, user);
  if (!connection) {
    return badRequest(`A word can hold ${MAX_CONNECTIONS_PER_WORD} language connections.`);
  }

  return Response.json({ connection }, { status: 201 });
};

export const config: Config = {
  path: "/api/words/:id/connections",
  method: ["POST"],
};
