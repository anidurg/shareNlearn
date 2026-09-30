import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { formatBytes } from "../api";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * pdf.js, loaded the first time somebody opens a PDF rather than with the app.
 * The legacy build carries its own polyfills, so the iPhones and older Androids
 * this group reads on get the same pages a desktop does.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
/** Pages sit this far apart, and this far in from the sides at fit-width. */
const PAGE_GAP = 12;
/**
 * iOS refuses to draw a canvas over roughly 16 million pixels, and a phone runs
 * out of canvas memory long before a dozen of them — so a page is drawn at the
 * device's sharpness only up to this, and softer beyond it while zoomed right in.
 */
const MAX_CANVAS_PIXELS = 8_000_000;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/**
 * A PDF read inside Share & Learn rather than instead of it. The pages are drawn
 * by the app itself with pdf.js, one canvas per page, so what is on screen is the
 * whole document under the app's own bar — not the browser's embedded viewer,
 * which on a phone showed a cover preview with a "View" button of its own that
 * left the app for the raw file with nothing to come back with.
 *
 * It opens over the page it was tapped on: the item, its circle and its folder
 * stay exactly where they were underneath, and Back simply takes the overlay
 * away. It is state rather than a route for that reason; a route would have
 * redrawn the page behind it.
 *
 * The device's Back button closes it too: opening pushes one history entry with
 * the same URL (so no `hashchange`, and the router does not move), and a
 * `popstate` is the close. Closing from the button steps back over that entry
 * so the history is left as it was found.
 *
 * Zooming is the viewer's own — a pinch, or the − / + buttons — because a pinch
 * the browser handled would scale the Back bar off the screen with the page.
 * Opening the file outside the app is offered in the bar as a secondary way out,
 * and as the main one only when the document could not be drawn here at all.
 */
export function DocumentViewer({
  url,
  name,
  size,
  onClose,
}: {
  url: string;
  name: string;
  size?: number;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const backRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState(1.414);
  const [fitWidth, setFitWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** Where a zoom was centred, so the same spot is still under it afterwards. */
  const anchorRef = useRef<{ x: number; y: number; ratio: number } | null>(null);

  useEffect(() => {
    let pushed = false;
    let popped = false;
    // Deferred a tick so React's development double-mount does not push and pop
    // an entry of its own.
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...(window.history.state ?? {}), documentViewer: true }, "");
      pushed = true;
    }, 0);
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    backRef.current?.focus();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (pushed && !popped && window.history.state?.documentViewer) window.history.back();
    };
  }, []);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setFailed(false);
    loadPdfjs()
      .then(async (pdfjs) => {
        const task = pdfjs.getDocument({ url, withCredentials: false });
        const pdf = await task.promise;
        loaded = pdf;
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        const first = await pdf.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(viewport.height / viewport.width);
        setDoc(pdf);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [url]);

  // The width a page fills at 100%: the screen, less a margin, and never wider
  // than a comfortable reading column on a desktop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setFitWidth(Math.max(200, Math.min(el.clientWidth - PAGE_GAP * 2, 900)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [failed]);

  // After a zoom, put the spot it was centred on back under the fingers.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const el = scrollRef.current;
    if (!anchor || !el) return;
    anchorRef.current = null;
    el.scrollLeft = (el.scrollLeft + anchor.x) * anchor.ratio - anchor.x;
    el.scrollTop = (el.scrollTop + anchor.y) * anchor.ratio - anchor.y;
  }, [zoom]);

  function zoomTo(next: number, focus?: { x: number; y: number }) {
    const el = scrollRef.current;
    const target = clampZoom(next);
    const current = zoomRef.current;
    if (!el || Math.abs(target - current) < 0.001) return;
    const x = focus?.x ?? el.clientWidth / 2;
    const y = focus?.y ?? el.clientHeight / 2;
    anchorRef.current = { x, y, ratio: target / current };
    setZoom(target);
  }

  // Pinch to zoom. While the fingers move the pages are scaled with a transform,
  // which costs nothing; when they lift, the pages are redrawn sharp at the new
  // size and the scroll is moved so the pinched spot stays where it was.
  useEffect(() => {
    const el = scrollRef.current;
    const pages = pagesRef.current;
    if (!el || !pages) return;
    let start: { distance: number; x: number; y: number } | null = null;
    let scale = 1;
    const distanceOf = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const rect = el.getBoundingClientRect();
      const x = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      const y = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
      start = { distance: distanceOf(event.touches), x, y };
      scale = 1;
      const originX = el.scrollLeft + x - pages.offsetLeft;
      const originY = el.scrollTop + y - pages.offsetTop;
      pages.style.transformOrigin = `${originX}px ${originY}px`;
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return;
      event.preventDefault();
      const raw = distanceOf(event.touches) / start.distance;
      scale = clampZoom(zoomRef.current * raw) / zoomRef.current;
      pages.style.transform = `scale(${scale})`;
    };
    const onEnd = (event: TouchEvent) => {
      if (!start || event.touches.length >= 2) return;
      const focus = { x: start.x, y: start.y };
      start = null;
      pages.style.transform = "";
      pages.style.transformOrigin = "";
      if (Math.abs(scale - 1) > 0.02) zoomTo(zoomRef.current * scale, focus);
    };
    // Desktop: ctrl + wheel (and a trackpad pinch, which browsers report as one).
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(zoomRef.current * Math.exp(-event.deltaY / 200), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    // Safari's own pinch, which would otherwise scale the whole screen.
    const onGesture = (event: Event) => event.preventDefault();
    el.addEventListener("gesturestart", onGesture);
    el.addEventListener("gesturechange", onGesture);
    return () => {
      el.removeEventListener("gesturestart", onGesture);
      el.removeEventListener("gesturechange", onGesture);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [doc]);

  const pageWidth = Math.round(fitWidth * zoom);
  const pageCount = doc?.numPages ?? 0;

  return createPortal(
    <div className="doc-viewer" role="dialog" aria-modal="true" aria-label={name}>
      <header className="doc-viewer-bar">
        <button ref={backRef} type="button" className="btn btn-ghost doc-viewer-back" onClick={onClose}>
          ← Back
        </button>
        <span className="doc-viewer-title" title={name}>
          {name}
          {pageCount > 0 && (
            <span className="doc-viewer-meta">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
            </span>
          )}
        </span>
        <a
          className="doc-viewer-open"
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open externally"
          title="Open externally"
        >
          ↗
        </a>
      </header>
      {failed ? (
        <div className="doc-viewer-fallback">
          <p className="doc-viewer-fallback-kind">PDF</p>
          <p className="doc-viewer-fallback-name">{name}</p>
          {size ? <p className="muted">{formatBytes(size)}</p> : null}
          <p className="muted">
            This PDF could not be shown here. You can open it in your device's own viewer
            instead — when you are done, come back and tap Back to return to where you were.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            ← Back
          </button>
          <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
            Open externally
          </a>
        </div>
      ) : (
        <>
          <div className="doc-viewer-scroll" ref={scrollRef}>
            <div
              className="doc-viewer-pages"
              ref={pagesRef}
              style={{ width: pageWidth ? pageWidth + PAGE_GAP * 2 : undefined }}
            >
              {!doc && <p className="doc-viewer-loading muted">Loading PDF…</p>}
              {doc &&
                pageWidth > 0 &&
                Array.from({ length: pageCount }, (_, index) => (
                  <PdfPage
                    key={index}
                    doc={doc}
                    pageNumber={index + 1}
                    width={pageWidth}
                    defaultAspect={aspect}
                    root={scrollRef}
                  />
                ))}
            </div>
          </div>
          {doc && (
            <div className="doc-viewer-zoom" role="group" aria-label="Zoom">
              <button
                type="button"
                onClick={() => zoomTo(zoom / 1.25)}
                disabled={zoom <= MIN_ZOOM + 0.001}
                aria-label="Zoom out"
              >
                −
              </button>
              <button type="button" onClick={() => zoomTo(1)} aria-label="Fit to width">
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => zoomTo(zoom * 1.25)}
                disabled={zoom >= MAX_ZOOM - 0.001}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * One page. It is drawn only while it is on screen or close to it and its canvas
 * is emptied once it is far away, so a hundred-page book costs a phone a few
 * canvases rather than a hundred.
 */
function PdfPage({
  doc,
  pageNumber,
  width,
  defaultAspect,
  root,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  defaultAspect: number;
  root: RefObject<HTMLDivElement>;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting);
      },
      { root: root.current, rootMargin: "1200px 0px" },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      // Hand the memory back; the page is redrawn if it comes near again.
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let cancelled = false;
    let task: RenderTask | null = null;
    // Wait for a zoom to settle before redrawing at the new size.
    const timer = window.setTimeout(async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
        const cssScale = width / base.width;
        const cssHeight = base.height * cssScale;
        let ratio = Math.min(window.devicePixelRatio || 1, 3);
        const pixels = width * cssHeight * ratio * ratio;
        if (pixels > MAX_CANVAS_PIXELS) ratio *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = page.getViewport({ scale: cssScale * ratio });
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        const context = offscreen.getContext("2d");
        if (!context) return;
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
        if (cancelled) return;
        // Swapped in whole, so a redraw at a new zoom never flashes blank.
        canvas.width = offscreen.width;
        canvas.height = offscreen.height;
        canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
        offscreen.width = 0;
        offscreen.height = 0;
      } catch {
        // A cancelled render rejects; a page that will not draw stays blank
        // rather than taking the rest of the document with it.
      }
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      task?.cancel();
    };
  }, [doc, pageNumber, width, near]);

  const height = Math.round(width * (aspect ?? defaultAspect));
  return (
    <div
      ref={holderRef}
      className="doc-viewer-page"
      style={{ width, height }}
      aria-label={`Page ${pageNumber}`}
      role="img"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
