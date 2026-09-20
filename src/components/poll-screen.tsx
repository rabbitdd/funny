"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LockKeyhole, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import type { Poll } from "@/lib/polls";

export function PollScreen() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<"yes" | "no" | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const started = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/poll", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPoll(data.poll);
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the poll.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void load();
    }
  }, [load]);
  useEffect(() => {
    if (privacy) dialog.current?.showModal();
    else dialog.current?.close();
  }, [privacy]);
  async function submit(value: "yes" | "no") {
    if (!poll || sending || resetting || answer) return;
    setSending(value);
    setError("");
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollId: poll.id,
          revision: poll.revision,
          answer: value,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your answer.");
    } finally {
      setSending(null);
    }
  }
  async function resetAnswer() {
    if (!poll || !answer || sending || resetting || poll.paused) return;
    setResetting(true);
    setError("");
    try {
      const response = await fetch("/api/vote", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId: poll.id, revision: poll.revision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAnswer(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset your answer.");
    } finally {
      setResetting(false);
    }
  }
  return (
    <div className="poll-page">
      <header className="site-header">
        <Brand />
        <span className="header-note">
          One small question. Different perspectives
        </span>
      </header>
      <main className="poll-main">
        <section className="poll-content" aria-busy={loading}>
          {loading ? (
            <div
              className="question-skeleton"
              role="status"
              aria-label="Loading question"
            >
              <span />
              <span />
            </div>
          ) : poll ? (
            <h1>{poll.question}</h1>
          ) : (
            <h1 className="unavailable-title">Just a moment.</h1>
          )}
          {!loading && poll && (
            <>
              {(answer || poll.paused) && (
                <p className="question-hint">
                  {answer
                    ? "Thank you. Your opinion counts."
                    : "This poll is paused. Check back later."}
                </p>
              )}
              <div className={`answer-buttons ${answer ? "answered" : ""}`}>
                <button
                  className={`answer-button yes ${answer === "yes" ? "chosen" : ""} ${answer === "no" ? "unchosen" : ""}`}
                  disabled={!!answer || !!sending || resetting || poll.paused}
                  onClick={() => submit("yes")}
                >
                  <Check size={24} strokeWidth={2} />
                  <span>{sending === "yes" ? "Saving…" : "Yes"}</span>
                  {answer === "yes" && (
                    <span className="your-choice">Your answer</span>
                  )}
                </button>
                <button
                  className={`answer-button no ${answer === "no" ? "chosen" : ""} ${answer === "yes" ? "unchosen" : ""}`}
                  disabled={!!answer || !!sending || resetting || poll.paused}
                  onClick={() => submit("no")}
                >
                  <X size={24} strokeWidth={1.8} />
                  <span>{sending === "no" ? "Saving…" : "No"}</span>
                  {answer === "no" && (
                    <span className="your-choice">Your answer</span>
                  )}
                </button>
              </div>
              <button
                type="button"
                className="icon-button reset-answer"
                aria-label={resetting ? "Resetting answer" : "Reset answer"}
                title="Reset answer"
                disabled={!answer || !!sending || resetting || poll.paused}
                onClick={resetAnswer}
              >
                <RotateCcw
                  size={20}
                  strokeWidth={1.7}
                  className={resetting ? "spinning" : ""}
                />
              </button>
              <div className="poll-reassurance" aria-live="polite">
                {answer ? (
                  <>
                    <span className="saved-icon">
                      <Check size={12} />
                    </span>
                    Answer saved. You’re all set.
                  </>
                ) : (
                  <>
                    <LockKeyhole size={13} />
                    Please share this with the Koreans
                  </>
                )}
              </div>
            </>
          )}
          {error && (
            <div className="poll-error" role="alert">
              <p>{error}</p>
              <button className="text-button" onClick={load}>
                <RotateCcw size={14} />
                Reload page
              </button>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <span>Sometimes one dog is enough</span>
        <div>
          <button onClick={() => setPrivacy(true)}>
            Privacy <ArrowRight size={13} />
          </button>
          <Link className="admin-link" href="/admin" aria-label="Admin sign in">
            <LockKeyhole size={15} />
          </Link>
        </div>
      </footer>
      <dialog
        aria-labelledby="privacy-title"
        className="privacy-dialog"
        ref={dialog}
        onCancel={() => setPrivacy(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPrivacy(false);
        }}
      >
        <button
          className="icon-button dialog-close"
          aria-label="Close"
          onClick={() => setPrivacy(false)}
        >
          <X size={20} />
        </button>
        <span className="section-kicker">ONLY WHAT WE NEED</span>
        <h2 id="privacy-title">
          Your opinion.
          <br />
          Without your name.
        </h2>
        <p>
          We store your answer, its timestamp, and a random browser identifier.
          The identifier is kept in a secure cookie for up to one year to
          prevent duplicate answers.
        </p>
        <p>
          We do not ask for your name, email, or phone number, and we do not
          fingerprint your device. IP addresses are not used to count
          participants.
        </p>
        <p>
          A different browser, another device, or deleted cookies will count as
          a new participant. Results represent unique browsers, not verified
          individuals.
        </p>
        <button
          className="primary-button full-width"
          onClick={() => setPrivacy(false)}
        >
          Got it <Check size={16} />
        </button>
      </dialog>
    </div>
  );
}
