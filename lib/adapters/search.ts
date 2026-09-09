import { getSourcePreferences } from "@/lib/db/sources";

export interface SearchResult {
  title: string;
  url: string;
  date?: string;
  excerpt: string;
  source?: string;
}

export interface SearchNewsOptions {
  maxResults?: number;
  days?: number;
  searchDepth?: "basic" | "advanced";
  includeDomains?: string[];
  excludeDomains?: string[];
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  published_date?: string;
  score?: number;
}

interface TavilyResponse {
  query: string;
  results: TavilyResult[];
  answer?: string;
  response_time?: number;
}

export async function searchNews(
  query: string,
  options: SearchNewsOptions = {}
): Promise<SearchResult[]> {
  const apiKey = process.env.NEWS_SEARCH_API_KEY;
  const provider = process.env.NEWS_SEARCH_PROVIDER;

  if (!apiKey) {
    throw new Error("NEWS_SEARCH_API_KEY is not configured");
  }

  if (provider !== "tavily") {
    throw new Error(`Unsupported news search provider: ${provider}`);
  }

  const prefs = await getSourcePreferences();

  const {
    maxResults = prefs.defaultMaxResults ?? 10,
    days = 7,
    searchDepth = prefs.defaultSearchDepth ?? "advanced",
    includeDomains = prefs.includeDomains.length > 0 ? prefs.includeDomains : undefined,
    excludeDomains = prefs.excludeDomains.length > 0 ? prefs.excludeDomains : undefined,
  } = options;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      days,
      include_domains: includeDomains,
      exclude_domains: excludeDomains,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Tavily search failed (${response.status}): ${text.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as TavilyResponse;

  return data.results.map((result) => ({
    title: result.title,
    url: result.url,
    date: result.published_date,
    excerpt: result.content,
    source: new URL(result.url).hostname.replace(/^www\./, ""),
  }));
}
