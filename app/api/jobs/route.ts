import { NextResponse } from "next/server";
import { z } from "zod";
import { createJob, listJobs } from "@/lib/db/jobs";
import { inngest } from "@/lib/inngest/client";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

const input = z.object({ query: z.string().min(5).max(500) });

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const limit = rateLimit(clientIp, {
    windowMs: 60_000,
    maxRequests: Number(process.env.RATE_LIMIT_PER_MINUTE ?? "10"),
  });

  if (!limit.allowed) {
    logger.warn({ clientIp }, "rate_limit_exceeded");
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit.limit),
          "X-RateLimit-Remaining": String(limit.remaining),
          "X-RateLimit-Reset": String(limit.resetAt),
        },
      }
    );
  }

  const result = input.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { error: "A news topic between 5 and 500 characters is required." },
      { status: 400 }
    );
  }

  const { query } = result.data;
  const job = await createJob(query);
  logger.info({ jobId: job.jobId, query, clientIp }, "job_created");

  await inngest.send({
    name: "news/job.created",
    data: { jobId: job.jobId, query },
  });

  return NextResponse.json(
    { jobId: job.jobId, status: "queued", query },
    { status: 202 }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 100 ? rawLimit : 25;

  const { jobs, total } = await listJobs({ page, limit });
  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    jobs,
    pagination: { page, limit, totalItems: total, totalPages },
  });
}
