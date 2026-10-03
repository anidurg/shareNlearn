// src/components/AboutPage.tsx
// Why the app exists, in the fewest words that say it.
//
// The wording lives in `src/content/about.json` and nowhere else: change it
// there, deploy, and this page says the new thing. That file holds prose only;
// this component decides where each piece goes — which sentence is the hero,
// which is the highlighted quote, which list becomes the flow and which the
// cards — along with the back link, the accessibility label and the card marks,
// which are the page's own furniture rather than anything worth rewording. The
// JSON is imported, so it is bundled at build time and never fetched.
//
// It is deliberately not documentation. Nothing here explains how to add a
// recipe or what a taxonomy node is — a member who wants that opens the thing
// itself, and every screen already says what it is for. What no screen says is
// the *reason*, so the page leads with it: the main message first, set large,
// and everything after it short enough to read on a phone in a minute.
//
// The order is the argument. The opening is the one sentence somebody might
// quote: it does not replace the chat, it keeps what would otherwise be lost
// in it. Then the idea in five words, then why, then how, then who it is for —
// and the page closes on the fuller statement of what the app is and is not,
// highlighted the same way. Everything under "How it works" describes
// something the app does today; a page about the app that promises features it
// does not have is worse than a shorter page.
//
// It is reachable from the footer and from nowhere else, on purpose. A page read
// once or twice in the life of an account does not earn a tab, a header button
// or a card on Profile; it earns a quiet line at the bottom of every screen,
// where anybody looking for it will look and nobody else has to step over it.
import type { ReactNode } from "react";
import about from "../content/about.json";
import type { TabName } from "../router";

/**
 * The marks beside the "How it works" cards, in the order the cards appear in
 * `about.json`. They are the app's own — 👥 is the Circles tab and the rest are
 * the category icons from `BUILT_IN_CATEGORIES` — so the page reads as the same
 * app rather than as a brochure about it. A card beyond the end of this list
 * simply has no mark.
 */
const POINT_MARKS = ["👥", "🗂", "🎵", "💬", "🔖"];

/**
 * The headline with its one stressed word set in `<em>`. The JSON names the
 * word rather than carrying markup; if it is missing or no longer appears in
 * the headline, the headline is shown plain rather than broken.
 */
function headline(text: string, emphasis: string | undefined): ReactNode {
  const at = emphasis ? text.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <em>{emphasis}</em>
      {text.slice(at + emphasis.length)}
    </>
  );
}

/** A section's paragraphs, each set as a lede. */
function Paragraphs({ items }: { items: string[] }) {
  return (
    <>
      {items.map((text) => (
        <p key={text} className="about-lede">
          {text}
        </p>
      ))}
    </>
  );
}

/**
 * The About page.
 *
 * `onNavigate` is the way out rather than a breadcrumb: this page is opened from
 * the bottom of whatever the reader was on, and it hangs under no circle, so
 * there is nothing above it to climb to. It lands on Circles, which is the app's
 * own front page — the same place the mark in the corner goes.
 */
export function AboutPage({ onNavigate }: { onNavigate: (tab: TabName) => void }) {
  return (
    <section className="about">
      <button className="btn-text back-link" onClick={() => onNavigate("circles")}>
        ← Back to circles
      </button>

      {/* The main message, first and largest: the sentence somebody might quote to a friend. */}
      <header className="about-intro">
        <h1 className="hero-title">{headline(about.headline, about.headlineEmphasis)}</h1>

        <blockquote className="about-quote">
          {about.keyMessage.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </blockquote>
      </header>

      <p className="about-lede">{about.problem}</p>

      <ol className="about-flow" aria-label="The idea behind Share & Learn">
        {about.flow.map((step) => (
          <li key={step.word} className="about-flow-step">
            <span className="about-flow-word">{step.word}</span>
            <span className="about-flow-line">{step.line}</span>
          </li>
        ))}
      </ol>

      <section className="about-section">
        <h2 className="about-section-title">{about.why.heading}</h2>
        <Paragraphs items={about.why.paragraphs} />
      </section>

      <section className="about-section">
        <h2 className="about-section-title">{about.howItWorks.heading}</h2>
        <ul className="about-points">
          {about.howItWorks.points.map((point, index) => (
            <li key={point.title} className="about-point">
              <span className="about-point-mark" aria-hidden="true">
                {POINT_MARKS[index] ?? ""}
              </span>
              <h3 className="about-point-title">{point.title}</h3>
              <p className="about-point-copy">{point.copy}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-section">
        <h2 className="about-section-title">{about.communities.heading}</h2>
        <Paragraphs items={about.communities.paragraphs} />
      </section>

      <section className="about-section">
        <h2 className="about-section-title">{about.faq.heading}</h2>
        <div className="about-faq">
          {about.faq.items.map((item) => (
            <details key={item.question} className="about-faq-item">
              <summary>{item.question}</summary>
              <div className="about-faq-answer">
                {item.answer.map((text) => (
                  <p key={text}>{text}</p>
                ))}
                {"points" in item && item.points && (
                  <ul>
                    {item.points.map((point) => (
                      <li key={point.title}>
                        <strong>{point.title}</strong> — {point.copy}
                      </li>
                    ))}
                  </ul>
                )}
                {"closing" in item && item.closing && (
                  <p><strong>{item.closing}</strong></p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* The closing highlight: what the app is, and what it is not. */}
      <blockquote className="about-quote about-closing">
        {about.closing.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </blockquote>
    </section>
  );
}
