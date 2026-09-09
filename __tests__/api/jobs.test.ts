import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, POST } from "@/app/api/jobs/route";
import { listJobs, createJob } from "@/lib/db/jobs";
import { inngest } from "@/lib/inngest/client";

vi.mock("@/lib/db/jobs", () => ({
  createJob: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

describe("/api/jobs", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("GET", () => {
    it("parses pagination and returns jobs with metadata", async () => {
      vi.mocked(listJobs).mockResolvedValue({
        jobs: [
          {
            jobId: "job-1",
            query: "q1",
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date(),
            events: [],
          },
        ] as Awaited<ReturnType<typeof listJobs>>["jobs"],
        total: 1,
      });

      const request = new Request("http://localhost:3000/api/jobs?page=2&limit=10");
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.jobs).toHaveLength(1);
      expect(body.pagination).toEqual({
        page: 2,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(listJobs).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });

    it("falls back to defaults for invalid query params", async () => {
      vi.mocked(listJobs).mockResolvedValue({ jobs: [], total: 0 });

      const request = new Request("http://localhost:3000/api/jobs?page=-1&limit=999");
      const response = await GET(request);
      const body = await response.json();

      expect(body.pagination).toEqual({
        page: 1,
        limit: 25,
        totalItems: 0,
        totalPages: 0,
      });
    });
  });

  describe("POST", () => {
    it("rejects topics that are too short", async () => {
      const request = new Request("http://localhost:3000/api/jobs", {
        method: "POST",
        body: JSON.stringify({ query: "AI" }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("between 5 and 500 characters");
    });

    it("creates a job and dispatches an event", async () => {
      const job = {
        jobId: "abc",
        query: "AI regulation Europe 2026",
        status: "queued" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
      };
      vi.mocked(createJob).mockResolvedValue(job);
      vi.mocked(inngest.send).mockResolvedValue({ ids: [] });

      const request = new Request("http://localhost:3000/api/jobs", {
        method: "POST",
        body: JSON.stringify({ query: job.query }),
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(202);
      expect(body.jobId).toBe("abc");
      expect(inngest.send).toHaveBeenCalledWith({
        name: "news/job.created",
        data: { jobId: "abc", query: job.query },
      });
    });
  });
});
