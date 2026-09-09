import { NextResponse } from "next/server";
import { requestJobCancel } from "@/lib/db/jobs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const accepted = await requestJobCancel(id);

  if (!accepted) {
    return NextResponse.json(
      { error: "Job not found or already finished" },
      { status: 409 }
    );
  }

  return NextResponse.json({ jobId: id, status: "cancel_requested" });
}
