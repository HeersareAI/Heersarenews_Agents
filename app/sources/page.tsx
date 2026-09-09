"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SourcePreferences {
  prefsId: string;
  includeDomains: string[];
  excludeDomains: string[];
  defaultSearchDepth: "basic" | "advanced";
  defaultMaxResults: number;
}

interface DiscoveredSource {
  domain: string;
  articleCount: number;
  lastUsed: string | null;
}

export default function SourcesPage() {
  const [preferences, setPreferences] = useState<SourcePreferences | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  useEffect(() => {
    fetch("/api/sources")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sources");
        return res.json();
      })
      .then((data) => {
        setPreferences(data.preferences);
        setDiscovered(data.discovered ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function savePreferences(updates: Partial<SourcePreferences>) {
    if (!preferences || saving) return;
    setSaving(true);
    try {
      const next = { ...preferences, ...updates };
      const res = await fetch("/api/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      const data = await res.json();
      setPreferences(data.preferences);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  function addDomain(list: "include" | "exclude") {
    const input = list === "include" ? includeInput.trim() : excludeInput.trim();
    if (!input || !preferences) return;
    const key = list === "include" ? "includeDomains" : "excludeDomains";
    const current = preferences[key];
    if (current.includes(input)) return;
    savePreferences({ [key]: [...current, input] });
    if (list === "include") setIncludeInput("");
    else setExcludeInput("");
  }

  function removeDomain(list: "include" | "exclude", domain: string) {
    if (!preferences) return;
    const key = list === "include" ? "includeDomains" : "excludeDomains";
    savePreferences({ [key]: preferences[key].filter((d) => d !== domain) });
  }

  function formatDate(iso: string | null): string {
    if (!iso) return "-";
    return new Date(iso).toLocaleString();
  }

  if (loading) return <p className="muted">Loading sources...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!preferences) return <p className="error">Sources unavailable</p>;

  return (
    <main>
      <aside>
        <div className="brand">
          HEERSARE<span>NEWS</span>
        </div>
        <nav>
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/sources" className="selected">
            Sources
          </Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <div className="profile">
          AI MULTI AGENT
          <br />
          <small>News analysis workspace</small>
        </div>
      </aside>
      <section className="content">
        <header>
          <div>
            <p className="eyebrow">INTELLIGENCE WORKSPACE</p>
            <h1>Sources</h1>
            <p>Manage news sources and search preferences.</p>
          </div>
          <Link href="/" className="secondary button-link">
            New analysis
          </Link>
        </header>

        {saving && <p className="muted">Saving...</p>}

        <div className="grid">
          <article className="panel wide">
            <p className="eyebrow">SEARCH PREFERENCES</p>
            <div className="form-row">
              <label>
                <span>Search depth</span>
                <select
                  value={preferences.defaultSearchDepth ?? "advanced"}
                  onChange={(e) =>
                    savePreferences({
                      defaultSearchDepth: e.target.value as "basic" | "advanced",
                    })
                  }
                  disabled={saving}
                >
                  <option value="advanced">Advanced</option>
                  <option value="basic">Basic</option>
                </select>
              </label>
              <label>
                <span>Max results per query</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={preferences.defaultMaxResults}
                  onChange={(e) =>
                    savePreferences({ defaultMaxResults: Number(e.target.value) })
                  }
                  disabled={saving}
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <p className="eyebrow">INCLUDE DOMAINS</p>
            <p className="muted small">
              Only results from these domains will be used when set.
            </p>
            <div className="domain-input">
              <input
                value={includeInput}
                onChange={(e) => setIncludeInput(e.target.value)}
                placeholder="example.com"
                onKeyDown={(e) => e.key === "Enter" && addDomain("include")}
              />
              <button onClick={() => addDomain("include")} disabled={saving}>
                Add
              </button>
            </div>
            <ul className="domain-list">
              {preferences.includeDomains.length === 0 && (
                <li className="muted">No included domains</li>
              )}
              {preferences.includeDomains.map((domain) => (
                <li key={domain}>
                  <span>{domain}</span>
                  <button
                    className="secondary danger small"
                    onClick={() => removeDomain("include", domain)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <p className="eyebrow">EXCLUDE DOMAINS</p>
            <p className="muted small">
              Results from these domains will be filtered out.
            </p>
            <div className="domain-input">
              <input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                placeholder="example.com"
                onKeyDown={(e) => e.key === "Enter" && addDomain("exclude")}
              />
              <button onClick={() => addDomain("exclude")} disabled={saving}>
                Add
              </button>
            </div>
            <ul className="domain-list">
              {preferences.excludeDomains.length === 0 && (
                <li className="muted">No excluded domains</li>
              )}
              {preferences.excludeDomains.map((domain) => (
                <li key={domain}>
                  <span>{domain}</span>
                  <button
                    className="secondary danger small"
                    onClick={() => removeDomain("exclude", domain)}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel wide">
            <p className="eyebrow">DISCOVERED SOURCES</p>
            {discovered.length === 0 ? (
              <p className="muted">No sources discovered yet. Run a job first.</p>
            ) : (
              <table className="jobs-table sources-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Articles used</th>
                    <th>Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {discovered.map((source) => (
                    <tr key={source.domain}>
                      <td>{source.domain}</td>
                      <td>{source.articleCount}</td>
                      <td>{formatDate(source.lastUsed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
