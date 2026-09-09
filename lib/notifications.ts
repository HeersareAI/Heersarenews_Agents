import { logger } from "@/lib/logger";
import type { JobOutput } from "@/lib/jobTypes";

export async function dispatchJobNotification(
  jobId: string,
  query: string,
  status: "completed" | "failed" | "cancelled",
  output?: JobOutput
): Promise<void> {
  const webhookUrl = process.env.JOB_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    jobId,
    query,
    status,
    timestamp: new Date().toISOString(),
    editorScore:
      typeof output?.editor?.score === "number" ? output.editor.score : null,
    error: output?.error ?? null,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn(
        { jobId, status, statusCode: response.status },
        "webhook_notification_failed"
      );
    } else {
      logger.info({ jobId, status }, "webhook_notification_sent");
    }
  } catch (error) {
    logger.warn(
      { jobId, status, error: error instanceof Error ? error.message : String(error) },
      "webhook_notification_error"
    );
  }
}
