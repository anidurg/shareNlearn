import { useEffect, useRef, useState } from "react";
import type { Notification } from "../api";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationBellProps {
  notifications: Notification[];
}

// Remembering the newest notification the member has looked at keeps the badge
// honest across reloads instead of resetting to "all unread" on every visit.
const SEEN_KEY = "share-and-learn:last-seen-notification";

function readSeenId(): number {
  const stored = Number(localStorage.getItem(SEEN_KEY));
  return Number.isFinite(stored) ? stored : 0;
}

export function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState(readSeenId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = notifications.filter((n) => n.id > seenId).length;

  function markSeen() {
    const newest = notifications.reduce((max, n) => Math.max(max, n.id), seenId);
    setSeenId(newest);
    localStorage.setItem(SEEN_KEY, String(newest));
  }

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        className="bell-button"
        onClick={() => {
          setOpen((o) => !o);
          markSeen();
        }}
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3c-3.3 0-6 2.7-6 6v3.3c0 .7-.3 1.4-.8 1.9l-1 1c-.9.9-.3 2.5 1 2.5h13.6c1.3 0 1.9-1.6 1-2.5l-1-1c-.5-.5-.8-1.2-.8-1.9V9c0-3.3-2.7-6-6-6z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-dropdown">
          <p className="bell-heading">Recent activity</p>
          {notifications.length === 0 ? (
            <p className="bell-empty">No uploads yet — be the first to share a recording.</p>
          ) : (
            <ul className="bell-list">
              {notifications.map((n) => (
                <li key={n.id}>
                  <span
                    className={n.memberId ? "bell-dot bell-dot-you" : "bell-dot"}
                    aria-hidden="true"
                  />
                  <div>
                    {/* An addressed notification — a welcome, or word that an invite was
                        accepted — is easy to miss in a group feed, so it is labelled. */}
                    {n.memberId && <span className="tag bell-tag-you">For you</span>}
                    {n.link ? (
                      <a
                        className="bell-link"
                        href={n.link}
                        onClick={() => {
                          markSeen();
                          setOpen(false);
                        }}
                      >
                        {n.message}
                      </a>
                    ) : (
                      <p>{n.message}</p>
                    )}
                    <time>{timeAgo(n.createdAt)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
