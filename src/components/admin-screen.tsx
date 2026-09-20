"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import type { Statistics } from "@/lib/polls";

async function request(url: string, payload?: object) {
  const response = await fetch(
    url,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.endsWith("login"))
      window.location.assign("/admin");
    throw new Error(data.error || "Could not complete the request.");
  }
  return data;
}
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
export function AdminScreen({ authenticated }: { authenticated: boolean }) {
  return authenticated ? <Dashboard /> : <Login />;
}
function Login() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/admin/login", {
        username: form.get("username"),
        password: form.get("password"),
      });
      window.location.assign("/admin");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <header className="site-header">
        <Brand />
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          Back to poll
        </Link>
      </header>
      <main className="login-main">
        <div className="login-card">
          <div className="login-icon">
            <LockKeyhole size={23} strokeWidth={1.5} />
          </div>
          <span className="section-kicker">JUST FOR YOU</span>
          <h1>Behind the scenes.</h1>
          <p className="muted">Sign in to see the bigger picture.</p>
          <form onSubmit={login}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              placeholder="Your username"
              required
              maxLength={100}
            />
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Your password"
                required
                maxLength={512}
              />
              <button
                className="icon-button"
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full-width" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-footnote">
            <LockKeyhole size={12} />A private space for your poll
          </div>
        </div>
      </main>
      <footer className="site-footer">
        <span>Less noise. More clarity.</span>
        <span>yesnoquestions</span>
      </footer>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<Statistics | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"edit" | "new" | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [updated, setUpdated] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async (id?: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await request(
        `/api/admin/stats${id ? `?poll=${encodeURIComponent(id)}` : ""}`,
      );
      setData(result);
      setSelectedId(result.selected.id);
      setUpdated(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);
  async function save(event?: React.FormEvent, pause?: boolean) {
    event?.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/admin/poll", {
        mode: pause !== undefined ? "pause" : mode,
        question: pause !== undefined ? data.selected.question : question,
        paused: pause ?? data.selected.paused,
        pollId: data.selected.id,
        revision: data.selected.revision,
      });
      setMode(null);
      setNotice(
        pause !== undefined
          ? pause
            ? "Poll paused."
            : "Poll resumed."
          : mode === "new"
            ? "New poll published."
            : "Question updated.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await request("/api/admin/logout", {});
      window.location.assign("/admin");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  const active = data?.selected.id === data?.currentId;
  const total = data?.totals.total ?? 0;
  const yesPercent = total ? Math.round((data!.totals.yes / total) * 100) : 0;
  const noPercent = total ? 100 - yesPercent : 0;
  const maxDay = Math.max(1, ...(data?.daily.map((d) => d.yes + d.no) ?? []));
  function openEditor(value: "edit" | "new") {
    setQuestion(value === "edit" ? (data?.selected.question ?? "") : "");
    setError("");
    setMode(value);
  }
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Brand />
          <span className="admin-divider" />
          <span className="admin-caption">Dashboard</span>
          <div className="admin-header-actions">
            <Link href="/" className="back-link">
              View poll <ArrowRight size={15} />
            </Link>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={logout}
              disabled={busy}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="dashboard">
        <div className="dashboard-title">
          <div>
            <span className="section-kicker">YOUR POLL, IN NUMBERS</span>
            <h1>
              The bigger picture<span>.</span>
            </h1>
            <p className="muted">Every answer counts.</p>
          </div>
          <button
            className="secondary-button refresh-button"
            onClick={() => load(selectedId)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spinning" : ""} />
            Refresh
          </button>
        </div>
        {error && !mode && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="alert success" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {!data ? (
          <div className="empty-dashboard" role="status">
            {loading
              ? "Loading statistics…"
              : "Statistics are unavailable. Try refreshing the page."}
          </div>
        ) : (
          <>
            <section className="current-question">
              <div className="question-panel-top">
                <span className="section-kicker">
                  {active ? "CURRENT QUESTION" : "PAST POLL"}
                </span>
                <span
                  className={`status-pill ${active && !data.selected.paused ? "live" : ""}`}
                >
                  <span />
                  {!active
                    ? "Closed"
                    : data.selected.paused
                      ? "Paused"
                      : "Accepting answers"}
                </span>
              </div>
              <h2>{data.selected.question}</h2>
              <div className="question-panel-bottom">
                <span>
                  Since{" "}
                  {new Date(data.selected.created_at).toLocaleDateString(
                    "en-US",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    },
                  )}
                </span>
                <div>
                  {active && (
                    <>
                      <button
                        className="text-button"
                        onClick={() => openEditor("edit")}
                      >
                        Edit question
                      </button>
                      <span className="control-divider" />
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => save(undefined, !data.selected.paused)}
                      >
                        {data.selected.paused ? (
                          <Play size={13} />
                        ) : (
                          <Pause size={13} />
                        )}
                        {data.selected.paused ? "Resume" : "Pause"}
                      </button>
                    </>
                  )}
                  <button
                    className="new-poll-button"
                    onClick={() => openEditor("new")}
                  >
                    <Plus size={15} />
                    New poll
                  </button>
                </div>
              </div>
            </section>
            <div className="metric-grid">
              <Metric
                label="Unique visitors"
                value={number(data.totals.visitors)}
                hint="Browsers that opened the poll"
              />
              <Metric
                label="Total answers"
                value={number(total)}
                hint={`${number(data.totals.today)} today · UTC`}
              />
              <Metric
                label="Response rate"
                value={`${data.totals.visitors ? Math.round((total / data.totals.visitors) * 100) : 0}%`}
                hint="Of unique visitors"
              />
            </div>
            <div className="charts-grid">
              <section className="panel results-panel">
                <div className="panel-heading">
                  <h2>Answer breakdown</h2>
                  <span className="small-muted">All time</span>
                </div>
                <div className="result-row">
                  <div className="result-icon yes-icon">
                    <Check size={18} />
                  </div>
                  <span>Yes</span>
                  <span className="result-count">
                    {number(data.totals.yes)} answer{ending(data.totals.yes)}
                  </span>
                  <strong>
                    {yesPercent}
                    <small>%</small>
                  </strong>
                </div>
                <div className="result-track">
                  <span
                    className="yes-fill"
                    style={{ width: `${yesPercent}%` }}
                  />
                </div>
                <div className="result-row">
                  <div className="result-icon no-icon">
                    <X size={18} />
                  </div>
                  <span>No</span>
                  <span className="result-count">
                    {number(data.totals.no)} answer{ending(data.totals.no)}
                  </span>
                  <strong>
                    {noPercent}
                    <small>%</small>
                  </strong>
                </div>
                <div className="result-track">
                  <span
                    className="no-fill"
                    style={{ width: `${noPercent}%` }}
                  />
                </div>
                <p className="chart-footnote">
                  {total
                    ? "One browser. One counted answer."
                    : "The first answers will appear here."}
                </p>
              </section>
              <section className="panel activity-panel">
                <div className="panel-heading">
                  <h2>Daily answers</h2>
                  <span className="small-muted">7 days · UTC</span>
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-yes" />
                    Yes
                  </span>
                  <span>
                    <i className="legend-no" />
                    No
                  </span>
                </div>
                <div
                  className="bar-chart"
                  role="img"
                  aria-label={`Answers over the last 7 days: ${data.daily.map((d) => `${d.day}: yes ${d.yes}, no ${d.no}`).join("; ")}`}
                >
                  {data.daily.map((day) => (
                    <div className="bar-column" key={day.day}>
                      <span className="bar-value">
                        {day.yes + day.no || ""}
                      </span>
                      <div className="bar-space">
                        <div
                          className="bar-stack"
                          title={`${day.day}: yes ${day.yes}, no ${day.no}`}
                          style={{
                            height: `${Math.max(2, ((day.yes + day.no) / maxDay) * 100)}%`,
                          }}
                        >
                          <div className="bar-no" style={{ flex: day.no }} />
                          <div className="bar-yes" style={{ flex: day.yes }} />
                        </div>
                      </div>
                      <span className="bar-label">
                        {new Date(`${day.day}T12:00:00Z`)
                          .toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                          })
                          .replace(".", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="dashboard-bottom">
              <div className="uniqueness-note">
                <CircleHelp size={17} />
                <p>
                  We count unique browsers, not people.
                  <br />
                  <span>
                    Another device or deleted cookies will count as a new
                    participant.
                  </span>
                </p>
              </div>
              <label className="poll-select">
                <span>Poll history</span>
                <select
                  value={selectedId}
                  onChange={(e) => load(e.target.value)}
                  disabled={loading}
                >
                  {data.polls.map((p, i) => (
                    <option value={p.id} key={p.id}>
                      {i === 0 ? "Current: " : ""}
                      {p.question}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            <footer className="dashboard-footer">
              <span>Real answers. Less noise.</span>
              <span aria-live="polite">Updated at {updated}</span>
            </footer>
          </>
        )}
      </main>
      <dialog
        aria-labelledby="editor-title"
        ref={dialog}
        className="editor-dialog"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setMode(null);
        }}
      >
        <button
          disabled={busy}
          className="icon-button dialog-close"
          aria-label="Close"
          onClick={() => setMode(null)}
        >
          <X size={20} />
        </button>
        <span className="section-kicker">
          {mode === "new" ? "A NEW TOPIC" : "REFINE YOUR QUESTION"}
        </span>
        <h2 id="editor-title">
          {mode === "new" ? "What’s the next question?" : "Edit question"}
        </h2>
        <p className="muted">
          {mode === "new"
            ? "The current poll will close. Its answers will stay in history, and the new poll will start with fresh statistics."
            : "Existing answers will be kept. Use this to fix typos. Create a new poll for a different topic."}
        </p>
        <form onSubmit={save}>
          <label htmlFor="question">Question</label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            minLength={3}
            maxLength={180}
            rows={3}
            required
          />
          <div className="character-count">{question.length} / 180</div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setMode(null)}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={busy || question.trim().length < 3}
            >
              {busy ? "Saving…" : mode === "new" ? "Publish" : "Save"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
function ending(n: number) {
  return n === 1 ? "" : "s";
}
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <section className="metric">
      <h2>{label}</h2>
      <strong>{value}</strong>
      <p>{hint}</p>
    </section>
  );
}
