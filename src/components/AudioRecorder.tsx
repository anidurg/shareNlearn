import { useEffect, useRef, useState } from "react";

/**
 * Recording audio in the browser, on its own so that nothing has to do it twice.
 *
 * It began inside the song form, which was the only place a member could sing
 * something into the app. Then a circle could invent an Upload field and say that
 * what it takes is audio — "Audio rendition" on a Stotras form — and that field
 * wants exactly what the song form already had: a clock, a Start, a Stop, a Record
 * again, and a preview to listen back to before saving. Building a second
 * `MediaRecorder` beside the first would have meant two answers to every awkward
 * question this file settles once (which container this browser can write, when to
 * let go of the microphone, what to do when a take runs long), so the recorder moved
 * here and the song form became its first caller rather than its owner.
 *
 * Nothing in here knows what the recording is *for*. It answers with a `Blob` and
 * how many seconds it lasted, and whoever asked decides whether that becomes a song
 * or the answer to a question a category asks.
 */

/**
 * Whether this browser can record at all. Read once at module load, the same way the
 * song form read it, because it cannot change while the page is open — and a caller
 * that does not check it would offer a Start button whose only outcome is a refusal.
 */
export const canRecordAudio =
  typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/** Stops a runaway recording well before the 20 MB per-recording ceiling. */
export const MAX_RECORDING_SECONDS = 10 * 60;

/** The containers worth asking for, best first; undefined lets the browser choose. */
function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** mm:ss, which is the whole of what a recording clock has to say. */
export function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Reads the length of a file the member picked, so a listing can show a duration.
 * A `Blob` rather than a `File` on purpose: a recording made here has no filename
 * and is measured exactly the same way.
 */
export function readAudioDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () =>
      done(Number.isFinite(probe.duration) ? Math.round(probe.duration) : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

/**
 * The sentence a member reads when the microphone will not open, with the way out
 * named where there is one. The alternative is the caller's to supply, because it
 * differs: a song form can say "upload a recording instead" and a field configured
 * for recording alone has nothing to offer but the browser's own permission prompt.
 */
function microphoneRefusal(alternative?: string) {
  return alternative
    ? `The microphone is not available. Allow microphone access, or ${alternative}.`
    : "The microphone is not available. Allow microphone access and try again.";
}

export type RecorderPhase = "idle" | "recording" | "recorded";

export type AudioRecorderState = {
  /** How long the take has run, or ran — which is its duration once stopped. */
  seconds: number;
  /** The take itself, once there is one. */
  recording: Blob | null;
  phase: RecorderPhase;
  /** A URL for listening back, revoked for the caller as it changes. */
  previewUrl: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Throws the take away and returns to "ready when you are". */
  again: () => void;
};

export function useAudioRecorder({
  onError,
  alternative,
}: {
  /** Where a refusal is shown. Called with null as a fresh attempt begins. */
  onError?: (message: string | null) => void;
  /** What else the member could do, named in the microphone refusal. */
  alternative?: string;
} = {}): AudioRecorderState {
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  function releaseMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      releaseMicrophone();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function start() {
    onError?.(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const captured = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecording(captured);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(captured);
        });
        setPhase("recorded");
        releaseMicrophone();
      };

      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          if (current + 1 >= MAX_RECORDING_SECONDS) stop();
          return current + 1;
        });
      }, 1000);
    } catch {
      onError?.(microphoneRefusal(alternative));
    }
  }

  function again() {
    setRecording(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setSeconds(0);
    setPhase("idle");
  }

  return { seconds, recording, phase, previewUrl, start, stop, again };
}

/**
 * The recorder as a member sees it: a clock that says what is happening, one button
 * that changes with the phase, and the take itself to listen back to. Drawn from the
 * hook's state and holding none of its own, so the same three-line markup serves the
 * song form and a category's audio field.
 */
export function AudioRecorder({
  recorder,
  disabled = false,
}: {
  recorder: AudioRecorderState;
  disabled?: boolean;
}) {
  const { seconds, phase, previewUrl } = recorder;
  return (
    <div className="recorder">
      <p className="recorder-clock" aria-live="polite">
        {phase === "recording" ? (
          <>
            <span className="recorder-dot" aria-hidden="true" /> Recording {formatClock(seconds)}
          </>
        ) : phase === "recorded" ? (
          `Recorded ${formatClock(seconds)}`
        ) : (
          "Ready when you are"
        )}
      </p>

      <div className="recorder-buttons">
        {phase === "idle" && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void recorder.start()}
            disabled={disabled}
          >
            Start recording
          </button>
        )}
        {phase === "recording" && (
          <button type="button" className="btn btn-ghost" onClick={recorder.stop}>
            Stop
          </button>
        )}
        {phase === "recorded" && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={recorder.again}
            disabled={disabled}
          >
            Record again
          </button>
        )}
      </div>

      {previewUrl && <audio controls src={previewUrl} className="recorder-preview" />}
    </div>
  );
}
