import { describe, it, expect, vi } from "vitest";
import { dispatchJobNotification } from "@/lib/notifications";

describe("dispatchJobNotification", () => {
  it("does nothing when JOB_WEBHOOK_URL is not set", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await dispatchJobNotification("job-1", "AI news", "completed");
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sends a webhook payload when JOB_WEBHOOK_URL is set", async () => {
    const originalEnv = process.env.JOB_WEBHOOK_URL;
    process.env.JOB_WEBHOOK_URL = "https://example.com/webhook";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await dispatchJobNotification("job-2", "AI regulation", "completed", {
      editor: { decision: "approved", score: 88, feedback: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init?.body as string) ?? "{}");
    expect(body.jobId).toBe("job-2");
    expect(body.status).toBe("completed");
    expect(body.editorScore).toBe(88);

    process.env.JOB_WEBHOOK_URL = originalEnv;
    vi.unstubAllGlobals();
  });
});
