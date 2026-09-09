import { NextResponse } from "next/server";
import {
  aggregateSourceUsage,
  getSourcePreferences,
  updateSourcePreferences,
} from "@/lib/db/sources";

export async function GET() {
  const [preferences, discovered] = await Promise.all([
    getSourcePreferences(),
    aggregateSourceUsage(),
  ]);
  return NextResponse.json({ preferences, discovered });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const updates: Parameters<typeof updateSourcePreferences>[0] = {};

  if (Array.isArray(body.includeDomains)) {
    updates.includeDomains = body.includeDomains.map(String);
  }
  if (Array.isArray(body.excludeDomains)) {
    updates.excludeDomains = body.excludeDomains.map(String);
  }
  if (body.defaultSearchDepth === "basic" || body.defaultSearchDepth === "advanced") {
    updates.defaultSearchDepth = body.defaultSearchDepth;
  }
  if (typeof body.defaultMaxResults === "number") {
    updates.defaultMaxResults = Math.max(1, Math.min(50, Math.round(body.defaultMaxResults)));
  }

  const preferences = await updateSourcePreferences(updates);
  return NextResponse.json({ preferences });
}
