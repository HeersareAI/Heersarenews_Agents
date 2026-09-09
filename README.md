# AI Multi News Analysis System

An eight-agent workflow for turning a news topic into a verified briefing, sentiment report, poster brief, social copy, and editor-approved output.

## Workflow

`Search → Research → Fact Check + Sentiment → Writer → Social → Poster → Editor`

## Production stack

- Next.js and TypeScript
- MongoDB for job history
- Inngest for durable orchestration
- OpenAI for analysis and writing
- Vercel Blob for generated poster assets

## Start here

1. Copy `.env.example` to `.env.local` and set the required values.
2. Install dependencies: `npm install`.
3. Run the application: `npm run dev`.
4. Run Inngest locally in another terminal: `npx inngest-cli@latest dev`.

## Important routes

- `POST /api/jobs` creates and dispatches a news analysis job.
- `GET /api/jobs` lists jobs (paginated via `?page=&limit=`).
- `GET /api/jobs/:id` returns a job and its results.
- `POST /api/jobs/:id/cancel` requests cooperative cancellation.
- `POST /api/jobs/:id/retry` creates a retry linked to the original job.
- `GET /api/health` validates the runtime configuration without exposing secrets.
- `PUT /api/settings` persists workspace model and provider preferences.
- `GET /api/settings` reads workspace model and provider preferences.

The implementation deliberately keeps search and model providers behind adapters so the service can be connected to the provider accounts you choose.

## Tests

Run the test suite with Vitest:

```bash
npm test
```

## Deploy to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Add the environment variables from `.env.example` in the Vercel dashboard.
3. Set `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` from your Inngest dashboard.
4. Set the Inngest serve path in your Inngest dashboard to `https://<your-domain>/api/inngest`.
5. Deploy. Vercel will run `next build` and serve the Inngest functions from `/api/inngest`.

> Note: Inngest's production mode does not require `INNGEST_DEV=1`. Remove that variable for production.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string for job history |
| `OPENAI_API_KEY` | OpenAI API key for analysis and image generation |
| `OPENAI_MODEL` | Optional env override for the OpenAI model |
| `NEWS_SEARCH_API_KEY` | Tavily API key for news search |
| `NEWS_SEARCH_PROVIDER` | News search provider (`tavily`) |
| `MOCK_AI_OUTPUTS` | Optional env override to skip OpenAI calls |
| `INNGEST_EVENT_KEY` | Inngest event key for sending events |
| `INNGEST_SIGNING_KEY` | Inngest signing key for production serve |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for poster image hosting |
| `JOB_WEBHOOK_URL` | Optional webhook called on job completed/failed/cancelled |
| `RATE_LIMIT_PER_MINUTE` | Optional per-IP rate limit for job creation (default 10) |
| `LOG_LEVEL` | Optional minimum log level (default `info`) |
