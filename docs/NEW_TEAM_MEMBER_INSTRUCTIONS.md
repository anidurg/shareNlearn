# Instructions for New Team Members

Welcome to **Share & Learn**.

Before making changes to the project, please read these two files in this order:

1. **AGENTS.md** — the detailed source of truth for current application behavior, implementation rules, permissions, and development conventions.
2. **docs/SHARE_AND_LEARN_CONTEXT.md** — the product vision, major design decisions, UX principles, architecture overview, and development handoff context.

## Starting instruction

If you are using ChatGPT, Claude, or another AI coding assistant, begin with:

> Please read `AGENTS.md` and `docs/SHARE_AND_LEARN_CONTEXT.md` first. Then help me continue development of Share & Learn while preserving the existing product decisions and conventions.

Do not assume examples in the README, comments, or old code represent current live data or the latest product decision. Inspect the current implementation before proposing or making a change.

## Local development setup

Recommended local path on Windows:

```text
C:\GitHub\shareNlearn
```

Avoid placing the repository inside OneDrive or another sync-managed folder. GitHub already handles version history and remote backup, and sync tools can interfere with `.git`, `node_modules`, generated files, or file locking.

### Clone the repository

Using GitHub Desktop:

1. Sign in to GitHub.
2. Clone **anidurg/shareNlearn**.
3. Choose a fully local folder such as `C:\GitHub\shareNlearn`.
4. Open the cloned folder in VS Code.

### Install dependencies

In the VS Code terminal:

```bash
npm install
```

`node_modules/` must be in `.gitignore`. Do not commit `node_modules`.

If npm reports blocked install scripts, review the exact package names rather than approving everything globally. The current project has required install scripts for dependencies such as `esbuild` and `sharp`.

### Verify the frontend

A basic Vite check can be run with:

```bash
npm run dev
```

This usually starts the frontend on a local Vite URL such as `http://localhost:5173`.

For normal Share & Learn development, prefer `netlify dev` after Netlify has been linked, because the app also uses Netlify Functions and other Netlify services.

## Netlify CLI setup

Install the Netlify CLI globally:

```bash
npm install -g netlify-cli
```

If npm blocks install scripts for the global Netlify CLI install, review and allow only the required packages rather than changing the global npm policy unnecessarily.

Verify installation:

```bash
netlify --version
```

Log in:

```bash
netlify login
```

Use the Netlify account that has access to the existing Share & Learn project.

Verify login:

```bash
netlify status
```

At this point it is normal for Netlify to say the folder is not yet linked.

### Link the local repo to the existing Netlify project

From inside `C:\GitHub\shareNlearn` run:

```bash
netlify link
```

Link to the existing project:

- **Admin URL:** `https://app.netlify.com/projects/share-n-learn`
- **Project URL:** `https://share-n-learn.netlify.app`

Do **not** create a new Netlify project for this repository.

Netlify stores the local project link under `.netlify/state.json`.

### Run Share & Learn locally

Use:

```bash
netlify dev
```

This is the preferred local development command because it runs the frontend together with the Netlify development environment, including local routing for Netlify Functions and project configuration.

Open the localhost URL printed by Netlify CLI. It is commonly `http://localhost:8888`.

Stop the local server with:

```text
Ctrl + C
```

## Local-to-production workflow

The normal development flow is:

```text
VS Code
   ↓
C:\GitHub\shareNlearn
   ↓
netlify dev
   ↓
Test locally
   ↓
GitHub Desktop
   ↓
Review changes → Commit → Push
   ↓
GitHub: anidurg/shareNlearn
   ↓
Netlify production deployment
```

Saving a file locally does **not** publish anything.

A production deployment happens after changes are pushed to the production branch.

## Before changing code

- Understand the requested behavior before editing.
- Check whether the capability already exists and can be extended simply.
- Keep changes small and focused.
- Test locally with `netlify dev` before committing when practical.
- Preserve existing data unless deletion is explicitly part of the requirement.
- Keep authorization and privacy enforcement on the server; hiding a UI control is not sufficient security.
- Do not hard-code live user or content records into React components.
- Prefer the existing architecture and patterns over introducing a new subsystem.
- Preserve the mobile-first, app-like experience.
- Avoid adding ratings, review mechanics, infrastructure, or complexity unless the product requirement calls for them.

## GitHub and deployment

The repository is **anidurg/shareNlearn** and the production branch is **main**.

Before modifying an existing GitHub file, fetch the current version from `main` and work from its latest SHA. Use a clear commit message.

**Important:** commits pushed to `main` automatically trigger a Netlify production deployment. Treat every push to `main` as a production-affecting action.

When working with an AI assistant, do not let it commit or publish changes merely because you are discussing an idea. Make sure the requested change is understood and explicitly approved before publishing.

As the team grows, prefer feature branches, pull requests, and Netlify Deploy Previews so changes can be reviewed and tested before they reach `main`.

## Product principle to preserve

Share & Learn is not trying to replace messaging, cloud storage, email, websites, or social media.

Its purpose is to make worthwhile shared knowledge easier to preserve, organize, discuss, and find again.

**Share → Preserve → Organize → Rediscover → Connect**

> The content may live elsewhere. The community knowledge around it lives in Share & Learn.

When in doubt about a proposed feature, prefer the simplest implementation that strengthens that purpose.
