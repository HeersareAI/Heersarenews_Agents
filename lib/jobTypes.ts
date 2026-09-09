export interface JobOutput {
  search?: { results: SearchResult[] };
  research?: {
    events: { date: string; description: string; sources: string[] }[];
    claims: { claim: string; attributedTo: string; source: string }[];
    entities: { name: string; type: string }[];
    context: string;
  };
  factCheck?: { pass: boolean; confidence: number; warnings: string[] };
  sentiment?: {
    overall: "positive" | "neutral" | "negative";
    positive: number;
    neutral: number;
    negative: number;
  };
  briefing?: { headline: string; summary: string; fullBriefing: string };
  social?: { linkedIn: string; x: string; instagram: string };
  poster?: {
    title: string;
    subtitle: string;
    prompt: string;
    imageUrl: string | null;
  };
  editor?: { decision: "approved" | "needs_revision" | "rejected"; score: number; feedback: string[] };
  timings?: Record<string, number>;
  error?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  date?: string;
  excerpt: string;
  source?: string;
}

export interface Job {
  jobId: string;
  query: string;
  status: "queued" | "running" | "completed" | "failed" | "cancel_requested" | "cancelled";
  createdAt: string;
  updatedAt: string;
  output?: JobOutput;
  events: { type: string; payload?: unknown; createdAt: string }[];
  parentJobId?: string | null;
}
