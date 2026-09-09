import { NextResponse } from "next/server";
import { getWorkspaceSettings, updateWorkspaceSettings } from "@/lib/db/settings";

export async function GET() {
  const settings = await getWorkspaceSettings();
  return NextResponse.json({
    openaiModel: settings.openaiModel,
    mockAiOutputs: settings.mockAiOutputs,
    newsSearchProvider: settings.newsSearchProvider,
  });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const settings = await updateWorkspaceSettings({
    openaiModel:
      typeof body.openaiModel === "string" && body.openaiModel.trim().length > 0
        ? body.openaiModel.trim()
        : undefined,
    mockAiOutputs:
      typeof body.mockAiOutputs === "boolean"
        ? body.mockAiOutputs
        : undefined,
    newsSearchProvider:
      body.newsSearchProvider === "tavily" ? "tavily" : undefined,
  });
  return NextResponse.json({
    openaiModel: settings.openaiModel,
    mockAiOutputs: settings.mockAiOutputs,
    newsSearchProvider: settings.newsSearchProvider,
  });
}
