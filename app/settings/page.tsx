"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  openaiModel: string;
  mockAiOutputs: boolean;
  newsSearchProvider: "tavily";
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load settings");
        return res.json();
      })
      .then((data) => setSettings(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = await res.json();
      setSettings(data);
      setError(null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading settings...</p>;
  if (error && !settings) return <p className="error">{error}</p>;
  if (!settings) return <p className="error">Settings unavailable</p>;

  return (
    <main>
      <aside>
        <div className="brand">
          HEERSARE<span>NEWS</span>
        </div>
        <nav>
          <Link href="/">Dashboard</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/sources">Sources</Link>
          <Link href="/settings" className="selected">
            Settings
          </Link>
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
            <h1>Settings</h1>
            <p>Configure models, providers, and workspace behavior.</p>
          </div>
          <Link href="/" className="secondary button-link">
            New analysis
          </Link>
        </header>

        {error && <p className="error">{error}</p>}
        {success && <p className="good">Settings saved.</p>}

        <div className="grid">
          <article className="panel wide">
            <p className="eyebrow">AI MODEL</p>
            <div className="form-row">
              <label>
                <span>OpenAI model</span>
                <input
                  value={settings.openaiModel}
                  onChange={(e) =>
                    setSettings({ ...settings, openaiModel: e.target.value })
                  }
                  placeholder="gpt-4o"
                  disabled={saving}
                />
              </label>
              <label>
                <span>Use mock AI outputs</span>
                <select
                  value={settings.mockAiOutputs ? "true" : "false"}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      mockAiOutputs: e.target.value === "true",
                    })
                  }
                  disabled={saving}
                >
                  <option value="false">Off — use real OpenAI</option>
                  <option value="true">On — use mock outputs</option>
                </select>
              </label>
            </div>
            <p className="muted small">
              Mock outputs skip OpenAI calls and return deterministic placeholders.
              Useful for testing without spending API credits.
            </p>
          </article>

          <article className="panel wide">
            <p className="eyebrow">NEWS SEARCH PROVIDER</p>
            <div className="form-row">
              <label>
                <span>Provider</span>
                <select
                  value={settings.newsSearchProvider}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      newsSearchProvider: e.target.value as "tavily",
                    })
                  }
                  disabled={saving}
                >
                  <option value="tavily">Tavily</option>
                </select>
              </label>
            </div>
            <p className="muted small">
              API keys are configured via environment variables:
              OPENAI_API_KEY, NEWS_SEARCH_API_KEY, NEWS_SEARCH_PROVIDER.
            </p>
          </article>

          <article className="panel wide">
            <p className="eyebrow">ENVIRONMENT</p>
            <div className="form-row env-readout">
              <ReadOnly label="Node env" value={process.env.NODE_ENV ?? "unknown"} />
              <ReadOnly
                label="Mock AI env override"
                value={process.env.MOCK_AI_OUTPUTS === "true" ? "true" : "false"}
              />
              <ReadOnly
                label="OpenAI model env override"
                value={process.env.OPENAI_MODEL || "not set"}
              />
              <ReadOnly
                label="Search provider env"
                value={process.env.NEWS_SEARCH_PROVIDER || "not set"}
              />
            </div>
            <p className="muted small">
              Environment variables take precedence over these workspace settings.
            </p>
          </article>
        </div>

        <div className="detail-actions">
          <button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </section>
    </main>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="read-only">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
