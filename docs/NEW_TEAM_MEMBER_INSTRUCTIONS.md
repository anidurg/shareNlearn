# Instructions for New Team Members

Welcome to **Share & Learn**.

Before making changes to the project, please read these two files in this order:

1. **AGENTS.md** — the detailed source of truth for current application behavior, implementation rules, permissions, and development conventions.
2. **docs/SHARE_AND_LEARN_CONTEXT.md** — the product vision, major design decisions, UX principles, architecture overview, and development handoff context.

## Starting instruction

If you are using ChatGPT, Claude, or another AI coding assistant, begin with:

> Please read `AGENTS.md` and `docs/SHARE_AND_LEARN_CONTEXT.md` first. Then help me continue development of Share & Learn while preserving the existing product decisions and conventions.

Do not assume examples in the README, comments, or old code represent current live data or the latest product decision. Inspect the current implementation before proposing or making a change.

## Before changing code

- Understand the requested behavior before editing.
- Check whether the capability already exists and can be extended simply.
- Keep changes small and focused.
- Preserve existing data unless deletion is explicitly part of the requirement.
- Keep authorization and privacy enforcement on the server; hiding a UI control is not sufficient security.
- Do not hard-code live user or content records into React components.
- Prefer the existing architecture and patterns over introducing a new subsystem.
- Preserve the mobile-first, app-like experience.
- Avoid adding ratings, review mechanics, infrastructure, or complexity unless the product requirement calls for them.

## GitHub and deployment

The repository is **anidurg/shareNlearn** and the production branch is **main**.

Before modifying an existing GitHub file, fetch the current version from `main` and work from its latest SHA. Use a clear commit message.

**Important:** commits to `main` automatically trigger a Netlify deployment. Treat every commit to `main` as a production-affecting action.

When working with an AI assistant, do not let it commit or publish changes merely because you are discussing an idea. Make sure the requested change is understood and explicitly approved before publishing.

## Product principle to preserve

Share & Learn is not trying to replace messaging, cloud storage, email, websites, or social media.

Its purpose is to make worthwhile shared knowledge easier to preserve, organize, discuss, and find again.

**Share → Preserve → Organize → Rediscover → Connect**

> The content may live elsewhere. The community knowledge around it lives in Share & Learn.

When in doubt about a proposed feature, prefer the simplest implementation that strengthens that purpose.
