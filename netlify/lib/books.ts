// netlify/lib/books.ts
// A book can carry several lines worth remembering. They live in one `books.quotes`
// column, one line each — the same shape recipes use for ingredients and steps — and
// travel over the API as an array so the browser never has to split strings.
import { text } from "./items.js";

/** Enough for a well-annotated book, small enough to keep a row bounded. */
export const MAX_QUOTES = 20;

type BookQuoteColumns = { quote: string | null; quotes: string | null };

/** Accepts either the array the browser sends or the newline-joined column value. */
export function quotesFrom(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  const lines: string[] = [];
  for (const entry of raw) {
    const line = text(entry);
    if (line.length > 0 && !lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, MAX_QUOTES);
}

export function joinQuotes(lines: string[]) {
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Rows written before `quotes` existed only have the single `quote`. */
export function quotesOf(row: BookQuoteColumns): string[] {
  if (row.quotes) return quotesFrom(row.quotes);
  return row.quote ? [row.quote] : [];
}

/** The shape the API returns: the stored row plus the quotes as an array. */
export function bookResponse<T extends BookQuoteColumns>(row: T) {
  return { ...row, quotes: quotesOf(row) };
}
