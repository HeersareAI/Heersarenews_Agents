import { getDb } from "@/lib/mongodb";

export interface SourceUsage {
  domain: string;
  articleCount: number;
  lastUsed: Date | null;
}

export interface SourcePreferences {
  prefsId: string;
  includeDomains: string[];
  excludeDomains: string[];
  defaultSearchDepth: "basic" | "advanced";
  defaultMaxResults: number;
  updatedAt: Date;
}

function prefsCollection() {
  return getDb().then((db) => db.collection<SourcePreferences>("source_preferences"));
}

const PREFS_ID = "default";

export async function getSourcePreferences(): Promise<SourcePreferences> {
  const collection = await prefsCollection();
  const prefs = await collection.findOne({ prefsId: PREFS_ID });
  if (prefs) {
    return {
      ...prefs,
      defaultSearchDepth: prefs.defaultSearchDepth ?? "advanced",
      defaultMaxResults: prefs.defaultMaxResults ?? 10,
    };
  }
  return {
    prefsId: PREFS_ID,
    includeDomains: [],
    excludeDomains: [],
    defaultSearchDepth: "advanced",
    defaultMaxResults: 10,
    updatedAt: new Date(),
  };
}

export async function updateSourcePreferences(
  updates: Partial<Omit<SourcePreferences, "prefsId" | "updatedAt">>
): Promise<SourcePreferences> {
  const collection = await prefsCollection();
  await collection.updateOne(
    { prefsId: PREFS_ID },
    {
      $set: {
        prefsId: PREFS_ID,
        ...updates,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  return getSourcePreferences();
}

export async function aggregateSourceUsage(limit = 100): Promise<SourceUsage[]> {
  const db = await getDb();
  const jobs = await db
    .collection("jobs")
    .find({ "output.search": { $exists: true } })
    .project({ "output.search": 1, updatedAt: 1 })
    .limit(limit)
    .toArray();

  const usage = new Map<string, { count: number; lastUsed: Date | null }>();

  for (const job of jobs) {
    const rawSearch = (job.output as { search?: unknown } | undefined)?.search;
    const results = Array.isArray(rawSearch)
      ? rawSearch
      : (rawSearch as { results?: { source?: string }[] } | undefined)?.results ?? [];
    const updatedAt = job.updatedAt instanceof Date ? job.updatedAt : null;

    for (const result of results) {
      const domain = (result as { source?: string })?.source?.trim();
      if (!domain) continue;
      const current = usage.get(domain) ?? { count: 0, lastUsed: null };
      current.count += 1;
      if (updatedAt && (!current.lastUsed || updatedAt > current.lastUsed)) {
        current.lastUsed = updatedAt;
      }
      usage.set(domain, current);
    }
  }

  return Array.from(usage.entries())
    .map(([domain, { count, lastUsed }]) => ({
      domain,
      articleCount: count,
      lastUsed,
    }))
    .sort((a, b) => b.articleCount - a.articleCount);
}
