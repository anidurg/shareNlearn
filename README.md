# Share &amp; Learn

Share &amp; Learn is a members-only app for a small group that likes to swap what it picks up during
the day. A member can record a song straight from the browser (or upload one they already have),
write down the recipe they just cooked, add a fun fact, add a vocabulary word with its meaning
and an example, log a book they finished so the rest of the group has something to read next, or
write down the remedy their grandmother swore by before it is forgotten.
Everything shared lands in a mixed "Recent shares" feed on the home page — which can be narrowed to
one topic or one circle, searched, and grouped by topic — and every member can save anything into
their own library.

Who sees a share is decided by **circles**. A circle is a group around a shared interest: Book Club,
kannada literature, Travel lovers. Anyone can start one, keeps it as its owner, and belongs to as
many circles as they are invited into or join — and two members can each keep a circle called Book
Club without getting in each other's way. When something is shared, its circles are ticked on the
form ("Share with: ☑ Music Lovers ☑ Family ☐ Book Club"), and one post reaches several circles
without being posted twice. Every post in a feed says which circle it came from, and notifications
about a circle only reach the people in it.

The group grows by invitation: a member creates an invite link, sends it however they like, and when
the friend opens it and creates an account everybody involved gets a notification. Share &amp; Learn
also installs to a phone or desktop like any other app, so it can be opened from the home screen
instead of a browser tab.

Two deletions are deliberately different:

- **Remove from My Library** only affects the member who saved the item.
- **Delete for everyone** is available to the member who shared the item, and to nobody else.

A library is independent of circles as well: what you saved stays saved after you leave the circle it
came from, and only goes away if whoever shared it deletes it or makes it private.

## Sections

| Section         | What it holds                                                                  |
| --------------- | ------------------------------------------------------------------------------ |
| **Home**        | Greeting, "What would you like to share?" shortcuts, and the recent-shares feed across every circle you are in |
| **Songs**       | Record or upload a recording; play, save, edit or delete your own               |
| **Recipes**     | Ingredients, method, notes, preparation time, with a full recipe page and its Experiences & Tips |
| **Learn**       | Fun Facts and Vocabulary together, so the navigation stays short                |
| **Books**       | What everyone has read, with a rating, a why-read-it line, a quote, and the discussions and likes it has collected |
| **Remedies**    | Traditional family remedies: what they are used for, ingredients, preparation, how to use, who they were passed down from, and what happened when members tried them |
| **Circles**     | Your circles, invitations waiting for you, people waiting to join yours, and circles you could join — each circle has its own page and its own feed |
| **My Library**  | Saved songs, recipes, facts, words, books and remedies, each removable from your list alone |
| **Profile**     | Account details, contribution counts, the friends you invited, and installing the app |

On phones the same sections appear as a fixed bottom bar — Home, Songs, Recipes, Learn, Books,
Remedies, Circles, My Library — and Profile stays reachable from the header.

Because remedies touch on health, every place they appear — the section, a single remedy, the form,
and the saved-remedies list — carries a plain note that they are shared family traditions rather
than medical advice, and that a qualified healthcare professional is the right call for anything
serious or persistent.

## Saying something back

A book card reads as the title, its stars, who shared it, and two counts:

```
📘 The Alchemist
⭐⭐⭐⭐⭐
Shared by Anita
💬 12 Discussions      👍 18 Likes
```

Both counts are buttons. The first opens the discussions in place — a book has no page of its own —
and the second is the like. Anyone who can see the book can start a discussion ("Which chapter
impacted you the most?"), join one, or like it: saying something back is a contribution, not an edit
of somebody else's share. Starting one tells the book's circles, and joining one tells the member who
asked and the member who shared the book:

```
📘 Anita started a discussion on Atomic Habits
"Which chapter impacted you the most?"
12 people joined the discussion.
```

Once a thread has a few replies in it, any member can ask for a **Discussion Summary** — the
aggregate of what people said, in a handful of lines:

- Most readers loved the themes of discipline and consistency.
- Several people preferred the audiobook.
- A few readers felt the examples became repetitive.

The summary is written through Netlify's AI Gateway and cached until the thread grows past it. It is
a convenience rather than a dependency: where no gateway is configured there are simply no
summaries, and everything else about a discussion works as it did.

Recipes carry **Experiences & Tips**, and remedies carry experiences plus anything else a member
added — what actually happened when somebody cooked it or made it, a tip for whoever tries it next,
or an extra step their family adds. A note belongs to whoever wrote it and can be taken back by them
or by the member who shared the recipe or remedy. A card shows how many there are, and says nothing
at all when there are none.

## Circles

Starting a circle asks for a name, a description, an icon (an emoji, picked from a grid or typed in),
an optional cover image, and how open it is:

| Privacy          | Who can get in                                          |
| ---------------- | ------------------------------------------------------- |
| **Private**      | Invitation only                                         |
| **Discoverable** | Listed, and anyone can ask the owner to let them in     |
| **Public**       | Listed, and anyone can join on the spot                 |

While creating one, the owner ticks people from their contacts — the members they already share the
group with — and each of them finds an invitation waiting on the Circles page, to accept or turn
down. Later invitations work the same way, from the circle's own page.

The owner can edit the circle, invite people, approve or turn down requests to join, remove members,
change the privacy, and delete the circle. Everybody else in it can read its posts, share into it,
save from it, and leave it — and nothing more. The owner is not removable; deleting the circle is
their way out.

A circle's page carries the same mixed feed as Home, narrowed to that circle and with its own search
box, so "what did Book Club share" is one place rather than a filter to remember. Deleting a circle
does not widen anything: a post that was only ever shared into that circle becomes private to
whoever wrote it.

## Inviting a friend

"Invite a friend" is a shortcut on Home and a section on Profile. Creating an invite produces a link
that only the inviter has; it can go out through the phone's share sheet, WhatsApp, email, a text
message, or a plain copied link. Opening the link shows a welcome screen naming whoever sent it,
with a way to create an account or log in — and because a confirmation email can land the friend
anywhere in the app, the pending invite is remembered until it has actually been accepted.

Accepting an invite writes three notifications: one the whole group sees saying who joined and who
invited them, a welcome addressed to the new member, and word to the inviter that their invite was
taken up. An invite is single-use, can be withdrawn while it is still waiting, and accepting it twice
does nothing the second time. Invites the inviter no longer wants stay listed as history.

## Installing it as an app

The site ships a web app manifest, app icons, and a service worker that caches the shell so the app
opens instantly and still shows something useful without a connection. API traffic is never cached.
Where the browser supports it, an "Install" button appears (in the Profile section, in the invite
share sheet, and in a dismissible banner); on iOS, which has no install event, the app explains the
Share → Add to Home Screen route instead. Once installed, the button disappears and the app reports
itself as installed.

Icons are generated rather than checked in by hand:

```bash
node scripts/generate-icons.mjs
```

## Tech stack

- **Frontend**: Vite + React + TypeScript, hand-rolled CSS (no UI framework), hash-based routing.
- **Auth**: [Netlify Identity](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/)
  via `@netlify/identity`, with open registration. Functions read the caller from the `nf_jwt`
  cookie with `getUser()`.
- **API**: Netlify Functions (`netlify/functions/*.mts`), plain Web Request/Response handlers.
- **Structured data**: Netlify Database (managed Postgres) via Drizzle ORM — `songs`, `recipes`,
  `facts`, `words`, `books`, `remedies`, `saved_items`, `learned_words`, `invites`,
  `notifications`, the circle tables `circles`, `circle_members`, `circle_invites`,
  `item_circles` and `members`, and the tables that hold what the group said back —
  `book_discussions`, `discussion_replies`, `item_likes` and `item_experiences` — defined in
  `db/schema.ts`. A discussion, a like and an experience are rows of their own rather than columns
  on the share they sit on, because each one belongs to whoever contributed it, and every count is
  derived from those rows rather than stored. A notification with no member id is for
  the whole group; one with a member id is addressed to that member alone; one with a circle id
  reaches that circle's members. `item_circles` is what lets a single post belong to several circles
  at once, and a post with no rows there still reaches the whole group, as everything did before
  circles existed.
- **File storage**: Netlify Blobs — the binary bytes only. A recording is uploaded in parts
  (a function accepts a 6 MB request body at most), stitched together server-side, and played back
  through a streaming endpoint that honours HTTP range requests so seeking works. Circle cover
  images live in their own store, with the row keeping just the key.
- **Recording**: the browser's own `MediaRecorder` and microphone; pronunciation uses
  `speechSynthesis`.
- **Summaries**: Netlify's AI Gateway, called server-side from `netlify/lib/discussions.ts`, so the
  credential never reaches the browser. A summary is asked for rather than automatic, cached on the
  discussion, and skipped entirely where no gateway is configured.
- **Installable app**: `public/manifest.webmanifest`, generated PNG icons in `public/icons/`, and a
  service worker in `public/sw.js` registered only in production builds.

## Running locally

```bash
npm install
netlify dev --port 8889
```

`netlify dev` proxies the Vite dev server and emulates Netlify Functions, Identity, Database, and
Blobs locally, so the app behaves the same as it does when deployed. Sign up from the login modal
(registration is open), then record a song or add a recipe to see it appear in the feed. Start a
circle from the Circles section to watch a share carry the circle it went to.

## Database migrations

Schema lives in `db/schema.ts`. After changing it, generate a new migration:

```bash
npx drizzle-kit generate --name <descriptive_name>
```

Migration files land in `netlify/database/migrations/` and are applied automatically by Netlify
at deploy time — never run `drizzle-kit migrate` or `push` directly, and never edit a migration
that has already been applied.

## Not built yet

- Sharing with one named person. A share goes to the circles it names, to everyone in the group when
  it names none, or stays private to its author.
- Emails sent by the app itself. A group invite is a link the inviter passes on; a circle invitation
  waits for its member inside the app. The app fills in a draft for email or a message but does not
  send anything on its own.
- Push notifications outside the app. Notifications live in the bell menu and are read when the app
  is open.
- Replying to a song, a fun fact, a word, or a post in a category a circle invented. Books have
  discussions and likes, recipes and remedies have experiences and tips; the other kinds have
  nothing to say back with yet. Reporting is absent everywhere.
- Editing a discussion prompt, a reply or an experience once written, threaded replies, and a
  notification when somebody likes a book you shared.
- Serving sizes on a recipe.
- The daily vocabulary quiz.
