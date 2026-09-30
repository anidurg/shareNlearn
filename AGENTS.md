# AGENTS.md

## What this project is

Share & Learn: a members-only group sharing app. Members log in and share six kinds of things —
songs (recorded in the browser or uploaded), recipes, fun facts, words worth keeping, books they
have read, and traditional family remedies — plus anything else a circle invents a category for.
Everything
shared appears in a mixed "Recent shares" feed on the home page — filterable to one topic or one
circle, searchable, and sortable by date or grouped by topic — generates a persistent
notification for the people it was shared with, and can be saved by any member into their own
library.

**Anybody may join.** Signing up is open: an account is created, and the member is put straight into
**Discover** — the circle everybody is in — so their first visit has something to read and somewhere
to post. Invites still exist and are still worth sending, because a link brings a friend into a
particular circle rather than only into the group, but nothing waits on one. What is still the app's
own record rather than Identity's is what happens after the door: an admin can pause an account,
which is refused at login and on every request, and starting a circle of one's own waits until the
account is trusted — a few days on the clock and a circle already joined — or
until an admin vouches for it. Both of those are the app's own records, which is the point: the rule
once also asked for a confirmed email and could never be satisfied, because the session token a
function reads carries no such field, so every member was told to confirm an address they had already
confirmed. The first account in an empty group is still special in one way: it
founds the group and is its admin.

**Each circle is run by its own people.** Its owner, and any member they make an admin, have the
same say over it: they answer the reports raised in it, approve requests to join and remove members,
invite people, edit its details and its privacy, switch its categories on and off, shape what its
forms ask, hand the admin role to somebody else, and close the circle. There is no second, narrower
question about who owns it — looking after a circle is the whole of the answer. What survives of
ownership is one exemption and nothing more: the owner cannot be removed from the circle or demoted
out of it, and cannot leave, deleting it being their way out. A **global app admin** exists for the exceptional cases only: abuse
no circle can settle, and technical support. The levers are few by design — vouch for an account,
pause or reinstate one, hand the role on — and an admin cannot pause or demote themselves, so the
group is never left without one.

**Every post carries a ⋮**, and the three things behind it are deliberately different. **Report**
tells the circle's admins and changes nothing on screen. **Hide** is the reader's own view, silent
and undone from Profile. **Block user** is mutual and silent, and takes everything that member wrote
out of the reader's app at once. None of them deletes anybody's work: a moderator who takes a share
out of a circle drops it from that circle, and a share that leaves its last circle becomes private
to its author — exactly what would have happened had they made it private themselves. Deleting is
still the author's own button.

**Circles** are the audiences. Any member can start a circle (a name, a description, an emoji icon,
an optional cover image, and a privacy setting of **Private**, **Ask to Join** or **Open to
All** — the first two are somebody's decision, and the third is the one door nobody has to answer,
so a member who has just arrived can find their first circle themselves), owns the ones
they start, and belongs to as many as they are invited into or join. Two members can each keep a
circle called "Book Club" without either one blocking the other. Every share names the circles it
goes to — one post, several circles, no duplicated rows — and each post in a feed shows which of the
reader's circles it came from. Notifications about a circle reach only that circle's members. An
owner or any of its admins may edit the circle, invite and remove members, change its privacy, and
delete it; a plain member may read it, share into it, and leave it, and nothing more.

**Categories** are what a circle is for. Starting one ticks the built-in categories it should
have — Songs, Recipes, Fun Facts, Word Explorer, Books, Remedies — and "+ Add category" invents one
that exists in that circle alone (Festivals 🎉), with a name and an icon. A custom category is
never offered in another circle, not even to the same owner. Each category has its own
**taxonomy tree** — Appetizers, Rice Items, Sweets, and as far down from any of them as the circle
wants to go: Vegetarian › South Indian › Karnataka, with no ceiling in sight but the one the code
keeps. Every node carries an optional parent, a node with none sits at the top level, and the whole
tree belongs to that circle and that category alone. **A category page is walked rather than read
flat**: it shows a breadcrumb of where the reader is — `Events › Raghavendra Swamy Aradhane ›
Songs`, every step of it a way back up — and beneath it one chip per node directly under that one,
with a count on each: the exact count on a leaf, and the whole branch's on a node with children, so
a parent never reads as emptier than what is under it. Tapping a chip moves into that node, which
lists everything filed on it and anywhere below it, and offers that node's own children in turn.
The page used to print the whole tree at once as `Aradhane`, `Aradhane › Bookmarks` and `Aradhane ›
Songs` side by side, which said the parent's name three times and made it look like a sibling of
what is inside it. **A level with children is a place to look around from, and a level without one
is a list to read**, and the page is two different things accordingly. Somewhere with children
leads with those children and then **Recent uploads** — the newest five from that node and anywhere
below it — with a quiet "View all →" after them when there is more, because a landing page is for
finding out what is here rather than for reading all of it. Somewhere with no children is the
listing itself with the same two controls above it. **The page is one shape at every width**, the
same way the circle cards are: the header is the way back, the icon, the name and the count and
nothing else — the wide "+ Add a book" that used to sit in it was the first thing off the side of a
320px screen — the subcategories come directly under it as `Subcategories  Manage`, and adding to
the category sits on the **Recent uploads** line where the list it adds to is, worded twice and
shown once (`+ Add a book` where there is room, `+ Add` on a phone). Adding is offered only to
somebody actually in the circle, since a public circle is readable by anybody who has come to look.
The search box and the sort — Newest, Oldest,
Title A–Z, Title Z–A — are on every level, because a reader who knows what they are looking for
should not have to walk to it; using either one is itself a way of asking for the whole list, so on
a landing page they open the listing rather than filtering the five rows under them, which is the
only honest thing to do with a truncated list.
The row of chips leads with **All (n)**, which is a statement of where the reader is rather than
somewhere to go: no child chip is ever the selected one, since tapping one navigates, so All is
always the current state and is drawn as such — pressed, counting everything filed here and below,
and asking for the whole of that list rather than the five recent rows when it is tapped on a
landing page. What there is *not* is an "Everything" chip that leads anywhere: the list under the
chips already *is* everything filed here and
below, so a chip leading to the page it was drawn on was a way of standing still, and it took the
eye first on every page a reader was meant to be browsing. Nor is there a note saying nothing sits
under a childless node — it was printed on top of a full listing and read as though the page were
empty. And a row in the list names only the part of its path that the breadcrumb has not already
said: nothing at all for something filed exactly here, and `Aradhane › Songs` for something that
came from further down. Counts are always derived from the posts the
reader may see, never stored. Filing is optional and never forced downwards: **a share may attach at
any level**, so a recipe filed under Vegetarian is a finished answer and nobody is made to pick
Karnataka to give it. Every share form offers the whole tree, indented, plus
"No subcategory", so a member can post now and classify later, and "+ Add new subcategory" lets
them make a node mid-post under whatever is selected — the parent is named on screen and can be
changed there, and a near-duplicate among that node's own siblings is caught first and offered as
"Use Sweets" instead, since Karnataka under Vegetarian and Karnataka under Non-Vegetarian are two
real places rather than a duplicate. Whether a plain member may invent one at all is the circle's own
setting (`memberTaxonomy`, asked as "Who can add subcategories" when a circle is started or edited);
where it is off, the tree is the owner's and the admins' alone and the server refuses either way.
**And a share does not have to go where its kind usually goes.** A recording of the Rathotsava
procession is a song, but in a circle that invented Events it belongs in Events, so every share form
carries "File under" beside the shelf: the categories the chosen circles invented, and nothing else,
because offering Songs as somewhere to put a song would be the same answer twice. Picking one moves
the share on that circle's category page and swaps the shelves under it for that category's own, so
Events offers Processions and Weddings rather than Bhajans and Keertanes. The choice names one
circle, because a custom category exists in one circle — a song shared into three of them is an
Events entry in the one and an ordinary song in the other two, and each circle keeps its own answer.
Filing under nothing in particular is still the ordinary case and still what every share said before
the question could be asked.
**A category a circle invented can also ask its own questions.** Every one of them shares the same
form — a title, some details, a shelf — so a circle makes that form fit what the category is
actually for, and whoever adds a question says what to ask and what kind of answer it takes: a line
of text, a paragraph, a tick box, a dropdown of choices they write, an upload — a PDF, a Word
document or an Excel workbook — or a link, a web address, which every
reader afterwards sees as something to tap rather than as a line to copy out. The question is added
to the category
rather than to the post, so Stotras asks every author afterwards which deity it is to, and
Travelogue asks which country. Unlike a shelf, which any member may add mid-post, a field is the
shape of the form itself — everybody afterwards is asked it, and a needed one they have to
answer — so it belongs to the people who answer for the circle: its owner, the admins they
chose, and the app admin stepping in. A plain member never sees the door, and the server refuses
them either way. Renaming, reordering, moving one, marking one needed and switching one off belong
to the same people, because those reshape a form everybody else has already answered and that is
exactly the kind of decision looking after a circle is.
Switching a field off stops the
form asking and keeps every answer; removing it is the one action that takes them, and says so
first.

**Configuring a form and filling one in are two different jobs, so they are two different
screens.** A keeper opens **Manage fields** — from a category's own page, or from the Books or Songs
tab header — and reads **the whole form**, not only the part of it that is stored. The built-in
questions the form ships with come first, each with a small padlock beside its name and the word
`Built-in` at the end of its line — `Book title 🔒 · Short text · Required · Built-in`,
`Author 🔒 · Short text · Optional · Built-in` — and under them the circle's own, worded the same
way and marked `Custom`: `Composer · Long text · Optional · Custom`, `PDF version · Upload (PDF) ·
Optional · Custom`. A custom row carries a **⋯** holding Edit, Move up, Move down, Make required /
Make optional, Disable and Delete; a built-in row carries no ⋯ at all, because a built-in field is
written into the form's own markup and there is no row anywhere to rename, reorder or switch off —
the lock is honest rather than decorative, and inventing hide-and-reorder rules the forms do not
have would be worse than saying so. Then a plain **+ Add field** under them all. Nobody has to
start writing a book in order to add a question to the Books form, which is what the old "+ Add a
field to Stotras" button on the share form required — and that button is gone rather than reworded:
a share form now renders the configured fields and nothing else, for a keeper exactly as for
anybody else, because a form that can change its own shape while being filled in is two jobs on one
screen. Adding one asks four things — the label, the kind of answer, whether it is required, and an
optional line of help — plus the choices when it is a dropdown, and three more when it is an
upload: **which documents it takes** (PDF, Word, Excel — any of them by default), **how big** one
may be (the platform's own ceiling, or something smaller the circle would rather ask for), and
**one file or several**. The upload rules are the field's own and are kept on both sides: the
device's picker is opened on the right documents, the browser refuses the wrong one before it is
uploaded, and the server refuses it again when the share is saved, which is the check. A field
narrowed after the fact retires nothing — a document already answered stays where it is.
So a circle can ask for "PDF version of the book" as an upload that takes a PDF, is not required,
and carries the help text the form itself offers to write:
*"Upload only if you own the rights or have permission to share this file."* The app never suggests
that anybody may upload somebody else's book, and the sentence is a suggestion rather than a rule
because the app cannot know what a member has permission to share. What a reader sees on the share
afterwards is the attachment itself — `PDF  atomic-habits.pdf · 1.2 MB  Open PDF` — one row per
document, so the answer to "is there a copy?" is a thing to tap.

**Two of the built-in kinds can be asked their own questions too.** Songs and Books carry the
same **Manage fields** their invented cousins do, because those two are the ones a circle wants to
know something particular about — which deity a recording is to, whether there is a copy of the book
to lend — and a hand-built form cannot know in advance what that is. The remaining four are the same
in every circle: `FIELDED_BUILT_INS` is where that list lives, `categoryTakesFields()` is the test on
both sides, and opening a fifth kind up is one entry in each — plus its form's own built-in row list
in `builtInFormFields()`, which is what the locked rows are read from. All of it is one field builder
rather than one per category: `src/fields.ts` holds the vocabulary, `ManageFields` is the single
view, and a new category — invented or built-in — gets the whole feature by being passed to it.
Any share may also carry photos, which is entirely optional: the form shows what has been added, an ×
takes one back out, and a "+" adds another up to ten, so a recipe can hold the finished dish and the
handwritten page it came from, and a remedy the plant it is made of. A word is the one exception —
Word Explorer reads as a dictionary, so a word has no pictures at all.

**A post in a category a circle invented can be read in more than one language.** A circle that
starts Stotras or Travelogue is rarely all reading the same one, so the form that adds to such a
category asks whether the details should be readable in other ways and, if they should, takes
as many as the author wants of eight, which are two different offers under one heading. Four of
them — Kannada, Hindi, Telugu, Tamil — say what the post *means*. The other four — Devanagari,
Kannada script, Telugu script, Tamil script — keep every word and the sounds of it and change only
the letters, which is what somebody who reads Devanagari and nothing else needs in order to read a
Sanskrit stotra, and what somebody who reads only Kannada needs in order to sing one.
Every reader then sees a link
per language under the post, and tapping one opens the same details written that way. It is written
once and kept, so the second reader pays nothing, and it is tied to the words
it came from — editing the post quietly retires the old versions rather than showing a stale one.
Changing the letters is a lookup table, so it is done exactly and instantly, in the function itself,
by the table [Aksharamukha](https://aksharamukha.appspot.com) publishes rather than by a round trip to
it; saying what the words mean is a reading, so it
goes to the AI Gateway. Each panel says which of the two it was, because they are not equally
trustworthy. What the AI is asked to do is deliberately narrow: **say what the author wrote in
another language** — never add a sentence, never explain, never answer a question the post happens
to ask.

**And a script most keyboards cannot type is no longer a reason not to write.** Both the lyrics field
and a custom category's details carry "⌨ Type in English letters instead": type `vakratuNDa
mahaakaaya`, pick Kannada, and ವಕ್ರತುಂಡ ಮಹಾಕಾಯ is added to what is already there. It converts on a
tap rather than as you type, because half a word converts to nonsense, and it adds rather than
replaces, so a verse can be built a line at a time. It asks which roman convention the member
uses — Itrans, IAST, ISO 15919 or Harvard-Kyoto — rather than guessing, since `aa`, `ā` and `A` are
three conventions' answer to the same vowel.

Hiding a category takes it off the circle page: no post is ever deleted by an admin action. A
hidden category stops accepting new shares and is not drawn under "What this circle is for" at
all — no faded tile and no badge, for whoever looks after the circle exactly as for anybody else,
because that grid is what the circle can be used for — while keeping everything in it, and showing
it again brings it back exactly as it was. It is **Hide** and **Show** in the categories manager
rather than Disable and Enable, since nothing about the category is switched off; the manager is
also the only place a hidden one can be read, so it lists every category the circle has. Only a custom category can be
removed for good, only once hidden, and only after saying what happens to its posts — move them to
another category, or let them go, which makes each one private to its author. Either way the
authors are told. Only its posts are ever at risk that way, because a category is the whole of where
a post lives; a song somebody filed into it is still a song, and it follows the posts into the new
category or simply goes back to Songs, losing only the shelf, which belonged to the category that is
going. Deleting a node of the tree leaves its posts in the category, unfiled, and promotes its
children one level rather than taking a branch down with it — the one thing nobody pressing a button
on Karnataka means is to lose everything under it.

**Managing the tree is a tree.** Whoever looks after a circle — its owner, the admins they chose, or
the app admin standing in — reads the taxonomy as an expandable list, each node collapsible by the
▸/▾ beside it and indented by how deep it sits, and each node offering the same five things:
**Add child**, **Edit** (rename), **Move…** (to another parent, or to the top level), **Disable**
(hide it, reversibly) and **Delete**, with **Merge…** beside them for folding one node into a
sibling. Adding a child names the parent's full path on screen before anything is typed, because a
node made in the wrong branch is worse than no node at all. Reordering is between siblings, since
that is the only place order means anything. Moving is refused where it would make a cycle, put a
node inside its own branch, or push a subtree past the depth the code keeps. Nothing here is a
courtesy of the interface: every one of the eight is gated server-side on `moderatorOf()` for that
particular circle, so an admin of one circle can do none of it to another.

**Word Explorer** is the words category, and it reads as a dictionary the group wrote rather than a
list of cards. The surface is a search box, an "+ Add Word" button and "Recently Added" — the words
by name, newest first; searching matches the word, its meaning and its language. Tapping one opens
it: language, meaning, example, pronunciation, notes, who added it and when. Synonyms and antonyms
are optional and their sections simply are not there when nobody typed any. A word carries no
pictures — the entry itself is the whole of it. Below them sit its **language connections**, the same idea in other tongues
(Greek osteon, German Knochen, Hindi अस्थि). The member adding a word usually already knows a few of
them, so the **Add Word form takes them alongside the meaning** — a language, the word in it, and
optionally how it connects, with a "+" for another — and the word arrives with them rather than
having to be opened again afterwards. Any member the word reaches may add one later, not only its
author, because a connection is knowledge somebody else has rather than an edit of the entry;
whoever added it and the word's author may take it back. A word with none says "No language
connections yet." and offers to add the first. Editing a word does not edit its connections: they
live on the word itself, where everybody it reaches can reach them.

**A song carries its words and the conversation about it.** Sharing a recording — sung into the
browser or uploaded — takes an optional **Lyrics** field and the language they are written in, in
whatever script the member types, with the same "type in English letters" converter beside it. Under
the player the words appear as they were written, and beside
them four buttons — **ಕನ್ನಡ Kannada**, **తెలుగు Telugu**, **देवनागरी Devanagari**, **हिन्दी Hindi** —
each of which opens a new section below the recording holding the same words in that script: the
first three are transliterations, the same sounds in different letters, done exactly and in a
millisecond by the Aksharamukha mapping tables, and Hindi is what the lines
mean, which the AI Gateway writes. The rendering is done once and kept, so the second reader pays
nothing, and
it is tied to the words it came from — editing the lyrics quietly retires the old renderings rather
than showing a stale one. What the AI is asked to do is deliberately narrow: **convert the words the
member wrote**, never recall, complete or fill in a song it thinks it recognises, because a model
reciting a recording's lyrics from memory would be reproducing somebody else's copyrighted words and
would get them wrong besides. A recording with no lyrics simply has no such section, and its author
is invited to add them.

Songs hold discussions for the same reason books do, and the question a listener most wants to ask is
which raga it is built on. A card carries "💬 3 Discussions", which opens the threads in place, and
any member the recording reaches may start one, reply to it, or ask for a summary once it is long
enough.

**Books hold discussions**, because a book read alone is only half of it. A book card carries the
title, its stars, who shared it, and two counts — "💬 12 Discussions" and "👍 18 Likes" — both of
which are buttons: one opens the threads in place, the other is the like itself. Any member the book
reaches may start a discussion ("Which chapter impacted you the most?"), join one, or like the book,
because saying something back is a contribution rather than an edit of somebody's share. Starting one
notifies the book's circles — "📘 Anita started a discussion on Atomic Habits" — and joining one
tells the member who asked and the member who shared the book that 12 people have now joined. Once a
thread has a few replies in it, any member can ask for a **Discussion Summary**: a handful of
aggregate bullets ("Most readers loved the themes of discipline and consistency." / "Several people
preferred the audiobook." / "A few readers felt the examples became repetitive."), written by the AI
Gateway and cached until the thread grows past them. A summary is a convenience — where no gateway
is configured, everything else about a discussion still works. A discussion is the same thing on a
book and on a song, and is one mechanism rather than two; a like is a book's alone.

**Recipes collect "Experiences & Tips"** and **remedies collect experiences plus anything else a
member added**, which is the same idea one step further: what actually happened when somebody cooked
it or made it. A note is an experience, a tip, or something extra, and it belongs to whoever wrote
it — removable by them and by the member who shared the recipe or remedy. A card shows how many
there are and says nothing at all when there are none.

Navigation is circle-first, and one circle at a time: **Circles is the landing page, and a circle's
own page is where a circle is read**. There is no dashboard in front of it. Arriving in the app —
after logging in, from the tab bar, from the mark in the corner, from an installed app's
`start_url` — lands on **Circles**: the heading, one line saying what the page is for,
invitations and requests waiting, **Your circles** with the search box under the heading, the cards
themselves, and the circles you could join. Nothing greets the member
by name there; the page is a list of doors and reads as one, so the search sits with the list it
searches rather than above the whole page. Starting a circle is offered at every width and exactly
once, in one of two shapes: **+ Start a circle** in the top-right corner of the header where there
is room for the words, and a small **+ New** chip on the **Your circles** line — `Your circles
+ New` — on anything phone-shaped. A phone never gets the worded one. It is a wide primary button
in a header that already holds a title, a subtitle and the app's own chrome, and on a narrow screen
it ended up half off the side of it, reachable only by turning the phone sideways, which is not a
way to start a circle.

**A card is the door, and its ⋯ is everything else.** Tapping anywhere on a circle's card opens that
circle and makes it the current one; there is no **Open** button on it any more, because a card whose
whole job is to be opened does not need a button saying so, and three small controls beside a
circle's name is what a phone has least room for. The ⋯ in the top-right corner opens a bottom sheet
instead — `Edit circle`, `Invite people`, `Manage members`, `Admin tools`, `Leave circle`,
`Delete circle` — holding only what this member may actually do, since a row nobody can use is worse
than no row, and stopping the tap from reaching the card so the two can never fire together.
Leaving and closing a circle still ask first. The sheet is one markup at every width, like
everything else here: it reads as a phone's sheet and works as a dialog on a desktop.

The circle's page is what Home used to be and says so
plainly: `← All circles` back to the listing, then the circle's icon, its name as the page title,
`7 members · Open to all · kept by …`, its description, its branches if it has any, then its
categories as the grid you navigate by and the mixed feed narrowed to it. The grid is the only way
in on purpose: a tile opens its category and the buttons that add to it, so a second row of the same
choices would only have said it twice. Two circles with different categories therefore give two
different pages, which is the point: the circle determines the navigation.

Opening a circle **is** switching to it — one act rather than two. `switchCircle()` chooses the
circle and then navigates to its page, so the header dropdown has already moved by the time the page
draws, and a shell effect keyed on the route chooses it again for every other way of arriving (a
tapped notification, a pasted link, the back button, a branch crumb). Sitting on Austin Madhwa
Sangha's page while the corner says Discover is the one thing that has to be impossible: it is two
answers to the same question and makes every "in this circle" on screen a guess. Which circle that
is lives on the device rather than the server, because it is where somebody last was rather than
something the group needs to know; joining a circle, accepting an invitation, starting one, opening
one from Profile or from the listing all make it the current one. The switch itself is asked for
**once**, in the header dropdown, and nowhere else. Profile still carries **My Circles** — every
circle the member is in, the current one tagged — because that is a list of what each circle is
rather than a second picker, and switching from a row there opens that circle. The
tab bar is Circles, Members and My Library, in that order — and only those three, on every
width. Profile is reached from the header instead, where the top-right corner is a plain **Profile**
button rather than the member's own name: a name there was decoration that read as a menu, and the
one thing anybody actually wanted from it was the page it now goes to. Logging out lives on that
page, and on both `AccessGate` screens, which are the two places a member can be with no Profile to
reach. The six per-type routes still exist so old links and the PWA shortcuts keep working,
and each of them shows what the circle in view holds rather than everything across every circle.
`#/home` is answered too — the `MOVED` map in `src/router.ts` lands it on Circles — because an
installed app's `start_url` and every bookmark still say it.

The circle in view is chosen from a **dropdown in the top-left corner of every screen**, beside the
mark. Its first entry is **All circles** — everything the member can see, nothing narrowed — which
is where the app opens and what the Circles listing under it is showing; a member who has narrowed
to one circle picks it to get back out. Then the member's own circles — picking one opens that
circle's page — and
below them the circles that are Open to All and they are not in yet, where picking one joins it
first and then switches. A circle that has to be asked about is not in the menu: asking is a
conversation, and it belongs on the Circles tab. Somebody with no account is offered no "All
circles": they have one circle to look at and no listing to widen to, so the corner goes on naming
it.

**The corner follows the page as well as leading it.** While the Circles listing is on screen it
reads All circles whatever the member last narrowed to, because a corner naming one circle above a
page showing all of them is the header disagreeing with the page — and that was the very first
screen anybody saw. That is an override rather than a choice: nothing is written down, so stepping
off the listing onto Songs still narrows to the circle they picked. Widening for good is what the
dropdown's own All circles does.

**A visitor gets the shop window on the same page.** Somebody with no account lands on Circles and
reads what the app is *for* and not a word of what anybody put in it: the opening message, the
default circle's name, the categories it holds with no counts on them, and "Discover more when you
join us" with Create account and Log in. Every tile is the way in. That used to be Home's job and
came here with the tab; there is no feed to hide, `visibleTo()` answering a visitor's listing with
nothing at all.

Two deletions are deliberately distinct and must stay that way: removing an item from **My Library**
only affects the member who saved it, while **Delete for everyone** is restricted to the member who
shared the item. A library is also independent of circles: what a member saved stays saved after they
leave the circle it came from, and only disappears if the original is deleted or made private.

Members grow the group with invite links, and the whole thing is installable as a PWA so it can live
on a home screen rather than in a tab.

## Directory layout

- `public/` — copied verbatim into the build; this is the installable-app surface.
  - `manifest.webmanifest` — name, icons, `start_url` of `/#/circles` (Circles being the landing
    page), standalone display, theme colours, and the Home-shortcut entries.
  - `sw.js` — the service worker. Navigations are network-first with the cached shell as fallback,
    hashed build assets and Google Fonts are cache-first, and anything under `/api/` or
    `/.netlify/` is left alone entirely so no API response is ever served from a cache. Bump
    `VERSION` when the caching rules change, or when anything cached by name rather than by a
    hashed filename does — the manifest, the icons, the favicon, the font; old caches are deleted on
    activate.
  - `icons/` and `favicon.svg` — generated by `scripts/generate-icons.mjs`, not hand-drawn. Re-run
    `node scripts/generate-icons.mjs` after changing the mark or the palette.
- `src/` — Vite + React + TypeScript frontend.
  - `src/App.tsx` — the shell: header, `Nav`, hash-route switch, and the creation modals launched
    from the header and from a circle. Holds `useCurrentCircle(store.circles)` and hands the circle
    in view to Members, Profile and the visitor's shop window on Circles; `switchCircle()` chooses a
    circle and then navigates to `#/circles/<id>`, in that order, because opening a circle and
    switching to it are one act and the header must never lag the page. Beside it sits the effect
    that does the same thing from the other end: any arrival at `#/circles/<id>` — a tapped
    notification, a pasted link, the back button, a branch crumb — chooses that circle too, gated on
    the member actually being in it so previewing a public circle does not fake a membership.
    Three small functions beside it are the whole of how scope and navigation now agree.
    `keepScope()` writes down what the page on screen was showing, and `goToTab()` — which every
    tab-bar entry, the header's Profile button and anything leaving the listing goes through — calls
    it before navigating, so stepping off the Circles listing carries "all circles" with it rather
    than letting the last-opened circle reassert itself. And `selectCircle()` / `selectAllCircles()`
    are what the header dropdown calls: they choose the circle and then stay put on a tab
    `isCircleScoped()` recognises, navigating to the circle's page only from the tabs where picking
    a circle can mean nothing else.
    It also holds the access gate: once
    `store.accessLoaded` is true it works out whether the member is `barred` (the account is paused,
    or its standing could not be read at all — the nav goes and `AccessGate` replaces everything) or
    merely `held`
    (in no circle yet, so Circles and Profile stay reachable and nothing else does), and it answers
    a "+ Start a circle" that the account cannot use yet with a `CircleTrustNote` modal rather than
    a failed request — after `await store.loadAccess()`, so the note it shows is never a refusal the
    server would no longer make, which is what left vouched-for members reading "not yet".
    Its header carries both doors for a visitor — "Log in" and "Create account" — which now open the
    same screen, since logging in and joining are one field and one tap: `requireLogin()` takes no
    argument, and `CirclesTab`'s `onNeedsLogin` lost its mode with it. For a member it carries one
    **Profile** button rather than their own
    name: the name was decoration, the page is what anybody was reaching for, and Profile is now the
    header's job on every width rather than a tab that appeared on some of them. `initialMode` is
    `"reset"` when `useIdentityUser()` reports a recovery this device asked for, and `"welcome"`
    otherwise — which is the ordinary case, a sign-in link arriving as a recovery too.
    Also hosts the install banner and redirects a
    freshly logged-in member back to a remembered invite.
  - `src/current-circle.ts` — `useCurrentCircle(circles)`: the one piece of state the whole shell
    reads, kept in `localStorage` on the device. It follows the route as well as leading it, so the
    header dropdown and the circle page under it can never disagree. The pick is only ever the member's own — the
    fallback is derived on every render rather than written back over it, so a
    circle just joined survives the moment before the circle list knows about it. **Nothing chosen
    means all circles**, which is a real answer rather than a placeholder: `circleId` is null, the
    corner says "All circles", and `inCircle(rows, null)` has always meant "do not narrow", so
    every per-type listing shows everything the member can see. Standing in with Discover was a
    choice nobody made — it put a circle's name in the corner over a page showing all of them, and
    then silently narrowed the six listings to it — so `chooseAll()` is the way back out and the
    state it writes (`ALL`, never a circle id) is what a first visit already reads as. The one
    exception is somebody with no account: they have exactly one circle on offer and are looking at
    it rather than in it, so the visitor's shop window still gets `isDefault` and then the first
    circle in the list, worked out from the roles the server sent rather than from whether anybody
    is logged in.
  - `src/router.ts` — `TabName`, `useRoute()` (hash routing, no router dependency), `itemLink()`.
    Routes are `#/circles` (the landing page — an unrecognised hash and an empty one land here
    too), `#/songs`, `#/recipes`, `#/recipes/:id`, `#/learn/facts`,
    `#/learn/vocabulary`, `#/books`, `#/remedies`, `#/remedies/:id`, `#/circles`, `#/circles/:id`,
    `#/circles/:id/:categoryId`, `#/circles/:id/:categoryId/:shelf` (one node of the category's
    taxonomy — where the reader is standing, which lists its whole branch rather than only what is
    filed on it exactly and offers that node's own children to walk into — or `none` for
    the unfiled), `#/library`, `#/profile`, and `#/join/:token` (the invite welcome screen, which
    sits outside the tab bar). `route.rest` carries whatever follows the detail id. `MOVED` is where
    a route that no longer exists says where its old links land: `home: "circles"`, because an
    installed app's `start_url`, a bookmark and a stored notification link all still say `#/home`.
    The URL is deliberately left as it was rather than rewritten — answering it costs nothing and a
    redirect could fight the back button. `isCircleScoped(tab)` is beside them, and is where the
    two rules about scope are stated once rather than guessed at per surface: Members and the five
    per-type listings each read one circle's worth of the app, so the main navigation carries the
    scope the page was showing into them, and changing the circle in the header changes which circle
    they are about rather than sending the reader back to the Circles listing. Circles itself is
    deliberately not in the list — a circle *is* its subject, so picking one there is asking to open
    it — and Library and Profile are not narrowed by a circle at all.
  - `src/store.ts` — `useShareAndLearn(userId)`: loads the six collections plus the member's
    library, saved-item rows, circles, categories, posts, contacts and their own invites in one
    pass, polls notifications, and owns optimistic add/edit/remove/save/learn,
    `inviteFriend`/`cancelInvite`, and the circle actions
    (`createCircle`, `editCircle`, `removeCircle`, `inviteToCircle`, `joinCircle` — which either
    joins a public circle or asks to join a discoverable one — `approveCircleRequest`,
    `leaveCircle`, `removeCircleMember`). It also exposes `circleById` so any card can name the
    circles a post went to. `addWordConnection` / `removeWordConnection` fold a language connection
    into the word already in `words`, so the open word updates without a reload.
    Categories live in two shapes: `categories` / `categoriesByCircle` / `categoryById` is the
    member's view across every circle and is what the share forms read — it carries no counts, since
    `GET /api/my-categories` leaves them out — while
    `circleCategories[circleId]` is the fuller list one circle's page fetched (a manager's includes
    what they switched off, and every row its derived count) and is what the admin panels, the
    category page read. `receiveCategories()` files the
    second into the store so a circle page needs no second request, and `loadCircleCategories()`
    fetches it for a surface that has no such response in hand — which is how the visitor's shop
    window on Circles gets the categories of the circle it is showing. The mutations are
    `addCategory`, `editCategory`, `removeCategory`, `reorderCategories`,
    `addShelf(circleId, categoryId, name, parentId, confirm)` — which takes the parent a node is
    going under and returns `{ created, similar }` so the caller can offer the near-duplicate —
    `editShelf(circleId, categoryId, subcategoryId, { name?, hidden?, mergeIntoId?, parentId? })`,
    which is rename, disable, merge and **move** in one call because they are one `PATCH`,
    `removeShelf`, `reorderShelves` (one node's siblings), and `addPost` / `editPost` / `removePost`
    for the custom
    categories' posts. `translatePost(id, language)` asks the server to write one post's details in
    any of the eight — four that translate and four that only change the letters — and folds the
    answer onto the post — in `posts` and
    in the saved copy in My Library both — so tapping the same language again costs nothing.
    What the group says back lives here too, folded into the song, book, recipe or remedy already
    loaded so the card and the copy of it in My Library both update without a reload:
    `startDiscussion(itemType, itemId, prompt)` / `removeDiscussion(itemType, itemId, id)`,
    `replyToDiscussion(discussionId, body)` / `removeDiscussionReply`, `summarizeDiscussion`, an
    optimistic `toggleBookLike` that moves
    the count before the server answers and rolls back if it refuses, and
    `addExperience(itemType, itemId, …)` / `removeExperience(…)` for a recipe's or a remedy's
    experiences and tips. A discussion action takes the kind of share it hangs on rather than a book
    id, and `patchDiscussions()` routes the answer to `patchBook` or `patchSong` — the two of them
    being the same function twice, one per collection that can be discussed.
    `songLyricScript(songId, script)` asks the server to render a recording's lyrics into Kannada,
    Telugu, Devanagari or Hindi and files the answer on the song, so tapping the same button again
    costs nothing.
    Who the member is to the app lives here too, read from `GET /api/my-access` by `loadAccess()`,
    which files the answer *and* returns it so a caller about to refuse something can act on the
    fresh one. It is read at startup, again on window focus and `visibilitychange`, and again
    immediately before "+ Start a circle" says no — because standing changes while the app is open
    (an admin vouches, the seventh day passes) and a copy from an hour ago refuses things the server
    would now allow. The state is `access` (the
    `AccessState`) with `accessLoaded` beside it so no gate flashes before the answer lands, the
    `moderating` set and `openReports` counts for the circles they moderate, `hidden` /
    `hiddenKeys`, `blocked` / `blockedIds`, and `directory` (the roll, which only an app admin's
    response carries). Every collection is filtered through `hiddenKeys` and `blockedIds` as it is
    read, and a saved copy in My Library goes quiet with it, so hiding or blocking takes effect
    everywhere at once rather than per surface. The actions are `reportPost`, `hidePost` /
    `unhidePost`, `blockPerson` / `unblockPerson` (both optimistic, since the point of them is that
    the post goes now), `settleReport(id, "dismiss" | "remove")` for a moderator,
    `setCircleRole(circleId, memberId, "admin" | "member")` for whoever looks after the circle, and
    `setMemberStanding(memberId, { trusted, status, role })` for the app admin.
  - `src/categories.ts` — the client-side vocabulary: `BUILT_IN_CATEGORIES`, `CATEGORY_ICONS`,
    `NO_SUBCATEGORY`, `sortedCategories()` / `sortedShelves()`, `filedIn(entry, circleId)` (which
    shelf a post sits on in this circle), `categoryIn(entry, circleId)` (which category it was filed
    under there, and null for the obvious one), `currentFiledCategoryId(entry)` (the same answer
    without a circle in hand, for an edit form to open on — at most one filing can name a custom
    category, so the first found is it), `filingChoices(categories, circleIds, keepId)` (what "File
    under" offers: the custom categories of the ticked circles, the hidden ones left out unless
    `keepId` says one is already chosen), `normalizeName()` / `similarName()` (the
    same duplicate rule the server uses), and `shareFlows()`, which maps a built-in category to the
    modals that add to it. It holds `ShareFlow` so no component has to import a type from `App.tsx`.
    The taxonomy tree is here too, since every surface that draws a shelf needs the same handful of
    answers about it: `PATH_SEPARATOR` and `pathText()` / `splitPathText()` (a breadcrumb is
    `Recipes › Vegetarian › Karnataka`, joined and split in one place so the browser and the server
    agree on the words), `childShelves()` / `rootShelves()` / `shelfById()`, `treeOf(nodes)` — the
    whole tree flattened in reading order, each row carrying its `depth`, its `path`, its
    `childCount`, its exact `count` and its branch `totalCount`, and its `hidden` cascaded down from
    any ancestor, because a node under a disabled one is not on offer either —
    `descendantShelves()` / `shelfBranchIds(nodes, id)` (a node and everything under it, which is
    what makes opening Vegetarian list the Karnataka recipes too), `shelfHidden()`, `shelfPath()`
    and `breadcrumbOf(categories, categoryId, subcategoryId)`, `entryBreadcrumb(categories, entry,
    circleId)` — the full path a feed row prints for where a share actually sits in the circle in
    view — `trailBelow(trail, base)`, which is that path with the part the reader is already
    standing in taken off it, so a row inside Bookmarks says nothing where the breadcrumb above it
    has already said Bookmarks and says `Stotras` where the share came from further down —
    `currentShelfChoice()` for an edit form to open on, and `ShelfOption` /
    `shelfOptions()` / `mergeShelfOptions()`, which are how a flat indented `<select>` is built from
    several circles' trees at once with the nodes two circles both have appearing once.
  - `src/manage.ts` — who the buttons are drawn for. `canManageShare(store, userId, item)` is the
    client half of `mayManageItem()`: the author, the app admin, or a member whose
    `store.moderating` set holds one of the share's `circleIds`. Every surface that draws Edit or
    Delete on somebody's share asks it rather than comparing ids itself, which is why granting a
    circle's admins the same reach was one function rather than fifteen. `deleteNote(mine, what,
    memberName)` is the sentence on the confirm, and it names the author when the thing being
    deleted is not the reader's own — a keeper tidying up should read whose work is about to go.
    The server refuses either way, so both of these are a courtesy rather than the check.
  - `src/feed.ts` — the mixed-feed model behind a circle's page: `TOPICS`, `TOPIC_ORDER`,
    `FeedEntry` (which carries `circleIds`, `filings` — the shelf it sits on in each of those
    circles — `photos`, and the `memberId` of whoever shared it, so a feed row can offer the same
    ⋮ menu a card does), the per-type entry
    builders including `postEntry()` for a custom category, `feedEntries()`, `inCircle()` — the
    one rule every per-type listing narrows itself with, and a no-op when no circle is in view —
    and
    `matchesQuery()` — the same matcher behind search across all circles and search inside one. A
    feed row also carries what the group said back, appended to its detail line by the private
    `countBits()` — 💬 discussions and 👍 likes on a book, 💬 discussions on a song, 💬 experiences
    on a recipe or a remedy — and a count of zero adds nothing, so a quiet row stays quiet. A fun
    fact's detail line carries its source, because the title is the whole fact and its row is
    therefore the whole of it — which is why a fact row has no button on it at all.
  - `src/api.ts` — typed `fetch` wrappers for every route, `uploadSongInParts()` (chunked upload),
    `uploadCircleCover()`, `uploadItemPhoto()` / `photoKeys()` and `MAX_PHOTOS_PER_ITEM` (one
    picture per request, scaled down in a canvas first, and the keys a form sends back), and the
    `formatDate`/`formatDuration`/`formatBytes` helpers. Every one of those goes through the private
    `request()` — never a bare `fetch` — which sets `credentials: "same-origin"` and, on a `401`,
    calls `withFreshSession()` and replays the call exactly once. That single retry is what makes a
    token expiring mid-visit invisible: without it the next tap after an hour was an error rather
    than a renewal. `get()` and `send()` are the two shapes on top of it, and adding a route means
    using one of them — a raw `fetch` in this file is a call that cannot recover. `Shared<T>` — what a form sends — carries
    `photos` as a list of keys, and `filedCategoryId` when the member filed the share somewhere other
    than where its kind usually goes: a number is that category, null is the ordinary case, and
    leaving the key out says nothing about filing at all, so an edit that never asks the question
    leaves the answer alone. Where a share is filed travels as a `ShelfChoice` — `subcategoryId` and
    `subcategoryName`, the node's id and its full path text — the id being exact in the node's own
    circle and the path being what that same choice means in the others, and the two keys' absence
    being the same three-state read `filedCategoryId` has. A `CircleFiling` read back carries the
    `categoryId` beside the
    `subcategoryId`, because both are per-circle. A `Subcategory` carries its `parentId`, and a
    `Circle` its `memberTaxonomy`, which is what `ShelfField` reads to decide whether to offer
    "+ Add new subcategory…" at all. Photos travel the other way round: an item read
    back carries them as `ItemPhoto` rows — every type
    but `Word`, which does not extend `HasPhotos` at all. A `Word`
    carries `synonyms` and `antonyms` as arrays and its `connections` as `WordConnection` rows;
    `SharedWord` is what the word form sends, which is `Shared<Word>` with its `connections` as the
    `NewWordConnection` shape instead, since the ones typed on the Add Word form have no id and no
    author yet and are created with the word (`MAX_WORD_CONNECTIONS` is the ceiling the form keeps).
    `createWordConnection()` / `deleteWordConnection()` are still their own two calls for one added
    to a word that already exists, because that is a contribution rather than a `PATCH` of the word.
    A `Book` carries its `discussions` as
    `Discussion` rows — each naming the `itemType` and `itemId` it hangs on, with its `replies`, its
    derived `replyCount` and
    `participantCount`, and its cached `summary` with `summaryStale` / `summarizable` — plus the
    `LikeState` of `likeCount` and `likedByMe`; a `Song` carries the same `discussions` and no like,
    since `DiscussionItemType` is `"book" | "song"`; a `Recipe` and a `Remedy` carry `experiences` as
    `ItemExperience` rows. A `Recipe` also carries the two things it says about itself —
    `menuTypes` as a list and `dishType` as one answer or null — beside the older single `category`,
    which nothing on screen reads any more and which the server has already folded into those two
    where a recipe has nothing else; `RECIPE_MENU_TYPES` and `RECIPE_DISH_TYPES` are what the form
    draws from, and `recipeMenuBits(recipe)` is the one place the two are turned into the words a
    card, a feed row and the search index print, so the three surfaces that used to print
    `category` say the same thing. `startDiscussion()`, `deleteDiscussion()`, `replyToDiscussion()`,
    `deleteDiscussionReply()`, `summarizeDiscussion()`, `setBookLike()`, `createExperience()` and
    `deleteExperience()` are each their own call for the same reason a connection is: contributing
    to somebody's share is not an edit of it. The first two take the kind of share as their first
    argument, because a thread is the same thing wherever it hangs.
    A `Song` also carries the words the member typed as `lyrics` and `lyricsLanguage`, the
    `lyricsScheme` they typed them in when those letters are Latin (a `RomanScheme`, or null), and
    whatever
    has been rendered from them as `lyricScripts` — `SongLyricScript` rows, one per script — beside
    `lyricScriptsAvailable`, which is the server's answer to which of the four can actually be made
    for these particular words. The buttons are drawn from that list rather than from all four, so a
    script that could only fail is not offered; an older response that says nothing about it means
    "offer all four", which is what the app did before it asked.
    `LYRIC_SCRIPT_OPTIONS` is what those buttons are drawn from (`LyricScript` being
    `kannada | telugu | devanagari | hindi`, each with its native label and a note saying whether it
    transliterates or translates), and `renderSongLyricScript(songId, script)` asks for one. Both a
    `SongLyricScript` and a `PostTranslation` name their `engine` — a `ConversionEngine` of
    `aksharamukha` or `ai` — so the panel reading it can say which one wrote it.
    `looksRomanised(text)` is the small client-side test behind both the scheme field and the
    author's nudge: four Indic letters and it is not romanised, which is deliberately cruder than
    the server's `detectScript()` because all it decides is whether to ask a question.
    Typing in another script is here too, and belongs to no share at all: `ROMAN_SCHEME_OPTIONS`
    (`RomanScheme` being `itrans | iast | iso | hk`, each with a hint and a worked example),
    `SCRIPT_OPTIONS` (the five `IndicScript`s a form offers to write into) and
    `transliterate({ text, from, to })`, which answers the converted text and nothing else — there
    is no id, because at that point the member has not shared anything yet.
    The access and moderation shapes live here as well: `AccessState` and `NO_ACCESS` (what the app
    assumes before `GET /api/my-access` answers — nothing), `ModerationState`, `ReportReason` with the
    `REPORT_REASONS` picker list and `reasonLabel()` so the reporter's own wording is what a
    moderator reads back, `ContentReport`, `HiddenRef`, `BlockedMember`, and the calls
    `fetchAccess()`, `reportItem()`, `fetchReports()`, `resolveReport()`, `hideItem()` /
    `unhideItem()`, `blockMember()` / `unblockMember()`, `setCircleMemberRole()` and
    `updateMemberStanding()`.
    `requestEmailSignIn(email, inviteToken?)` is the one call here made by somebody who is not
    logged in yet: it asks for a sign-in link, answers `{ sent: true }` whatever the address turned
    out to be, and rethrows a refusal with `retryAfter` folded onto the `Error` so the login screen
    can count the resend button down rather than guess.
  - `src/pwa.ts` — service worker registration (production builds only) and `useInstall()`, which
    reports `installed` / `prompt` / `ios-instructions` / `unavailable` so the UI only offers an
    install button when one can actually work.
  - `src/identity.ts` — calls `init()` from `@netlify/identity` once at app startup.
  - `src/session.ts` — the reason a member stays logged in, and a small correction to something the
    Identity browser library does. It writes the session it is given as **thirty-day** cookies
    (`COOKIE_DAYS`) rather than the session cookies the library writes: `nf_jwt` and `nf_refresh`
    arrive with no `Max-Age`, so closing the browser threw the whole login away, and `getUser()`
    finding no cookie then cleared the stored session too — which is why signing in every single
    time was not a preference anybody had chosen. The token itself is still Identity's, still in
    `localStorage` under `gotrue.user`, and still refreshed by Identity; this file only makes it
    outlive the tab. `restoreSession()` re-stamps from storage before anything asks who the member
    is, `withFreshSession()` renews a token within `MARGIN_SECONDS` of expiry and answers whether
    anything changed, `restampFromStorage()` and `stampAuthCookies()` are the writes, and
    `hasStoredSession()` is the cheap "was anybody here?" a startup path asks before doing work.
    Nothing here parses or trusts a token's contents — expiry is read to decide *when* to refresh,
    never to decide *what* the member may do, which stays the server's answer.
    Beside those sit the two small facts about logging in that belong to the **device** rather than
    the account. `keepSignedIn()` / `setKeepSignedIn()` is the "Keep me logged in" tick, which is
    what decides whether `stampAuthCookies()` writes a lifetime at all — unticked, the cookies are
    session ones and `restoreSession()` drops the persisted session as well, since GoTrue would
    otherwise let this file write the login straight back. And `rememberPasswordReset()` /
    `pendingPasswordReset()` / `clearPasswordReset()` is how the app tells a password reset from a
    sign-in link, because Identity has exactly one email that logs somebody in on one tap and
    `netlify/lib/magic-link.ts` builds the sign-in link on it, so `handleAuthCallback()` reports
    `recovery` for both and cannot tell them apart. The marker deliberately sits on the **reset**
    rather than on the sign-in, which is the way round that survives being wrong: a link asked for
    on a laptop and opened on a phone finds no marker there, and defaulting to "sign in" is what a
    sign-in link should do and a perfectly good outcome for a reset besides, since Profile changes a
    password afterwards. `RESET_WINDOW_MS` is two hours, so a reset abandoned last week does not
    turn next week's sign-in link into a password form.
  - `src/components/Auth.tsx` — `useIdentityUser()` hook (wraps `getUser`/`onAuthChange`) and the
    login modal, which is **provider-first**: "Welcome to Share & Learn", a "Continue with …" button
    per provider, an "or" divider, one email field and "Continue with Email", which sends a sign-in
    link rather than asking anybody to invent a password. There is no separate signup door — the
    same field and the same tap either logs an address in or makes it an account, which is why
    `requireLogin()` in `App.tsx` takes no argument any more. The provider row is rendered from
    `getSettings().providers` rather than hardcoded, so enabling Google in the Netlify dashboard is
    the whole change and a site with none of them (or an unreachable Identity, which `getSettings()`
    throws on) degrades silently to the email field. **Apple is absent because Identity has no such
    provider** — `AuthProvider` is `google | github | gitlab | bitbucket | facebook | email`, and
    adding Apple would mean not using Identity, which every `getUser()` in `netlify/functions/`
    depends on; one line in `OAUTH_PROVIDERS` is the whole change if it ever ships.
    `AuthMode` is the six screens — `welcome`, `inbox` (the "check your inbox" note with the
    address, a "Send it again in Ns" button counting down `RESEND_SECONDS`, and "Use a different
    address"), and then `password`, `signup`, `forgot` and `reset`, which are the password paths kept
    one link down from the front door: members who already chose a password still have one, and
    signup is the only place a display name is collected, a link-made account getting
    `nameFromEmail()` instead. A `429` carrying `retryAfter` moves to `inbox` with the countdown on
    the button whether it was a first send or a resend, because a link is in flight either way.
    It awaits `restoreSession()` before `handleAuthCallback()` and
    `getUser()`, so a returning member's cookies are back in place before the library can conclude
    there is nobody there, re-stamps on `login`, on `token_refresh` **and on `recovery`**, and renews
    on focus and `visibilitychange` — a phone left on a home screen for a week being the ordinary
    case rather than the odd one. That third event is load-bearing rather than tidy: arriving on a
    link emits `recovery` and never `login`, so without it every sign-in link would have been written
    as a session cookie and died with the browser — the exact bug `src/session.ts` exists to fix —
    and it is now the ordinary way members arrive. Whether that arrival shows the app or a
    "choose a password" form is `pendingPasswordReset()`'s answer, read and cleared once.
  - `src/components/AccountSettings.tsx` — the two halves of a login, changed from the top of
    Profile: "Change login email" and "Change password", each opening a small form in the profile
    card itself. Identity owns both, so this is the one part of Profile that talks to
    `updateUser()` rather than to the app's own API, and nothing about it touches `members`. Both
    ask for the current password first and prove it with `login()` before writing anything, because
    the session on a device lasts thirty days and a signed-in phone is not the same thing as the
    person who signed it in — somebody who could move the address an account logs in with would be
    walking off with the account. A new address is not the login until it is confirmed: Identity
    emails the link, `user.pendingEmail` is what the card says while it is outstanding, and the
    `handleAuthCallback()` that `Auth.tsx` already runs on every page load completes the change when
    the link is opened. The password panel also offers the ordinary recovery email, for the member
    who cannot answer the question it asks — and calls `rememberPasswordReset()` before sending it,
    because that email is the same email a sign-in link arrives by, and without the marker the link
    would simply log in somebody who is already logged in rather than opening the form they wanted.
    An account made through a provider gets a line saying so
    instead of a form.
  - `src/components/shared.tsx` — `Modal`, `VisibilityPicker` (private / shared, plus the tick-list
    of circles a post goes to — a circle that switched this category off is not offered — and the
    one shelf the share is filed under), `SubcategoryPicker` (the whole taxonomy tree of the chosen
    circles as one indented `<select>` — every node, not only the leaves, since a share may sit at
    any level — "No subcategory", the chosen node's full path under the field once it is more than
    one deep, and the "+ Add new subcategory…" panel, which opens under whatever was selected, names
    the parent it is about to add to, lets that parent be changed, and warns about a near-duplicate
    among that parent's own children before accepting a new name. Its `allowNew` is what the
    circle's `memberTaxonomy` setting turns off, and nothing is created here at all: the path travels
    with the share and the server makes what is missing, so abandoning the form leaves no stray
    shelf behind), `ShelfField` (the two questions about where a share
    sits, in one block: an optional "File under" `<select>` over `filingChoices()` above the
    `SubcategoryPicker`, whose shelves swap to that category's own the moment one is picked. It is
    drawn only when `onFiledCategoryIdChange` is passed and the ticked circles have invented
    something, which is what keeps it off `PostModal` — a post's category is the whole of what it is
    and is never a question. A choice that stops being offered, because the circle was unticked or
    the category removed, is cleared by an effect, but only once the categories have actually
    loaded, so a slow load never quietly costs a member their filing), `PhotoField` (the optional pictures on a share:
    thumbnails of what has been added, an × on each, and the "+" that adds another — each one
    uploaded as it is picked, so the form holds keys rather than megabytes) and `PhotoGallery` (the
    same pictures wherever a share is read, tapping one to see it full size), `SaveButton`,
    `ShareButton`, `OwnerActions`,
    `ChoiceField` and `LANGUAGE_OPTIONS` (a dropdown of known answers with an "Other" box behind it,
    where whatever the member types is what gets stored so "Other" itself never is, and the list of
    languages this group actually shares in — it began inside `BookModal` and moved here the moment a
    word's language connections wanted the same question asked the same way),
    `TickList` (the same question asked where more than one answer applies: a legend, a row of tick
    boxes over an offered list, and an answer re-derived by filtering that list, so it is always in
    the order it was offered rather than the order it was tapped. The multi-select counterpart to
    `ChoiceField`, drawn with the same `.circle-choice` rules the circle tick-list uses, which is
    why a recipe's Menu type looks like the audience picker rather than like a new control),
    `TabHeader`,
    `SearchField`, `EmptyState`, `Stars`, `CircleChips` and `Byline` (which puts the circle a post
    came from under it), `WelcomeNote` (the opening message, shown to a visitor
    on Circles and again on the join-a-circle door, so nobody arrives at a bare screen; in
    **Discover** it says something else entirely — "Explore. Learn. Share. Inspire." and what the
    space is for, rather than the member's own name, because that is the circle everybody lands in
    and being greeted by name every single time says less than being told what to do there),
    `HealthNote` (the not-medical-advice note that travels with every remedy
    surface), and the other shared pieces.
  - `src/components/Icons.tsx` — the app's whole icon vocabulary, drawn inline rather than pulled
    from a font or a package: `IconName`, a `PATHS` table on a 24×24 grid where each entry says
    whether it is stroked or filled, `Icon` for one drawn beside words, and `IconButton` for a
    control that is nothing but an icon. Everything inherits `currentColor`, so a tone is a class
    rather than a second copy of the drawing. `IconButton` makes `label` **required** and uses it
    as both the `aria-label` and the `title`, because replacing the word "Edit" with a pencil
    throws the accessible name away unless something puts it back — which is why the callers pass
    the sentence they would have written ("Remove from reading list", "Play the recording") rather
    than the word they replaced. The paths themselves are shared: the bookmark and its filled twin
    are the save toggle in both states, and `play` / `stop` are one button in a recording's two.
    `lock` is a closed padlock, and it is the one icon in the table drawn purely as a *status*
    rather than as a control: it sits beside a built-in field's name in **Manage fields** to say
    that the row is part of the form itself. It carries no accessible name of its own on purpose,
    the row's meta line ending "· Built-in", so the status is written in text and the icon is the
    quick read of it.
    `more` is the three dots, filled rather than stroked because a 1.2px circle is a smudge at
    16px, and it is drawn inside things that are themselves clickable — which is why
    `IconButton`'s `onClick` is handed the event rather than called bare: the ⋯ on a circle card
    sits on a card that opens the circle, and `stopPropagation()` is the whole difference between
    a menu and a navigation. A plain `() => void` handler still satisfies the type, so no existing
    caller changed.
  - `src/components/ActionSheet.tsx` — `SheetAction` and `ActionSheet`: the actions behind a ⋯,
    shown the way a phone shows them — a panel rising from the bottom of the screen with a grab
    handle, a header naming what the actions are about, one full-width row each, and a Cancel under
    them. It exists because a card had run out of room: a circle card used to carry Open, a pencil
    and Leave as three tap targets competing with the circle's own name on a 360px screen, while
    everything else a keeper might want (invite somebody, answer a report, close the circle) had to
    be found on another page entirely. A sheet holds as many rows as the member is allowed and costs
    the card one 40px button. It dismisses on Escape, on Cancel, and on a backdrop tap that *began*
    on the backdrop — the same rule `Modal` follows, so a drag ending outside is not a dismissal —
    and it focuses its first row so a keyboard reaches the actions rather than the page behind them.
    Two things it deliberately does not do: it decides no permissions, the caller passing the rows
    it has already worked out, and it confirms nothing, a `danger` row closing the sheet and opening
    the question instead, because a panel that dismisses on any tap is the wrong place to ask "are
    you sure?".
  - `src/components/Nav.tsx` — one component for the desktop tab row and the mobile bottom bar.
    Three sections — Circles, Members, My Library — because the six kinds of thing are
    categories inside a circle rather than sections of the app, because a circle's own page is what
    Home used to be, and because Profile is the header's
    job on every width rather than a fourth tab that only appeared on some of them. The row ends with
    an "Invite a
    friend" entry, right-justified on wide screens, which opens the
    invite flow instead of navigating to a tab; it steps aside on a phone, where inviting people to
    the group also lives on Profile.
  - `src/components/SongsTab.tsx`, `RecipesTab.tsx`, `LearnTab.tsx`,
    `BooksTab.tsx`, `RemediesTab.tsx`, `CirclesTab.tsx`, `LibraryTab.tsx`, `ProfileTab.tsx` — one
    per section; Learn holds Fun Facts and Word Explorer. There is no `HomeTab` any more: it carried
    a greeting, the circle in view's categories and a mixed feed, all of which a circle's own page
    says without a dashboard in front of it — so the tab went, its visitor shop window moved into
    `CirclesTab`, and the two things that had nowhere else to go went with it: the cross-circle
    "All my circles" feed and the group-wide share shortcuts for a member in no circle. The six
    per-type tabs are no
        longer in the nav but are still routed and still render, so old links keep working. `BooksTab`
    puts `BookConversation` on every card between the byline and the actions, which is where the
    discussion and like counts read; `SongsTab` puts `SongLyrics` immediately under the player and
    `SongConversation` below the photos, which is the "new Div section below the uploaded song" the
    words appear in; `RecipesTab` and `RemediesTab` show `ExperienceCount` on a card
    and the full `ExperienceSection` on the detail page; `LibraryTab` shows all of them on a saved
    copy, so
    a member can read the lyrics or join a discussion from their own shelf, and says "No items saved
    yet" as one
    message — with no shelves and no zeroes — until something is actually saved. `ProfileTab` puts `MyCircles` above "Your
    contributions", so the list of circles and the switch between them sit with the account, and
    carries the account's own standing below it: `StandingTags` (app admin, paused, can start
    circles, or the number of days until it can), `AccountSettings` — the login's own two changes,
    in the profile card beside the address they change — `QuietList` — "Hidden and blocked", the one
    place
    a hide or a block is undone — and `AppAdminPanel`, which renders for nobody but the app admin
    and holds the searchable roll with its levers per member; the three that change an account are
    left off the admin's own row, so the group can never be left without one, while
    "Who can see them?" is on every row and opens `MemberBlocksPanel` — the blocks that member is
    on either side of, whichever of them wrote one, with "Lift this block" beside each, plus the
    circles they are in and a note when their shares name none. Below it sits `AdminCirclesPanel`,
    every circle in the group with a delete on each and, when a duplicate Discover exists, the
    button that folds it back into one. Neither panel fetches anything for an ordinary member: the
    role is checked before the request, not only before the render.
  - `src/components/MembersTab.tsx` — the people in the circle in view: whoever is waiting for
    approval first (a moderator's to-do, so it is at the top and leaves the page once answered),
    then any invitation nobody has answered, then the roll itself with its role tags and a search
    box once it is long enough to need one. Everybody in the circle can read the roll; whoever looks
    after it — its owner, its admins, or the app admin stepping in — also sees the waiting room,
    answers it, hands out the circle's admin role and takes it back. It is the **only** roll now:
    a circle's own page used to carry a smaller copy — this list with the search, the waiting room
    and the role buttons taken off it — and no longer does, the head count in that page's header
    pointing here instead. It reads `GET /api/circles/:id` for the circle the header dropdown points at, so it moves
    when that does. With no circle in view it is **everybody the member shares a circle with**,
    read in one pass from `GET /api/my-members`: one row per person, searchable by their name or by
    a circle's, and each row carrying a chip per circle the two of them are both in, which narrows
    to that circle without leaving Members. It is a directory rather than a management screen on
    purpose — roles, the waiting room and the admin controls belong to one circle and stay on that
    circle's own roll, because "approve this request" has to name where it is being approved. A
    member in no circle at all still gets the empty state that sends them to find one.
  - `src/components/CircleSwitcher.tsx` — the two faces of the same choice. `CircleMenu` is the
    dropdown in the header, on every screen, and the only place the circle in view is chosen:
    "All circles" first, then "My
    circles", then "Open to all — join and
    switch", where picking one that is not theirs yet calls `joinCircle` before switching and only
    moves them if the join actually happened. A native `<select>` on purpose, so a phone opens the
    OS picker. It is the header's alone: a second switcher beside a circle's own page would be
    saying the same thing twice, and opening a circle from the listing already moves it.
    `MyCircles` is the Profile list — every circle the member is in, the current one tagged, each row
    naming its head count, whether they own it, and the shape of its categories, and offering either
    "Open" or "Switch to it" — followed by "+ Start a circle".
  - `src/components/CirclesTab.tsx` — both circle surfaces: the list (invitations waiting on the
    member, join requests waiting on the owner, the member's own circles, and the public or
    discoverable ones they could join) and one circle's page at `#/circles/:id` (its description,
    the grid of its categories, and the same mixed feed narrowed to that circle with
    its own search — and nothing else, the page being about what people shared here). Its head
    count is a button to the Members tab rather than a roll of its own. It hands the categories
    `GET /api/circles/:id` returned to `store.receiveCategories` so the admin panels and the share
    forms agree without a second read.
    `onEnteredCircle` fires when the member actually becomes a member — accepting an invitation or
    joining a public circle, so `store.joinCircle()`'s `{ joined }` is what it keys on — and never
    when they merely ask to join a discoverable one, because a pending request is not being in it.
    **The listing reads as an app rather than as a page of forms.** Under the heading sits one line
    saying what it is for — "Find and manage your circles." — and then "Your circles" with the
    search box under it, because a member scanning a list of
    doors wants the list first and the search once the list is long. That heading is also where a
    phone starts a circle: `Your circles` and a short "+ New" chip on one line
    (`section-head-narrow-action`), the worded "+ Start a circle"
    (`tab-header-wide-action`) staying in the header's own action row for the widths that have room
    for it. Both are always rendered and a media query shows exactly one, since nothing in this app
    is conditionally rendered by width. Which one is off by default matters and is deliberate: the
    chip is hidden until a rule turns it on and the worded button is hidden by that same rule, so a
    breakpoint that fails to match leaves the small control on screen rather than the wide one — and
    it was the wide one that used to sit half off the edge of a phone in portrait, since a header
    with a title, a subtitle and a full-width primary button in it has nowhere narrow to put the
    button. The rule swaps at 720px rather than the 640px the rest of the phone styles use, with a
    coarse-pointer clause widening it further, because "a phone in portrait" is not a width anybody
    can name: a foldable's inner screen is about 673px and a phone asked for the desktop site
    reports whatever it likes. Erring wide costs a large phone a chip instead of a worded button,
    which is the same action somewhere it can be tapped; erring narrow costs somebody the button
    altogether, so the two are not the same mistake.
    **A card is the tap target and the ⋯ is the exception to it.** The whole card opens the circle
    and switches to it — one act, `onEnterCircle` — and the ⋯ in its top-right corner calls
    `stopPropagation()` and opens `ActionSheet` instead, so the two never fire together. The card
    itself is a `<li onClick>` rather than a button, a button being unable to contain the circle's
    `<h3>`; the name inside it is a real button so a keyboard reaches it, and the card draws the
    focus ring with `:focus-within`. Its rows are the icon, the name, the ⋯, then
    `5 members · Ask to join`, a two-line-clamped description and "Kept by …".
    `actionsFor(circle)` is what the sheet holds, and it is built from the same facts the server
    checks rather than from a longer list with rows disabled: Edit circle and Invite people for a
    keeper (`role` of owner or admin, or `store.moderating`), Manage members for a keeper and View
    members for everybody else — the same row, differently worded — Admin tools with the open-report
    count on it, Leave circle where `canLeaveCircle()` allows it, and Delete circle for a keeper of
    a circle that is not `isDefault`. Both destructive rows still ask first, `LeaveCircleModal` and
    a Delete confirmation whose dialog stays open with the refusal on it when the server says no.
    Two of those actions live on the circle's own page rather than on the card, so the sheet asks
    for them rather than duplicating them: `pendingPanel` remembers which was tapped, the tab
    navigates into the circle, and `CircleDetailView`'s `openPanel` / `onPanelShown` opens the
    invite panel or the Admin tools drawer once the circle's own read has answered — which it waits
    for, both panels being a keeper's and `canManage` not being known until then. Manage members
    goes to `onOpenCircleMembers` in `App.tsx`, which chooses the circle *before* navigating, since
    the tab bar's own `goToTab()` would widen the scope to All circles and hand back the
    cross-circle roll instead of that circle's.
    A manager's
    invite panel offers both ways in: the contacts tick-list for members the app already knows, and
    a link for anybody else, which is the only route that works in a group of one. A circle page is
    also where that circle is moderated, and all of it is behind **Admin tools** — one drawer, drawn
    for its owner, its admins and the app admin stepping in, and for nobody else. Inside it sit the
    open reports (who reported what and why, answered with "Leave it up" or "Take it out of the
    circle"), the members asking to join, the invitations nobody has answered, and a link to the
    Members tab for the roll and the roles. The button carries a numeric badge — `Admin tools ③` —
    only when something is actually waiting on a keeper: open reports plus join requests, and
    deliberately **not** outstanding invitations, which are waiting on the person invited and would
    put a number on the button that nothing in the drawer can clear. It was three sections of the
    page itself, each rendered whether or not it held anything, so the first thing on a quiet
    circle's page was a heading saying nothing had been reported; housekeeping that is usually
    empty belongs behind a button that says how much of it there is.
  - `src/components/CircleCategories.tsx` — everything below a circle: `CategoryGrid` (the tiles,
    each with its derived entry count, and hidden ones left out of it entirely — for a keeper as
    much as for a member, since the grid is the way into a category and a hidden one has nowhere to
    go, and **Manage** is where a keeper reads them and shows them again; its
    `title`, `showCounts` and `emptyNote` are optional so the visitor's shop window can render the
    same grid with no counts at all under "What people share here"),
    `CategoryPage` (`#/circles/:id/:categoryId` — the tree walked **one level at a time**: a
    breadcrumb naming where the reader is (`Events › Aradhane › Songs`, every step but the last a
    button back up, and the category's own name the step that returns to the top), a chip per
    **immediate child** of that node and nothing deeper, each with its branch count where it has
    children and its exact count where it is a leaf, and the listing narrowed by `filedIn()` over
    `shelfBranchIds()`, so standing on Vegetarian shows what is filed there *and* everything under
    it — which is what makes filing on a shallow node a real answer rather than a dead end. It used
    to draw `treeOf()` flat, which put "Aradhane", "Aradhane › Bookmarks" and "Aradhane › Songs"
    side by side as three equal chips and made a parent read as a peer of its own children; a chip
    now carries its own name alone, because the breadcrumb above the row is what says where it
    sits. The row leads with **All ({entries.length})**, drawn `chip-active` with `aria-pressed`
    because it is the selected state rather than a destination — tapping a child navigates, so no
    child is ever selected and All is always where the reader is — and its tap sets `viewAll`, which
    is the only honest thing it can mean on a landing page showing five of forty rows. There is
    still no "Everything" chip *leading* anywhere — the listing below the chips is already
    everything filed
    here and below, so it led to the page it was drawn on — and "Everything else", the unfiled
    bucket, is still drawn at the top of the category alone, being a question about the whole
    category rather than about a node. A level with no children draws no chip row at all, and no
    note about the absence either: "Nothing sits under Bookmarks yet." sat on top of a full list of
    bookmarks and read as though the page were empty, so the only place the absence is still
    mentioned is the top of a category a keeper could give a tree to. What sits under the chips is
    `hasChildren` and `viewAll`'s answer: children and no `viewAll` draws **Recent uploads**, the
    newest `RECENT_LIMIT` of the branch with "View all →" after them when there is more; anything
    else draws the listing itself with a `SearchField` and a `ShelfSort` select over it, so the two
    controls appear exactly where there is a list to ask them of. Walking anywhere resets all three,
    since a search carried from Bookmarks into Stotras filters a list nobody asked about.
    Its shape is the phone's at every width, the same trade the circle cards made. The header is the
    back link, the icon, the name and the count — the circle's name is not repeated in it, the line
    above having just said it, and the wide primary Add button that used to live there is gone,
    a header holding a back link, an icon, a title and a count having nowhere narrow left to put
    one. The subcategories follow it under a `section-head-inline` heading whose action is
    `Manage subcategories` / `Manage` — the wide/narrow pair, drawn for a keeper only — the trail is
    drawn only below the top level, where it says something the page title has not, and the chip row
    carries `shelf-chips-wrap`, which is the one `.shelf-chips` that wraps rather than scrolling
    sideways, because the number of chips is the number of nodes the circle invented. Adding sits on
    the listing's own heading as the same wide/narrow pair — `+ Add a book` from
    `shareFlows(itemType)[0]` for a built-in and `+ Add to Stotras` for a category the circle
    invented, behind `guidelines.guard()` — gated on a `canContribute` prop rather than on
    `canManage`, since sharing is for the circle's members and reading is for anybody; Word Explorer
    is left out of it, bringing its own "+ Add Word". Search and sort stay with the list and not with
    the chips),
    `CircleFeedList` (one row per entry, tagged with where it sits in this circle via
    `entryBreadcrumb()` — the whole path on a circle's own feed, where there is no one place the
    reader is standing, and only the part below `trailBase` on a category page, since the
    breadcrumb over the list has said the rest of it once and a row repeating it said it twenty
    times — with
    posts and words expanding in place through `entryAction()` / `EntryDetail`, because neither has
    a detail page to go to, and a song's words and a song's or a book's discussions collapsed
    under it through `SongLyrics` and `ItemDiscussions`. That last one is why the row carries
    `bookById` beside `songById`: a discussable row is worked out by kind — `discussed` is
    `{ itemType, item }` or null — rather than per kind, and it is there because the feed drew the
    conversation for **no** kind at all, which left a recording's discussions unreachable from the
    circle it was shared in. A book, a recipe and a remedy survived that because `entryAction()`
    answers `open` for them and their pages show what the group said; a song answers `play`, so
    from a circle page or one of its folders there was no route from the recording to its threads
    at all), `CategoryManager` and
    its private `TaxonomyManager` — the expandable/collapsible tree the circle's keepers manage the
    taxonomy from: a ▸/▾ twist per node with children carrying `aria-expanded`, indentation capped
    at five levels so a deep branch cannot widen a phone, and per node **Add child | Edit | Move… |
    Merge… | Disable/Enable | Delete**. "Add child" names the parent's full path before anything is
    typed, "Move…" offers every node that is not inside the moving node's own branch plus the top
    level, reordering is sibling-scoped, and each of them is one call to `store` and one refusal
    from the server if the caller has no business making it. `CategoryManager` keeps its own
    (reorder, rename, merge, switch off, and — for a custom category,
    once hidden — remove, after choosing whether its posts move or are released to their authors).
    `entryCount()` and `categoryEntries()` are exported for the pages that need the same count.
    `categoryEntries()` reads the filing rather than the kind of thing: a share whose filing names
    this category is here, a share filed under nothing in particular is here when this is a built-in
    category, and so a category the circle invented lists its own posts *and* the songs, recipes and
    books filed into it, while Songs stops showing the ones that went elsewhere. A
    Word Explorer category is the one exception on a category page: its listing is `WordExplorer`
    rather than `CircleFeedList`, narrowed to this circle and shelf, and it brings its own
    "+ Add Word" button, so the header does not repeat one. A category page says nothing about what
    its form asks: the share form is the one place that shape is read and changed, so the page
    carried the same list twice and no longer does.
  - `src/fields.ts` — the client-side vocabulary behind a category's own questions, kept beside
    `src/categories.ts` rather than inside a component because the share form, the reader, the
    admin view and every door into it need the same handful of answers and a component is a bad
    place to keep a rule the server also keeps. `FIELDED_BUILT_INS` / `FieldedBuiltIn` and
    `categoryTakesFields(itemType)` are the client half of the same list `netlify/lib/fields.ts`
    holds — a category the circle invented, plus Songs and Books — and opening a fifth kind up is
    one entry in each. `canAddFields(store, category)` is the permission test, and it is the same
    answer the server gives: `store.moderating` for the circle, or the app admin.
    `askedFields(category)` is what the form draws (the ones still switched on, in the keepers'
    order) and `orderedFields(category)` is what the admin list draws (all of them, since switching
    one back on means finding it first). `fieldTypeText(field)` is the words a row says a field
    is — "Short text", "Upload (PDF)" — and `builtInCategoryFor(categories, itemType, circleId)`
    resolves one circle's copy of Books or Songs, answering null with no circle in view, a form's
    shape belonging to one circle rather than to the kind.
    `BuiltInFormField` / `builtInFormFields(itemType)` are the other half of the form — the
    questions it asks before anybody adds one — and they are deliberately a *description* rather
    than a definition: a built-in field is JSX in `SongModal`, `BookModal` or `PostModal`, so there
    is no row anywhere to rename, reorder, switch off or delete, and this list exists so a keeper
    can read the whole form in one place and see that Books already asks for the author. Nothing
    enforces the correspondence — a question added to one of those three forms belongs here too —
    and the frame is deliberately left out: "Share with" and the circle tick-list, "File under" and
    the subcategory picker (Manage subcategories' business), Cancel/Save, and a song's "Start a
    discussion", which writes a contribution rather than part of the share.
  - `src/components/ManageFields.tsx` — configuring a form, which is a different job from filling
    one in and therefore a different screen. One view serves every category that can be asked
    anything at all, so Books, Songs and Stotras are one field builder rather than three.
    `ManageFieldsButton` is the door and decides for itself whether it exists — `canAddFields()` and
    nothing else — which is why every caller is one line and why a plain member never sees it;
    `BuiltInFieldsButton` is the same door named by kind and circle for a tab header.
    `ManageFieldsModal` wraps it, a modal rather than a panel because it opens over whatever page
    the keeper was on. `ManageFields` is the view, and it draws **the whole form** in one
    `.manage-list`: first `builtInFormFields(category.itemType)` — each row the label, a
    `.manage-lock` padlock in the `tag` slot, and a meta line ending `· Built-in`, with
    `actions={[]}` so `ManageRow`'s own `disabled={busy || actions.length === 0}` renders an
    unavailable ⋯ and the rows still line up with the ones below — then `orderedFields()`, each the
    label, `fieldTypeText()`, Required/Optional and `· Custom`, with an "Off" tag on a disabled one
    and a **⋯** opening an `ActionSheet` of Edit, Move up, Move down, Make required / Make optional,
    Disable (or "Switch it back on") and Delete. Under them a **+ Add field** that becomes a note at
    `MAX_FIELDS_PER_CATEGORY`, and, when the circle has added nothing yet, one line saying so rather
    than an empty-list state — the list above it is not empty, it is the built-in form. The
    required toggle is on the ⋯ as well as inside Edit because whether an answer is compulsory is
    the part of a field a keeper changes oftenest; it binds new entries and edits from now on and
    chases nobody for an answer they were never asked for. It takes the category it is given as an *address* rather than as the
    truth: `forMember()` on the server strips the fields a keeper switched off, so the view upgrades
    to the fuller row in `store.circleCategories[circleId]` — loading it if the circle's own page
    has not — or "Switch it back on" would be unreachable. It holds no copy of anything, both
    `takeCategories()` and `loadCircleCategories()` refreshing the store the list is read from.
    `FieldForm` is one form for adding and editing: label, kind, required, the dropdown's choices,
    and — only for an upload — the three rules that belong to the field itself (which documents it
    takes, how big, one or several), then the help text, with a one-tap `RIGHTS_NOTE` beside it
    where the kind is an upload. Deleting is the one action that throws answers away, so it asks
    first and names disabling as the alternative.
  - `src/components/CategoryFields.tsx` — the questions a category asks, on the two surfaces where
    they are *answered* rather than decided, and nothing else: it carries no door into **Manage
    fields** any more, for a keeper no more than for anybody else, because a form whose shape can
    be changed while it is being filled in is two jobs on one screen.
    `FieldInputs` is what sits in the share form: one control per active field over
    `askedFields()`, drawn by its kind, and nothing at all when the category asks nothing — there
    is no admin control down here to keep an empty block on screen for, which is also why
    `BuiltInFields` skips a circle whose copy of the category has no active field rather than
    drawing an empty box with its name on it.
    `initialAnswers()` seeds an edit from what the
    post already said, `FieldAnswers` is the read view — an unanswered question has no line, so a
    category asking twelve things does not turn every post into a table of blanks — and
    `FileFieldInput` is the control behind an upload, which reads the field's own rules rather than
    the platform's: the picker's `accept` is narrowed by `fieldFileAccept(field.fileTypes)`, a wrong
    or oversized file is refused before it is uploaded, and the ceiling on how many is 1 or
    `MAX_FILES_PER_FIELD` depending on `field.multiple`. `FieldAnswer` renders a stored upload as
    the attachment a reader wants — a kind tag, the filename, its size and "Open PDF" — one row per
    document, since a field may hold several. `attachmentKind()` is where the tag's word comes from,
    read off the filename rather than stored.
    `BuiltInFields` is `FieldInputs` for one of the kinds in `FIELDED_BUILT_INS`: a
    song or a book reaches several circles at once and each keeps its own copy of the category, so it
    draws one list per chosen circle, named by circle only when there are two of them — which is
    exactly the union of fields the server checks the answers against. `SongFields` and `BookFields`
    are that component with the kind filled in, and opening a third built-in up is one more wrapper
    and one more entry in each list — plus a row list in `builtInFormFields()`, so the manager can
    show that form's built-in half too. The four shared predicates it used to export
    (`FIELDED_BUILT_INS`, `categoryTakesFields()`, `canAddFields()`, `askedFields()`) moved to
    `src/fields.ts` when this file started importing the admin view, a module being unable to sit
    both above and below another one.
  - `src/components/DocumentViewer.tsx` — a PDF read inside the app. Tapping "View PDF" on an
    upload answer opens it as an overlay over the item — state, not a route, so the item, its
    circle and its folder never redraw underneath — with a Back bar that stays on screen and the
    device's Back button closing it through one pushed history entry. The pages are drawn by
    **pdf.js** (`pdfjs-dist`, legacy build, loaded on first use) into one canvas per page, only
    while near the screen, rather than by an `<iframe>`: a phone's embedded viewer showed a cover
    preview with a "View" button of its own that left the app for the raw file. Zoom is the
    viewer's own — pinch, ctrl+wheel, or the − / % / + control — because the browser's pinch
    would scale the Back bar off screen too. "Open externally" is a small ↗ in the bar, and the
    main action only when pdf.js could not draw the document at all.
  - `src/components/EntryReader.tsx` — what the button on a feed row does, which is the one thing
    every mixed feed has to agree about. `entryAction(entry)` answers `play` for a song, `read` for a
    post or a word, `open` for a recipe, a remedy or a book — the three kinds with a page of their
    own — and `none` for a fun fact, whose row is already the whole fact. `entryActionLabel()` is the
    words on it, and `EntryDetail` is what `read` opens underneath the row: a post's paragraphs, its
    `FieldAnswers` and its `PostTranslations`, or `WordDetail` for a word. It is a named set of four
    answers rather than a chain of `else if`s because the chain used to end in a silent
    `onOpenLearn("vocabulary")`, which is exactly how a word, a fun fact and a post came to leave the
    circle a reader was looking at and land on the Learn tab. A new kind of share now has to say
    which of the four it is.
  - `src/components/WordExplorer.tsx` — the words surface, used both by Learn and by a circle's Word
    Explorer category: the search field and "+ Add Word" row, the "Recently Added" list of names —
    each row carrying the word, the language it is in, and the first language connection somebody
    offered for it ("Greek: osteon"), because the connection is what most readers are scanning the
    list for and a row that shows one saves opening the word to find out — and `WordPage`, the one
    word opened in place. `WordDetail` is everything that page reads
    (language, meaning, example, pronunciation, notes,
    added by, date added, then the optional sections) without the frame around it, exported because a
    word also opens under a feed row now and there should be one implementation of what a word says.
    `matchesWord()` is the search rule — word,
    meaning, language, and nothing else. `WordChips` renders Synonyms and Antonyms and answers null
    when there are none, so an empty section never appears. `LanguageConnections` lists the
    language/term pairs with an × for whoever may remove one, holds the inline "+ Add Connection"
    form — whose Language is the shared `ChoiceField` over `LANGUAGE_OPTIONS` rather than a free text
    box, so "Kannada", "kannada" and "Kanada" stop being three languages — and shows "No language
    connections yet." with "Add the first connection" when the word has
    none. Which word is open is component state rather than a route, so the same component serves
    both places. A word is read rather than heard: the page used to offer "🔊 Say it" through the
    browser's speech synthesis, and no longer does — a synthetic English voice reading a Sanskrit or
    Kannada word said it wrong, which is worse than not saying it.
  - `src/components/RecordModal.tsx` (MediaRecorder), `UploadModal.tsx` (both of which carry the
    optional `LyricsField`, so a recording can arrive with its words already on it),
    `RecipeModal.tsx` (which asks the two questions the single "Category" dropdown used to ask at
    once: **Menu type** as a `TickList` of the five in `RECIPE_MENU_TYPES`, because more than one
    applies to the same dish, and **Dish type** as a single `<select>` over `RECIPE_DISH_TYPES` in
    the slot the old control occupied. It is one form for adding and editing, so an edit opens on
    `recipe.menuTypes` and `recipe.dishType` — which the server derives from the old column where
    that is all a recipe has — and a stored dish type that is not on the offered list is appended to
    it, so an answer carried over from before is offered back rather than quietly lost on the next
    save. Neither is a folder: `ShelfField` and the folder picker are untouched beside them),
    `FactModal.tsx`, `WordModal.tsx` (which also takes synonyms and antonyms — one line each,
    separated by commas or new lines, blanks dropped — free notes, and, when the word is a new one,
    its language connections: a row of language, the word in it and an optional note, with a "+" for
    another and an × to take one back, sent with the word and created alongside it. Editing a word
    shows none of that and says so, because a connection on a word that exists belongs to whoever
    adds it), `BookModal.tsx` (which carries `BookFields`, so the chosen circles' own questions about
    a book — which shelf it came off, whether there is a copy to lend, whether there is a PDF of
    it — are asked on the same form, and nothing on it changes what those questions are: that is
    **Manage fields**, reached from the Books tab header),
    `RemedyModal.tsx`, `PostModal.tsx` (the one
    form behind every invented category: a title, details, the category's own fields, the languages
    the details should be
    readable in, and a subcategory — with no circle picker, because a custom category exists in
    exactly one circle, and no "when", which the form stopped asking for once Travelogue existed.
    It is the one form a circle can change the shape of, and it is changed from **Manage fields** on
    the category's own page rather than from here — a form being for filling in, which is also why
    it no longer takes a `store` at all),
    `CircleModal.tsx`
    (create or edit a circle: icon grid, cover upload, privacy, "Who can add subcategories" — the
    `memberTaxonomy` switch, anybody in the circle or only its keepers — the tick-list of built-in
    categories
    and the "+ Add category" panel, and the contacts tick-list when
    starting one), `NotificationBell.tsx` — creation and edit forms.
  - `src/components/Discussions.tsx` — what the group says about a share, and the same mechanism on
    two surfaces, which is the trade `SongLyrics.tsx` makes with the words. The private
    `ConversationBody` is the panel itself — the threads, the invitation when there are none, the
    form that asks the first question — and two exports open it. `ItemConversation` is the counts
    as chips over it, drawn where the share is what the page is about: a book card, a song's own
    page, a saved copy in My Library. `ItemDiscussions` is the collapsed `details-toggle` line for
    a **listing row** — "▸ Discussion — 3 questions the group asked" — which is what `CircleFeedList`
    draws, because a feed row's detail line has already printed "💬 3" and what the reader wants
    from a row is the questions rather than a second count of them. Neither draws an empty block:
    a "💬 0 Discussions" chip is a zero wearing a count, so `ItemConversation` reads
    "💬 Start a discussion" where there are no threads and renders nothing at all where there are
    none and this reader could not write one anyway, and a listing row with no questions says
    nothing, starting one belonging on the share's own page.
    **Which kinds can be discussed is a table rather than a component**: `DISCUSSABLE` holds the
    wording each kind is asked in (a book's "Which chapter impacted you the most?", a song's "Which
    raga is this based on?") and nothing else is keyed on the kind, so a third one is one entry here
    beside the one in `DISCUSSION_ITEM_TYPES` on the server. `BookConversation` and
    `SongConversation` are `ItemConversation` with the kind filled in, the book's also carrying the
    "👍 n Likes" chip, which is a book's alone. Its private
    `DiscussionThread` shows one question, who asked it, "N people have joined the discussion.", the
    **Discussion Summary** block when there is one (tagged "Behind the thread" when replies have
    arrived since), the replies with an × for whoever may take one back, the reply form, and the
    button that asks for a summary once a thread is long enough.
  - `src/components/SongLyrics.tsx` — the words of a recording, in both directions. `SongLyrics`
    sits directly under the player: the lyrics as the member wrote them, the script buttons
    (`LYRIC_SCRIPT_OPTIONS`, narrowed to the song's own `lyricScriptsAvailable` so a button that
    could only fail is not drawn), and the `.lyrics-rendered` div below holding whichever one was
    tapped —
    a second tap closes it, an already-rendered script costs no request, and a failure is a line of
    error text rather than a lost panel. A recording with no lyrics renders nothing at all, except
    for its own author, who is told they can add them by editing it. The one other thing it says to
    the author alone is why nothing is on offer when the answer is something they can fix: words in
    Latin letters with no convention declared, which `looksRomanised()` spots, and which Edit
    resolves. The panel also tags which
    converter wrote what is on screen — "exact conversion" or "written by AI" — because the two are
    not equally trustworthy and the reader deserves to know which one they are reading.
    `LyricsField` is the other
    direction — the optional textarea, the language input and the roman-convention picker that the
    record, upload and edit forms all
    share, with `ScriptConverter` between them — and its hint is where the app says plainly that it
    converts what was typed and never
    fills in a song it thinks it recognises. The third field only appears when it has something to
    ask: `looksRomanised(lyrics)` and nothing else decides it, so a member typing Kannada is never
    asked which way they typed English. "I would rather not say" is an option and costs them the
    exact conversion rather than the feature, since the gateway can still read romanised text where
    one is configured.
  - `src/components/ScriptConverter.tsx` — the answer to the reason a stotra never gets typed: the
    words are known and the keyboard is Latin. Collapsed it is one line of text
    ("⌨ Type in English letters instead"); open it is a roman-scheme picker, a target-script picker,
    a textarea, and a Convert button that calls `POST /api/transliterate` and shows what came back.
    Three choices in it are deliberate. It converts **on a tap** rather than as you type, because a
    half-typed word converts to nonsense and watching that happen is worse than not seeing it. It
    **adds** to the field rather than replacing it (`appendText()`), so a verse can be built a line
    at a time and English already typed is never eaten. And it **asks which roman convention** the
    member uses rather than guessing, since `aa`/`ā`/`A` are three schemes' answer to the same
    vowel — `ROMAN_SCHEME_OPTIONS` carries an example of each, and the placeholder shows the chosen
    one. It holds no store and knows nothing about posts or songs: `target` is a phrase for the
    button and `onAdd` is where the text goes, which is why the same component sits in `LyricsField`
    and in `PostModal`.
  - `src/components/PostTranslations.tsx` — a post in a language somebody else reads, in both
    directions, the same shape `SongLyrics.tsx` has. `PostTranslations` sits under the details
    wherever a post is opened — the circle feed and the saved copy in My Library — and draws one
    link per language the author asked for (`POST_LANGUAGE_OPTIONS`, whose `script` flag is what
    separates the four that keep the words from the four that translate them), with the chosen one
    opening in
    a `.translation-body` div below: a second tap closes it, a language already written costs no
    request, and a failure is a line of error text rather than a lost panel. It carries the same
    engine tag `SongLyrics` does, for the same reason. A post with no details,
    or one whose author asked for no languages, renders nothing at all. `TranslationField` is the
    other direction — the yes/no on the post form and, under the yes, the chips and the "+ Add a
    language…" dropdown — and its hint says plainly which of the two things each option does: a
    script keeps the words and is exact, a language says what they mean and is written by AI, and
    neither adds anything the member did not write.
  - `src/components/Experiences.tsx` — `ExperienceCount` (the one-line "💬 n experiences and tips"
    on a listing card, absent at zero) and `ExperienceSection` (the notes themselves, each tagged
    Experience, Tip or Something extra, with the kind picker and the form that adds one). Used by
    recipes as "Experiences & Tips" and by remedies for the same plus anything else a member added.
  - `src/components/PostMenu.tsx` — the ⋮ on a post, and the three unlike things behind it:
    `Report` (tells the circle's admins and changes nothing on screen), `Hide` (this reader's own
    view, silent, undone from Profile) and `Block user` (mutual, silent, and everything that member
    wrote goes at once). None of them deletes anybody's work — deleting is the author's own button
    somewhere else. `PostMenu` answers null for the reader's own post and for nobody signed in;
    `ReportDialog` is the reason picker and the optional note; and `PostActions` is the form every
    listing actually uses, taking the store the tab already has instead of three threaded props.
  - `src/components/AccessGate.tsx` — the three doors between an account and the app, each naming
    what opens it: `unavailable` (nothing to do with the member — the app could not read where the
    account stands, so it says so and offers a reload), `suspended` (nothing was deleted, and it all
    comes back), and `circle-first` (join one, with
    "Find a circle", under the same `WelcomeNote` the visitor's shop window carries — reachable now
    only when the automatic join into Discover did not land). `CircleTrustNote` is why "+ Start a circle" just said
    no — join a circle, or wait out the days, and an admin can shorten either — shown as a note
    rather than by hiding the button, because
    a member who cannot find a button assumes the app is broken while one who is told the date
    waits. It is shown only after `store.loadAccess()` has been re-read, so it never explains a
    refusal that is no longer true.
  - `src/components/Guidelines.tsx` — the three lines every member agrees to before their first
    share. `COMMUNITY_GUIDELINES` is the wording, `GuidelinesList` renders it (in the gate, and
    again on Profile where somebody who has already agreed can read it back), `GuidelinesGate` is
    the modal with the tick and the button, and `useGuidelinesGate(store)` is how a surface uses
    it: `guard(action)` runs the action for a member who has agreed and holds it in front of the
    gate for one who has not, so agreeing opens the form they were heading for rather than
    dropping them back where they started, and `gate` is the modal to render. Every surface with
    its own "+ Add" button — the shell's `startQuickShare`, the per-type tabs, and a custom
    category's page — goes through it, and the server refuses an unagreed share anyway.
  - `src/components/InviteModal.tsx` — the two-step invite flow, which takes as many people as the
    member wants to name: each "+ Add contact" is another name-and-email pair, and submitting mints
    one single-use link per person, since an invite belongs to one friend rather than being passed
    around. Plus the exported `InviteShare`
    row (share sheet, copy, WhatsApp, email, SMS) reused on Profile.
  - `src/components/JoinScreen.tsx` — `#/join/:token`: previews who invited you, accepts the invite
    as soon as a member is present, and remembers the token in `localStorage` so a signup round trip
    through a confirmation email still lands back on the invite. `onJoined` carries the circle the
    link named, or null for a plain group link, because a circle link is the one circle the new
    member came for and so becomes the circle they land on, `onEnterApp` opening its page rather
    than the listing.
  - `src/components/InstallPrompt.tsx` — `InstallButton`, `InstallBanner` (dismissal remembered),
    `InstallCard` for Profile, and the iOS Add-to-Home-Screen instructions.
  - `src/styles.css` — all styling, no CSS framework.
- `scripts/generate-icons.mjs` — draws the app mark and writes the PNG icons with a small
  hand-rolled encoder, so no image tooling or binary asset editing is needed.
- `netlify/lib/` — server-side helpers shared by the functions:
  - `items.ts` — the permission rules: `visibleTo(table, user, itemType)` for listings — shared and
    within the caller's circles, or their own, and `false` for somebody with no account at all, so a
    visitor's listing comes back empty from the database rather than being trimmed afterwards —
    `savedVisibleTo()` for library rows (circles do not
    come into it), plus body parsing and the standard error responses. `ownedBy()` is still
    exported and is no longer what any route asks: who may edit or delete a share is
    `mayManageItem()` in `moderation.ts`, since a share belongs to its author *and* to the
    circles it was said in.
  - `access.ts` — who is in the group, and what their account may do. Identity answers
    "is this a real login?" and nothing more, so standing and trust are the app's own
    record: `accessOf(user)` derives `admitted` (true for anybody who can log in — the door is
    open), `suspended`, `isAppAdmin`,
    `trusted`, `canCreateCircle`, `needsCircle` and `trustedInDays` in three reads, and stamps
    `admitted_at` / `trusted_at` the first time an account qualifies so the answer cannot wobble
    afterwards — which also means a brand new account gets its directory row on its very first
    request. Trust is earned by two things and only two: `TRUSTED_AFTER_DAYS` on the clock and a
    circle already joined. It once also required a confirmed email, and that was a bug rather than a
    policy — the user a function decodes from the token carries no such field, so the clause could
    never be true and no member ever earned trust on their own, vouch or no vouch. The rule may test
    only what the app itself wrote on `members`. `TRUSTED_AFTER_DAYS` is the waiting period,
    `groupIsEmpty()` is how the founder is spotted — the first account founds the group
    and becomes its app admin — and `admittedAccess()` / `admittedUser()` are what every route
    calls instead of `getUser()`. `notAdmitted()`, `needsCircleFirst()` and `forbidden()` are the
    refusals; `sharingAccess()` and `sharingGate(user)` are the create-a-share gate — which also
    holds back a member who has not yet agreed to the Community Guidelines (`needsGuidelines()`,
    `acceptedGuidelines` on the state); and
    `accessResponse()` is how it all travels to the browser. `accessOf()` is also where everybody
    is kept in Community: the membership read it already does answers "how many circles?" and "is
    Community among them?" at once, so the auto-join below costs no extra query and fires exactly
    once per member — and it is what lets a new account post from its first visit rather than
    having to go looking for a circle.
  - `community.ts` — the one circle everybody is in, which members read as **Discover** 🌏 (the
    module and its `COMMUNITY_*` identifiers keep the older name; `circles.is_default` is what marks
    the circle, never its label). `COMMUNITY_NAME` / `COMMUNITY_ICON` and
    `COMMUNITY_CATEGORIES` (Books, Fun Facts, Word Explorer, and Travelogue as a custom category
    with its own shelves) are what it is made of; `findCommunity()` reads it back by the lowest id
    so two racing requests agree on the same row; `communityCircle()` creates and seeds it on first
    use; and `ensureCommunityMembership()` puts a member in it. `upgradeDefaultName()` carries a
    change to `COMMUNITY_NAME` onto the row that already exists — the circle is created lazily, so
    there may be nothing to rename when a deploy lands and there is on the first read afterwards. It
    matches `PREVIOUS_DEFAULT_NAMES` exactly, the same way `upgradeLegacyNames()` does in
    `categories.ts`, so a name deliberately changed by hand is left alone, and it returns straight
    away when nothing is stale. `circles.mts` calls it on the read every session makes at startup.
    Its `ownerId` is the sentinel
    `"system"`, which no Identity id can equal, so no member is ever Discover's owner and nobody
    inherits it by having been here first. That sentinel used to be the whole of its protection,
    back when every circle mutation asked `circle.ownerId === user.id`; now that a circle is run by
    whoever looks after it, Discover is run by the app admin and anybody they make an admin of it,
    which is right — somebody has to be able to tidy the circle every account lands in. The two
    things that would break the app are refused in `circle.mts` instead: a circle that `is_default`
    cannot be deleted, and its privacy is pinned however the rest of it is edited, so the front door
    can be neither closed nor locked.
  - `safety.ts` — the line the guidelines draw, applied to every piece of text before it is stored.
    `checkText(...parts)` answers a `SafetyVerdict` and `unsafeText(...parts)` turns a refusal into
    a `422`, which is the one line each write route adds. Deliberately deterministic rather than a
    model call: an AI answer elsewhere may be absent and the feature degrades, but a filter that
    quietly stops filtering where no gateway is configured is the one failure that matters. Slurs
    and strong profanity are matched on whole words, through leetspeak, letter-spacing and
    stretched vowels; illegal material is matched as a *transaction* rather than a subject, so
    "buy cocaine" is refused and a fun fact about cocaine is not. Mild words and words with
    innocent readings in a recipes-and-books app are left out on purpose — the ⋮ Report menu is a
    human reading context, which a word list cannot do.
  - `moderation.ts` — reporting, hiding, blocking, and who answers for what. `moderatorOf()` /
    `moderatedCircleIds()` name the circles a member moderates (as owner, as circle admin, or as
    the app admin stepping in), `moderatesItem(itemType, itemId, access)` asks the same question of
    one particular share — does the caller keep any circle it went into — and
    `mayManageItem(itemType, itemId, authorId, access)` is that with the author's own right in front
    of it, which is the one gate every per-item `PATCH` and `DELETE` in the API is built on, so the
    answer is the same whichever kind of thing is being changed. `visibleItem()` is the share behind
    an id but only when the reader can already see it, `fileReport()` (one row per member per item, so a second tap is the same
    report) / `reportResponse()` / `reportsFor()` / `reportsForCircle()` / `openReportCounts()` are
    the queue, and `resolveReport()` is the answer to one — `dismiss` leaves it up, `remove` calls
    `removeFromCircle()`, which drops the `item_circles` row for that circle and nothing else, so a
    share taken out of its last circle becomes private to its author rather than deleted.
    `notifyModerators()` tells the circle's admins. `hideItem()` / `unhideItem()` are the reader's
    own view, `blockMember()` / `unblockMember()` are mutual and silent, `blockedIdsFor(user)` is
    the set every listing and every contribution read filters against, and `moderationStateOf()`
    is what `GET /api/my-access` sends back. `blocksInvolving(memberId)` is the same question asked
    from the outside — every block a member is on *either* side of — and `liftBlock(a, b)` removes
    one whichever way round it was written. Those two exist because a block is deliberately mutual
    and silent, which is right until one was a mistap: the member on the wrong end of it watches
    half the group vanish with nothing on screen and cannot undo a row somebody else wrote, so the
    app admin can.
  - `admin.ts` — what the app admin can see and put right across the whole group, as against what a
    circle's own people decide inside it. `circleRoll()` is every circle with its owner, privacy,
    head count and share count; `canonicalDefault()` / `duplicateDefaults()` name the Discover the
    rest of the app agrees on and any stray beside it; `mergeCircleInto(from, into)` folds one
    circle into another — memberships first (owners and admins arrive as plain members, since
    merging is not a way to be given a role), then the `item_circles` rows, unfiled, because a
    shelf belongs to the source circle's own category — and only then calls `deleteCircle()`, which
    is the whole reason for the order: `closeCircleContent()` privatises anything left with no
    circles, and by that point there is nothing left. `mergeDuplicateDefaults()` is the repair
    itself, and nobody is stranded by it — a member who was only ever in a stray now has no default
    circle at all, which is exactly what `accessOf()` already watches for. `memberCircleList()`,
    `outsideDefault()` and `sharesWithoutCircles()` are the diagnosis behind
    `GET /api/members/:id/blocks`: which circles somebody is actually in, whether they are missing
    from Discover, and which of their shares name no circle at all — the last of which is not
    invisible (an item with no `item_circles` rows still reaches the whole group) but appears on no
    circle page, since every circle surface asks the opposite question.
  - `circles.ts` — everything circle-shaped: the `PRIVACIES` list (the three doors a circle can
    have) and `CHOOSABLE_PRIVACIES`, which is now the same list, since **Open to All** is offered
    again; `privacyOf()` is the input rule, so anything else lands on private. Then the icon and
    cover helpers (`coverStore()`, `MAX_COVER_BYTES`, `coverUrl()`), `circleResponse()` (the row
    plus what it means to the caller — their role, the head count, whether they have a request
    pending — and its `isDefault`, so the browser can tell Discover from a circle somebody happens
    to have called that; the column travels, never the label), `myCircleIds()`, `membershipOf()`, `joinCircle()`, `pendingFor()`, and the reach
    helpers `setItemCircles()` / `applyItemCircles()` / `circleIdsByItem()` / `withCircleIds()` /
    `clearItemCircles()` — the first two taking the shelf name a form sent and the category the
    share belongs to, whether that is a post's own or the one a member filed a song under, both of
    which they hand on to `categories.ts`. A chosen category is written on the one circle that owns
    it and null on every other circle the share went to, which is the whole of what makes the filing
    per-circle. `circleFilingsByItem()` reads all three columns back, so a listing knows where each
    share sits in each of its circles.
    `groupRoll()` is the roll read the other way round — everybody in a given set of circles, named
    once with the circles they are in and their role in each, which is what Members shows when
    nothing is narrowed. It reads each member's current name from `members` rather than trusting the
    `circle_members.member_name` frozen at join time, since somebody who has renamed themselves
    would otherwise read as two different people across two circles.
    `circlesOfItem()` answers which circles a
    share already reaches, so news arriving later — a discussion started on somebody else's
    book — can be told to the same people. `announceShare()` writes one notification per circle an
    item went to (or one group-wide row when it named none), and `closeCircleContent()` / `deleteCircle()` tear a
    circle down.
  - `members.ts` — the contact directory: `registerMember()` keeps the caller's own row current,
    `directory()` returns everyone a member could invite, and `contactNames()` puts names on the ids
    an owner sent. Emails are stored but never returned.
  - `taxonomy.ts` — the tree itself, with no database access in it at all: every function takes the
    rows already read and answers a question about them, which is what lets a route read one
    category's nodes once and then ask eight things. `TaxonomyNode` is a `subcategories` row and
    `ShelfChoice` is `{ id?, name? }` — the id and the path text a form sends together, since the id
    is exact in its own circle and the path is what that same choice means in the others. Then the
    limits (`MAX_SUBCATEGORY_NAME`, `MAX_TAXONOMY_DEPTH`, which is where "unlimited nesting" meets
    the fact that something has to stop a runaway loop), `PATH_SEPARATOR` with `pathText()` /
    `splitPath()` — the same `›` the browser joins with, so a path survives the round trip — and
    `normalizeName()` / `similarSubcategory()` / `siblingsOf()`, the duplicate rule scoped to one
    parent's children rather than to the whole category. The tree reads are `sortNodes()`,
    `nodeById()`, `ancestorsOf()`, `pathOf()`, `depthOf()`, `childrenOf()`, `descendantsOf()`,
    `subtreeIds()`, `heightOf()`, `nodeAtPath()` and `nodeHidden()` — which is the one that cascades:
    a node whose parent or grandparent is hidden is hidden, so disabling Vegetarian takes Karnataka
    off every form without touching its row. And the two refusals every move has to pass:
    `reparentRefusal(rows, node, parentId)` answers a sentence rather than a boolean — a parent in
    another category, a node inside its own branch, itself, or a subtree that would end up too
    deep — and `tooDeepFor(rows, parent)` is the same ceiling for a node being added.
  - `categories.ts` — everything category-shaped: `BUILT_INS` (the six, with the seed subcategories
    a new circle starts with), the name limits and `normalizeName()` / `similarSubcategory()` (the
    duplicate rule), `seedCategories()` for a new circle and `ensureCategories()` for one made
    before categories existed, `circlesAccepting()` — which of the circles a share names still take
    this kind of thing, plus the circle that owns a custom category the member filed the share
    into, since filing a song into Events is a reason for that circle to take it whether or not it
    still has Songs switched on — `resolveSubcategory()` (a `ShelfChoice` becomes a shelf id in each
    circle: the id answers its own circle outright, and the path is walked down every other circle's
    tree by `resolvePath()`, which creates the segments that are missing only where the caller may
    and otherwise stops at the deepest node it did match, so a share never lands somewhere it was not
    filed — all inside the category that applies there, the chosen one where the member named one and
    the built-in for the kind otherwise, which is how the shelves follow the category for free),
    `shelfChoiceFrom(body)` (the three-state read of a form's `subcategoryId` / `subcategoryName` —
    a choice, an explicit unfiling, or the keys being absent, which says nothing and leaves the
    filing alone), `mayAddTaxonomy(circleId, user)` (whether this member may invent a node in this
    circle at all: `moderatorOf()` always, and an ordinary member only where `circles.memberTaxonomy`
    is on), the tree writes `addSubcategory()` — which keeps the depth cap, dedupes against the
    node's own siblings rather than the whole category, and answers the existing row when two members
    race for the same name — `moveSubcategory()`, `mergeSubcategory()` and `deleteSubcategory()`,
    which promotes the node's children one level rather than dropping a branch, plus
    `TaxonomyNodeResponse` and `rollUpNodes()`, which is where each node's branch `totalCount` and
    `childCount` are summed up from the leaves. `filedCategoryIdFrom()` (the three-state read of a form's
    `filedCategoryId`), `releaseFiledItems()` (what a category being deleted does to the built-in
    shares filed into it: they move with the posts, or go back to their own category and lose the
    shelf), `categoryCounts()` and `categoryResponse()` (counts derived from the posts
    the caller may see, never stored — and attributed by what the filing says rather than by the kind
    of thing, so a song filed into Events counts towards Events and not towards Songs), `forMember()` (drops what the owner switched off),
    `circleCategoryList()` / `activeCategoriesByCircle()`, and the admin operations
    `refileSubcategory()`, `applyOrder()` and `postsInCategory()`. Both of the first two take an
    optional `categoryId`, and a post in a custom category has to pass it: a category a circle
    invented has no `item_type`, so looking one up by the kind of share finds nothing, which is
    what used to leave such a post with no circle row and no shelf however carefully it was filed.
    `RENAMED_BUILT_INS` and the
    private `upgradeLegacyNames()` carry a built-in whose default label changed — Vocabulary became
    Word Explorer — onto circles created before the change: a row still holding the exact old
    default is updated in place, and a circle that renamed the category itself is left alone.
    Every category response carries its `fields` as well, read in the same pass as its
    subcategories, so no surface needs a second request to know what its form asks.
  - `fields.ts` — the extra questions a custom category asks, and the answers to them. Every
    category a circle invents shares one hand-built form — a title, some details, a shelf — so this
    is how a circle makes that form fit what it is actually for: Stotras asks which deity,
    Travelogue asks which country. `FIELD_KINDS` is the six shapes an answer can take (`text`,
    `textarea`, `checkbox`, `select`, `file`, `link`) with `isFieldKind()` / `fieldKindOf()`, then
    the limits
    (`MAX_FIELDS_PER_CATEGORY`, `MAX_FIELD_LABEL`, `MAX_FIELD_HINT`, `MAX_FIELD_OPTIONS`,
    `MAX_OPTION_LABEL`, `MAX_FIELD_VALUE`), `optionsFrom()` / `splitOptions()` for a dropdown's
    choices — held one per line the way a word keeps its synonyms — `fieldResponse()`, `fieldsOf()`
    / `fieldById()`, `addField()` (idempotent on the label, so two members asking for "Deity" make
    one field) and `applyFieldOrder()`. On the answer side, `answersFrom()` reads what a form sent
    and answers undefined when the body said nothing, so an edit that only changes the title leaves
    the answers alone; `missingRequired()` is the one refusal; `answerTexts()` is what
    `unsafeText()` is given; and `setPostFieldValues()` / `applyPostFieldValues()` /
    `clearPostFieldValues()` / `fieldValuesOf()` / `withFieldValues()` are the usual write, edit,
    teardown and decorate quartet. An answer is stored against the field it answers and read back
    with that field's `label` and `kind` folded in, so a copy saved in My Library still reads
    properly long after the member has left the circle that asked the question. A value whose field
    has been switched off is kept and simply not read, exactly as a hidden category's posts are.
    `clearFieldValues()` and `clearCategoryFields()` are what a deleted field and a deleted
    category take with them. It has its own private `labelKey()` rather than importing
    `normalizeName()` from `categories.ts`, so the dependency between the two runs one way only.
    Four of the six kinds are something a member types or picks, and two are not. A `file`
    answer is a document they uploaded, stored as the small JSON envelope
    `{ key, name, size }` in the same `value` column the others use — the bytes being in Blobs,
    which is why no migration was needed to add a kind — or, where the field takes more than one, a
    JSON **array** of those envelopes in that same column, which is why adding several needed no
    migration either: one file is still written as the bare object it always was, so nothing already
    stored had to be rewritten and nothing that reads one had to learn a second shape it did not
    need. An upload field carries its own three rules, and they are the field's rather than the
    platform's: `fileTypesFrom()` / `fileTypesOf()` (which of PDF, Word and Excel it takes — all
    three is stored as none, so "no preference" and "everything" are one answer and the default
    every field written before the column existed already has), `maxBytesFrom()` / `maxBytesOf()`
    (something smaller than `MAX_ATTACHMENT_BYTES`, clamped to it, or null for the ceiling itself)
    and `MAX_FILES_PER_FIELD` beside the `multiple` flag. All three are enforced in `valueFor()`,
    which is what makes them the rule rather than a hint: the browser narrows the picker and refuses
    a wrong file before it is uploaded, and the server refuses it again whatever the browser did.
    Narrowing a field afterwards retires nothing — a document already stored on a share is kept and
    still read, exactly as a dropdown's answer is when its choices are rewritten. A `link` answer is a web address, put
    through `webAddressOf()` before it is stored: a missing scheme is filled in, since somebody
    pasting `example.com/page` means `https://`, and anything that is not `http` or `https` is
    refused, because the answer is read back as something a member taps and `javascript:` is not a
    place. Two consequences live here rather than in
    the routes. `valueFor()` refuses a key that does not begin with the writing member's id, so
    nobody can put somebody else's upload on their own share, which is why every caller of
    `setItemFieldValues()` / `applyItemFieldValues()` passes `user.id`. And the private
    `sweepAttachments()` deletes a blob only once no `post_field_values` row still names it, so
    replacing or removing an answer takes its document with it while a key still in use is left
    alone — the one failure worth avoiding being a document a live post still shows.
  - `attachments.ts` — everything document-shaped, and the same file `photos.ts` is for pictures:
    `attachmentStore()` (the `field-files` blob store), `MAX_ATTACHMENT_BYTES`,
    `ATTACHMENT_TYPES` — the five accepted, being PDF, `.doc`, `.docx`, `.xls` and `.xlsx` — with
    `ATTACHMENT_REFUSAL` as the one sentence a member reads when a file is none of them,
    `attachmentTypeFor(contentType, name)`, which matches the declared type first and falls back to
    the extension because a phone reports a `.docx` as `application/octet-stream` often enough that
    trusting the header alone would refuse real files, `attachmentNameOf()` (control characters,
    path separators and quotes stripped, because the name is written into a
    `Content-Disposition` header), `attachmentKeyFor()` — `<memberId>_<uuid>`, so a key names its
    uploader exactly as a photo's does — `isAttachmentKey()`, `attachmentUrl()`, and the
    `encodeAttachment()` / `parseAttachment()` / `attachmentKeysIn()` / `deleteAttachment()` that
    `fields.ts` stores and sweeps with. Beside those sit the same answers for a field that takes
    several: `encodeAttachments()` writes one file as the bare object and a list as an array, and
    `parseAttachments()` reads either shape back, so the difference is invisible to everything above
    it and no stored answer had to be rewritten. And because a field may say which documents it
    takes, the accepted types are addressable one at a time: each `ATTACHMENT_TYPES` row carries an
    `id`, `ATTACHMENT_TYPE_IDS` / `AttachmentTypeId` / `isAttachmentTypeId()` are the three of them
    (`pdf`, `word`, `excel`), `attachmentTypeLabel()` is the word a form says, and
    `attachmentRefusalFor(ids)` is `ATTACHMENT_REFUSAL` narrowed to what this particular field
    asked for, so a member reads which documents *this* field takes rather than which ones the app
    accepts.
  - `ai.ts` — the one place the Netlify AI Gateway is spoken to. `gatewayAvailable()` says whether a
    credential is configured at all, and `askText({ system, prompt, maxTokens })` posts one message
    to `MODEL` and answers the text back — or null on every failure path there is: no gateway, a
    refused request, an empty answer. Nothing else in the codebase reads the gateway's environment
    variables or knows the model's name, so both the discussion summaries and the lyric renderings
    degrade the same way and a deployment with no gateway simply has neither.
  - `aksharamukha.ts` — the one place letters are changed, and the reason it is no longer a model's
    job. Changing letters and changing words are two different tasks: /ka/ is ಕ
    is క is क, which a lookup table settles in a millisecond, while what a verse *means* in Hindi is
    a reading. So script conversion comes here and the gateway keeps only the second job.
    The table itself is **in process**: `@indic-transliteration/sanscript` is a self-contained
    mapping of every script and roman scheme this file offers, so a conversion is a function call
    rather than a request. The hosted Aksharamukha service is still here and still gives the file its
    name, but it is now only the fallback for a pair the local table declines — the whole of a
    stotra used to wait a second and a half on somebody else's server for an answer that is a
    lookup, and now it does not.
    `SCRIPTS` is the ten scripts, each with the name Sanscript's own tables use, the exact name
    Aksharamukha knows it by, and the Unicode
    block its letters live in, with `IndicScript` / `isIndicScript()`; `ROMAN_SCHEMES` is the four
    conventions for typing in Latin letters (Itrans, IAST, ISO 15919, Harvard-Kyoto) with the same
    pair of names and
    `RomanScheme` / `isRomanScheme()`, and `TransliterationSource` is either. `detectScript()` counts
    letters per block and answers the script with the most of them, or null — and null for Latin text
    is deliberate, since English prose put through a transliterator becomes confident gibberish.
    `transliterate({ source, from, to })` is the request — local first, then the private `remote()`
    if that answered nothing — and `transliterateDetected(source, to)` is
    the reader-side one that works the source out for itself; `MAX_TRANSLITERATION_SOURCE` is the
    ceiling and `ConversionEngine` (`aksharamukha` | `ai`) is what both cache tables record. The two
    exact converters deliberately share the one stored value: what a cached row needs to say is
    whether it was mapped or read, and both of these map.
    Two things it does that are easy to get wrong. **The service names are not guesses** — an
    unrecognised `source` or `target` comes back `200` with the text untouched, so `Punjabi` and
    `Odia` silently do nothing and `Gurmukhi` and `Oriya` are the real names. Which is why the
    private `converted()` checks every answer — local or remote — holds letters of the block that was
    asked for and differs from what went in before
    believing it. And **nothing here throws**: every failure — a scheme the local table does not
    know, an unreachable or slow service, an answer in the
    letters it went out in, the same script asked for twice — is null, exactly as `ai.ts` behaves,
    so a caller falls back to the gateway or offers nothing. It needs no credential, so
    `transliterationAvailable()` is always true and script conversion works on every deployment.
  - `discussions.ts` — everything a discussion needs, on a book or on a song: the limits
    (`MAX_DISCUSSION_PROMPT`,
    `MAX_REPLY_BODY`, `MAX_DISCUSSIONS_PER_ITEM`, `MAX_REPLIES_PER_DISCUSSION`,
    `SUMMARY_MIN_REPLIES`), `DISCUSSION_ITEM_TYPES` (`book`, `song`) with `isDiscussionItemType()`
    and the per-kind `discussionGlyph()` / `discussionLink()` / `discussionNoun()` a notification is
    written from, `visibleDiscussable()` — the share behind an id, only when it reaches this member,
    which is the visibility test rather than the ownership one — with `visibleBook()` still there for
    the book routes, `visibleDiscussion()` (the thread plus what it hangs on),
    `discussionResponse()` — which derives `replyCount` and
    `participantCount`, the head count being of people rather than replies — `discussionsOf()` /
    `discussionsByItem()` / `withDiscussions()` for decorating a listing in two reads,
    `startDiscussion()`, `addReply()`, `deleteDiscussion()`, `countDiscussions()`,
    `clearDiscussions()`, and `summarize()`, which asks `askText()` for the aggregate bullets
    and caches them on the row against `summary_reply_count`. Every way the model call can fail —
    no gateway configured, a refused request, an empty answer — answers null, so a missing summary
    is quietly absent rather than an error on a card.
    Threads began as a books-only idea, so the table is still `book_discussions` with its `book_id`
    column; a row now names what it hangs on with `item_type` and `item_id`, and `itemRefOf()` reads
    the old column as a fallback while the private `onItems()` matches either shape for a book. That
    is a read-time normalization rather than a back-fill, the same trick `upgradeLegacyNames()` uses
    in `categories.ts`, so no migration has to touch anybody's data.
  - `lyrics.ts` — the words of a recording and the scripts they can be read in. The limits
    (`MAX_LYRICS`, `MAX_LYRICS_LANGUAGE`), `lyricsFrom()` / `lyricsLanguageFrom()` /
    `lyricsSchemeFrom()` for what a form
    sent, `LYRIC_SCRIPTS` (Kannada, Telugu and Devanagari as transliterations — the same words and
    sounds in other letters — and Hindi as a translation of what they mean) with `isLyricScript()`,
    `visibleSong()`, `lyricScriptResponse()` / `lyricScriptsOf()` / `withLyricScripts()`,
    `renderLyricScript()`, `cachedLyricScript()` and `clearLyricScripts()`.
    Each entry carries a `script` naming what Aksharamukha writes it in, and the private
    `scriptFor()` reading it is the one place the choice of converter is made: the three
    transliterations are a table lookup and come back at once, and Hindi — whose
    `script` is null — goes to the gateway.
    **What a mapping needs and lyrics do not always give is what to map *from*.** Words in an Indic
    script declare themselves, so `detectScript()` answers and the conversion is exact. Words in
    Latin letters declare nothing — `vakratuNDa` is four conventions' spelling of the same
    line — and `detectScript()` answers null for them on purpose, which used to send every romanised
    stotra to the gateway to be guessed at, and to nowhere at all on a deployment with no gateway.
    So the author is asked once, on the form, and `songs.lyrics_scheme` remembers the answer. The
    private `sourceOf()` is `detectScript() ?? scheme`, and `exactSourceFor(target, lyrics, scheme)`
    is the whole routing decision: it answers what to convert from, or null for the two different
    failures that wear the same face — nothing to map from, and the words already being in the script
    asked for. That second case is why `transliterate()` returning null for `from === to` had to be
    caught here rather than fallen through, since falling through handed a verse to a model to
    "convert" into the letters it was already in.
    `availableLyricScripts(lyrics, scheme)` is that test over all four, and it is what the browser
    draws its buttons from — a script that could only fail is not offered, which is better than a
    button whose one outcome is "nothing came back". `lyricScriptAvailableFor(script, lyrics, scheme)`
    is the same answer for one script, asked per request rather than per site for the same reason it
    always was: writing lyrics whose script or convention is known into another script needs no
    gateway at all. `sameScriptAs()` is its own export so the route can say "these words are already
    written in that script", which is a different sentence from "that could not be written".
    `warmLyricScripts()` renders every exactly-convertible script at save time — three table lookups,
    so the reader who opens the card next finds them already there — and `lyricReadingOf()` is the
    pair (`lyricScripts` and `lyricScriptsAvailable`) that every song response spreads, so no route
    can send one without the other.
    A rendering is stored against `digestOf()` — a hash of the lyrics it was made from — and the
    private `stillBest()` is what reads it back: a rendering is retired when the digest no longer
    matches *or* when it is a model's attempt at a script conversion that can now be made exactly,
    so editing the words retires the old versions and an old AI transliteration quietly upgrades
    itself the next time somebody taps it — which is also what happens the moment an author declares
    the convention they typed in, since that is a change in what "exactly" is possible rather than a
    change in the words. Latin-source lyrics with no convention declared keep their AI rendering,
    because nothing else can make one.
    `systemFor()` is where the model is told what it may do, and the point of the whole feature is
    what it is told it may not: work only from the lines given, never add a word or a line, never
    complete what looks unfinished, and never draw on any song it recognises. The lyrics are the
    member's own text and are named as material to convert rather than instructions to follow.
    `systemFor()` is where the model is told what it may do, and the point of the whole feature is
    what it is told it may not: work only from the lines given, never add a word or a line, never
    complete what looks unfinished, and never draw on any song it recognises. The lyrics are the
    member's own text and are named as material to convert rather than instructions to follow.
  - `translations.ts` — the same idea for a post in a category a circle invented, since a circle
    that writes Travelogue or Stotras is not all reading one language. `POST_LANGUAGES` is the eight
    on offer and splits down the middle: Kannada, Hindi, Telugu and Tamil translate what the post
    says and carry a null `script`, while Devanagari, Kannada script, Telugu script and Tamil script
    keep every word and change only the letters, each naming the `IndicScript` Aksharamukha writes
    it in. Kannada appearing twice is the point of the list rather than a duplicate in it: a recipe
    written in English wants translating into Kannada, and a stotra typed in Devanagari wants
    writing in Kannada letters, and translating that one would turn a prayer into a paraphrase of
    one. Then `isPostLanguage()`, the private `scriptFor()` (which converter a request goes to),
    `MAX_TRANSLATION_SOURCE`
    is the ceiling on how much is sent, `translateIntoFrom()` reads what the form asked for —
    undefined when the body said nothing, so an edit that only changes the title leaves the choice
    alone — and `translateIntoOf()` / `readableLanguages()` turn the stored lines back into the list
    the browser reads. Then `withTranslations()` for decorating a listing in one extra read,
    `visiblePost()` (the post behind an id, only when it reaches this member),
    `renderTranslation()`, `cachedTranslation()`, `translationAvailableFor(language, body)` — per
    request, because a script conversion of Indic text needs no gateway — and `clearTranslations()`.
    A translation is stored
    against `digestOf()` — a hash of the details it was made from — and read back through the same
    `stillBest()` rule `lyrics.ts` uses, so editing the post retires
    every translation of the old text without a cascade or a sweep, and a model's script conversion
    is remade exactly the next time it is asked for.
    `systemFor()` is the narrow brief: convert only what is given, never add a sentence or a
    heading, never answer a question the post asks, and keep the paragraphs; the details are named
    as material rather than instructions. Every failure path answers null, so a deployment with no
    AI Gateway has no translations — though it still has every script conversion — and a post still
    reads as written.
  - `likes.ts` — `likeStateOf()` / `likesByItem()` / `withLikes()` (the count plus whether this
    reader is in it), `setLike()`, which is idempotent in both directions so a double tap cannot
    double count, and `clearItemLikes()` for a deleted share.
  - `experiences.ts` — what happened when somebody actually tried it: `EXPERIENCE_ITEM_TYPES` (a
    recipe and a remedy), `EXPERIENCE_KINDS` (`experience`, `tip`, `extra`), the limits,
    `visibleShare()`, `addExperience()`, `experiencesOf()` / `withExperiences()`, and
    `clearItemExperiences()`.
  - `recipes.ts` — the two questions a recipe answers about itself, and the one it used to answer
    instead of them. `RECIPE_MENU_TYPES` (Vegetarian, Non-vegetarian, Vegan, Jain, No onion &
    garlic) is the list several answers can be given from at once, which is why the form ticks it
    rather than dropping it down; `RECIPE_DISH_TYPES` (Appetizer … Chutney / Pickle, Other) is the
    list exactly one answer comes from. `menuTypesFrom()` reads either the array a form sent or the
    newline-separated text the column stores — dropping anything not on the list and answering in
    the offered order rather than the ticked one — and `joinMenuTypes()` writes it back, the shape a
    word keeps its synonyms in. `dishTypeFrom()` deliberately does *not* check its answer against
    the list, because a value carried over from the old single "Category" is still what its author
    wrote. `recipeReadingOf()` is the whole of the backward compatibility: the two columns where
    either holds anything, and otherwise the old `category` read as whichever of the two it always
    meant — Vegetarian/Non-vegetarian/Vegan as menu types, Dessert and Drink as Sweet / Dessert and
    Drink / Beverage, and anything else offered back verbatim as a dish type. That is read-time
    normalisation rather than a back-fill, the same trick `itemRefOf()` plays on a discussion's
    original `book_id`, so no migration rewrote anything anybody typed. `recipeResponse()` is a row
    plus that reading, and every route that hands a recipe over spreads it. `recipeMetaFrom()` is
    what a create writes and `recipeMetaPatch()` what an edit does: a body naming neither key leaves
    all three columns alone, the way `photoKeysFrom()` leaves photos alone, and a body naming either
    has been asked the question — so the derived reading is written into the new columns and the old
    one is retired, since the form it came back from opened on that reading and the author either
    confirmed or corrected it. Neither field is a folder, a subfolder or a category: they are facts
    about one recipe, stored on the recipe beside its preparation time, and where it *sits* is still
    Circle → Folder → Subfolder and nothing here touches it.
  - `words.ts` — everything Word Explorer needs on the server: the limits
    (`MAX_WORD_LIST`, `MAX_CONNECTIONS_PER_WORD`, `MAX_LANGUAGE_NAME`, `MAX_TERM`,
    `MAX_CONNECTION_NOTE`), `wordListFrom()` / `joinWordList()` — synonyms and antonyms travel as
    arrays and are stored one per line, the shape a book's quotes use — `wordListPatch()`, which
    keeps a list a PATCH did not mention and replaces one it did, `wordResponse()` for a single row,
    `connectionsOf()` / `withConnections()` for decorating a listing in one read, `visibleWord()`
    (the word behind an id, only when it reaches this member), `connectionFrom()`,
    `addConnection()` — idempotent on the same language and term, so two members offering "Greek
    osteon" make one row — `connectionsFrom()` / `addConnections()`, which are the same two things
    for the whole list an Add Word form sent (a row missing either half is dropped, the same pair
    twice is one, and the per-word ceiling still applies) — and `clearConnections()` for a deleted
    word.
  - `audio-uploads.ts` — chunked-upload constants, the two blob stores, and part keys.
  - `photos.ts` — everything photo-shaped, and the same helpers for every kind of share that takes
    pictures (all of them except a word):
    `photoStore()`, `MAX_PHOTO_BYTES`, `MAX_PHOTOS_PER_ITEM`, `photoKeyFor()` (a key is
    `<memberId>_<uuid>`, so it names its uploader), `photoUrl()`, `photoKeysFrom()` — which answers
    null when a body says nothing about photos, so an edit that does not mention them leaves them
    alone — `setItemPhotos()` / `applyItemPhotos()` / `clearItemPhotos()`, and `photosOf()` /
    `withPhotos()` for decorating a listing. A member may only attach keys they uploaded, and never
    one already attached to another item, so nothing can reach into somebody else's pictures.
  - `invites.ts` — invite token generation and validation, the circle lookup behind a
    circle-scoped invite, plus the two response shapes:
    `invitePreview()` for the public join screen (never includes the invitee's email) and
    `inviteForOwner()` for the inviter's own list. Both name the circle when the link was made
    from one.
  - `magic-link.ts` — logging in without a password, which is how everybody now arrives. Identity
    has no magic-link or one-time-code endpoint of its own, and its **only** app-triggerable email
    that produces a logged-in session on one tap is the password-recovery one, so the sign-in link
    is built on `POST {identity}/recover` — a plain unauthenticated `fetch` from `sendRecoveryEmail()`,
    since the browser-side `requestPasswordRecovery()` runs on a GoTrue client that does not exist in
    a function. `sendSignInLink(email, inviteToken)` is the whole flow and is deliberately the same
    two sentences either way round: work out whether the address is already an account (the `members`
    directory first, then a paged `admin.listUsers()` walk, because Identity has no filter by email),
    create one if not, send the email — and if the send fails on an address believed to exist, make
    the account and try once more, since "believed to exist" is the one thing that can be wrong.
    `ensureAccount()` stamps `app_metadata: { roles: ["member"] }` itself, because
    `admin.createUser()` auto-confirms, sends nothing and **bypasses the `userSignup` event** in
    `identity.mts` that would otherwise have done it, and it swallows its own errors: either the
    address was already an account or two taps raced, and both mean carry on.
    `nameFromEmail()` is load-bearing rather than cosmetic — `memberNameOf()` falls back to
    `user.email`, so an account made with no name would print its owner's address on every card they
    shared. `throttleSignInLink()` is the per-address limit (`COOLDOWN_SECONDS`, `HOURLY_LIMIT` in a
    `WINDOW_SECONDS` window) answering a `ThrottleVerdict`, and `normalizeEmail()` is the input rule.
    Nothing here checks standing: a suspended account is refused by `access.ts` on every request and
    by `userLogin` at the door, whatever way the session was obtained, and checking here would only
    have built an oracle for whether an address is a member.
- `netlify/functions/` — the API, one file per route, using the modern default-export handler
  signature with in-code `config.path`:
  - `songs.mts` — `GET /api/songs`, each song decorated with its photos, whatever lyric scripts have
    been rendered for it, which of the four can be made for its words, and its discussions.
    `song.mts` — `PATCH`/`DELETE /api/songs/:id` (author
    only); a `PATCH` may set or clear the lyrics, and clearing them takes the language and the roman
    convention with them, may declare that convention on words shared before the form asked — which
    is the ordinary way an old recording becomes exactly convertible — and calls
    `warmLyricScripts()` afterwards, so the scripts that are a table lookup are remade from the new
    words rather than left to the next reader. A delete clears the renderings and the threads along
    with the audio blob.
  - `song-lyrics.mts` — `POST /api/songs/:id/lyrics/:script`: the lyrics of one recording rendered
    into `kannada`, `telugu`, `devanagari` or `hindi`. Any member the song reaches may ask, since
    nothing about the song changes; it answers the cached rendering when the words have not moved,
    `400` when the song has no lyrics, when the script is not one of the four, or when the words are
    already written in it (`sameScriptAs()`), and `503` only where the
    answer actually needs a gateway — which `lyricScriptAvailableFor()` decides per request, since
    writing lyrics whose script or convention is known into another script needs no gateway at all.
    That `503` says one of two different things, because the two have different remedies: where the
    words are in Latin letters with no convention declared, it names that and says the author can
    pick one under Edit; otherwise it is the plain "not switched on for this site".
  - `transliterate.mts` — `POST /api/transliterate`: text in, the same text in another script out.
    The only route in the app gated on nothing but `admittedUser()`, because there is no item, no
    circle and no owner — the member has not shared anything yet, which is the whole point of it.
    It reads `{ text, from, to }`, where `from` is a roman scheme or an Indic script and `to` is an
    Indic script, and answers `{ text }` or a `502` saying what was typed is still there. Nothing is
    stored, no model is involved, and nothing about it needs the AI Gateway.
  - `upload-part.mts` — `PUT /api/uploads/:uploadId/parts/:index` (requires auth).
  - `upload-complete.mts` — `POST /api/uploads/:uploadId/complete`: stitches the parts into one
    blob, inserts the song row — with the lyrics, their language and the roman convention they were
    typed in, if the member gave any — warms the exactly-convertible scripts so the words arrive
    readable in Kannada, Telugu and Devanagari at once, and notifies the group when the song is
    shared.
  - `audio.mts` — `GET /api/audio/:id`, streaming with HTTP range support so seeking works.
  - `recipes.mts` / `recipe.mts`, `facts.mts` / `fact.mts`, `words.mts` / `word.mts`,
    `books.mts` / `book.mts`, `remedies.mts` / `remedy.mts` — list and create, then patch and
    delete per id. The same shape for all five types. `books.mts` / `book.mts` carry one extra
    beside that shape, the same one `songs.mts` does: `fieldsForBuiltIn("book", …)` reads what the
    chosen circles' Books categories ask, `missingRequired()` refuses a needed answer left blank,
    `answerTexts()` goes through `unsafeText()` with the rest, and the answers are written with
    `setItemFieldValues` / `applyItemFieldValues`, read back as `fieldValues` and cleared on delete.
    `words.mts` has one extra: a `connections`
    list on the `POST` is created with the word, so a new entry can arrive with the Greek and the
    German for it already on it. A `PATCH` says nothing about connections, because by then they
    belong to whoever added them.
  - `item-discussions.mts` — `GET`/`POST /api/items/:itemType/:itemId/discussions`: the threads on
    one book or one song, and starting one, which notifies that share's circles.
    `item-discussion.mts` —
    `DELETE /api/items/:itemType/:itemId/discussions/:discussionId`, allowed to whoever started the
    thread and to the member who shared the thing it hangs on. One pair of routes rather than one
    per kind, because a discussion is the same thing wherever it sits.
    `discussion-replies.mts` — `POST /api/discussions/:id/replies`, which also
    tells the thread starter and the share's author that somebody joined.
    `discussion-reply.mts` — `DELETE /api/discussions/:id/replies/:replyId`, allowed to the reply's
    author, the thread starter and the share's author. `discussion-summary.mts` —
    `POST /api/discussions/:id/summary`, which any member who can see the thread may ask for: it
    answers the cached summary when the thread has not moved, `400` below `SUMMARY_MIN_REPLIES`,
    and `503` where no AI Gateway is configured. The three reply and summary routes are keyed on the
    discussion alone, so they never needed to know what it hangs on.
  - `book-likes.mts` — `POST`/`DELETE /api/books/:id/likes`, one row per member per book.
  - `experiences.mts` — `POST /api/experiences`: an experience, a tip or something extra on a
    recipe or a remedy. `experience.mts` — `DELETE /api/experiences/:id`, allowed to whoever wrote
    the note and to the member who shared the thing it sits on.
  - `word-learned.mts` — `POST`/`DELETE /api/words/:id/learned` (personal, per member).
  - `word-connections.mts` — `POST /api/words/:id/connections`: the same word in another language.
    Any member the word reaches may add one, which is the second place a mutation is not the
    author's alone (the first is adding a subcategory mid-post). `word-connection.mts` —
    `DELETE /api/words/:id/connections/:connectionId`, allowed to whoever added the connection and
    to the author of the word it hangs on.
  - `library.mts` — `GET`/`POST /api/library`. `library-item.mts` —
    `DELETE /api/library/:itemType/:itemId`, scoped to the caller's own row.
  - `notifications.mts` — `GET /api/notifications` (most recent 50), filtered to the group-wide
    rows, the ones addressed to the caller, and the ones belonging to a circle the caller is in.
  - `circles.mts` — `GET`/`POST /api/circles`: everything the circles screen needs in one read (the
    caller's circles, the public and discoverable ones on offer, invitations waiting on them, and
    requests waiting on their own circles), and creating one, optionally inviting contacts at the
    same time. `circle.mts` — `GET /api/circles/:id` (one circle with its members, pending
    invitations and pending requests; a non-member sees the circle but not its roll), plus `PATCH`
    and `DELETE` for whoever looks after it — its owner, its admins, or the app admin, all of them
    `moderatorOf()`. Discover (`isDefault`) is the one circle that cannot be closed, and its privacy
    is pinned even for an app admin editing the rest of it, because every account is joined to it and
    closing or locking it would shut the app's front door.
  - `circle-members.mts` — `POST /api/circles/:id/members`: join a public circle, ask to join a
    discoverable one, accept an invitation, or — as the circle's owner or one of its admins —
    approve someone's request.
    `circle-member.mts` — `DELETE /api/circles/:id/members/:memberId` (`me` as shorthand for the
    caller), which is leaving, declining an invitation, withdrawing a request, or a manager removing
    somebody, plus `PATCH` for making a member an admin of that circle or taking the role back.
    Both are `moderatorOf()`, so an admin may remove a member and may promote or demote a fellow
    admin. The owner is the one exception either way: they cannot be removed or demoted, and
    deleting the circle is their way out of it.
  - `circle-invites.mts` — `POST /api/circles/:id/invites`: the circle's owner or one of its admins
    invites contacts by member id.
  - `circle-categories.mts` — `GET`/`POST`/`PATCH /api/circles/:circleId/categories`: one circle's
    categories with their subcategories and derived counts, adding one (a built-in by `itemType`,
    or a custom one by name and icon — re-ticking a built-in the circle already had simply unhides
    it), and reordering. `circle-category.mts` —
    `PATCH`/`DELETE /api/circles/:circleId/categories/:categoryId`: rename, re-icon, switch off or
    on; and delete, which refuses a built-in, refuses one still switched on, and answers `409`
    unless the caller said what happens to its posts (`{ posts: "move", to }` or
    `{ posts: "release" }`) — either way the authors are notified, naming whoever pressed the
    button. `moderatorOf()` in both files.
  - `subcategories.mts` — `POST`/`PATCH
    /api/circles/:circleId/categories/:categoryId/subcategories`: adding a node of the tree, at the
    top level or under a `parentId` (which must belong to the same category, and must leave the
    result inside `MAX_TAXONOMY_DEPTH`), and the response says whether it was created or which
    existing sibling it is close to, so the form can offer "Use Sweets" instead. Who may do it is
    `mayAddTaxonomy()` rather than a flat "any member": a manager always, an ordinary member only
    where the circle's `memberTaxonomy` is on, and a `403` naming the rule — "This circle keeps its
    categories to its owner and admins." — where it is off. `PATCH` reorders one node's siblings, and
    is a manager's.
    `subcategory.mts` — `PATCH`/`DELETE /api/.../subcategories/:subcategoryId`: rename, move to
    another parent or to the top level, merge into another node, hide or show, and delete — which
    unfiles its posts rather than removing them and promotes its children one level rather than
    taking the branch with it. A rename that clashes is sibling-scoped and answers `409` with a
    `mergeInto` so the caller can offer the merge instead; a merge into a node inside the moving
    node's own `subtreeIds()` is refused, as is any move `reparentRefusal()` names. `moderatorOf()`
    throughout, so every one of the six is checked against that particular circle.
  - `category-fields.mts` — `POST`/`PATCH
    /api/circles/:circleId/categories/:categoryId/fields`: the extra questions one custom category
    asks on its share form. `POST` is gated on `moderatorOf()` — the circle's owner, one of its
    admins, or the app admin stepping in — because a field reshapes the form everybody else fills
    in, which is the opposite of a subcategory; a member of the circle who is none of those gets a
    `403` saying so, and anybody outside it gets the plain "join the circle" refusal. It answers
    `{ created, field,
    categories }`, where `created` is null when the label was already there, so a second admin
    asking for "Deity" gets the field that exists rather than a duplicate. `PATCH` reorders and is
    the same set of people. Which categories can be asked anything at all is `categoryTakesFields()`:
    a category the circle invented, and the two built-ins opened up to questions — Songs and
    Books — while the other four are refused by name, their forms being the same in every circle.
    `category-field.mts` — `PATCH`/`DELETE /api/.../fields/:fieldId`: rename, change what it asks
    for, rewrite a dropdown's choices, mark it needed, switch it off or on, and delete — which is
    the one action here that throws anything away, taking the answers with it. `moderatorOf()`, like
    everything else that reshapes the circle.
  - `posts.mts` — `GET`/`POST /api/posts`: the posts of every custom category the caller can see,
    each decorated with its photos, its answers to its category's fields and whatever translations
    have been written for it, and adding
    one. `post.mts` — `PATCH`/`DELETE /api/posts/:id` (author only); a `PATCH` may change which
    languages the post is offered in, a `PATCH` that says nothing about `fieldValues` leaves the
    answers alone while one that names them replaces the set, and a delete clears its translations
    and its answers along with everything
    else hanging off it. Both routes pass the post's own `categoryId` down to `setItemCircles()` /
    `applyItemCircles()`, because a custom category has no `item_type` to be found by.
  - `post-translation.mts` — `POST /api/posts/:id/translations/:language`: one post's details
    written in one of the eight — `kannada`, `hindi`, `telugu` and `tamil`, which say what it means,
    and `devanagari`, `kannada-script`, `telugu-script` and `tamil-script`, which keep every word and
    change only the letters. Any member the post reaches
    may ask, since nothing about the post changes; it answers the cached translation when the
    details have not moved, `400` when the post has no details or the language is not one of the
    eight, and `503` only where the answer actually needs a gateway, which
    `translationAvailableFor()` decides per request — a script conversion of Indic text needs none.
  - `my-categories.mts` — `GET /api/my-categories`: the categories of every circle the caller is
    in, as they see them, which is what the share forms read at startup.
  - `circle-covers.mts` — `POST /api/circle-covers`, storing a cover image in Blobs and returning
    its key. `circle-cover.mts` — `GET /api/circle-covers/:key`, serving one back.
  - `photos.mts` — `POST /api/photos`, storing one picture in Blobs and returning its key and URL;
    a member must be logged in, and the key it mints says who uploaded it. `photo.mts` —
    `GET /api/photos/:key`, serving one back, cached hard because a key never points at different
    bytes.
  - `files.mts` — `POST /api/files`, the same one-request upload for a document answering a
    category's `file` field: the bytes are the whole body, the filename travels in an `x-file-name`
    header rather than in a multipart form, and anything that is not a PDF, a Word file or an Excel
    workbook is refused with a `415` naming the three. `file.mts` — `GET /api/files/:key`, serving
    one back with the type it was uploaded as, `X-Content-Type-Options: nosniff`, and a
    `Content-Disposition` of `inline` for a PDF and `attachment` for the rest, since only the first
    has anything in a browser to open in. Like a photo, it needs no login, the key being
    unguessable and only ever reaching somebody the share itself reached.
  - `identity.mts` — the Identity event function, and the front door, which is open: it no longer
    refuses a signup for arriving without an invitation, so anybody may create an account. It keeps
    the two things Identity cannot do on its own — `userSignup` stamps `app_metadata.roles`
    server-side, since
    a signup form has no say in its own role; and `userLogin` denies a suspended member at the door
    as well as inside the app. A pause is enforced twice — here, and
    again on every request by `access.ts` — because an account can also appear from the Netlify UI
    or an external provider without passing through this function.
  - `email-signin.mts` — `POST /api/email-signin`: an address in, a sign-in link out. It is the one
    write in the app deliberately **not** behind `admittedUser()`, because whoever is asking has no
    session yet and may not have an account at all. It validates the address, reads an optional
    `inviteToken` for parity with the signup path, refuses through `throttleSignInLink()` with a
    `429`, a `Retry-After` and a `retryAfter` the browser counts down, and otherwise answers
    `Response.json({ sent: true })` — **the same answer whether the address was already a member or
    has just become one**, which is the whole reason the route exists rather than a "does this email
    have an account?" endpoint plus a send. A `502` is a send that actually failed, which is a
    different thing from an address the caller was fishing for.
  - `access.mts` — `GET /api/my-access`: everything the browser needs to know about its own account in
    one read — the access state, the circles it moderates, open report counts per circle, the posts
    it hid, the members it blocked, and (for the app admin alone) the roll. Also refreshes
    `last_seen_at`.
  - `guidelines.mts` — `POST /api/guidelines`: the member agreeing to the Community Guidelines,
    stamped on `members.guidelines_accepted_at` and idempotent, so a second tap is the same
    agreement. It is the one write that is deliberately *not* behind `sharingGate()` — a gate that
    refused until you had agreed, on the route where you agree, could never be opened.
  - `reports.mts` — `GET`/`POST /api/reports`: the queue a moderator sees, and reporting a post.
    Any member who can see something may report it, never their own, and the `circleId` they were
    reading in is what routes the report. `report.mts` — `PATCH /api/reports/:id`, the moderator's
    answer (`{ decision: "dismiss" | "remove" }`), open to that circle's owner and admins and to
    the app admin, and to nobody else.
  - `blocks.mts` — `GET`/`POST /api/blocks`: who this member has blocked, and blocking somebody.
    `block.mts` — `DELETE /api/blocks/:memberId`, unblocking. `hidden.mts` —
    `GET`/`POST /api/hidden`, and `hidden-item.mts` — `DELETE /api/hidden/:itemType/:itemId`: the
    same two shapes for a post this member would rather not see. Every one of the four is scoped to
    the caller's own rows, because a hide and a block are nobody else's business.
  - `member.mts` — `PATCH /api/members/:id`: the app admin's few levers, for abuse and support and
    nothing else — vouch for an account so it can start circles, suspend or reinstate one, and hand
    the global role on. An admin cannot suspend or demote themselves, so the group is never left
    without one.
  - `member-blocks.mts` — `GET /api/members/:memberId/blocks` and
    `DELETE /api/members/:memberId/blocks/:otherId`, the app admin's alone: why one member cannot
    see another, and the lever that fixes it. The read answers the blocks either way round, the
    circles the member is in, whether they are outside Discover, and how many of their shares name
    no circle — because those are the only reasons two members of one group are invisible to each
    other, and none of them says anything on screen. Lifting a block tells whoever placed it, since
    it was their own record; the member it was placed on is told nothing, having never been told it
    existed.
  - `admin-circles.mts` — `GET`/`POST /api/admin/circles`: every circle in the group with its owner,
    privacy and counts, and `{ action: "merge-defaults" }`, which folds any stray Discover back into
    the canonical one. It is not a way into what circles contain — a circle is moderated by its own
    people — and exists for the two things nobody inside a circle can do: close one whose owner has
    gone, and repair a duplicated default circle, which is invisible from inside either copy.
  - `members.mts` — `GET`/`POST /api/members`: the contact directory an owner picks invitees from,
    and the call that keeps the caller's own entry in it current. Emails never leave the server.
  - `my-members.mts` — `GET /api/my-members`: everybody in the circles the caller is in, each named
    once with the circles they share with the caller and their role in each. It is what Members
    reads when nothing is narrowed, and it is deliberately not the contact directory above it: that
    one is everybody an invite could reach, and this one is the people the caller already shares a
    room with, which is a narrower claim and the only one a roll should make. It grants no reach a
    circle's own page would not, and answers nothing at all to somebody with no account.
  - `invites.mts` — `GET`/`POST /api/invites`, the caller's own invites only. A `circleId` on the
    `POST` makes the link a circle invitation, and only somebody who looks after that circle —
    `moderatorOf()` — may make one.
    `invite.mts` — `GET /api/invites/:token` (public, so a friend without an account can see who
    invited them, and which circle) and `DELETE /api/invites/:token` (inviter only, and only while
    still pending).
    `invite-accept.mts` — `POST /api/invites/:token/accept`: single-use, idempotent for the member
    who already accepted, the place where the three join notifications are written, and — for a
    circle link — where the new member is joined into that circle and listed in the contact
    directory.
- `db/schema.ts` — Drizzle schema: `songs`, `recipes`, `facts`, `words`, `books`, `remedies`,
  `saved_items`, `learned_words`, `invites`, `notifications`, `circles`, `circle_members`,
  `circle_invites`, `item_circles`, `item_photos`, `circle_categories`, `subcategories`, `posts`,
  `category_fields`, `post_field_values`,
  `word_connections`, `song_lyric_scripts`, `book_discussions`, `discussion_replies`, `item_likes`,
  `item_experiences`, `post_translations`,
  `content_reports`, `hidden_items`, `blocked_members`, `sign_in_links` and `members` tables. On `notifications`, a null
  `member_id`
  means the whole group sees the row and a member id addresses that one member; a `circle_id` limits
  the row to that circle's members; `link` is an in-app
  hash route to open when the notification is tapped. A `circle_id` on `invites` marks a link that
  joins the group and that circle together, which is how an owner invites somebody with no account.
  `item_circles` is the join table that gives a
  post its audiences — one row per circle, so a post shared into three circles is still one post —
  and its `subcategory_id` is where that post sits in that circle, because a shelf belongs to one
  circle and the answer differs per circle. Null there is the real "no subcategory", never a row
  named "Uncategorized": an absence cannot be renamed, merged or duplicated.
  `category_id` beside it is which of that circle's categories the share was filed under, and it is
  per-circle for exactly the same reason: a category belongs to one circle, so a song can be an
  Events entry in the circle that invented Events and an ordinary song in the next one. Null is the
  ordinary case and means "wherever this kind of thing goes" — which is what every row said before
  the column existed, so nothing had to be back-filled — and a `posts` row carries the same id its
  own `posts.category_id` does. A column rather than a rule in code because where a member decided
  to put something is a fact about that share in that circle, and there is nowhere else to keep it.
  `item_photos` hangs pictures off anything shared the same way — `item_type` plus `item_id`, a
  `blob_key` into the `item-photos` store, and a `sort_order` so the first photo stays the first
  photo. Rows rather than a column because a share may have none, one, or several, and because the
  answer is identical for every kind that takes them — which is all of them but a word, Word Explorer
  being a dictionary rather than an album.
  `circle_categories` is what one circle offers, with `item_type` naming the built-in it holds and
  null for a custom one, a unique index on `(circle_id, item_type)` so a circle has each built-in
  at most once while keeping as many custom ones as it likes, and `status` of `active` or `hidden`
  for the reversible switch. `subcategories` hangs off a category, holds its own `sort_order` and
  `status`, and is stored as rows rather than text on each post so renaming and merging are one
  update. It is also the taxonomy tree: `parent_id` is a nullable self-reference, so a node with none
  is at the top level and a node with one sits under that node, to any depth — an adjacency list
  rather than a second table, because the only questions ever asked of it (this node's children, its
  ancestors, its branch) are answered from one category's rows read in a single pass. Nesting means
  the uniqueness of a name is a question about siblings rather than about the category, and Postgres
  will not treat two nulls as equal, so it takes two indexes to say one thing:
  `subcategories_category_name_idx` is unique on `(category_id, parent_id, name)` for the nodes with
  a parent, and the partial `subcategories_category_root_name_idx` is unique on
  `(category_id, name) WHERE parent_id is null` for the ones without. Karnataka under Vegetarian and
  Karnataka under Non-Vegetarian are two real places and both indexes allow them; two Karnatakas
  under the same parent are refused by the database rather than only by the code above it.
  On `circles`, `member_taxonomy` is the one setting behind all of it: true — the default, and what
  every circle made before the column existed reads as — lets any member invent a node mid-post, and
  false keeps the tree to whoever looks after the circle. A column rather than a rule in code because
  it is a decision that circle made about itself and there is nowhere else to keep it.
  `posts` is the single table behind every custom category — title, body, and
  `translate_into`, the languages its author asked for it to be readable in, held one per line the
  way a word keeps its synonyms — because a category invented at runtime cannot have a hand-built
  form. Its `happens_on` column is still there and still read back, but no form asks for it any
  more: Travelogue took over what it was for, and a column nothing writes costs nothing while
  dropping one would lose what members already typed.
  `category_fields` is how that one shared form is made to fit: a `category_id`, the `label` to
  ask, a `kind` of `text`, `textarea`, `checkbox`, `select`, `file` or `link`, the dropdown's
  `options` held one
  per line, an optional `hint`, `required`, a `sort_order` and the same `active` / `hidden` status
  every other reshapeable thing has, with a unique index on `(category_id, label)` so two members
  asking for the same question make one field. Three more columns belong to an upload field alone
  and mean nothing on the other five kinds: `file_types` holds which of PDF, Word and Excel it takes
  (one per line, and null for all three), `max_bytes` a smaller ceiling than the platform's own, and
  `multiple` whether it takes more than one document. All three are nullable or defaulted to exactly
  what an upload field written before them already meant — any of the three formats, the platform's
  ceiling, one file — so no field anywhere had to be touched. They are columns rather than a rule in
  code for the usual reason: what a particular form asks for is a fact about that field, decided by
  that circle, and there is nowhere else to keep it. `post_field_values` is one post's answer to one of
  them — a `post_id`, a `field_id` and the `value` — unique on `(post_id, field_id)`, so re-saving
  a post replaces its answers rather than stacking them. Rows on both sides rather than JSON on the
  post: a question that can be renamed, reordered, switched off and counted is a row, and an answer
  that has to survive the question being renamed has to point at it rather than copy it.
  `value` is plain text whatever the kind, and an uploaded document is the JSON
  `{ key, name, size }` written into it — the bytes living in the `field-files` blob store the same
  way a photo's do — so adding the `file` kind cost no column and no migration. Several documents
  are a JSON array of those same envelopes in that same column, which is why letting a field take
  more than one cost no migration either: one file is still the bare object, so every answer already
  stored reads back exactly as it did.
  A custom category has fields, and so do Songs and Books — `FIELDED_BUILT_INS`, whose answers hang
  off the share itself through `item_type` / `item_id` rather than off a `posts` row — and a value whose
  field was switched off is kept and simply not read, exactly as a hidden category's posts are.
  `post_translations` is one post's details in one language: a `post_id`, a `language` — one of the
  four that translate (`kannada`, `hindi`, `telugu`, `tamil`) or the four that only change the
  letters (`devanagari`, `kannada-script`, `telugu-script`, `tamil-script`) — the written `body`,
  `source_digest` — a hash of the details it was made from — and `engine`, naming which of the two
  converters wrote it, with a unique index on `(post_id, language)` so each
  language is stored once and a re-render replaces it. The digest does the same work it does for a
  song's lyrics: a translation whose digest no longer matches is simply not read, so editing the
  post retires its translations with no cascade and no sweep, and it is written again only
  when somebody actually taps the language. `engine` is the second reason a row is retired, and the
  one that lets the cache improve on itself: an `ai` row for a language that is only a change of
  letters is remade exactly the next time it is asked for, while an `aksharamukha` row never needs
  remaking and an `ai` row for a real translation is the best there is. It defaults to `ai`, so
  everything written before Aksharamukha arrived is described correctly and upgrades on its own.
  Rows rather than columns because a post may have none
  of the eight or all of them, and because the answers arrive one at a time.
  `circle_invites` holds both directions of a pending join: an invitation the owner sent and a
  request someone made. `members` is the contact directory, so an owner can pick invitees without
  Identity admin access.
  On `words`, `synonyms` and `antonyms` hold one entry per line — text rather than rows, the way a
  book keeps its quotes, because they are short, ordered and only ever read with the word — and
  `notes` is free text; all three are nullable, and a word with nothing in them shows no such
  section. `word_connections` is the same word in another language: a `word_id`, a `language`, the
  `term` itself, an optional `note`, and the member who added it, with a unique index on
  `(word_id, language, term)` so the same offering twice is one row. Rows rather than a column
  because a word may have none or many and because each one belongs to whoever contributed it,
  which is what lets a member add to somebody else's word without editing it.
  On `recipes`, `menu_types` holds who can eat it — one entry per line, the shape a word keeps its
  synonyms in, because the answers are short, ordered and only ever read with the recipe — and
  `dish_type` holds what kind of dish it is, exactly one of them. Two columns rather than one
  because they are two different facts: `category`, which asked both at once and could only answer
  one, is still there and still stored, never written by the current form and read only as a
  fallback by `recipeReadingOf()` when neither new column holds anything. That is why no migration
  rewrote a row — the DDL only adds — and why a recipe nobody has edited since still reads
  correctly. Columns on the recipe rather than `category_fields` rows, because these are built-in
  questions every circle's Recipes form asks rather than something one circle added, and Recipes is
  deliberately not in `FIELDED_BUILT_INS`.
  On `songs`, `lyrics` holds the words as the member typed them and `lyrics_language` names the
  language they are in. Both are nullable and neither is required to share a recording. They are
  columns rather than rows because they belong to the song the way its title does — one set of
  words, written by whoever shared it, editable only by them. `lyrics_scheme` is the third of the
  same kind: which roman convention those words follow — `itrans`, `iast`, `iso` or `hk` — when they
  are typed in Latin letters at all, and null on words written in an Indic script, where the letters
  say what they are. It is stored because it is the one thing about romanised lyrics that cannot be
  worked out by looking at them: `aa`, `ā` and `A` are three conventions' answer to the same vowel,
  so without the author's answer an exact conversion is not possible, which is why every romanised
  stotra used to be handed to a language model to guess at. Nullable and defaulted like everything
  else here, so every recording shared before the column existed keeps working and can be told
  afterwards.
  `song_lyric_scripts` is those same words in another script: a `song_id`, a `script` of `kannada`,
  `telugu`, `devanagari` or `hindi`, the rendered `body`, `source_digest` — a hash of the lyrics
  it was made from — and `engine`, naming which of the two converters wrote it, with a unique index
  on `(song_id, script)` so each script is stored once and a
  re-render replaces it. The digest is the whole trick: a rendering whose digest no longer matches
  the song's lyrics is simply not read, so editing the words retires the renderings without a
  cascade or a sweep, and it is written again only when somebody actually taps the button.
  `engine` retires a row for the other reason, exactly as it does on `post_translations`: a model's
  attempt at Kannada, Telugu or Devanagari is remade exactly the next time somebody asks, while
  Hindi — which is a translation — keeps the one the model wrote. It defaults to `ai`, so every
  rendering made before Aksharamukha arrived is labelled honestly and upgrades on its own.
  Rows rather than columns because a song may have none of the four or all of them, and because the
  answers arrive one at a time.
  `book_discussions` is one question somebody asked about something shared — the `prompt`, who
  asked, and an `item_type` and `item_id` naming what it hangs on — and it carries its own `summary`
  beside `summary_reply_count` and `summary_at`, so the
  aggregate bullets are generated once and reused until the thread grows past the count they were
  made from. `discussion_replies` are the answers, oldest first, each belonging to whoever wrote it.
  Neither is a column on `books` or `songs`, because a discussion is a contribution by somebody
  other than the
  share's author. The table keeps its name and its now-nullable `book_id` from when threads were a
  books-only idea: a row written then still says which book it is on the old way, and `itemRefOf()`
  reads it, so nothing had to be back-filled and nothing anybody asked was lost. `item_likes` is one row per member per thing liked — `item_type` plus `item_id`
  again, with a unique index on `(item_type, item_id, member_id)` so a second tap is the same single
  like — and the count is a `GROUP BY` over it rather than a number on the row. `item_experiences`
  is what happened when somebody actually tried it: `item_type` and `item_id`, a `kind` of
  `experience`, `tip` or `extra`, the note itself, and its author. Generic in the same way
  `item_photos` is, because a recipe and a remedy want exactly the same thing.
  Standing lives on `members`, because Identity says whether a login is real and nothing more:
  `admitted_at` is when this account first turned up (stamped by `accessOf()` on its first request,
  or by `admitMember()` when it arrived on an invite) and `invited_by_id` is whose link it came
  on, if any; `trusted_at` is when it became old enough to start circles, `role` is `member` or
  `app_admin`,
  `status` is `active` or `suspended`, and `last_seen_at` is stamped on each `GET /api/my-access`.
  `guidelines_accepted_at` is when they agreed to the Community Guidelines, which is asked once and
  is a date rather than a flag so it says *which* wording they agreed to and when. All
  of them are nullable or defaulted, so an account from before any of this existed keeps working and
  is stamped the next time it opens the app. `circles.is_default` marks Discover, the one
  circle every member is joined to; it is a column rather than a name lookup so a circle somebody
  else calls "Discover" is not mistaken for it — and so renaming the default one costs nothing.
  `circle_members.role` is `owner`, `admin` or
  `member` — who moderates a circle is a property of the membership rather than a table of its own,
  since it is the same row that says they are in it at all.
  `content_reports` is one flag raised on one share: `item_type` and `item_id`, the `circle_id` it
  was read in so it reaches that circle's admins, the `reason` and optional `details`, the reporter
  and the author by id and name so a queue reads without a second join, a `status` of `open` /
  `dismissed` / `removed`, and who settled it when. A unique index on
  `(item_type, item_id, reporter_id)` makes a second tap the same report.
  `hidden_items` and `blocked_members` are each one row per member per thing, unique on
  `(member_id, item_type, item_id)` and `(blocker_id, blocked_id)`: a hide is one reader's view of
  one post, a block is one member's view of another and is read both ways round, and both are
  silent and undone by deleting the row. Rows rather than columns for the usual reason — the answer
  differs per reader, so it cannot live on the thing being read.
  `sign_in_links` is the only table keyed on somebody who may not be a member yet, and it is
  deliberately the thinnest one in the schema: a `email_hash` primary key, `last_sent_at`,
  `window_started_at` and `sent_count`, which is everything `throttleSignInLink()` needs to say "not
  again for a minute" and "not more than five an hour". The key is a **SHA-256 of the address and
  never the address itself**, because the table's whole job is to rate-limit strangers and a list of
  every email anybody has ever typed into the login box is not something worth keeping — a hash
  answers "is this the same address as last time?" and nothing else. It hangs off no member, is
  never read by any listing, and a row going missing costs one extra email rather than anything a
  member would notice.
- `db/index.ts` — Drizzle client (`drizzle-orm/netlify-db` adapter, no connection string needed).
- `drizzle.config.ts` — Drizzle Kit config; `out` is pinned to `netlify/database/migrations` so
  Netlify applies generated migrations automatically on deploy.
- `netlify/database/migrations/` — generated SQL migrations. Never edit an applied migration;
  roll forward with a new one instead.

## Why each Netlify primitive is used here

- **Netlify Identity** (`@netlify/identity`) for auth: open registration (the project's Identity
  setting is Registration → Open, and the app adds no gate of its own), JWT-based
  sessions via the `nf_jwt` cookie. Functions call `getUser()` (imported from `@netlify/identity`) to read the
  authenticated user from that cookie — no manual JWT verification needed. Creating anything is
  gated on `getUser()` returning non-null; editing and deleting go through `mayManageItem()`, which
  answers yes for the author and for whoever keeps a circle the share went into, so a plain member
  can only change their own contributions and a circle's own people can put right what is in their
  circle. Identity sends no
  invitation emails of its own here, which is why an invite is a link the inviter passes on and a row
  in the `invites` table rather than an Identity admin call.
  **Logging in is provider-first and otherwise passwordless.** `oauthLogin(provider)` navigates away
  and `handleAuthCallback()` picks the member up on the way back, and the buttons offered are read
  from `getSettings().providers` so the dashboard is the only place the list is decided. Apple is not
  among them because Identity has no Apple provider — `AuthProvider` is
  `google | github | gitlab | bitbucket | facebook | email` — and there is no way to add one without
  giving up Identity, which every `getUser()` in the API depends on. The email door is a **link**
  rather than a password or a one-time code, and the shape of it is forced: Identity exposes no
  magiclink or OTP endpoint, and the one email it will send on request that logs somebody in on a
  single tap is the password-recovery one. So `netlify/lib/magic-link.ts` creates the account if it
  is new (`admin.createUser()`, which auto-confirms and therefore bypasses the `userSignup` event, so
  the roles are stamped by hand) and then posts to `{identity}/recover`; the member comes back
  through `handleAuthCallback()`, which reports **`recovery`** and not `login`. Two consequences are
  load-bearing: `recovery` must re-stamp the cookies or the login dies with the browser, and
  something has to tell "I wanted in" from "I wanted a new password", which is
  `pendingPasswordReset()` in `src/session.ts`. **The recovery email's wording is a dashboard
  setting, not code** — Identity → Emails → Recovery — so it still reads as a password reset until
  somebody edits the template there, which is the one part of this that cannot be fixed from the
  repository.
  One thing about the browser side had to be corrected rather than used as shipped: the library
  writes `nf_jwt` and `nf_refresh` with no `Max-Age`, which makes them session cookies, and
  `getUser()` finding no cookie clears the stored session as well — so closing the browser logged
  everybody out and there was nothing left to refresh from. `src/session.ts` re-stamps the same
  cookies with a thirty-day lifetime before anything reads them, and every API call retries once
  behind `withFreshSession()` on a `401`. The token is still Identity's and is still refreshed by
  Identity; only how long the browser keeps it is ours.
  The **Identity event function** `netlify/functions/identity.mts` is the front door:
  `userSignup` writes `app_metadata.roles` server-side, and
  `userLogin` denies a suspended account. Identity is asked who somebody is and nothing more —
  whether the account is paused, whether they may start a circle, and whether they moderate one
  are the app's own records in Postgres, checked again on every request by `access.ts`, because an
  account can also be made from the Netlify UI or an external provider without passing through the
  event function at all. Roles live in `app_metadata`, never `user_metadata`, the latter being
  whatever the signup form said about itself.
- **Netlify Database** (Postgres + Drizzle) for structured, queryable data: the six content tables
  (metadata, plus a reference to the audio blob for songs), the `posts` table behind every custom
  category, the `saved_items` and `learned_words`
  join tables that keep each member's library private to them, the `invites` table, the circle
  tables (`circles`, `circle_members`, `circle_invites`, `item_circles`, `circle_categories`,
  `subcategories`, `members`), the `word_connections` table hanging off a word, the
  `song_lyric_scripts` table holding a recording's words in another script, the
  `book_discussions` and `discussion_replies` tables behind a book's and a song's conversations, the
  `item_likes` and `item_experiences` tables that hold what the group said back, the `members`
  columns that record who was admitted and who is trusted, the `content_reports` queue, the
  `hidden_items` and `blocked_members` rows behind one reader's own quiet, the `sign_in_links`
  hashes that keep the sign-in email from being a way to spam somebody's inbox, and the
  `notifications` feed. This is relational, filterable data, so it belongs in Postgres, not Blobs.
  Circle reach in particular is a `WHERE` clause over `item_circles`, so a listing stays one query,
  and a category's counts are a `GROUP BY` over the same rows rather than a number kept up to date
  by hand.
- **Netlify Blobs** for the actual binary files: audio in a `song-audio` store keyed by
  `<memberId>/<uuid>`, with in-progress upload parts in `song-audio-parts`, circle cover images in a
  `circle-covers` store, and the photos on a share in an `item-photos` store keyed by
  `<memberId>_<uuid>`, and the documents answering a category's `file` field in a `field-files`
  store keyed the same way. The `songs.blob_key`, `circles.cover_key` and `item_photos.blob_key`
  columns
  link a metadata row to its blob, and a document's key travels inside the
  `post_field_values.value` envelope. Blobs is used only for the unstructured file bytes — never for the metadata
  itself.
- **Netlify AI Gateway** for the three things a rule cannot do: reading a long discussion and
  saying what the group as a whole thought of it, saying in Hindi what the lyrics a member typed
  under their recording mean, and saying what the details of a post in a category a circle invented
  mean in Kannada, Hindi, Telugu or Tamil.
  `netlify/lib/ai.ts` posts to
  the gateway with a plain `fetch` — no SDK dependency — reading `ANTHROPIC_BASE_URL` /
  `ANTHROPIC_API_KEY` and falling back to `NETLIFY_AI_GATEWAY_BASE_URL` /
  `NETLIFY_AI_GATEWAY_KEY`, so the gateway holds the credential and the browser never sees one. A
  summary
  is asked once per thread and a translation once per language, each
  cached on a row, and a deployment
  with no gateway configured simply has none of them — every other part of a discussion, of a song
  and of a post
  still works.
  What the model is asked for is deliberately bounded in every case: summarise these replies, say
  these lines in that language. It is never asked to supply content
  it was not given, which on the lyrics
  side is the whole design — a model asked to recall a known recording's words would be reproducing
  somebody else's copyrighted lyrics and would get them wrong, so the words always come from the
  member who shared the recording. Every system
  prompt ends by naming the member-written text as material to work on rather than instructions to
  follow, because it is untrusted input.
- **Transliteration in process** (`@indic-transliteration/sanscript`) — not a Netlify primitive, but
  it belongs in this list because it took a job off the gateway and then took it off the network too.
  Changing letters is a lookup table: ka is ಕ is క
  is क, and the answer does not depend on what the sentence means, so asking a language model to do
  it was slow, occasionally wrong, and cost money per verse — and then asking a hosted service to do
  it was still a second and a half of somebody's afternoon, every time, for a table lookup. Sanscript
  is MIT, ships every scheme inlined in one CommonJS file with no filesystem or WASM at runtime, and
  answers in about half a millisecond, so `netlify/lib/aksharamukha.ts` converts in the function
  itself and the member waits for nothing but the function.
  The hosted **Aksharamukha** service is still behind it, still with a plain form-encoded `fetch`, no
  SDK and no credential, for the pairs the local table declines — which is why script conversion
  works on every deployment, gateway or not, and why the file keeps its name. Its npm package was the
  obvious first choice and is unusable here: it ships Pyodide and WASM, weighs sixteen megabytes, and
  is GPL-3.0-only. A conversion is cached either way,
  on the same row the gateway's answers were, against the same digest.
  Its one trap is worth knowing before touching that file: an unrecognised script name comes back
  `200` **with the text unchanged**, so a typo is silent rather than an error, which is why every
  answer — local or remote — is checked for letters of the block that was asked for, and no script
  name in the file was
  spelled from memory.

## Platform limits that shaped the code

- A function receives at most a **6 MB request body**, so the browser slices a recording into
  ~4 MB parts, `PUT`s each one, and `upload-complete.mts` stitches them together (20 MB ceiling per
  recording).
- A function returns at most **6 MB buffered**, so `audio.mts` streams the blob and answers range
  requests with bounded `206` slices — which is also what Safari needs in order to play at all.
- The same 6 MB request ceiling is why a picture — a circle cover or a photo on a share — is drawn
  into a canvas at display width and sent as a JPEG before it leaves the browser. One request per
  picture, so adding a second one is simply another upload, and a camera format no browser can draw
  never reaches the server.

## Coding conventions

- Functions use `.mts` with the modern bare default-export handler and an exported `config` object
  for routing (`path`, `method`) rather than the legacy `netlify.toml` per-function config.
- Every listing filters with `visibleTo()` and every mutation of an existing row goes through
  `mayManageItem()` from `netlify/lib/moderation.ts`. A new content type must follow the same two
  rules, and must also carry its circles:
  read them with `circleIdsFrom()`, write them with `setItemCircles()` / `applyItemCircles()`, clear
  them with `clearItemCircles()` on delete, and decorate its listing with `withCircleIds()` — which
  also carries the per-circle filing, resolved from the name the form sent by
  `resolveSubcategory()` and from the category `filedCategoryIdFrom()` read off the body. Photos work the same way and are just as compulsory to wire up: attach
  them with `setItemPhotos()` on create and `applyItemPhotos()` on edit, clear them with
  `clearItemPhotos()` on delete, and decorate the listing with `withPhotos()`.
- Every route that stores text a member wrote passes it through `unsafeText(...)` from
  `netlify/lib/safety.ts` first, and returns the refusal it answers. An edit is checked as well as
  a create, since the words can be changed afterwards, and a recording is checked before its parts
  are stitched, so a refused share never becomes a blob. The one deliberate exception is
  `reports.mts`: a reporter has to be able to quote the thing they are reporting.
- Photos are optional everywhere and never required by a form. A create that names none has none, a
  PATCH that says nothing about `photos` keeps the ones already there, and a PATCH that names them
  replaces the set — which is how removing one works. A member may only attach a key they uploaded
  themselves, and never one already on another item, so no share can borrow or blank another's
  pictures. Dropping a photo deletes its blob as well as its row; the row is the record, and a blob
  left behind by a failed delete is only wasted bytes.
- A word is the one kind of share with no pictures at all. `words.mts` and `word.mts` neither read a
  `photos` key nor return one, and no word surface — the form, the open word, the copy in My Library,
  the feed row — draws a gallery. The delete path still calls `clearItemPhotos()`, because a word that
  took a picture before they were removed still has a row and a blob to sweep up.
- Circle reach is deliberately backwards compatible: an item with no `item_circles` rows reaches the
  whole group, exactly as everything did before circles existed. Once an item names circles, "shared"
  means those circles' members plus the author. A private item never keeps circle links.
- **A share belongs to its author and to the circles it was said in, so both may manage it.**
  `mayManageItem(itemType, itemId, authorId, access)` is the whole of the rule and every per-item
  `PATCH` and `DELETE` route is gated on it and on nothing else: the author always, and otherwise
  whoever keeps a circle the share went into — its owner, an admin they chose, or the app admin
  stepping in. A plain member is exactly where they were, able to edit and delete their own and
  nothing else. Contributions widen the same way, through `moderatesItem()` on the share they hang
  on: a discussion, a reply, an experience or a language connection may be taken back by whoever
  wrote it, by the author of the share it sits on, and by that share's circle keepers. Two things
  stay deliberately narrower, because they are not moderation: replacing a recording's audio is the
  author's alone (`song.mts` refuses it in its own words rather than the blanket "not yours"), and a
  share that names no circle has no local keeper, so only its author and the app admin answer for
  it. Letting somebody else save the form has a cost worth knowing about — a `PATCH` sends back the
  photo keys and document keys it was given, and those name their uploader, so `setItemPhotos()` and
  `valueFor()` in `fields.ts` both allow through the keys already stored on that item. A new kind of
  attached file has to do the same or a manager's edit silently blanks the author's attachment.
- **`moderatorOf()` is the whole of circle authority, and there is no second, narrower question.**
  Every mutation of a circle — its details, its privacy, its cover, its invitations, its categories,
  its subcategories, its category fields, removing a member, appointing or demoting an admin, and
  closing the circle — is gated on `moderatorOf(circleId, access)`, so a circle's owner, the admins
  they made, and the app admin standing in all have the same say. Nothing checks
  `circle.ownerId === user.id` any more, and a new circle route that does is reintroducing the split
  this replaced. Ownership survives as exactly two facts and no powers: the owner cannot be removed
  from the circle or demoted out of it, and cannot leave — deleting the circle is their way out. The
  one exception on the category side runs the other way and is now the circle's own to make: adding a
  node of the taxonomy is any member's where `circles.member_taxonomy` is on, because it happens in
  the middle of posting, and the circle's keepers' alone where it is off. `mayAddTaxonomy()` is that
  question and the only place it is asked; every other way of shaping the tree — moving, renaming,
  reordering, merging, disabling, deleting — is `moderatorOf()`'s without exception.
- Discover is the one circle that cannot be treated like the others, and the reason is that every
  account is joined to it. Its `ownerId` sentinel no longer refuses anybody now that authority is
  `moderatorOf()`, so `circle.mts` says it in the two places it matters instead: a circle that
  `is_default` cannot be deleted, and its privacy is pinned however the rest of it is edited. Both
  are refusals in the route rather than rules implied elsewhere, because closing or locking the front
  door is not something a tidy-up should be able to do by accident.
- A refusal names what was attempted. `notACircleManager(what)` in `netlify/lib/moderation.ts`
  finishes the sentence — "change it", "invite people to it", "choose its admins" — and
  `notTheManager()` in `categories.ts` is the same thing for the category routes, so a member reads
  which rule they met rather than guessing.
- A circle has three doors, and the stored values are what they have always been — only the words
  changed. `private` is **Private**, invite only; `discoverable` is **Ask to Join**, listed, and the
  owner decides; `public` is **Open to All**, listed and joined on the spot. `privacyOf()` accepts
  all three and anything else lands on private. Use the labels, not the stored names, in anything a
  member reads.
- Writing on somebody else's share is a **contribution**, never an edit, and it is always a row of
  its own rather than a column on theirs: a language connection on a word, a discussion or a reply on
  a book or a song, a like on a book, an experience or a tip on a recipe or a remedy. Any member the
  share reaches may
  add one, gated on `visibleWord()` / `visibleDiscussable()` / `visibleShare()` rather than on who
  owns the share,
  because nothing already there changes. Removing one is allowed to whoever wrote it, to the
  member whose share it sits on, to whoever keeps a circle that share went into — `moderatesItem()`,
  the same widening as the share itself — and, for a reply, to whoever started the thread.
  Everything that really is an edit of the share itself goes through `mayManageItem()`.
- **Transliteration and translation are two different jobs, and the code never blurs them.**
  Changing the letters a word is written in is deterministic and belongs to Aksharamukha; saying what
  it means is a reading and belongs to the AI Gateway. So every option a reader is offered names
  which of the two it is — `scriptFor()` in `lyrics.ts` and in `translations.ts` is the one place the
  routing is decided, an `IndicScript` meaning "convert the letters" and null meaning "ask the
  model" — and every cached row records the `engine` that wrote it so the browser can say so too. A
  new script or language is added by putting it in `LYRIC_SCRIPTS` or `POST_LANGUAGES` with the right
  `script`, and nothing else changes.
- **A mapping has to know what it maps from, so anything that cannot be looked at is asked for
  once and stored.** A script declares itself and `detectScript()` reads it; a roman convention does
  not, and `aa` in the wrong one is the wrong vowel — so `songs.lyrics_scheme` holds the author's
  answer and `exactSourceFor()` is `detectScript() ?? scheme`. Two consequences are load-bearing.
  A missing source is a *reason*, not a dead end: the browser is sent the per-song
  `lyricScriptsAvailable` rather than being left to draw four buttons and discover which work, and
  the route's `503` names which of the two problems it is so the one the author can fix says so.
  And "the words are already in that script" must be caught before the fallback, never after —
  `transliterate()` answers null for `from === to`, and a null that falls through to the gateway
  asks a model to convert a verse into the letters it is already written in, which comes back as a
  paraphrase.
- **A cached conversion is retired by anything that would make a better one possible, not only by
  the text changing.** `stillBest()` drops a row when its `source_digest` no longer matches *or*
  when it is an `ai` row for a script that can now be mapped exactly — so declaring a convention on
  an old recording quietly upgrades its Kannada, with no back-fill and no sweep. The same rule reads
  `post_translations`. Anything that widens what can be converted exactly belongs in that test.
- A lyric rendering and a post translation are the written rows, and neither is a contribution
  nor an edit: the
  words are the author's, the other script or language is a reading of them, and it belongs to the
  share rather than to
  whoever tapped the button. So `POST /api/songs/:id/lyrics/:script` is gated on `visibleSong()` and
  `POST /api/posts/:id/translations/:language` on `visiblePost()` —
  any member who can already see the share may ask to read it another way — and the answer is
  shared by everybody who asks next. `POST /api/transliterate` is the exception that proves the rule:
  it hangs on nothing, stores nothing and is gated on `admittedUser()` alone, because it converts
  what somebody is still typing.
- Counts of contributions are derived the way category counts are — `count(*)` over the rows the
  caller can see — so a discussion count, a like count and an experience count are never stored on
  the item. A like is idempotent in both directions (`setLike()` inserts with
  `onConflictDoNothing()`), so a double tap cannot double count.
- Deleting a share takes its contributions with it: `clearDiscussions()` and
  `clearItemLikes()` on a book, `clearDiscussions()` and `clearLyricScripts()` on a song,
  `clearItemExperiences()` on a recipe or a remedy, `clearTranslations()` on a post, beside the
  `clearItemCircles()` and `clearItemPhotos()` that were already there.
- An AI answer is a convenience, never a dependency, and all three are asked for by hand rather
  than generated automatically. `summarize()`, `renderLyricScript()` and `renderTranslation()`
  answer null on every failure
  path — no gateway, a refused call, an empty answer, and for the two converters an unreachable or
  unhelpful Aksharamukha as well — the caller shows nothing, and the thread, the
  song or the post itself is unaffected. A summary is cached against the reply count it was made
  from and
  only offered once a thread has `SUMMARY_MIN_REPLIES` in it, so the group is never
  charged for summarising two sentences; a rendering is cached against a digest of the lyrics it
  came from and a translation against a digest of the post's details, so the same script or language
  is never paid for twice and a stale one is never shown. Whether an answer is possible at all is
  asked per request — `lyricScriptAvailableFor()`, `translationAvailableFor()` — rather than by
  looking at the site's configuration, since half of what is on offer needs no gateway.
- The model is never asked to supply content the app did not give it. A summary uses only what the
  replies say; a lyric rendering converts only the lines the member typed, and `systemFor()` forbids
  adding, completing or drawing on any song the model recognises; a post translation says only what
  the post already says, and its own `systemFor()` forbids adding a sentence or answering a question
  the post asks. This is not a style preference:
  a model reciting a known recording's lyrics would be reproducing copyrighted words it half
  remembers. Anything a member wrote is named to the model as material to work on, never as
  instructions to follow.
- Nothing is ever transliterated on a guess about what it is. `detectScript()` answers null for
  Latin text on purpose: English prose run through a transliterator becomes fluent nonsense, and
  "We drove to Mysore" in Kannada letters is worse than nothing at all. So the reader side falls
  back to the gateway, which can tell romanised Sanskrit from English, and the author side asks the
  member which roman convention they are typing in rather than sniffing at it.
- Nothing a manager does to a category ever deletes another member's post. Hiding a category takes
  it off the circle page and keeps everything — its posts, its shelves and its form; a custom category can only be removed once hidden, and only after
  its posts are moved elsewhere or released to their authors as private items. Deleting a
  node of the taxonomy unfiles its posts and promotes its children one level, so nothing filed
  anywhere under it is lost either. Whoever wrote an affected post is notified.
- **The taxonomy is a tree, and every operation on it has to survive being asked the wrong thing.**
  A parent must be in the same category; a node may not become its own descendant; a subtree may not
  be moved somewhere that pushes it past `MAX_TAXONOMY_DEPTH`; a merge target may not be inside the
  node being merged. `reparentRefusal()` and `tooDeepFor()` in `netlify/lib/taxonomy.ts` are where
  all of that lives, and a route asks them rather than reasoning about parents itself — an adjacency
  list with no such check is one bad `PATCH` away from a cycle no read can escape. Hiding cascades at
  read time through `nodeHidden()` rather than being written down the branch, so enabling a node
  restores exactly what was under it.
- **A share may be filed at any level, and a listing has to honour that from both ends.** Filing
  writes the one node id the member chose and never the leaf below it, and reading a node lists its
  whole branch (`shelfBranchIds()` on the client, the same idea server-side), so a recipe filed on
  Vegetarian is found by somebody browsing Vegetarian and a recipe filed on Karnataka is found there
  too. A node's count is exact where it has no children and the branch's total where it does, for
  the same reason: a parent showing 0 above four filled children would be a lie about where to look.
- A filing travels as a `ShelfChoice` — the node id *and* its path text — because a share reaches
  several circles and a node belongs to one. The id settles its own circle exactly; every other
  circle's tree is walked by the path, creating the missing segments only where the member is
  allowed to and otherwise stopping at the deepest node that did match. Sending only an id would
  file the share in one circle and nowhere else; sending only a name would lose the difference
  between two nodes with the same word under different parents.
- A category's fields are deliberately *not* the split a subcategory has. A shelf is filing, so any
  member may add one mid-post; a field is the form itself, asked of everybody afterwards and
  compulsory once marked needed, so adding one is `moderatorOf()`'s — the circle's owner, an admin
  they made, or the app admin standing in — and every way of reshaping a form other members have
  already filled in — rename, retype, reorder, mark needed, switch off, delete — is the same set of
  people. So configuring a form and filling one in are two different screens: **Manage fields** is
  where the questions are decided and the share form is where they are answered, and no keeper has
  to start writing a book in order to add a question to the Books form. That split is absolute
  rather than a default — a share form carries no field-management control at all, for a keeper as
  much as for anybody else — so the doors into the manager are a category's own page and the Books
  or Songs tab header, and `src/components/CategoryFields.tsx` is the answering side only. The
  client hides those doors
  from a plain member via `canAddFields()` — the door decides for itself, which is why every caller
  is one line — and the route refuses them regardless, because a hidden control is never the check.
  Switching a field off keeps its answers and stops them being read; deleting it is
  the only path that removes an answer, and the client confirms before taking it. Which categories
  have fields at all is `categoryTakesFields()`, kept on both sides: a category the circle invented,
  plus Songs and Books, and both routes refuse the other four built-ins by name.
- **The manager shows the whole form, and the part of it that is not stored says so.** A keeper
  deciding what a category should also ask needs to see what it already asks, so the list leads with
  the built-in fields from `builtInFormFields()` — a padlock beside the name, `· Built-in` at the
  end of the line, and no ⋯ at all — before the circle's own, marked `· Custom`. Those rows are a
  description of the form's markup rather than rows in `category_fields`, which is why they carry no
  actions: there is nothing to rename, reorder, disable or delete, and inventing rules the forms do
  not have would be worse than an unavailable ⋯. Two consequences follow. `builtInFormFields()` has
  to be kept in step with `SongModal`, `BookModal` and `PostModal` by hand, since nothing can
  enforce a correspondence between a list and some JSX. And it describes what the form *collects
  about the entry* and not its frame, so "Share with", "File under", Cancel and Save are left out —
  the first two being other screens' business and the last two not being questions.
- An upload field's own rules are the field's and are enforced three times over, in that order:
  the picker's `accept` narrows what a member can choose, the browser refuses a wrong or oversized
  file before it is uploaded, and `valueFor()` on the server refuses it again whatever the browser
  did — the last of those being the check and the first two being a courtesy. All three read the
  same `fileTypes` / `maxBytes` / `multiple` off the field, and all three of those are nullable or
  defaulted to what every field written before them already meant, so nothing had to be back-filled.
  Narrowing a field afterwards retires nothing: a document already stored on a share is kept and
  still read, exactly as a dropdown's answer is when its choices are rewritten.
- Category counts are always derived — `categoryCounts()` over the rows the caller can see — never
  stored on the category. The client renders the number the server sent and never recomputes it.
- **Where a share sits is what its filing says, never what kind of thing it is.** `item_circles`
  carries the category as well as the shelf, so a song filed into Events is an Events entry — on the
  category page, in that category's count, and under that category's shelves. Three consequences are
  load-bearing. A null is the ordinary case and means "wherever this kind belongs", which is what
  every row said before the column existed, so a listing asks `categoryIn()` and falls back to the
  built-in rather than treating the absence as a category of its own. The answer is **per circle**,
  because a custom category belongs to one circle — write the chosen id on that circle's row and null
  on the others, and never assume one filing speaks for the share. And the three states of
  `filedCategoryId` on a body are all meaningful: a number files it, null unfiles it, and the key
  being absent says nothing at all, so a `PATCH` that never asked the question leaves the answer
  alone — exactly as `photoKeysFrom()` behaves.
- Nothing that reshapes a category may strand a share that only happens to be filed there. Deleting
  a custom category decides about its **posts** — moved or released — because a category is the whole
  of where a post lives; every other kind filed into it is released by `releaseFiledItems()` back to
  its own category, keeping its circles and losing only the shelf, which belonged to the category
  going away. So the `409` counts posts alone, and a move target only has to be real when there are
  posts to move.
- A circle that has switched a category off stops accepting *new* shares of that kind
  (`circlesAccepting()`), but nothing already shared is retracted, and a circle already ticked on
  an existing share stays on the list so the author can undo it.
- Custom categories belong to the circle that invented them and are never offered anywhere else,
  which is why a `posts` row reaches exactly one circle while the other six kinds may reach several.
- A listing shows what the circle in view holds. The six per-type tabs narrow their collection
  through `inCircle()` before they count, search or draw it, so a book shared into Book Club does
  not turn up while Family is on screen. One item opened by id is still looked up across everything
  the member may see, because a link is a link. My Library is the deliberate exception: what
  somebody saved is theirs and outlives the circle it came from.
- A feed row never navigates out of the circle in view to show something that has no page there.
  `entryAction()` in `src/components/EntryReader.tsx` is the single answer to what a row's button
  does — play, read in place, open a page, or nothing — and both mixed feeds ask it rather than
  deciding for themselves. A kind with no route of its own (a post in a custom category, a word) is
  read underneath its own row through `EntryDetail`; a kind whose row is already complete (a fun
  fact) gets no button. Adding a kind means adding a case, and the switch is exhaustive on purpose:
  the bug that produced this rule was a trailing `else` sending three kinds to the Learn tab.
- A member with circles is not offered "Everyone in the group" on a share form. A circle is the
  audience, so the two would read as the same choice and the wider one would be picked by accident;
  ticking a circle is how something is shared, and unticking the last one lands on private rather
  than quietly widening it. The option survives only where it is the plain truth — a member in no
  circle at all, and a share made before circles existed, whose author can still see and change what
  it does.
- The circle in view is a client-side preference and never a server concept. No route carries it, no
  request filters by it, and no API answer depends on it — `useCurrentCircle` narrows what a member
  is shown out of what the server already said they may see, so losing it costs nothing but a
  default. New surfaces that want it take it as a prop from `App.tsx` rather than reading storage
  themselves.
- A circle's own page is derived from the circle it is showing, never hardcoded, and there is no
  dashboard in front of it: Circles is the landing page, and what a member can reach in a circle is
  that circle's active categories as a grid, so switching a category off removes
  its tile and inventing one adds it, with no list to keep in step. Adding something is done from
  the category itself rather than from a second row above it, so there is one way in and only one
  place to keep right.
- Opening a circle and switching to it are one act rather than two, and the page and the header
  dropdown may never disagree about which circle is in view. That is guaranteed from both ends:
  `switchCircle()` in `App.tsx` calls `current.choose()` *before* it navigates, so the Open button on
  a card has already moved the dropdown by the time the page draws, and a route-keyed effect chooses
  the circle for every other way of arriving at `#/circles/<id>` — a link, a notification, the back
  button, a breadcrumb — gated on the member actually being in it, so previewing a public circle
  does not fake a membership. A new way of opening a circle needs neither, being covered by the
  second.
- **The main navigation preserves the scope the page is showing, and the selector changes the circle
  without changing the area.** Those are two halves of one rule, and both were bugs before they were
  rules. The Circles listing shows every circle at once, and its "All circles" was only an override
  the header wore while that page was up — nothing was written down, so tapping Members restored
  whichever circle had last been opened and produced a circle's administration screen nobody asked
  for. `goToTab()` in `App.tsx` commits the scope on the way out instead, which is why it is the
  function the tab bar calls and a bare `navigate()` is not. In the other direction, changing the
  circle used to navigate to that circle's page from wherever the member was, so answering "which
  circle?" cost them the thing they were reading; now `isCircleScoped()` in `src/router.ts` says
  which areas keep their place, and a new circle-narrowed surface belongs in that list rather than
  in a condition of its own.
- Registration is open: anybody may sign up, and the account is joined to Discover so it can read
  and post straight away. Nothing in the app refuses a member for arriving uninvited — but every
  route still reads the member through
  `admittedUser()` / `admittedAccess()` rather than `getUser()`, because those are what turn a
  paused account away and what write down a new one. A new route that calls `getUser()` directly is
  a hole; call the access helpers. `email-signin.mts` is the single deliberate exception and says so
  in its own comment: it is asked by somebody who has no session and may have no account, which is
  the whole point of it — so it is gated on a rate limit instead, and it hands back nothing but
  `{ sent: true }`.
- **Nothing about the login says whether an address has an account.** Signing in and signing up are
  one field and one tap, and `POST /api/email-signin` answers identically either way — no "no such
  member", no "that email is taken", no different latency worth reading. This is not politeness: the
  member list is the group, so an endpoint that distinguished the two would be a membership oracle
  for anybody with a word list. It follows that a check which *would* have been useful is left out on
  purpose — a suspended address is not detected here, because refusing it would answer the question;
  `access.ts` and `userLogin` refuse it after the session exists, which is where it costs nothing.
  The address itself is never stored by the throttle either — `sign_in_links` is keyed on a SHA-256 —
  since a table of every email typed into the login box is a liability and a hash answers the only
  question asked of it.
- **Registration is open; reading is not.** Somebody with no account sees the shop window and
  nothing behind it: Discover's name, its icon and the categories it holds — which is what the app
  is *for* — and not one thing any member wrote. That is enforced in the data rather than in the
  markup, and in one place: `visibleTo()` answers `false` for a null user, so every listing, every
  single-item read and every derived category count comes back empty without each route having to
  remember. The three answers that do not flow through it are gated by hand — a visitor's
  notification list is empty, `GET /api/circles/:id` gives them Discover's shell and no roll, and no
  head counts travel — and `/api/audio/:id`, whose id is a small number and therefore guessable, now
  looks the song up through `visibleTo()` before it streams a byte. A new route that hands a visitor
  anything a member wrote is the bug; hiding it in the UI instead is the worse one.
- Trust, roles and suspension are the app's own records in Postgres, never claims from
  the token. Identity answers "is this login real?" and nothing else. `app_metadata.roles` is
  written server-side and is a convenience for tooling; the answer that decides anything is
  `members.role`. Nothing ever reads a role, a trust flag or a circle admin out of `user_metadata`.
- Nobody should ever be sitting outside a circle, because `accessOf()` joins every member to
  Discover. The circle-first path is kept for the case where that join could not be made:
  `needsCircleFirst()` on the server, `needsCircle` in `AccessState`, and the `circle-first`
  gate on the client, which still leaves Circles and Profile reachable because that is where they
  are being sent. Sharing is gated by `sharingGate(user)`, so a route cannot forget it.
- Starting a circle needs a trusted account — `TRUSTED_AFTER_DAYS` on the clock and a circle already
  joined — or an app admin's vouch. Both halves are rows in Postgres, and that is deliberate: the
  rule may only test things the app itself wrote down. It once also required a confirmed email, read
  off the user the token decodes to, which never carries one — so the test was permanently false and
  every member, vouched or not, was told to confirm an address they had already confirmed. Anything
  Identity does not put in the token is not available to a rule; if it matters, record it on
  `members`. The first account in an empty group is the
  exception, because somebody has to found it. The client explains a refusal instead of hiding the
  button, but the server refuses either way: never rely on a hidden control.
- A refusal the server derives is only as fresh as the client's last copy of it. `AccessState` is
  read once at startup, so anything that changes standing — an admin's vouch, the seventh day
  passing — would otherwise leave a member looking at a stale "not yet". `store.loadAccess()` returns
  the state as well as filing it, and it is re-read on window focus, on `visibilitychange`, when
  `StandingTags` mounts, and once more immediately before "+ Start a circle" refuses, so the answer
  a member is given is the answer the server would give now.
- A circle is run by its own people. Its owner and the members they made admins answer its reports
  and everything else about it, and `moderatorOf()` is the check — never "is this a member?" and no
  longer "is this the owner?". The global app admin is a
  last resort for abuse a circle cannot settle and for technical support, so it is a small set of
  levers (vouch, suspend, hand on the role) rather than a way into everybody's content, and an admin
  cannot suspend or demote themselves, so the group is never left without one.
- Report, hide and block are three different things and must stay that way. A report asks somebody
  else to act and changes nothing on screen; a hide is one reader's own view, silent and reversible;
  a block is mutual, silent, and takes everything that member wrote out of the reader's app at once.
  None of the three deletes anybody's work — "remove" on a report drops the `item_circles` row for
  that circle, so a share taken out of its last circle becomes private to its author, exactly as if
  they had made it private themselves.
- Hides and blocks are filters applied as content is read, not flags on the content: every listing
  and every contribution read — replies, experiences, connections — filters through `hiddenKeys` and
  `blockedIds`, and the saved copy in My Library goes quiet with the original. A new listing that
  skips the filter re-exposes a blocked member, so wire it up the way circles and photos are wired
  up.
- All DB access goes through `db/index.ts` + Drizzle query builder — no raw SQL, no ad hoc
  `pg` clients.
- Column names in `db/schema.ts` are snake_case strings (`"member_id"`, `"created_at"`); the
  Drizzle field names on the JS side are camelCase (`memberId`, `createdAt`).
- Frontend fetches use same-origin `credentials` so the `nf_jwt` cookie set by
  `@netlify/identity` is sent automatically — no manual `Authorization` header handling. They also
  all go through `request()` in `src/api.ts` rather than calling `fetch` directly, which is what sets
  those credentials in one place and what retries once behind `withFreshSession()` on a `401`. A raw
  `fetch` in a new call is a call that cannot survive a token expiring mid-visit.
- Any schema change to `db/schema.ts` must be followed by
  `npx drizzle-kit generate --name <descriptive_name>` in the same change. Never hand-write SQL
  migrations while using Drizzle, and never run `drizzle-kit migrate`/`push` — Netlify applies
  migration files automatically at deploy time.
- The service worker must never cache API traffic. Anything under `/api/` or `/.netlify/` bypasses
  it, so authenticated and per-member responses are always fresh.
- **Colour is only ever a token.** `src/styles.css` opens with the whole palette as custom
  properties, and every rule below reads `var(--…)`; a literal hex or `rgb()` in a rule is a colour
  that will be missed the next time the theme moves. The warm names the app shipped with (`--ivory`,
  `--terracotta`, `--gold`, …) are still there as aliases pointing at their blue equivalents, which
  is why the retheme did not have to touch three hundred rules — a new rule should use the current
  names (`--blue`, `--surface`, `--line`, `--ink`, …) and the aliases exist only so the old ones
  keep resolving.
- **An icon is not a label.** Any control whose visible content is an icon goes through
  `IconButton` from `src/components/Icons.tsx`, which requires a `label` and writes it into both
  `aria-label` and `title`, and the icon itself is `aria-hidden`. Pass the sentence a reader needs
  ("Remove from reading list"), not the word the icon replaced. Words stay words in two places on
  purpose: a confirmation ("Delete for everyone?" and its Cancel), because a destructive choice
  should be read rather than recognised, and a dense management list of distinct actions — the
  category, subcategory and field managers, the admin levers — where a row of small glyphs would be
  a puzzle rather than a shorthand.
- **Every surface has to survive a 360px phone**, which is a handful of rules rather than a
  separate layout: an auto-fill grid uses `minmax(min(Npx, 100%), 1fr)` so it can never be wider
  than its column, a row of filter chips scrolls sideways instead of wrapping into a wall, a tap
  target is at least 44px (40px for a chip), anything a member types into is 16px on a narrow
  screen because iOS zooms the page in below that, and `overflow-wrap: break-word` on `body` keeps
  a pasted URL from widening the screen. `.page` clips horizontally with `overflow-x: clip` rather
  than `hidden`, since `hidden` would make it a scroll container and break the sticky header.
  Hover effects that move something are switched off under `@media (hover: none)`, where a phone
  leaves them stuck after a tap. Where a phone wants a different *shape* rather than a different
  size — a list of actions as a sheet from the bottom of the screen rather than as buttons on a
  card — the shape is built once and used at every width, and only the odd affordance that would
  read as duplication swaps by media query (the two ways of starting a circle, exactly one of which
  is ever on screen — and the narrow one is the default, so a rule that misses shows the small
  control rather than hiding the only one there is). A page header's two sides both carry
  `min-width: 0` and its actions `max-width: 100%`, so a wide button in it shrinks or wraps instead
  of pushing itself past the edge of the screen, where nothing can reach it. A card that is itself tappable puts its own controls behind
  `stopPropagation()`, and, being a `<li>` rather than a `<button>` so it can hold a heading, keeps
  a real button inside it for a keyboard and draws its focus ring with `:focus-within`.
- The PWA's own assets are generated, not drawn: after changing the mark or the palette, re-run
  `node scripts/generate-icons.mjs` and bump `VERSION` in `public/sw.js`. The icons, the favicon and
  the font are cached by name rather than by a hashed filename, so an installed app keeps serving
  the old ones out of its own caches until the version changes.

## Not built yet

Comments and reactions on a post in a custom category, and on a fun fact or a word — a book
has discussions and likes, a song has discussions, and a recipe and a remedy have experiences and
tips, but the other kinds
still have nothing to say back with. Also absent: the daily
vocabulary quiz, emails sent by the app itself (a group invite is a link the inviter forwards, and a
circle invitation waits for its member inside the app), and push notifications outside the app.

On discussions: a thread has no route of its own, so it opens in place wherever the share is read
and cannot
be linked to — the notification about one lands on the books or the songs tab. It is read in three
places now — the share's own page, a listing card, and a feed row inside a circle or one of its
folders — and **not** on a share link: `SharedItemScreen` is deliberately store-less, since it is
read by people with no account and every discussion action needs one, so somebody handed a link
reads the share and nothing the group said about it. A row with no questions on it says nothing at
all, which is the right shape for a list and means the only way to *start* one from a circle page
is to open the share first — a song's row opens the player rather than its page, so that is the
Songs tab or a saved copy. A prompt and a reply
can be
written and removed but not edited, replies are flat rather than threaded, and nobody is notified
when a book they shared is liked. The summary is asked for by hand rather than generated as a thread
grows, and it is one shared summary per discussion rather than one per reader. Only a book and a
song can be discussed; adding a third kind means one more entry in `DISCUSSABLE` and nothing else,
but nothing else has been added. A raga discussion is a plain thread with a suggested question — the
app does not know what a raga is, cannot list them, and nothing links two recordings in the same
one.

On lyrics: they are typed by whoever shares the recording, and there is no transcription from the
audio — the app converts the words it is given and the model is explicitly forbidden to
recall or complete a song it recognises, so a recording shared without lyrics simply has none. A
rendering is one block of text with no per-line alignment to the original and no way to read the two
side by side, it cannot be corrected by hand when a name or a proper noun comes out wrong, and
the four scripts are a fixed list rather than something a circle can extend. Which converter wrote
one is shown but not chosen: a reader cannot ask the model for a second opinion on one the mapping
table already did, nor insist on the table where the author declared no roman convention. The
convention itself is asked of the author and only the author, so a reader looking at romanised
lyrics whose author has not answered — and who may never open the app again — has no way to say
"this is Itrans" and get the exact conversion; and nothing guesses, since guessing between four
conventions is what this replaced. A member is not told that answering the question is what unlocks
three scripts for everybody else, beyond the hint under the field. Lyrics play no part in
search, and neither the words nor their renderings appear on a feed row. Editing the lyrics silently
retires every rendering made from them, which is right but unannounced: the next reader pays for the
re-render without being told why — and an old AI rendering of a script that can now be converted
exactly is retired the same silent way, so it improves without anybody being told it did. Nobody is
notified when lyrics are added to a recording they saved.

On typing in another script: the converter is a panel on two forms — a recording's lyrics and a
custom category's details — and nowhere else, so a recipe, a book note or a word must still be typed
in whatever the keyboard offers. It converts on a tap rather than as you type, there is no
transliterate-as-I-go mode, and nothing remembers which roman scheme a member used last, so Itrans
is guessed at afresh every time. The five target scripts on the form are a subset of the ten the
library knows and a fixed list either way. What it adds is plain text appended to the field: it
cannot convert a selection, replace what is already there, or convert back the other way to check
itself, and once added there is no undo beyond editing the textarea. Conversion is a table lookup in
the function itself now, so it is as fast as the request around it, but the pairs the table declines
still fall back to a hosted Aksharamukha with no key and no fallback of its own — a slow or
unreachable one there is a line of error text and the member's
Latin text is simply left where they typed it.

On a recipe's menu type and dish type: both lists are fixed in code, so a circle that wants
"Halal" or "Gluten-free" on the tick boxes cannot add one — Recipes is not in `FIELDED_BUILT_INS`,
so there is no per-circle field builder behind them either. Neither is required, so a recipe can
still say nothing about itself, and nothing back-fills the old single "Category": it is read as
whichever of the two it always meant and is only retired from a row the next time somebody saves
that recipe, so a recipe nobody edits keeps reading through the fallback indefinitely. A value in
that column that was never on the old dropdown is offered back as a dish type and kept if saved,
which is the safe reading rather than a correct one — nothing knows whether it was meant as a
dietary note. Neither field plays any part beyond display and the recipes tab's own search: the
mixed feed prints them on a row but cannot filter or group by them, so there is no way to ask for
every Sweet / Dessert in a circle, and My Library shows a saved recipe without them. Nobody is
notified when a recipe they saved is reclassified.

On experiences and tips: they carry no photos of their own, cannot be edited once written, and the
count on a card does not distinguish an experience from a tip. Nobody is notified when somebody adds
one to their recipe or remedy.

On the circle in view: it is chosen in two places that agree rather than one — the header dropdown,
and opening a circle from the listing, which is the same act. It is remembered
on the device rather than on the member, so signing in on a
phone and a laptop can leave the two showing different circles, and clearing site data resets it to
All circles, which is where a first visit starts anyway. A circle's own page carries its id in the
route and so can be linked to, but the choice
itself is not in the URL, so nothing else can say which circle to open: the tab bar's Circles entry
lands on the listing, and the per-type tabs land on whichever circle was last chosen. Those
tabs are narrowed to it, but nothing on them says which circle they are narrowed to beyond the
subtitle, and a member who follows a link to a share in another circle sees the item and not the
listing it came from. Notifications and My Library are not narrowed at all.

On Members: the consolidated roll is everybody the member shares a circle with rather than everybody
in the group, so somebody in one circle sees one circle's worth of people and there is still no way
to see the whole group — which is deliberate, a roll being about rooms somebody is actually in. It
carries no roles, no waiting room and no admin controls, because each of those names a circle; a
name that appears in three circles is one row with three chips, and moderating any of them means
narrowing to it first. Both halves read afresh on every switch rather than sharing the circle page's
copy. A member's row carries their name and their circles and nothing else — no join date on the
roll itself, no way to message somebody, and no way to see what they have shared.

On the Word Explorer: a word has no route of its own, so which one is open is state and a word cannot
be linked to. A feed row opens it in place instead, which is what a reader in a circle wanted, but a
word opened that way carries only its sections and its connections — the actions on the word's own
page (save it, mark as learned, edit it if it is yours) are not there, and there is no way to get
from the row to the page. A language connection can be added and removed
but not edited, nobody is notified when one arrives on their word, and connections play no part in
search — the query still matches word, meaning and language only. A row in "Recently Added" shows the
first connection somebody offered and no more, so a word with six of them looks like a word with one.
The language a connection is in is picked from a list with an "Other" box behind it, which is a
starting list rather than a controlled vocabulary: two members can still reach the same language by
different spellings through that box, and nothing merges them afterwards. Synonyms and antonyms are
plain text, not links to other words in the group, and there is no daily quiz. A word is read rather
than heard — the browser's own voice used to say it aloud and no longer does, and nothing has replaced
it.

On photos: they cannot be reordered or captioned once added, only removed and added again, and a
picture uploaded into a form that is then abandoned leaves a blob nothing points at — there is no
sweeper for those yet. A word takes none at all, and any word photo added while it could is now
invisible; nothing reads those rows, and they are cleared when the word itself is deleted.

On the category side: a custom category is a circle's own and there is no shared list to promote one
to, and a post cannot sit on two shelves in the same circle.
Anything shared before categories existed keeps reaching the whole group and stays unfiled — no
back-fill runs, and `ensureCategories()` only gives an older circle the six built-ins the first time
somebody looks. A post also no longer has a "when": the form stopped asking once Travelogue gave
circles a better place for a trip, the `happens_on` column and the server's tolerance for it are
still there so nothing anybody typed was lost, and what is still in it is simply not drawn anywhere.

On the taxonomy tree: it nests as far as anybody wants within one limit — `MAX_TAXONOMY_DEPTH` is
twelve, which is not "unlimited" so much as far enough that nobody meets it, and a member who does
gets a refusal rather than an explanation of why the number is what it is. A node cannot be dragged;
moving one is a dropdown of the other nodes, which reads well at twenty and less well at two
hundred, and there is no search inside the manager. Reordering is one step at a time between
siblings, so pushing a node from last to first in a long list is a lot of taps, and there is no way
to sort a level alphabetically in one go. Which nodes are expanded is component state rather than
anything remembered, so closing the manager forgets it, and a deep branch is opened again from the
top on the next visit. Browsing it is one level at a time, which is the shape the tree actually has
and costs a member three taps to reach a grandchild — there is no way to jump straight to a deep
node from the category page, no search over the nodes, and nothing that remembers where in the tree
somebody was the last time they opened the category, so every visit starts at the top. The
breadcrumb is the only way back up: the browser's own Back button works, the route carrying the
node, but nothing on the page says the trail and the history are the same walk. The search and the
sort on a node are the reader's own and live nowhere: neither is in the route, so a filtered list
cannot be linked to and walking one level away forgets both, deliberately — a query carried into
another node filters a list nobody asked a question about — and "View all" is likewise state rather
than a second page, so a landing page opened at its full length reads as recent again on the next
visit. Search over a node matches title, detail, author and kind, which is the mixed feed's rule
rather than a per-kind one, so a recipe's ingredients and a song's lyrics are not in it. A Word
Explorer category is the one page none of this reaches: its listing is `WordExplorer`, which brings
its own search and its own newest-first "Recently Added", so it has no sort and no recent-uploads
cut. Merging folds one node into another and refiles its posts, but it does not
merge the two nodes' children, so merging a parent leaves its old children under the target rather
than paired up with the target's own. Nothing warns before a delete that a node has posts filed on
it or children under it — the children are promoted and the posts unfiled, which is the safe
outcome, but the confirm does not say how many of either. A node cannot be moved between categories
or between circles, only within the one category it was made in. The whole tree is loaded with the
circle's categories rather than lazily, which is right at the sizes a circle actually reaches and
would not be at thousands of nodes. And the member-creation setting is one switch for the whole
circle: there is no "members may add under existing nodes but not at the top level", which is
probably the rule most circles would actually want.

On filing a share away from its own kind: it goes one way only. A song, recipe, fact, word, book or
remedy can be filed under a category the circle invented, and a post cannot go the other way, having
no kind of its own — the six built-ins have hand-built forms and a `posts` row would have nothing to
be shown by. The form asks the question once for the whole share rather than once per circle, so a
recording cannot be an Events entry in one circle and a Festivals entry in another even though the
column would hold it; the answer is stored per circle, so the second half of that is a form away.
The circle tick-list still hides a circle that has switched the kind off, so filing a song into
Events in a circle with no Songs category is something the server allows and the form cannot reach.
Nothing says on screen that a share was filed away from its kind: the built-in category simply stops
listing it, with no note on the row and nothing on the card, so a member wondering where their song
went has to open Events to find it. The mixed feed is unaffected either way — its topic chips are
still the kind of thing, so a song filed under Events is still a Song there — and search, the
per-type tabs and My Library know nothing about it. Nobody is notified that somebody filed a share
into their category.

On a category's own fields: a category the circle invented has them, and so do Songs and Books, so
the other four built-in kinds cannot be asked anything extra and a recipe still has exactly the
fields it was written with. Which four is a hardcoded list in two places rather than a setting —
opening Recipes up is two entries and a wrapper, not something a circle can do for itself. The
six kinds are a fixed list — there is no date, number, member picker or multi-select — an answer
carries no photo of its own, and nothing validates a text answer beyond its length. A link answer
is checked for being a web address and nothing more: nobody visits it to see whether it is still
there, no title or preview is fetched for it, and a field takes one address rather than several.
An address pasted into a Short text or Long text field is made tappable when it is read, so a
category that asked for its links before there was a Link kind still reads properly — but the
answer is stored as the text it was typed as, and nothing rewrites it. Fields play no
part in search, do not appear on a feed row, and are not counted or grouped by, so a Stotras
category cannot list its posts by deity the way it lists them by shelf. A dropdown's choices can be
rewritten by the owner, and an answer that no longer matches one is kept and still shown, so
narrowing a list retires nothing. Marking a field needed only binds new posts and edits that send
answers — a post written before the field existed is not chased for one. Nobody is notified when a
category starts asking something new, and there is no way to promote a field to another circle's
copy of the same idea. **Manage fields** is one screen for every category that has them, which is
also its limit: it is reached from a category's own page and from the Books or Songs tab header, so
a keeper looking for it anywhere else — Profile, the circle's Admin tools drawer, the circle's edit
form, or the share form it used to sit on — will not find it. Reordering is one step at a time
between
neighbours rather than a drag, so moving a field from last to first in a long form is a lot of
taps, and there is no way to sort them or to group them into sections. A field cannot be
duplicated, and there is no preview of the form a keeper is shaping: the only way to see what
members will read is to open the share form itself. Nothing records who added, renamed or removed a
question, so a form that changed shape overnight has no history to read.
The built-in rows are the honest half of that screen and the fragile one. They are a hand-kept list
describing three forms rather than anything read from them, so a question added to `SongModal`,
`BookModal` or `PostModal` and not to `builtInFormFields()` simply will not appear, and nothing
notices — there is no test and no type that ties the two together. A built-in field cannot be
renamed, reordered, marked optional, switched off or deleted, which is the current behaviour stated
rather than a limitation introduced: the forms have never offered any of that. So a circle that
does not want a book's rating asked for has no way to stop it being asked, and the padlock explains
why without offering a way round it. The custom rows sit below the built-in ones as a second block
rather than being interleaved with them, because a stored field has a `sortOrder` and a JSX one has
only its position in the markup — which also means a keeper cannot put "Composer" between the title
and the author however much the form would read better that way.

On an uploaded document: the three formats are a fixed list — a field can be narrowed to any of
PDF, Word and Excel, but a fourth format is a code change rather than something a circle can ask
for — and the ceiling is 5 MB, which is what one request can carry: there is no chunked upload the
way a recording has, so a longer PDF cannot be shared at all, and a field's own smaller ceiling can
only ever ask for less. A field may take several files now, up to `MAX_FILES_PER_FIELD`, but they
are an unordered set: they cannot be reordered, renamed or captioned, and replacing one means
removing it and adding it again. Nothing reads inside a document, so a PDF plays no part in search,
and there is no preview beyond the filename — what is stored is the name and the bytes as uploaded,
and a name is not checked for being a plausible description of what is in the file. Narrowing a
field afterwards retires nothing, which is the right outcome and an unannounced one: a Word file
already stored on a share stays readable on a field that now says PDF only, and nothing on screen
says why. A document is served on an unguessable key with no login, exactly as a photo is, which
means somebody handed the link keeps it after the share goes private — so "only members who can see
the share can open the file" is true of every route into it and not of the URL itself. And a file
uploaded into a form that is then abandoned leaves a blob nothing points at — the same gap photos
have, and the same missing sweeper. The rights note a keeper can put under an upload field is a
sentence and nothing more: nobody checks whether an uploaded book is somebody else's, and the only
recourse afterwards is the ⋮ Report menu and a keeper taking the share out of the circle.

On reading a post in another language: only a post in a custom category can be translated — the six
built-in kinds cannot, and a song's lyrics keep their own four scripts rather than sharing this
list, so Kannada script is on offer for a stotra in a category and not for the lyrics under a
recording of the same verse. The eight options are a fixed list rather than something a circle can
extend, the choice
belongs to the author rather than the reader (so a reader who wants Tamil on a post that was not
offered in Tamil cannot ask for it), and a translation cannot be corrected by hand when a name
comes out wrong. The list is also long enough now to be confusing: Kannada and Kannada script sit
next to each other and only the small note under them says which does what. Only the details are
converted, never the title, so a post opens under its
original heading, and a post typed in Latin letters gets an AI attempt at a script conversion rather
than an exact one, since there is nothing to convert from. Editing the details silently retires
every translation made from them, which is
right but unannounced: the next reader pays for the re-write without being told why. Translations
play no part in search, do not appear on a feed row, and nobody is notified when one is written.

On admission and standing: signing up is open, so there is no screening of any kind at the door and
suspending an account is the only way to take one back out. An invite is a shortcut into a
particular circle rather than a permission, and the one it came on is recorded but never re-checked,
so revoking it after somebody used it does nothing. Trust is a date and a circle rather than any
measure of what somebody actually did, an app admin's vouch is the only way to shorten the wait, and
there is no vouching by ordinary members. Netlify Identity still asks an account that signed up with
a password to confirm its email before the first log-in, which is the one wait nothing here can
skip — an account made by sign-in link skips it, `admin.createUser()` confirming as it creates, so
the two doors do not take the same number of emails to get through. The app itself no
longer asks about that confirmation, and must not: whether an address was confirmed is not in the
token a function reads, so a rule that tests it is a rule that is always false. Standing is re-read
on focus, on `visibilitychange` and before a refusal is shown, which is not a subscription: a member
sitting on Profile when an admin vouches for them still sees the old answer until something wakes
the page. Nobody is emailed by the
app when they are trusted, suspended or made an admin; it tells them the next time they open it. A
suspended member sees the paused screen, but their existing shares stay exactly where they were
rather than being pulled from the circles they reached.

On staying logged in: the session is kept on the device for thirty days when the member leaves "Keep
me logged in" ticked, and dies with the browser when they untick it — two lengths rather than a
policy, so there is nothing between them and signing out is the only way to end one early. The tick
is per device and per browser, as is the session it governs, so there is no list of where an account
is signed in and no way to sign the others out. Nothing warns that a session is
about to lapse; the thirty-first day is an ordinary login screen. A `401` is retried exactly once,
so a genuinely expired refresh token surfaces as whatever error the call was making rather than as
"please log in again", and the two are told apart only by what the screen does next.

On logging in: the front door is a provider row and an email field, and the two ends of it are
uneven. **Apple is not on offer and cannot be** — Netlify Identity has no Apple provider, so the
button in the design is the one part of it that is not built, and it appears the moment Identity
ships one and not before. The email door is a **link only** — there is no one-time code to type,
which was the other half of the request: Identity exposes no OTP endpoint, and a code would mean
minting, storing and verifying credentials of our own, which is the thing Identity is here to avoid.
The link itself is Identity's *recovery* email wearing a different hat, and that shows in three
places. Its **wording still talks about resetting a password**, because the template lives in the
Netlify dashboard (Identity → Emails → Recovery) and not in this repository, so nothing here can fix
it. Its lifetime is Identity's, not ours, and nothing on screen says how long a member has to open
it. And whether arriving on one shows the app or a "choose a new password" form is decided by a
marker in `localStorage`, so a link asked for on one device and opened on another always signs the
member in — right for a sign-in, and a silently different outcome for somebody who wanted the reset.
Nothing tells a member their address is already an account, or that it has just become one, which is
deliberate; the cost is that a typo in an address is indistinguishable from success, and the link
simply never arrives. There is no resend beyond the button on the inbox screen, no "wrong email?"
path other than starting again, and the throttle is per address rather than per device, so five
attempts an hour is five for everybody trying that address. Password login, signup, forgot and reset
all still work and are all one link down from the front door, which means the only way to *acquire* a
password is to have chosen one at signup or to go through "Forgot password?" — and signup, being the
one place a display name is asked for, is now a link most members will never tap, so an account made
by link is named after the local part of its address until nothing changes it, because nothing does.

On changing the login: the email and the password are the whole of what Profile can change — a
member's display name is still whatever they typed at signup and nothing edits it, and there is no
avatar. Changing the address logs nobody out anywhere: other devices keep working on their existing
tokens, and there is no "sign out everywhere" to go with the change. A member returning from the
confirmation link lands wherever the link opened with no message about what just happened — the
profile card shows the new address and stops saying one is pending, which is the only
acknowledgement. Nothing is emailed to the *old* address to say it was moved, which is what most
apps do, and the app's own contact directory picks the new one up on the next load rather than at
the moment of the change.

On moderation: reports are a queue, not a conversation — a reporter is never told what was decided,
and a moderator cannot ask them what they meant. "Take it out of the circle" removes a share from
the one circle the report came from rather than from all of them, so the same post reported in two
circles is two decisions. There is no appeal, no history beyond the settled row, no rate limit on
reporting, and nothing that notices the same member being reported repeatedly. A circle admin now
has the owner's whole reach — reports, requests, removals, the circle's details and privacy,
invitations, categories, fields, the admin role itself, closing the circle, and now editing or
deleting anything anybody shared into it — which is deliberate and has no undo attached: an admin can
delete a circle, or demote every other admin including the one who promoted them, and nothing warns
anybody first or records who did it beyond the closure notification. That last reach is the least
accountable of them: a keeper's edit is indistinguishable from the author's own afterwards, nothing
records that somebody else changed it, and the author is not told — they simply find their share
different, or gone. The confirm names whose work it is, which is the whole of the safety net, and it
is a courtesy on the reader's screen rather than anything the server keeps. A keeper cannot replace a
recording's audio, which is the one part of an edit held back to its author, and a share that names
no circle has no keeper at all — so what reaches the whole group is still its author's alone. There is no middle rank between reading a circle and running it, and no way to hand
ownership itself to somebody else, so an owner who wants out either stays nominally the owner or
deletes the circle. Nobody's role can be changed in Discover's favour either — it has no owner and
the app admin looks after it.

On the app admin's circle roll: it lists and deletes, and does nothing in between. A circle cannot
be renamed, re-iconed, handed to a new owner or have its privacy changed from there, so a circle
whose owner has left is either kept exactly as it is or deleted outright. Merging is not offered as
a general operation either — `mergeCircleInto()` exists and is what the duplicate-Discover repair
is built from, but the only button on it is that one repair, which appears solely when a second
default circle actually exists. There is no undo for a deletion and no export beforehand; the
confirm is the whole of the safety net. The roll is a snapshot read when the panel opens rather
than something that follows the group, and it counts members and shares without saying who or
what, so deciding whether a circle is really dead means opening it.

On hides and blocks: both are the reader's own and neither is on a per-circle basis, so blocking
somebody quiets them everywhere the two share a circle. A block hides what the other member wrote
but does not stop either of them from being in the same circle, from seeing the other's name on a
circle's roll, or from being counted in its head count. Hidden posts are undone from Profile only —
there is no "show it again" on the row where the post used to be — and a member whose name changes
keeps the name that was stored when they were blocked. A block is undone by whoever placed it, from
their own Profile, or by the app admin from the member roll; the member on the receiving end still
has no way to see that one exists, because telling them would undo the silence that is the point of
it, so somebody who has quietly disappeared from half the group has to ask an admin to look. Lifting
one tells the blocker and nobody else, and there is nothing that notices a block placed by accident
or one that has sat there for a year.

On the look of it: the palette is one theme rather than a choice — there is no light/dark switch and
nothing reads `prefers-color-scheme`, so a member on a dark phone gets the same light blue surfaces
everybody else does. The icon set is hand-drawn inline SVG and deliberately small, which means a
control that wants a glyph nobody has drawn yet is still a worded button; the four that exist (edit,
delete, play/stop, save) are the ones on every listing. Icons carry no visible text beside them
anywhere, so what each one does is learned from its tooltip or from tapping it — there is no legend,
and the management lists that stayed worded are the deliberate other half of that trade. On a phone
the layout adapts by CSS alone: nothing is conditionally rendered by width, so a narrow screen gets
the same markup and the same amount of it, and the long forms are long. There is no landscape-specific
treatment, no tablet breakpoint between phone and desktop, and no way to verify any of it in this
repository — there is no visual regression test and no browser in the build container, so a layout
change is read rather than seen.

On the circle cards and their sheet: the sheet is a phone's shape used at every width, so a wide
screen gets a panel at the bottom of the window rather than a dropdown beside the ⋯ it came from.
It cannot be dragged — the grab handle is decoration, there is no swipe-to-dismiss and no
half-height detent — and it opens on the ⋯ alone, a long press on the card doing nothing. Its rows
are a fixed list: there is nothing on it that the circle page did not already offer, so handing a
circle to somebody else is still not possible from there either, and two of the rows are a hint
rather than the panel itself — Invite people and Admin tools navigate into the circle and open the
panel when its own read lands, which means they cost a page load and a moment of nothing happening
on a slow connection, and they silently do nothing at all if the server comes back saying this
member is not a keeper after all. The card is tappable everywhere except the ⋯, which is right for
a thumb and means a mis-press opens a circle rather than doing nothing; there is no undo beyond
going back. Only the member's own circles read this way — an invitation and a circle on offer still
carry worded buttons, because Join, Have a look first and Not now are choices rather than actions
on something the member already has.
