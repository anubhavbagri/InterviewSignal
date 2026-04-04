# InterviewSignal

> Real interview questions from real candidates — not practice problems.

InterviewSignal aggregates interview experience posts from LeetCode Discuss, extracts structured questions using GPT-4o, deduplicates them, and surfaces them via a filterable UI.

---

## Architecture

```
[Playwright Scraper (Python)]
        ↓  daily cron (GitHub Actions)
[MongoDB Atlas — raw_posts]
        ↓  LLM batch processor
[MongoDB Atlas — questions]
        ↓
[Next.js API Routes]
        ↓
[Frontend UI — /recent-questions]
```

---

## Project Structure

```
InterviewSignal/
├── frontend/           # Next.js app (App Router + Tailwind + shadcn/ui)
│   ├── app/
│   │   ├── api/
│   │   │   ├── questions/route.ts   # GET /api/questions
│   │   │   ├── companies/route.ts   # GET /api/companies
│   │   │   └── recent/route.ts      # GET /api/recent
│   │   ├── recent-questions/
│   │   │   ├── page.tsx
│   │   │   └── RecentQuestionsContent.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx                 # redirects → /recent-questions
│   ├── components/
│   │   ├── FilterBar.tsx
│   │   ├── QuestionTable.tsx
│   │   ├── StatsBar.tsx
│   │   └── TypeBadge.tsx
│   └── lib/
│       ├── mongodb.ts               # singleton client
│       └── types.ts                 # shared TypeScript interfaces
├── scraper/
│   ├── scraper.py                   # Playwright async scraper
│   ├── processor.py                 # OpenAI LLM batch processor
│   ├── db.py                        # MongoDB connection + indexes
│   └── requirements.txt
└── .github/
    └── workflows/
        └── scrape.yml               # Daily cron job
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| MongoDB Atlas | Free tier M0 |
| OpenAI API | GPT-4o access |

---

## Setup

### Environment Variables

There are **two** `.env` files — one per subsystem. There is no root-level env file.

| File | Used by | Variables |
|------|---------|----------|
| `frontend/.env.local` | Next.js | `MONGODB_URI`, `MONGODB_DB_NAME` |
| `scraper/.env` | Python scripts | `MONGODB_URI`, `MONGODB_DB_NAME`, `OPENAI_API_KEY` |

### 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database named `interviewsignal`
3. Create a DB user and whitelist your IP (or `0.0.0.0/0` for GitHub Actions)
4. Copy the connection string

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in MONGODB_URI in .env.local

npm install
npm run dev
# → http://localhost:3000
```

### 3. Scraper

```bash
cd scraper
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

cp .env.example .env
# Fill in MONGODB_URI and OPENAI_API_KEY in .env

# Run scraper (fetches posts from LeetCode)
python scraper.py

# Run LLM processor (extracts questions via GPT-4o)
python processor.py
```

---

## API Routes

| Route | Params | Description |
|-------|--------|-------------|
| `GET /api/questions` | `company`, `type`, `page`, `limit` | Paginated question list |
| `GET /api/companies` | — | Distinct company list |
| `GET /api/recent` | `limit` | Latest questions |

---

## Deployment

### Frontend → Vercel

1. Push the repo to GitHub
2. Import the `frontend/` folder at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME` = `interviewsignal`

### Scraper → GitHub Actions

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|--------|-------|
| `MONGODB_URI` | Your Atlas connection string |
| `MONGODB_DB_NAME` | `interviewsignal` |
| `OPENAI_API_KEY` | Your OpenAI key |

The workflow (`.github/workflows/scrape.yml`) runs daily at 01:00 UTC. You can also trigger it manually via the GitHub Actions UI.

---

## Deduplication

Questions are deduplicated using a SHA-256 hash of the normalized question text:

```
question_hash = sha256(lowercase(strip(remove_punctuation(question))))
```

A unique index on `question_hash` in MongoDB prevents any duplicates from being stored, even if the same question appears in multiple interview posts.

---

## MongoDB Schema

### `raw_posts`
| Field | Type | Notes |
|-------|------|-------|
| `post_url` | string | unique index |
| `title` | string | |
| `company` | string \| null | inferred from text |
| `content` | string | full post body |
| `posted_at` | string | |
| `processed` | boolean | false until LLM processed |
| `created_at` | datetime | |

### `questions`
| Field | Type | Notes |
|-------|------|-------|
| `company` | string \| null | |
| `question` | string | normalized |
| `type` | DSA \| SYSTEM_DESIGN \| BEHAVIORAL | |
| `tags` | string[] | |
| `difficulty` | easy \| medium \| hard \| unknown | |
| `source_post_url` | string | link back to LeetCode post |
| `question_hash` | string | unique index |
| `created_at` | datetime | |

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Database**: MongoDB Atlas
- **Scraper**: Python 3.11, Playwright (async)
- **AI**: OpenAI GPT-4o
- **Deployment**: Vercel (frontend), GitHub Actions (scraper cron)
