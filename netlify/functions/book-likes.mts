// netlify/functions/book-likes.mts
// 👍 on a book. Any member the book reaches may like it, and liking is the same
// call twice over: one row per member, so pressing the button again removes it and
// pressing it twice never counts twice.
import type { Config, Context } from "@netlify/functions";
import { admittedUser } from "../lib/access.js";
import { visibleBook } from "../lib/discussions.js";
import { badRequest, idFrom, notFound, unauthorized } from "../lib/items.js";
import { setLike } from "../lib/likes.js";

export default async (req: Request, context: Context) => {
  const bookId = idFrom({ id: context.params.id });
  if (bookId === null) return badRequest("Invalid book id.");

  const user = await admittedUser();
  if (!user) return unauthorized();

  const book = await visibleBook(bookId, user);
  if (!book) return notFound("Book");

  const like = await setLike("book", bookId, user, req.method === "POST");

  return Response.json({ like });
};

export const config: Config = {
  path: "/api/books/:id/likes",
  method: ["POST", "DELETE"],
};
