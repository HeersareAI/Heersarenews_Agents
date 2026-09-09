import { NextResponse } from "next/server";
import { deleteJob, getJob } from "@/lib/db/jobs";
import { logger } from "@/lib/logger";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteJob(id);

  if (!deleted) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  logger.info({ jobId: id }, "job_deleted");
  return NextResponse.json({ jobId: id, deleted: true });
}
