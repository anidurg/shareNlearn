import React from "react";
import ReactDOM from "react-dom/client";
import "./identity";
import "./styles.css";
import App from "./App";
import { AppCrashNote, ErrorBoundary } from "./components/ErrorBoundary";
import { captureIncomingShare } from "./incoming-share";
import { registerServiceWorker } from "./pwa";

registerServiceWorker();

/*
 * A share from the device's own share sheet arrives as a query string on `/`,
 * which is the one thing in this app that is not a hash — so it is read here,
 * before React draws, and written down. `captureIncomingShare()` strips the
 * query as it goes, so a refresh cannot share the same thing twice, and `App`
 * picks the payload up out of storage rather than out of the address bar, which
 * is what lets it survive a round trip through logging in.
 */
if (captureIncomingShare()) window.location.hash = "#/incoming";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary where="app" fallback={() => <AppCrashNote />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
