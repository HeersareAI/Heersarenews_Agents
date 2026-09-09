# Production workflow

| Stage | Responsibility | Stored output |
| --- | --- | --- |
| Search | Collect current articles from approved sources | URLs, titles, dates, excerpts |
| Research | Extract events, claims, context and key entities | structured research notes |
| Fact Check | Compare material claims against independent sources | pass status, confidence, warnings |
| Sentiment | Classify source and public tone | positive, neutral, negative shares |
| Writer | Produce an attributed, balanced briefing | headline, summary, full briefing |
| Social | Create concise platform-ready posts | LinkedIn, X, Instagram copy |
| Poster | Generate visual concept and hosted asset | title, subtitle, prompt, image URL |
| Editor | Enforce evidence, clarity and brand standards | score, decision, feedback |

Fact Check and Sentiment run in parallel after Research. The workflow is cancelled cooperatively between stages, preserving partial outputs for audit. Jobs are durable, retryable, and linked to their original run.

## Required implementation services

1. MongoDB collections: `jobs`, `jobEvents`, and `settings`.
2. Inngest event: `news/job.created`, with a concurrency limit of five.
3. OpenAI adapter for structured outputs and the Poster image adapter.
4. News search adapter for a licensed search provider.
5. Vercel Blob adapter for poster images.

Never expose provider tokens to the browser. Validate all required environment variables during application startup, and return safe health state only.
