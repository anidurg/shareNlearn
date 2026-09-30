// netlify/functions/words.mts
import type { Config } from "@netlify/functions";
import { admittedUser, sharingGate } from "../lib/access.js";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { words } from "../../db/schema.js";
import { filedCategoryIdFrom, shelfChoiceFrom } from "../lib/categories.js";
import {
  announceShare,
  circleIdsFrom,
  filingsOf,
  setItemCircles,
  withCircleIds,
} from "../lib/circles.js";
import { folderIdFrom } from "../lib/folders.js";
import {
  badRequest,
  jsonBody,
  memberNameOf,
  optionalText,
  text,
  visibilityOf,
  visibleTo,
  unauthorized,
} from "../lib/items.js";
import {
  addConnections,
  connectionsFrom,
  joinWordList,
  wordListFrom,
  wordResponse,
  withConnections,
} from "../lib/words.js";
import { unsafeText } from "../lib/safety.js";

export default async (req: Request) => {
  const user = await admittedUser();

  if (req.method === "GET") {
    const all = await db
      .select()
      .from(words)
      .where(visibleTo(words, user, "word"))
      .orderBy(desc(words.createdAt));
    return Response.json({
      words: await withConnections(
        await withCircleIds("word", all.map(wordResponse), user),
        user,
      ),
    });
  }

  // Everything shared here goes to a circle, so being in one comes before sharing.
  if (!user) return unauthorized();
  const gate = await sharingGate(user);
  if (gate) return gate;

  const body = await jsonBody(req);
  if (!body) return badRequest("Expected a JSON body.");

  const word = text(body.word);
  const meaning = text(body.meaning);
  if (!word || !meaning) return badRequest("A vocabulary entry needs a word and its meaning.");

  const memberName = memberNameOf(user);
  const example = optionalText(body.example);
  const notes = optionalText(body.notes);
  const synonyms = wordListFrom(body.synonyms);
  const antonyms = wordListFrom(body.antonyms);
  const connections = connectionsFrom(body.connections);

  // The entry and everything offered with it, including the connections, which
  // are created in the same request and so are checked in the same breath.
  const refused = unsafeText(
    word,
    meaning,
    example,
    notes,
    ...synonyms,
    ...antonyms,
    ...connections.flatMap((connection) => [connection.language, connection.term, connection.note]),
  );
  if (refused) return refused;

  const [created] = await db
    .insert(words)
    .values({
      memberId: user.id,
      memberName,
      word,
      meaning,
      example,
      language: optionalText(body.language),
      pronunciation: optionalText(body.pronunciation),
      synonyms: joinWordList(synonyms),
      antonyms: joinWordList(antonyms),
      notes,
      source: optionalText(body.source),
      visibility: visibilityOf(body.visibility),
    })
    .returning();

  // A private word reaches nobody, so it keeps no circle links.
  const chosen =
    created.visibility === "shared"
      ? await setItemCircles(
          "word",
          created.id,
          circleIdsFrom(body) ?? [],
          user,
          shelfChoiceFrom(body),
          filedCategoryIdFrom(body),
          folderIdFrom(body),
        )
      : [];

  // A word carries no pictures: the entry itself — meaning, example,
  // pronunciation, its words in other languages — is the whole of it.

  // The connections the form offered, made with the word rather than after it.
  // They are rows either way, each naming this member as the one who added it.
  const added = await addConnections(created.id, connections, user);

  if (created.visibility === "shared") {
    await announceShare({
      itemType: "word",
      message: `${memberName} added the word "${word}"`,
      circles: chosen,
    });
  }

  return Response.json(
    {
      word: {
        ...wordResponse(created),
        circleIds: chosen.map((circle) => circle.id),
        filings: await filingsOf("word", created.id, user),
        // Whatever the form offered, and an empty list when it offered nothing,
        // so the browser never has to guard against the field's absence.
        connections: added,
      },
    },
    { status: 201 },
  );
};

export const config: Config = {
  path: "/api/words",
  method: ["GET", "POST"],
};
