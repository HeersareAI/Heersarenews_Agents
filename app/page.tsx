"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Job, JobOutput, SearchResult } from "@/lib/jobTypes";

const agentNames = [
  "Search",
  "Research",
  "Fact Check",
  "Sentiment",
  "Writer",
  "Social",
  "Poster",
  "Editor",
];

interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  activeJobs: number;
  averageEditorScore: number | null;
  recentJobs: { jobId: string; query: string; status: Job["status"]; createdAt: string }[];
}

export default function Home() {
  const [query, setQuery] = useState("AI agents and infrastructure market 2026");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setJob(null);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "Failed to start analysis");
      setLoading(false);
      return;
    }

    const data = await response.json();
    setJob({
      jobId: data.jobId,
      query: data.query,
      status: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      events: [],
    });
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {});

    const statsInterval = setInterval(() => {
      fetch("/api/stats")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(() => {});
    }, 5000);

    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return;
    }

    const interval = setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.jobId}`);
      if (!response.ok) return;
      const data = await response.json();
      setJob(data.job);
    }, 1500);

    return () => clearInterval(interval);
  }, [job?.jobId, job?.status]);

  async function cancelJob() {
    if (!job) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/jobs/${job.jobId}/cancel`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to cancel job");
      } else {
        const data = await response.json();
        setJob((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancelling(false);
    }
  }

  async function retryJob() {
    if (!job) return;
    setRetrying(true);
    try {
      const response = await fetch(`/api/jobs/${job.jobId}/retry`, { method: "POST" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to retry job");
      } else {
        const data = await response.json();
        setJob({
          jobId: data.jobId,
          query: data.query,
          status: data.status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [],
          parentJobId: data.parentJobId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry job");
    } finally {
      setRetrying(false);
    }
  }

  const status = job
    ? job.status.charAt(0).toUpperCase() + job.status.slice(1)
    : "Ready";

  const completedStagesFromEvents = new Set(
    job?.events
      .filter((e) => e.type === "stage_complete")
      .map((e) => {
        const payload = (e.payload as { stage?: string }) ?? {};
        return payload.stage;
      }) ?? []
  );

  function getSearchResults() {
    const raw = job?.output?.search;
    return Array.isArray(raw) ? raw : raw?.results ?? [];
  }

  function isStageComplete(stageKey: string): boolean {
    if (completedStagesFromEvents.has(stageKey)) return true;
    const output = job?.output ?? {};
    switch (stageKey) {
      case "search":
        return getSearchResults().length > 0;
      case "research":
        return typeof output.research?.context === "string";
      case "factcheck":
        return typeof output.factCheck?.confidence === "number";
      case "sentiment":
        return typeof output.sentiment?.overall === "string";
      case "writer":
        return typeof output.briefing?.headline === "string";
      case "social":
        return typeof output.social?.x === "string";
      case "poster":
        return typeof output.poster?.title === "string";
      case "editor":
        return typeof output.editor?.score === "number";
      default:
        return false;
    }
  }

  const activeIndex =
    job?.status === "completed"
      ? -1
      : agentNames.findIndex((name) => {
          const lower = name.toLowerCase().replace(/\s/g, "");
          if (job?.status === "queued") return false;
          return !isStageComplete(lower);
        });

  const completedCount = agentNames.filter((name) =>
    isStageComplete(name.toLowerCase().replace(/\s/g, ""))
  ).length;

  const progress =
    agentNames.length > 0
      ? Math.round((completedCount / agentNames.length) * 100)
      : 0;

  const output: JobOutput | undefined = job?.output;

  return (
    <main>
      <aside>
        <div className="brand">
          HEERSARE<span>NEWS</span>
        </div>
        <nav>
          <a className="selected">Dashboard</a>
          <Link href="/jobs">Jobs</Link>
          <Link href="/sources">Sources</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <div className="profile">
          AI MULTI AGENT
          <br />
          <small>News analysis workspace</small>
        </div>
      </aside>
      <section className="content">
        <header>
          <div>
            <p className="eyebrow">INTELLIGENCE WORKSPACE</p>
            <h1>News Analysis</h1>
            <p>Evidence-first reporting powered by specialized AI agents.</p>
          </div>
          <span className="live">● LIVE</span>
        </header>

        <form onSubmit={run}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="News topic"
            disabled={loading}
          />
          <button disabled={loading || query.trim().length < 5}>
            {loading ? "Starting..." : "Run analysis"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        {job && (
          <div className="actions">
            {(job.status === "running" || job.status === "queued" || job.status === "cancel_requested") && (
              <button
                className="secondary danger"
                onClick={cancelJob}
                disabled={cancelling || job.status === "cancel_requested"}
              >
                {cancelling || job.status === "cancel_requested"
                  ? "Cancelling..."
                  : "Cancel job"}
              </button>
            )}
            {(job.status === "failed" || job.status === "cancelled") && (
              <button className="secondary" onClick={retryJob} disabled={retrying}>
                {retrying ? "Retrying..." : "Retry job"}
              </button>
            )}
          </div>
        )}

        <div className="stats">
          <Stat value={stats ? String(stats.totalJobs) : "-"} label="Total jobs" />
          <Stat value={stats ? String(stats.completedJobs) : "-"} label="Completed" />
          <Stat value={stats ? String(stats.activeJobs) : "-"} label="Active" />
          <Stat
            value={stats?.averageEditorScore != null ? `${stats.averageEditorScore}%` : "-"}
            label="Avg editor score"
          />
        </div>

        {job && (
          <div className="grid">
            <article className="panel wide">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">ACTIVE WORKFLOW</p>
                  <h2>{job.query}</h2>
                </div>
                <span className="badge">{status}</span>
              </div>
              <div className="agents">
                {agentNames.map((name, i) => {
                  const lower = name.toLowerCase().replace(/\s/g, "");
                  const isComplete = isStageComplete(lower);
                  const isActive = i === activeIndex && !isComplete;
                  const state: "complete" | "active" | "queued" = isComplete
                    ? "complete"
                    : isActive
                    ? "active"
                    : "queued";
                  return (
                    <div className="agent" key={name}>
                      <span className={state}>
                        {state === "complete" ? "✓" : i + 1}
                      </span>
                      <b>{name}</b>
                      <small>{state}</small>
                    </div>
                  );
                })}
              </div>
              <div className="progress">
                <i style={{ width: `${progress}%` }} />
              </div>
              <p className="muted">
                {completedCount} of {agentNames.length} agents complete
                {activeIndex >= 0 && activeIndex < agentNames.length
                  ? ` · ${agentNames[activeIndex]} is running`
                  : ""}
              </p>
            </article>

            <article className="panel">
              <p className="eyebrow">FACT CHECK</p>
              {output?.factCheck ? (
                <>
                  <h2>
                    {output.factCheck.pass ? "Passed" : "Flagged"}{" "}
                    <span className={output.factCheck.pass ? "good" : "bad"}>
                      {Math.round(output.factCheck.confidence * 100)}%
                    </span>
                  </h2>
                  <p className="muted">
                    {output.factCheck.warnings.length
                      ? output.factCheck.warnings.join(" ")
                      : "No warnings"}
                  </p>
                </>
              ) : (
                <p className="muted">Waiting for fact check...</p>
              )}
            </article>

            <article className="panel">
              <p className="eyebrow">SENTIMENT</p>
              {output?.sentiment ? (
                <>
                  <h2>{output.sentiment.overall}</h2>
                  <div className="bar">
                    <i style={{ width: `${output.sentiment.positive * 100}%` }} />
                    <i style={{ width: `${output.sentiment.neutral * 100}%` }} />
                    <i style={{ width: `${output.sentiment.negative * 100}%` }} />
                  </div>
                  <p className="muted">
                    Positive {Math.round(output.sentiment.positive * 100)}% · Neutral{" "}
                    {Math.round(output.sentiment.neutral * 100)}% · Negative{" "}
                    {Math.round(output.sentiment.negative * 100)}%
                  </p>
                </>
              ) : (
                <p className="muted">Waiting for sentiment...</p>
              )}
            </article>

            <article className="panel wide">
              <p className="eyebrow">AI NEWS BRIEFING</p>
              {output?.briefing ? (
                <>
                  <h2>{output.briefing.headline}</h2>
                  <p>{output.briefing.summary}</p>
                  <button className="secondary">Open briefing</button>
                </>
              ) : (
                <p className="muted">Waiting for writer...</p>
              )}
            </article>

            <article className="panel">
              <p className="eyebrow">EDITOR REVIEW</p>
              {output?.editor ? (
                <>
                  <h2>
                    {output.editor.decision === "approved" ? "Approved" : "Review"}{" "}
                    <span
                      className={
                        output.editor.decision === "approved" ? "good" : "bad"
                      }
                    >
                      {output.editor.score}%
                    </span>
                  </h2>
                  <p className="muted">
                    {output.editor.feedback.slice(0, 2).join(" ")}
                  </p>
                </>
              ) : (
                <p className="muted">Waiting for editor...</p>
              )}
            </article>

            {output?.social && (
              <article className="panel wide">
                <p className="eyebrow">SOCIAL COPY</p>
                <div className="copy-block">
                  <b>LinkedIn</b>
                  <p>{output.social.linkedIn}</p>
                </div>
                <div className="copy-block">
                  <b>X</b>
                  <p>{output.social.x}</p>
                </div>
                <div className="copy-block">
                  <b>Instagram</b>
                  <p>{output.social.instagram}</p>
                </div>
              </article>
            )}

            {output?.poster && (
              <article className="panel">
                <p className="eyebrow">POSTER</p>
                <h2>{output.poster.title}</h2>
                <p className="muted">{output.poster.subtitle}</p>
                {output.poster.imageUrl ? (
                  <img src={output.poster.imageUrl} alt={output.poster.title} />
                ) : (
                  <p className="muted">Image not generated</p>
                )}
              </article>
            )}

            {getSearchResults().length > 0 && (
              <article className="panel wide">
                <p className="eyebrow">SOURCES</p>
                <ul className="source-list">
                  {getSearchResults().slice(0, 5).map((result: SearchResult, i: number) => (
                    <li key={i}>
                      <a href={result.url} target="_blank" rel="noreferrer">
                        {result.title}
                      </a>
                      <span className="muted">
                        {" "}
                        · {result.source}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            )}
          </div>
        )}

        {stats && stats.recentJobs.length > 0 && (
          <article className="panel wide" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <p className="eyebrow">RECENT JOBS</p>
              <Link href="/jobs" className="secondary button-link">
                View all
              </Link>
            </div>
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentJobs.map((recentJob) => (
                  <tr key={recentJob.jobId}>
                    <td>
                      <Link href={`/jobs/${recentJob.jobId}`} className="job-link">
                        {recentJob.query}
                      </Link>
                    </td>
                    <td>
                      <span className={`status-pill ${statusClass(recentJob.status)}`}>
                        {recentJob.status}
                      </span>
                    </td>
                    <td>{new Date(recentJob.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        )}
      </section>
    </main>
  );
}

function statusClass(status: Job["status"]): string {
  switch (status) {
    case "completed":
      return "status-completed";
    case "failed":
      return "status-failed";
    case "running":
      return "status-running";
    case "queued":
      return "status-queued";
    case "cancel_requested":
    case "cancelled":
      return "status-cancelled";
    default:
      return "";
  }
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
