// src/components/ErrorBoundary.tsx
// The floor under every screen: something to show when a render throws.
//
// This exists because of a specific failure rather than as a precaution. A shared
// link to a word arrived with `synonyms` as the raw database column instead of the
// array the screen is typed against, `synonyms.length` threw during render, and
// React — with nothing above it to catch — unmounted the whole tree and left a
// blank white page. A stranger following a link from a friend saw nothing at all,
// which is the worst outcome the app has: it says neither what went wrong nor what
// to do, and it is indistinguishable from the site being down.
//
// So the payload bug is fixed *and* the floor is here, because the next
// shape mismatch should cost a paragraph rather than the page. Two of these are
// used: one around the whole app in `main.tsx`, and one inside the shared-item
// screen around the item's own body, so a crash reading the item still leaves the
// header, the "shared by" line and the circle's own offer on screen — the parts
// that tell a recipient what happened and give them somewhere to go.

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * `fallback` is what replaces the children. It is a function of the reset so a
 * caller can offer "try again" without knowing anything about this class; a
 * caller that wants a plain note passes an element and ignores it.
 */
export class ErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: (retry: () => void) => ReactNode;
    /** Named in the console so a report says which boundary caught it. */
    where?: string;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    /* The console is the whole of the reporting: there is no error service wired
       up here, and inventing one would be a larger decision than this fix. What
       matters is that the message survives — a blank page threw this away too. */
    console.error(`[${this.props.where ?? "app"}] render failed`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback(() => this.setState({ failed: false }));
  }
}

/**
 * The whole-app fallback: a reload, because at this level nothing else is known
 * to work. A retry that re-renders the same broken tree would loop, so the button
 * reloads the page instead — which also picks up a newer build, the likeliest way
 * a member meets this at all.
 */
export function AppCrashNote() {
  return (
    <div className="page">
      <div className="empty-state">
        <p className="empty-glyph">😕</p>
        <h2>Something went wrong on this screen</h2>
        <p className="muted">
          Nothing you shared or saved has been lost. Reloading usually clears it.
        </p>
        <div className="empty-actions">
          <button className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
