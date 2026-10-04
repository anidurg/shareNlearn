# Share & Learn — Developer Handoff

This is the short handoff for a developer or AI joining the project. Read **AGENTS.md** as the detailed source of truth for current behavior and implementation conventions; this file captures product intent and decisions that should survive future changes.

## Product idea

Share & Learn solves a simple problem: useful things are easy to share but hard to find again. Songs, recipes, books, links, documents, cultural knowledge and experiences get scattered across messaging, social media, email, browser bookmarks and cloud storage.

**Share → Preserve → Organize → Rediscover → Connect**

Share & Learn does not try to replace WhatsApp, Google Drive, OneDrive, email or websites. Content may continue to live there. Share & Learn preserves the **community knowledge around it**: why somebody shared it, where the community filed it, and the discussion that grows around it.

> The content may live elsewhere. The community knowledge around it lives in Share & Learn.

The UI should feel like a simple mobile app rather than a traditional website. Prefer small, understandable improvements over infrastructure or feature bloat.

## Core information model

**Circle → Category → optional taxonomy/subcategory → Item**

- A **Circle** is who the member shares with.
- A **Category/content type** is what the item is.
- Taxonomy/subcategory is optional organization within a Circle/category.
- One item can reach multiple Circles without duplicating the item.
- Built-ins include Songs, Recipes, Fun Facts, Word Explorer, Books and Remedies.
- A Circle enables only the types it needs and can create its own categories.
- Turning a category or field off should preserve existing content/data.
- Circle admins manage their Circle. Global app administration is for exceptional abuse/support.

See **AGENTS.md** before changing these rules; it documents the implemented details, permissions and taxonomy behavior.

## Discover

**Discover** is the open/default Circle for registered members: a place to explore and contribute without first being invited to another Circle.

Current product direction favors Books, Word Explorer, Fun Facts and Travelogue-style community knowledge in Discover. Avoid allowing one high-volume type to overwhelm the feed.

Logged-out visitors must not receive private/user-generated Circle content or member identities merely because a UI component hides them. Enforce access server-side.

## Sharing and links

- **+ Share an item** means contribute a new item.
- **Share** on an existing item means share a link outward using native sharing where available, with fallbacks.

A shared private link must never expose private content before sign-in and authorization. Clicking a link must not silently add someone to a Circle.

For incoming Android sharing, the intended flow is:

**Android share sheet → Share & Learn → review/prefilled Share an item → choose Circle → optional filing/category → save**

Do not confuse incoming file type with Share & Learn content type.

iOS inbound native sharing is intentionally paused. Do not restart Capacitor/iOS Share Extension work without an explicit product decision.

## Books

Books are community recommendations and discussion, not a Goodreads clone. The desired direction is **Readers' Thoughts / Discussions**, not a rating-driven experience.

The current implementation still contains legacy rating support. Do not expand rating mechanics without an explicit product decision.

Books already have optional `buyUrl` entered as **Where to buy it (optional)**. `BuyLink` in `src/components/shared.tsx` displays Amazon destinations as **Available on Amazon ↗** and other retailers as **Buy a copy ↗**.

### Amazon experiment

As of October 2026, Discover contains these test books:

- **Think Again** — Adam Grant
- **Hidden Potential** — Adam Grant

Their `buyUrl` values are being used to test links to Amazon hardcover product pages.

This is currently only a product-link experiment. **Do not label these links as affiliate links unless they actually contain the project's real Amazon Associates tracking tag.** If Share & Learn joins Amazon Associates later, use the real Associate tag and required disclosure. A later refinement may support separate **Hardcover · Kindle** choices, but the current one-link model is deliberately simple.

Do not make an Amazon API a prerequisite for Books. Automated lookup can be considered later if program/API access and product need justify it.

## Other content-type direction

**Recipes:** use Menu Type and Dish Type where appropriate; discussion language should be **Experiences & Tips**, not ratings/reviews.

**Songs:** support recording/upload. Lyrics/transliteration should preserve canonical source text and switch displayed script rather than append duplicate lyric blocks.

**Word Explorer:** learning-oriented: word, language/script, meaning, pronunciation, optional part of speech/example/notes/synonyms/antonyms, with optional language connections.

**Travelogue:** community stories, experiences and practical advice rather than tourism ratings.

**Home Remedies:** family/ancestral traditions and experiences, not medical claims. Preserve the application's health disclaimer/safety framing.

## Files and external content

A Bookmark means: **our community may find this useful, and here is why**.

External content can stay where it lives — a website, Google Drive, OneDrive, etc. Share & Learn can preserve a link and community context instead of becoming another file-storage system.

Preferred PDF experience:

**Item → PDF viewer inside Share & Learn → Back → exact same Item**

Preserve Circle/folder/item context. Do not make raw-PDF navigation the primary experience.

## UX principles

- Mobile first; compact and touch friendly.
- Prefer one clear action over competing actions.
- Keep the Circle selector and **+ Share an item** language.
- Hidden/disabled content types disappear for ordinary members rather than becoming dead controls.
- Preserve context when navigating into an item and back.
- Use functional iconography consistently; Circle identity can be more expressive.
- Discussion and community context are differentiators. Avoid turning content types into review/rating products.
- Build the smallest useful version first, test it, then expand.

## About / product language

The About page opening is considered settled unless deliberately revisited. It starts with the familiar problem of remembering something useful but not remembering where it was seen or saved, then introduces Share & Learn as the place to preserve it without interrupting normal sharing habits.

Useful phrases:
- **Explore. Learn. Share. Inspire.**
- **Share what you Learn! / Keep what you Share!**
- **Word Explorer**
- **Discover**
- **+ Share an item**

A naming idea — **SLIK: Share · Learn · Inspire · Keep** — was discussed but intentionally put on hold. Do not rename the product around it without an explicit decision.

## Architecture and deployment

- React 18 + TypeScript
- Vite
- Netlify Functions
- Netlify Identity
- Netlify Database / Drizzle ORM
- Netlify Blobs where needed
- GitHub repository: `anidurg/shareNlearn`
- Production branch: `main`
- Build: `npm run build`
- Publish: `dist`
- Functions: `netlify/functions`

Netlify auto-publishes commits to `main`. Treat a commit to `main` as production-affecting.

## Working conventions for developers and AI

1. **Read AGENTS.md first.** It is the detailed implementation/behavior source of truth.
2. Inspect current code before proposing a change. Do not infer live data from README examples or old comments.
3. Keep authorization on the server. UI hiding is not permission enforcement.
4. Preserve data when disabling categories/fields unless deletion is explicitly requested.
5. Avoid hard-coding live content records into React. Shares are database data.
6. Prefer extending an existing field/flow over creating a new subsystem.
7. Keep changes small and testable.
8. Before editing a GitHub file, fetch current `main` and use its fresh SHA.
9. Use clear commit messages.
10. Every `main` commit triggers a Netlify deployment.
11. If a product decision conflicts with old code/docs, clarify intended behavior rather than silently expanding legacy behavior.
12. Do not assume examples in documentation are current live records.

## Where to look

- **AGENTS.md** — detailed behavior and implementation source of truth.
- **CLAUDE.local.md** — points Claude to AGENTS.md.
- **README.md** — overview; examples may lag current product decisions.
- **src/components/** — React UI.
- **src/content/about.json**, **src/components/AboutPage.tsx** — About/Tutorial content.
- **src/api.ts** — frontend API types/contracts.
- **netlify/functions/** — HTTP endpoints.
- **netlify/lib/** — shared server-side rules/helpers.
- **db/** — database schema and related code.
- **netlify.toml** — deployment configuration.

## Handoff principle

**Sharing should remain easy. Share & Learn adds the place where something worth keeping can be preserved, organized, discussed and found again.**
