import type { TabName } from "../router";

const TABS: {
  name: TabName;
  label: string;
  short: string;
  glyph: string;
  /** Kept for an entry that only earns its place on a wide screen. */
  wideOnly?: boolean;
}[] = [
  { name: "circles", label: "Circles", short: "Circles", glyph: "👥" },
  { name: "members", label: "Members", short: "Members", glyph: "🧑‍🤝‍🧑" },
  { name: "library", label: "My Library", short: "Library", glyph: "🔖" },
];

/**
 * One component for both navigations: a row of tabs on wide screens and a fixed
 * bottom bar on phones.
 *
 * Songs, recipes, fun facts, vocabulary, books and remedies are not sections of
 * the app any more — they are categories inside a circle, and a circle is where
 * you go to find them. Circles comes first because it is the app's landing page:
 * there is no dashboard in front of it any more, and a circle's own page is what
 * Home used to be — its categories, its people, its shares. What remains beside
 * it is the people in the circle in view (Members) and your library.
 *
 * Profile is not here at all: the header carries it on every screen, so a tab
 * saying the same thing would only have asked twice.
 *
 * The last entry is not a section: it opens the invite flow, and sits apart from
 * the tabs at the end of the row. It steps aside on a phone, where inviting
 * people also lives on Profile.
 */
export function Nav({
  active,
  onNavigate,
  onInviteFriend,
}: {
  active: TabName;
  onNavigate: (tab: TabName) => void;
  onInviteFriend: () => void;
}) {
  return (
    <nav className="tab-nav" aria-label="Sections">
      {TABS.map((tab) => (
        <button
          key={tab.name}
          className={[
            "tab-link",
            tab.name === active ? "tab-link-active" : "",
            tab.wideOnly ? "tab-link-wide" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onNavigate(tab.name)}
          aria-current={tab.name === active ? "page" : undefined}
        >
          <span className="tab-glyph" aria-hidden="true">
            {tab.glyph}
          </span>
          <span className="tab-label">{tab.label}</span>
          <span className="tab-label-short">{tab.short}</span>
        </button>
      ))}
      <button className="tab-link tab-link-action tab-link-wide" onClick={onInviteFriend}>
        <span className="tab-glyph" aria-hidden="true">
          ✉
        </span>
        <span className="tab-label">Invite a friend</span>
        <span className="tab-label-short">Invite</span>
      </button>
    </nav>
  );
}
