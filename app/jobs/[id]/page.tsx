"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Job, JobOutput } from "@/lib/jobTypes";

const STAGES = [
  "Search",
  "Research",
  "Fact Check",
  "Sentiment",
  "Writer",
  "Social",
  "Poster",
  "Editor",
];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadJob();

    const interval = setInterval(() => {
      loadJob(true);
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);

  async function loadJob(silent = false) {
    if (!id) return;
    try {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) throw new Error("Job not found");
      const data = await res.json();
      setJob(data.job);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/jobs/${job.jobId}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to cancel job");
      setJob((prev) => (prev ? { ...prev, status: "cancel_requested" } : prev));
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
      const res = await fetch(`/api/jobs/${job.jobId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to retry job");
      const data = await res.json();
      window.location.href = `/jobs/${data.jobId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry job");
      setRetrying(false);
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function formatDuration(startIso: string, endIso: string): string {
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  function stageState(stage: string): "complete" | "active" | "pending" {
    const normalize = (s: string) => s.toLowerCase().replace(/\s/g, "");
    const completedStages =
      job?.events
        .filter((e) => e.type === "stage_complete")
        .map((e) => normalize((e.payload as { stage?: string })?.stage ?? ""))
        .filter(Boolean) ?? [];
    const completed = new Set(completedStages);
    const stageKey = normalize(stage);

    if (completed.has(stageKey)) return "complete";

    const lastCompleted =
      [...(job?.events ?? [])]
        .reverse()
        .find((e: { type: string; payload?: unknown }) => e.type === "stage_complete")
        ?.payload as { stage?: string } | undefined;
    const currentStage = lastCompleted?.stage ?? null;
    if (currentStage && normalize(currentStage) === stageKey) return "active";

    const currentIndex = currentStage ? STAGES.findIndex((s) => normalize(s) === normalize(currentStage)) : -1;
    const stageIndex = STAGES.indexOf(stage);
    return stageIndex <= currentIndex ? "complete" : "pending";
  }

  if (loading) return <p className="muted">Loading job...</p>;
  if (error || !job) return <p className="error">{error || "Job not found"}</p>;

  const output = job.output;
  const isActive =
    job.status === "running" ||
    job.status === "queued" ||
    job.status === "cancel_requested";

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

  function downloadBriefingMarkdown(query: string, output: JobOutput, status: Job["status"]) {
    const lines = [
      `# ${output.briefing?.headline ?? query}`,
      "",
      `**Topic:** ${query}`,
      `**Status:** ${status}`,
      `**Editor score:** ${output.editor?.score ?? "-"}%`,
      `**Fact check:** ${output.factCheck ? `${Math.round(output.factCheck.confidence * 100)}%` : "-"}`,
      "",
      "## Summary",
      "",
      output.briefing?.summary ?? "",
      "",
      "## Full briefing",
      "",
      output.briefing?.fullBriefing ?? "",
      "",
      "## Sources",
      "",
    ];

    const raw = output.search;
    const results = Array.isArray(raw) ? raw : raw?.results ?? [];
    for (const result of results) {
      lines.push(`- [${result.title}](${result.url}) · ${result.source}`);
    }

    if (output.timings) {
      lines.push("", "## Stage timings", "");
      for (const [stage, ms] of Object.entries(output.timings)) {
        lines.push(`- ${stage}: ${ms}ms`);
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${query.slice(0, 40).replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "briefing"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <aside>
        <div className="brand">
          HEERSARE<span>NEWS</span>
        </div>
        <nav>
          <Link href="/">Dashboard</Link>
          <Link href="/jobs" className="selected">
            Jobs
          </Link>
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
            <p className="eyebrow">JOB DETAIL</p>
            <h1>{job.query}</h1>
          </div>
          <Link href="/jobs" className="secondary button-link">
            Back to jobs
          </Link>
        </header>

        <div className="job-meta">
          <span>
            Status: <strong className={`status-pill ${statusClass(job.status)}`}>{job.status}</strong>
          </span>
          <span>Created: {formatDate(job.createdAt)}</span>
          <span>Updated: {formatDate(job.updatedAt)}</span>
          <span>Duration: {formatDuration(job.createdAt, job.updatedAt)}</span>
          <span className="mono">ID: {job.jobId}</span>
        </div>

        {job.parentJobId && (
          <p className="muted">
            Retry of{" "}
            <Link href={`/jobs/${job.parentJobId}`}>{job.parentJobId}</Link>
          </p>
        )}

        <div className="detail-actions">
          {isActive && (
            <button
              className="secondary danger action-button"
              onClick={cancelJob}
              disabled={cancelling || job.status === "cancel_requested"}
            >
              {cancelling || job.status === "cancel_requested"
                ? "Cancelling..."
                : "Cancel job"}
            </button>
          )}
          {(job.status === "failed" || job.status === "cancelled") && (
            <button
              className="secondary action-button"
              onClick={retryJob}
              disabled={retrying}
            >
              {retrying ? "Retrying..." : "Retry job"}
            </button>
          )}
        </div>

        {output?.error && <p className="error">Error: {output.error}</p>}

        <div className="grid">
          {output?.briefing && (
            <article className="panel wide">
              <div className="panel-head">
                <p className="eyebrow">AI NEWS BRIEFING</p>
                <button
                  className="secondary small"
                  onClick={() => downloadBriefingMarkdown(job.query, output, job.status)}
                >
                  Download Markdown
                </button>
              </div>
              <h2>{output.briefing.headline}</h2>
              <p>{output.briefing.summary}</p>
              <pre className="briefing-full">{output.briefing.fullBriefing}</pre>
            </article>
          )}

          {output?.factCheck && (
            <article className="panel">
              <p className="eyebrow">FACT CHECK</p>
              <h2>
                {output.factCheck.pass ? "Passed" : "Flagged"}{" "}
                <span className={output.factCheck.pass ? "good" : "bad"}>
                  {Math.round(output.factCheck.confidence * 100)}%
                </span>
              </h2>
              <p className="muted">
                {output.factCheck.warnings.join(" ") || "No warnings"}
              </p>
            </article>
          )}

          {output?.sentiment && (
            <article className="panel">
              <p className="eyebrow">SENTIMENT</p>
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
            </article>
          )}

          {output?.editor && (
            <article className="panel">
              <p className="eyebrow">EDITOR REVIEW</p>
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
              <p className="muted">{output.editor.feedback.join(" ")}</p>
            </article>
          )}

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

          {(() => {
            const raw = output?.search;
            const results = Array.isArray(raw) ? raw : raw?.results ?? [];
            return results.length > 0 ? (
              <article className="panel wide">
                <p className="eyebrow">SOURCES</p>
                <ul className="source-list">
                  {results.map((result, i) => (
                    <li key={i}>
                      <a href={result.url} target="_blank" rel="noreferrer">
                        {result.title}
                      </a>
                      <span className="muted"> · {result.source}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null;
          })()}

          <article className="panel wide">
            <p className="eyebrow">WORKFLOW STAGES</p>
            <div className="stage-list">
              {STAGES.map((stage) => {
                const state = stageState(stage);
                const stageKey = stage.toLowerCase().replace(/\s/g, "");
                const timingMs = output?.timings?.[stageKey];
                return (
                  <div key={stage} className="stage">
                    <span className={`dot ${state}`} />
                    <span>{stage}</span>
                    {typeof timingMs === "number" && (
                      <span className="muted">{timingMs}ms</span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel wide">
            <p className="eyebrow">EVENT TIMELINE</p>
            <ul className="timeline">
              {[...job.events].reverse().map((event, i) => (
                <li key={i}>
                  <time>{formatDate(event.createdAt)}</time>
                  <div>
                    <span className="event-type">{event.type}</span>
                    {event.type === "stage_complete" &&
                      (event.payload as { stage?: string })?.stage && (
                        <span className="muted">
                          {" "}
                          · {(event.payload as { stage?: string }).stage}
                        </span>
                      )}
                    {event.type === "status_changed" &&
                      (event.payload as { status?: string })?.status && (
                        <span className="muted">
                          {" "}
                          · {(event.payload as { status?: string }).status}
                        </span>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
