# Lead Enrichment Dashboard

A production-minded MVP for LinkedIn lead enrichment with a server-side provider waterfall, PostgreSQL cache, admin cost controls, and protected lookup history.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style local components
- Prisma
- PostgreSQL on Supabase
- NextAuth credentials login
- Server-side API routes only for provider calls

## What It Does

- Enriches a LinkedIn profile URL from `/`.
- Checks the database cache before calling providers.
- Runs a configurable provider waterfall: Proxycurl, Apollo, Hunter, People Data Labs, then optional Twilio phone validation.
- Skips providers with missing API keys and logs the skip.
- Supports local mock mode with deterministic demo data.
- Tracks provider calls, returned fields, errors, cost, and budget skips.
- Lets admins enable providers, set priority, set cost, and configure daily/monthly budget limits.
- Provides `/history` with search and CSV export.

## Environment Variables

Copy `.env.example` to `.env.local` for local development and set the real values in Vercel.

```bash
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD=

PROXYCURL_API_KEY=
APOLLO_API_KEY=
HUNTER_API_KEY=
PDL_API_KEY=

DROPCONTACT_API_KEY=
SNOV_CLIENT_ID=
SNOV_CLIENT_SECRET=
FINDYMAIL_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
MOCK_PROVIDER_MODE=true
```

Keep `MOCK_PROVIDER_MODE=true` locally if you want the MVP to return sample enrichment data without paid provider keys. Set it to `false` in production unless you intentionally want demo data.

## Local Setup

```bash
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

For local Docker Postgres, use:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lead_enrichment?schema=public"
```

## Supabase Setup

1. Create a Supabase project.
2. Copy the pooled PostgreSQL connection string into `DATABASE_URL`.
3. Run `npm run prisma:deploy` locally or as a Vercel build/deploy step.
4. Add all required environment variables in Vercel Project Settings.

The initial migration is checked in at `prisma/migrations/20260514000000_init/migration.sql`.

## API Routes

- `POST /api/enrich`
- `GET /api/leads`
- `GET /api/leads/[id]`
- `GET /api/cost-summary`
- `GET /api/provider-logs`
- `GET /api/admin/provider-config`
- `POST /api/admin/provider-config`
- `PATCH /api/admin/provider-config/[id]`
- `GET /api/export/leads`

Admin routes require a NextAuth session. Provider API keys are only read from server-side code.

## Provider Notes

The adapters normalize provider responses into the same lead shape. Real API calls are implemented for Proxycurl, Apollo, Hunter, PDL, and Twilio Lookup, but each provider API can evolve, so validate payload mappings against your provider plan before production spend.

Twilio is only used to validate a phone number that an enrichment provider already returned. It does not discover phone numbers.

## Deploying to Vercel

1. Push this repository to GitHub.
2. Import the GitHub repo in Vercel.
3. Set the environment variables from `.env.example`.
4. Use the default build command: `npm run build`.
5. Run database migrations with `npm run prisma:deploy` before the first production request.

## AWS-Ready Architecture

The app keeps provider calls behind route handlers, stores state in PostgreSQL, and keeps secrets in environment variables. The same structure can move to AWS Amplify, ECS/Fargate, or Lambda behind API Gateway with RDS PostgreSQL by replacing Vercel hosting and updating `DATABASE_URL`.

## Limitations

- Rate limiting is in-memory for MVP simplicity. Use Redis, Upstash, or an API gateway limiter for multi-instance production deployments.
- Provider mappings are intentionally conservative and should be verified against paid account response payloads.
- Password auth uses `ADMIN_PASSWORD` from env for speed of shipping. Use hashed credentials or an identity provider for larger teams.
