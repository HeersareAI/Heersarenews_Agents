import { NextResponse } from "next/server";
export function GET() { const required = ["MONGODB_URI", "OPENAI_API_KEY"]; const missing = required.filter(key => !process.env[key]); return NextResponse.json({ ok: missing.length === 0, mode: process.env.NODE_ENV, missing }); }
