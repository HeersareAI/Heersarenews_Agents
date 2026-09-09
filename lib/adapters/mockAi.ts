import type { SearchResult } from "@/lib/adapters/search";
import type {
  Briefing,
  EditorReview,
  FactCheckResult,
  PosterResult,
  ResearchNotes,
  SentimentResult,
  SocialCopy,
} from "@/lib/adapters/openai";

function firstSentence(text: string): string {
  const match = text.replace(/\s+/g, " ").match(/^[^.!?]{10,150}[.!?]/);
  return match ? match[0].trim() : text.slice(0, 120).trim() + "...";
}

function topSources(articles: SearchResult[], limit = 3): string[] {
  return articles.slice(0, limit).map((a) => `${a.source ?? "source"} (${a.url})`);
}

export function mockExtractResearch(
  query: string,
  articles: SearchResult[]
): ResearchNotes {
  const titles = articles.map((a) => a.title).filter(Boolean);
  const context = articles.length
    ? `Recent coverage of "${query}" focuses on ${titles.slice(0, 3).join("; ")}. Multiple sources highlight developments over the past week.`
    : `Limited coverage found for "${query}".`;

  return {
    events: articles.slice(0, 5).map((a, i) => ({
      date: a.date ?? "unknown",
      description: firstSentence(a.excerpt),
      sources: [a.url],
    })),
    claims: articles.slice(0, 4).map((a) => ({
      claim: firstSentence(a.excerpt),
      attributedTo: a.source ?? "news source",
      source: a.url,
    })),
    entities: [
      { name: query, type: "topic" },
      ...articles.slice(0, 3).map((a) => ({
        name: a.source ?? "unknown source",
        type: "organization",
      })),
    ],
    context,
  };
}

export function mockFactCheck(
  _research: ResearchNotes,
  articles: SearchResult[]
): FactCheckResult {
  const confidence = articles.length ? 0.75 : 0.45;
  return {
    pass: confidence >= 0.6,
    confidence,
    warnings: articles.length
      ? ["Verify dates and primary-source attribution before publication."]
      : ["Very few sources available; confidence is low."],
  };
}

export function mockSentiment(
  _query: string,
  articles: SearchResult[]
): SentimentResult {
  const score = articles.length ? 0.45 : 0.33;
  return {
    overall: "neutral",
    positive: Number((score - 0.05).toFixed(2)),
    neutral: Number(score.toFixed(2)),
    negative: Number((1 - score - (score - 0.05)).toFixed(2)),
  };
}

export function mockBriefing(
  query: string,
  research: ResearchNotes,
  factCheck: FactCheckResult
): Briefing {
  const headline = `Latest developments on ${query}`;
  const summary = `${research.context}\n\nKey claims include: ${research.claims
    .slice(0, 3)
    .map((c) => c.claim)
    .join(" ")}`.trim();
  return {
    headline,
    summary,
    fullBriefing: `${headline}\n\n${summary}\n\nFact-check confidence: ${Math.round(
      factCheck.confidence * 100
    )}%. ${factCheck.warnings.join(" ")}\n\nSources:\n${topSources(
      research.events.flatMap((e) => e.sources).map((url) => ({ url }) as SearchResult)
    ).join("\n")}`,
  };
}

export function mockSocialCopy(query: string, briefing: Briefing): SocialCopy {
  return {
    linkedIn: `A quick update on ${query}: ${briefing.summary.slice(0, 180)}`,
    x: `Latest on ${query}: ${briefing.headline}`.slice(0, 280),
    instagram: `Following ${query}. ${briefing.headline} #news #ai #analysis`,
  };
}

export function mockPoster(query: string, briefing: Briefing): PosterResult {
  return {
    title: briefing.headline,
    subtitle: query,
    prompt: `Modern editorial infographic poster titled "${briefing.headline}" with clean typography, subtle gradient background, and news-related iconography.`,
    imageUrl: null,
  };
}

export function mockEditorReview(
  briefing: Briefing,
  factCheck: FactCheckResult
): EditorReview {
  const score = Math.max(
    50,
    Math.min(95, Math.round(factCheck.confidence * 100) + 15)
  );
  return {
    decision: score >= 70 ? "approved" : "needs_revision",
    score,
    feedback: [
      `Headline is clear: "${briefing.headline}"`,
      `Fact-check confidence at ${Math.round(factCheck.confidence * 100)}%.`,
      "Review source attribution before final publish.",
    ],
  };
}
