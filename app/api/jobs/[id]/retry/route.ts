import { NextResponse } from "next/server";
import { createJob, getJob } from "@/lib/db/jobs";
import { inngest } from "@/lib/inngest/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const original = await getJob(id);

  if (!original) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const retry = await createJob(original.query, original.jobId);

  await inngest.send({
    name: "news/job.created",
    data: { jobId: retry.jobId, query: retry.query },
  });

  return NextResponse.json(
    { jobId: retry.jobId, parentJobId: original.jobId, status: "queued" },
    { status: 202 }
  );
}
