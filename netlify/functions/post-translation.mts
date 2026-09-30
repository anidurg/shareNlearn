// netlify/functions/post-translation.mts
// One post's details written out in one other script — Devanagari, Kannada, Telugu or
// Tamil letters, or English letters — so everybody the post reached can read it.
//
// Every one of them is a character mapping: the words are kept and only the letters
// change, which the mapping tables settle in the time one request takes. Nothing here
// translates, so nothing here needs a model and no deployment is without it.
//
// Any member the post reaches may ask, because asking is reading: it changes nothing
// about the post, the words, or anybody else's view of them. The words themselves
// stay the author's alone, and there have to be some — this route converts what
// somebody wrote and never supplies what they did not.
//
// The answer is cached against the text it was made from, so a script somebody
// already opened costs nothing the second time, and one made from details that have
// since been edited is remade rather than served.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { badRequest, idFrom, notFound, unauthorized } from "../lib/items.js";
import {
  cachedTranslation,
  postLanguageOf,
  renderTranslation,
  translationAvailableFor,
  translationResponse,
  visiblePost,
} from "../lib/translations.js";

export default async (_req: Request, context: Context) => {
  const postId = idFrom({ id: context.params.id });
  if (postId === null) return badRequest("Invalid post id.");

  // Normalised rather than merely checked, so a link on a post whose author ticked
  // one of the four ids this list used to use still opens.
  const language = postLanguageOf(context.params.language);
  if (!language) {
    return badRequest("That is not a script this app writes.");
  }

  const user = await admittedUser();
  if (!user) return unauthorized();

  const post = await visiblePost(postId, user);
  if (!post) return notFound("Post");

  if (!post.body) {
    return badRequest("This post has no details to read in another script yet.");
  }

  // Already made from exactly these words: the cache is the answer, and nothing is
  // converted a second time.
  const cached = await cachedTranslation({ id: post.id, body: post.body }, language);
  if (cached) return Response.json({ translation: translationResponse(cached) });

  // A mapping has to know what it is mapping from, and details in Latin letters say
  // nothing — nor is there anything to do when they are already in the script asked
  // for. Refused here rather than approximated.
  if (!translationAvailableFor(language, post.body)) {
    return badRequest(
      "These details cannot be written in that script: they are either already in it, or in letters nothing can convert from.",
    );
  }

  const rendered = await renderTranslation(
    { id: post.id, title: post.title, body: post.body },
    language,
  );
  if (!rendered) {
    return Response.json(
      { error: "That could not be written in that script just now. Try again in a moment." },
      { status: 502 },
    );
  }

  return Response.json({ translation: translationResponse(rendered) }, { status: 201 });
};

export const config: Config = {
  path: "/api/posts/:id/translations/:language",
  method: ["POST"],
};
