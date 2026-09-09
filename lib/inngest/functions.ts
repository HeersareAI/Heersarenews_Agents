import { inngest } from "@/lib/inngest/client";
import {
  appendJobOutput,
  appendJobTiming,
  finalizeJobCancellation,
  isJobCancelled,
  updateJobStatus,
} from "@/lib/db/jobs";
import { searchNews } from "@/lib/adapters/search";
import {
  analyzeSentiment,
  editorReview,
  extractResearch,
  factCheckClaims,
  generatePoster,
  writeBriefing,
  writeSocialCopy,
} from "@/lib/adapters/openai";
import { logger } from "@/lib/logger";
import { dispatchJobNotification } from "@/lib/notifications";

const stageTimings: Record<string, number> = {};

export const analyzeNewsJob = inngest.createFunction(
  {
    id: "analyze-news-job",
    concurrency: { limit: 5 },
    triggers: [{ event: "news/job.created" }],
  },
  async ({ event, step }) => {
    const { jobId, query } = event.data;
    const startedAt = Date.now();
    logger.info({ jobId, query }, "job_started");

    await updateJobStatus(jobId, "running");

    async function timedStep<T>(name: string, fn: () => Promise<T>): Promise<T> {
      const t0 = Date.now();
      const result = (await step.run(name, fn)) as T;
      const durationMs = Date.now() - t0;
      stageTimings[name] = durationMs;
      await appendJobTiming(jobId, name, durationMs);
      logger.info({ jobId, stage: name, durationMs }, "stage_completed");
      return result;
    }

    async function checkCancelled(label: string): Promise<boolean> {
      const cancelled = await step.run(`check-cancelled-${label}`, async () =>
        isJobCancelled(jobId)
      );
      if (cancelled) {
        await step.run(`mark-cancelled-${label}`, async () =>
          finalizeJobCancellation(jobId)
        );
        const durationMs = Date.now() - startedAt;
        logger.info({ jobId, durationMs }, "job_cancelled");
        await dispatchJobNotification(jobId, query, "cancelled");
      }
      return cancelled;
    }

    try {
      const searchResults = await timedStep("search", async () => {
        const results = await searchNews(query, { maxResults: 10, days: 7 });
        await appendJobOutput(jobId, "search", { results });
        return results;
      });

      if (await checkCancelled("after-search")) {
        return { jobId, status: "cancelled" };
      }

      const research = await timedStep("research", async () => {
        const notes = await extractResearch(query, searchResults);
        await appendJobOutput(jobId, "research", notes);
        return notes;
      });

      if (await checkCancelled("after-research")) {
        return { jobId, status: "cancelled" };
      }

      const [factCheck, sentiment] = await Promise.all([
        timedStep("fact-check", async () => {
          const result = await factCheckClaims(research, searchResults);
          await appendJobOutput(jobId, "factCheck", result);
          return result;
        }),
        timedStep("sentiment", async () => {
          const result = await analyzeSentiment(query, searchResults);
          await appendJobOutput(jobId, "sentiment", result);
          return result;
        }),
      ]);

      if (await checkCancelled("after-fact-check")) {
        return { jobId, status: "cancelled" };
      }

      const briefing = await timedStep("writer", async () => {
        const result = await writeBriefing(query, research, factCheck);
        await appendJobOutput(jobId, "writer", result);
        return result;
      });

      if (await checkCancelled("after-writer")) {
        return { jobId, status: "cancelled" };
      }

      const social = await timedStep("social", async () => {
        const result = await writeSocialCopy(query, briefing);
        await appendJobOutput(jobId, "social", result);
        return result;
      });

      if (await checkCancelled("after-social")) {
        return { jobId, status: "cancelled" };
      }

      const poster = await timedStep("poster", async () => {
        const result = await generatePoster(query, briefing);
        await appendJobOutput(jobId, "poster", result);
        return result;
      });

      if (await checkCancelled("after-poster")) {
        return { jobId, status: "cancelled" };
      }

      const editor = await timedStep("editor", async () => {
        const result = await editorReview(briefing, factCheck);
        await appendJobOutput(jobId, "editor", result);
        return result;
      });

      await step.run("finalize", async () => {
        const durationMs = Date.now() - startedAt;
        const finalOutput = {
          search: { results: searchResults },
          research,
          factCheck,
          sentiment,
          briefing,
          social,
          poster,
          editor,
          timings: { ...stageTimings, totalMs: durationMs },
        };
        await updateJobStatus(jobId, "completed", finalOutput);
        logger.info({ jobId, durationMs }, "job_completed");
        await dispatchJobNotification(jobId, query, "completed", finalOutput);
      });

      return { jobId, status: "completed" };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ jobId, error: message, durationMs }, "job_failed");
      await updateJobStatus(jobId, "failed", { error: message, timings: { totalMs: durationMs } });
      await dispatchJobNotification(jobId, query, "failed", { error: message });
      throw error;
    }
  }
);

export const functions = [analyzeNewsJob];
