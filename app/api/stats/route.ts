import { NextResponse } from "next/server";
import { getJobStats } from "@/lib/db/jobs";

export async function GET() {
  const stats = await getJobStats();
  return NextResponse.json(stats);
}
