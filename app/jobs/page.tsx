"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job } from "@/lib/jobTypes";

const DEFAULT_LIMIT = 25;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  async function loadJobs(silent = false, currentPage = page, currentLimit = limit) {
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(currentLimit),
      });
      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.jobs ?? []);
      setPage(data.pagination?.page ?? currentPage);
      setLimit(data.pagination?.limit ?? currentLimit);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotalItems(data.pagination?.totalItems ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadJobs(true, page, limit);
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleString();
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

  async function cancelJob(jobId: string) {
    setCancellingId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to cancel job");
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === jobId ? { ...j, status: "cancel_requested" } : j
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancellingId(null);
    }
  }

  async function retryJob(jobId: string, query: string) {
    setRetryingId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to retry job");
      const data = await response.json();
      const newJob: Job = {
        jobId: data.jobId,
        query,
        status: data.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [],
        parentJobId: data.parentJobId,
      };
      setJobs((prev) => [newJob, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry job");
    } finally {
      setRetryingId(null);
    }
  }

  async function deleteJobById(jobId: string) {
    if (!confirm("Delete this job permanently?")) return;
    setDeletingId(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete job");
      setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
      setTotalItems((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    } finally {
      setDeletingId(null);
    }
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
            <p className="eyebrow">INTELLIGENCE WORKSPACE</p>
            <h1>Job History</h1>
            <p>Recent news analysis jobs and their outcomes.</p>
          </div>
          <Link href="/" className="secondary button-link">
            New analysis
          </Link>
        </header>

        {loading && <p className="muted">Loading jobs...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && (
          <div className="jobs-table-wrap">
            <div className="jobs-table-meta">
              <span className="muted">
                {totalItems} job{totalItems === 1 ? "" : "s"}
              </span>
              <div className="page-size">
                <label htmlFor="limit" className="muted">
                  Per page
                </label>
                <select
                  id="limit"
                  value={limit}
                  onChange={(e) => {
                    const newLimit = parseInt(e.target.value, 10);
                    setLimit(newLimit);
                    setPage(1);
                    loadJobs(false, 1, newLimit);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Editor</th>
                  <th>Created</th>
                  <th>Job ID</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted center">
                      No jobs yet.
                    </td>
                  </tr>
                )}
                {jobs.map((job) => (
                  <tr key={job.jobId}>
                    <td>
                      <Link href={`/jobs/${job.jobId}`} className="job-link">
                        {job.query}
                      </Link>
                      {job.parentJobId && (
                        <span className="muted"> · retry</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${statusClass(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>
                      {job.output?.editor
                        ? `${job.output.editor.score}%`
                        : "-"}
                    </td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td>
                      <div className="actions">
                        <span className="mono">{job.jobId.slice(0, 8)}</span>
                        {(job.status === "running" ||
                          job.status === "queued" ||
                          job.status === "cancel_requested") && (
                          <button
                            className="secondary danger action-button"
                            onClick={() => cancelJob(job.jobId)}
                            disabled={
                              cancellingId === job.jobId ||
                              job.status === "cancel_requested"
                            }
                          >
                            {cancellingId === job.jobId ||
                            job.status === "cancel_requested"
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        )}
                        {(job.status === "failed" ||
                          job.status === "cancelled") && (
                          <button
                            className="secondary action-button"
                            onClick={() => retryJob(job.jobId, job.query)}
                            disabled={retryingId === job.jobId}
                          >
                            {retryingId === job.jobId ? "Retrying..." : "Retry"}
                          </button>
                        )}
                        <button
                          className="secondary danger action-button"
                          onClick={() => deleteJobById(job.jobId)}
                          disabled={deletingId === job.jobId}
                          title="Delete job"
                        >
                          {deletingId === job.jobId ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Job pagination">
                <button
                  className="secondary"
                  onClick={() => loadJobs(false, page - 1, limit)}
                  disabled={page <= 1}
                >
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="secondary"
                  onClick={() => loadJobs(false, page + 1, limit)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
