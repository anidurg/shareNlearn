// drizzle.config.ts
// A plain object with a type-only import rather than `defineConfig()`: that
// helper only returns its argument, and importing it at runtime makes loading
// this file depend on `drizzle-kit` resolving from the project's own
// node_modules, which fails wherever the CLI is run through npx without them.
import type { Config } from "drizzle-kit";

export default {
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "netlify/database/migrations",
} satisfies Config;
