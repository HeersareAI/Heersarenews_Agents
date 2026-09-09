import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";
import type { SearchResult } from "@/lib/adapters/search";
import { getWorkspaceSettings } from "@/lib/db/settings";
import {
  mockBriefing,
  mockEditorReview,
  mockExtractResearch,
  mockFactCheck,
  mockPoster,
  mockSentiment,
  mockSocialCopy,
} from "@/lib/adapters/mockAi";

const DEFAULT_MODEL = "gpt-4o";
const FAST_MODEL = "gpt-4o-mini";

async function useMockAi(): Promise<boolean> {
  if (process.env.MOCK_AI_OUTPUTS === "true") return true;
  const settings = await getWorkspaceSettings();
  return settings.mockAiOutputs;
}

async function getModel(preferFast = false) {
  const envModel = process.env.OPENAI_MODEL;
  const settings = await getWorkspaceSettings();
  const configured = envModel || settings.openaiModel;
  if (configured) return openai(configured);
  return openai(preferFast ? FAST_MODEL : DEFAULT_MODEL);
}

export interface ResearchNotes {
  events: { date: string; description: string; sources: string[] }[];
  claims: { claim: string; attributedTo: string; source: string }[];
  entities: { name: string; type: string }[];
  context: string;
}

export async function extractResearch(
  query: string,
  articles: SearchResult[]
): Promise<ResearchNotes> {
  if (await useMockAi()) return mockExtractResearch(query, articles);

  const articleText = articles
    .map(
      (a, i) =>
        `[${i + 1}] ${a.title}\nSource: ${a.url}\nDate: ${a.date ?? "unknown"}\n${a.excerpt}`
    )
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: await getModel(),
    schema: z.object({
      events: z
        .array(
          z.object({
            date: z.string().describe("ISO date or 'unknown'"),
            description: z.string(),
            sources: z.array(z.string()),
          })
        )
        .describe("Key recent events related to the query"),
      claims: z
        .array(
          z.object({
            claim: z.string(),
            attributedTo: z.string().describe("Source or author, if known"),
            source: z.string().describe("URL or citation, if known"),
          })
        )
        .describe("Factual claims found in the articles, with attribution"),
      entities: z
        .array(z.object({ name: z.string(), type: z.string() }))
        .describe("Important people, organizations, laws, or concepts"),
      context: z
        .string()
        .describe("2-3 sentence summary of the broader context"),
    }),
    prompt: `You are a research analyst. Extract structured notes from the following articles about: "${query}"\n\n${articleText}\n\nReturn concise, factual notes. Attribute claims to sources using the [n] citation format when possible.`,
  });

  return object;
}

export interface FactCheckResult {
  pass: boolean;
  confidence: number;
  warnings: string[];
}

export async function factCheckClaims(
  research: ResearchNotes,
  articles: SearchResult[]
): Promise<FactCheckResult> {
  if (await useMockAi()) return mockFactCheck(research, articles);

  const claims = research.claims
    .map((c) => `- ${c.claim}${c.attributedTo ? ` (attributed to ${c.attributedTo})` : ""}`)
    .join("\n");

  const { object } = await generateObject({
    model: await getModel(true),
    schema: z.object({
      pass: z.boolean().describe("Whether the claims are broadly supported"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe("Confidence score between 0 and 1"),
      warnings: z
        .array(z.string())
        .describe("Specific concerns, unsupported claims, or missing context"),
    }),
    prompt: `You are a fact checker. Given the following claims extracted from articles:\n\n${claims}\n\nEvaluate whether they are broadly supported by the provided sources. Flag any unsupported, misleading, or contentious claims.`,
  });

  return object;
}

export interface SentimentResult {
  overall: "positive" | "neutral" | "negative";
  positive: number;
  neutral: number;
  negative: number;
}

export async function analyzeSentiment(
  query: string,
  articles: SearchResult[]
): Promise<SentimentResult> {
  if (await useMockAi()) return mockSentiment(query, articles);

  const excerpts = articles.map((a) => `- ${a.source}: ${a.excerpt}`).join("\n");

  const { object } = await generateObject({
    model: await getModel(true),
    schema: z.object({
      overall: z.enum(["positive", "neutral", "negative"]),
      positive: z.number().min(0).max(1),
      neutral: z.number().min(0).max(1),
      negative: z.number().min(0).max(1),
    }),
    prompt: `Analyze the sentiment of the following excerpts about "${query}". Provide percentage shares that sum to 1.0 and an overall classification.\n\n${excerpts}`,
  });

  return object;
}

export interface Briefing {
  headline: string;
  summary: string;
  fullBriefing: string;
}

export async function writeBriefing(
  query: string,
  research: ResearchNotes,
  factCheck: FactCheckResult
): Promise<Briefing> {
  if (await useMockAi()) return mockBriefing(query, research, factCheck);

  const { object } = await generateObject({
    model: await getModel(),
    schema: z.object({
      headline: z.string().describe("A clear, factual headline"),
      summary: z
        .string()
        .describe("A 2-3 paragraph summary of the key developments"),
      fullBriefing: z
        .string()
        .describe("A detailed, attributed briefing with citations"),
    }),
    prompt: `You are an investigative journalist writing an evidence-first briefing on: "${query}"\n\nResearch notes:\n${JSON.stringify(research, null, 2)}\n\nFact check confidence: ${Math.round(
      factCheck.confidence * 100
    )}%\nWarnings: ${factCheck.warnings.join(", ") || "none"}\n\nWrite a balanced, attributed briefing. Include source citations where possible.`,
  });

  return object;
}

export interface SocialCopy {
  linkedIn: string;
  x: string;
  instagram: string;
}

export async function writeSocialCopy(
  query: string,
  briefing: Briefing
): Promise<SocialCopy> {
  if (await useMockAi()) return mockSocialCopy(query, briefing);

  const { object } = await generateObject({
    model: await getModel(true),
    schema: z.object({
      linkedIn: z.string().describe("Professional LinkedIn post, under 150 words"),
      x: z.string().describe("X post under 280 characters"),
      instagram: z.string().describe("Instagram caption, 1-2 sentences with hashtags"),
    }),
    prompt: `Create platform-ready social copy based on this briefing about "${query}":\n\nHeadline: ${briefing.headline}\nSummary: ${briefing.summary}`,
  });

  return object;
}

export interface PosterResult {
  title: string;
  subtitle: string;
  prompt: string;
  imageUrl: string | null;
}

async function generateAndUploadImage(
  prompt: string,
  slug: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const imageUrl = data?.data?.[0]?.url as string | undefined;
  if (!imageUrl) return null;

  // Download the generated image and upload it to Vercel Blob for persistent hosting.
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return imageUrl; // Fallback to OpenAI's temporary URL if Blob fails.

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const blob = await put(`posters/${slug}-${Date.now()}.png`, imageBuffer, {
    access: "public",
    contentType: "image/png",
  });

  return blob.url;
}

export async function generatePoster(
  query: string,
  briefing: Briefing
): Promise<PosterResult> {
  const baseResult = await useMockAi()
    ? mockPoster(query, briefing)
    : await generateObject({
        model: await getModel(true),
        schema: z.object({
          title: z.string().describe("Poster title"),
          subtitle: z.string().describe("Short poster subtitle"),
          prompt: z
            .string()
            .describe(
              "A vivid, safe image generation prompt for a news infographic poster"
            ),
        }),
        prompt: `Design a poster brief for a news infographic about "${query}". Headline: ${briefing.headline}. Summary: ${briefing.summary}`,
      }).then(({ object }) => object);

  const imageUrl = await generateAndUploadImage(
    baseResult.prompt,
    `${slugify(query)}-${Date.now()}`
  );

  return {
    ...baseResult,
    imageUrl,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export interface EditorReview {
  decision: "approved" | "needs_revision" | "rejected";
  score: number;
  feedback: string[];
}

export async function editorReview(
  briefing: Briefing,
  factCheck: FactCheckResult
): Promise<EditorReview> {
  if (await useMockAi()) return mockEditorReview(briefing, factCheck);

  const { object } = await generateObject({
    model: await getModel(),
    schema: z.object({
      decision: z.enum(["approved", "needs_revision", "rejected"]),
      score: z.number().min(0).max(100).describe("Quality score from 0-100"),
      feedback: z
        .array(z.string())
        .describe("Specific strengths or improvement suggestions"),
    }),
    prompt: `You are a senior editor reviewing this briefing:\n\nHeadline: ${briefing.headline}\nSummary: ${briefing.summary}\nFull briefing: ${briefing.fullBriefing}\n\nFact check confidence: ${Math.round(
      factCheck.confidence * 100
    )}%\nWarnings: ${factCheck.warnings.join(", ") || "none"}\n\nEvaluate evidence, clarity, balance, and brand safety. Return a decision and feedback.`,
  });

  return object;
}
