import { useState } from "react";
import { useInstall } from "../pwa";
import { Modal } from "./shared";

const DISMISSED_KEY = "share-and-learn:install-banner-dismissed";

/**
 * Installing is offered rather than pushed: Chrome and Edge get the real prompt,
 * iOS gets the Add to Home Screen steps because Safari has no prompt to call, and
 * anywhere the app is already installed the whole thing disappears.
 */
export function InstallButton({
  label = "Install the app",
  className = "btn btn-ghost",
}: {
  label?: string;
  className?: string;
}) {
  const { state, install } = useInstall();
  const [showSteps, setShowSteps] = useState(false);

  if (state === "installed" || state === "unavailable") return null;

  return (
    <>
      <button
        className={className}
        onClick={() => (state === "prompt" ? install() : setShowSteps(true))}
      >
        {label}
      </button>
      {showSteps && <IosInstallSteps onClose={() => setShowSteps(false)} />}
    </>
  );
}

function IosInstallSteps({ onClose }: { onClose: () => void }) {  return (
    <Modal eyebrow="Keep it on your phone" title="Add Share &amp; Learn to your Home Screen" onClose={onClose}>
      <ol className="install-steps">
        <li>
          Tap the <strong>Share</strong> button at the bottom of Safari — the square with an arrow
          pointing up.
        </li>
        <li>
          Scroll down and choose <strong>Add to Home Screen</strong>.
        </li>
        <li>
          Tap <strong>Add</strong>. Share &amp; Learn now opens like any other app, full screen and
          without the address bar.
        </li>
      </ol>
      <p className="card-meta">
        You stay logged in, and everything the group shares is there the next time you open it.
      </p>
      <button className="btn btn-primary" onClick={onClose}>
        Got it
      </button>
    </Modal>
  );
}

/**
 * A one-time nudge along the bottom of the screen. Dismissing it is remembered,
 * because a banner that keeps coming back is worse than no banner.
 */export function InstallBanner() {
  const { state, install } = useInstall();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "yes",
  );
  const [showSteps, setShowSteps] = useState(false);

  if (dismissed || state === "installed" || state === "unavailable") return null;

  function close() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "yes");
  }

  async function keepIt() {
    if (state === "prompt") {
      const accepted = await install();
      if (accepted) close();
      return;
    }
    setShowSteps(true);
  }

  return (
    <>
      <div className="install-banner" role="complementary">
        <span className="install-banner-glyph" aria-hidden="true">
          ⬇
        </span>
        <div className="install-banner-copy">
          <p className="install-banner-title">Keep Share &amp; Learn on your phone</p>
          <p className="install-banner-text">
            Install it once and it opens like an app — full screen, one tap from your Home Screen.
          </p>
        </div>
        <div className="install-banner-actions">
          <button className="btn btn-primary" onClick={keepIt}>
            {state === "prompt" ? "Install" : "How to add"}
          </button>
          <button className="btn-text" onClick={close}>
            Not now
          </button>
        </div>
      </div>
      {showSteps && (
        <IosInstallSteps
          onClose={() => {
            setShowSteps(false);
            close();
          }}
        />
      )}
    </>
  );
}

/**
 * The Profile tab's version: always says something, including "already installed",
 * so the section never renders as an empty heading.
 */
export function InstallCard() {
  const { state } = useInstall();

  if (state === "installed") {
    return (
      <p className="card-meta">
        Share &amp; Learn is installed on this device — it opens full screen, straight from your Home
        Screen.
      </p>
    );
  }

  return (
    <>
      <p className="card-meta">
        {state === "ios-instructions"
          ? "On iPhone and iPad, add it from Safari's Share menu and it behaves like any other app."
          : state === "prompt"
            ? "Install it and it opens full screen from your Home Screen, no address bar."
            : "Open this page on your phone to add Share & Learn to the Home Screen."}
      </p>
      <InstallButton />
    </>
  );
}
