# InterviewSignal

> Real interview questions from real candidates — not practice problems.

InterviewSignal scrapes interview experience posts from LeetCode Discuss via their internal GraphQL API, extracts structured questions using GPT-4o, deduplicates them, and surfaces them in a searchable, filterable UI.

---

## Architecture

```
[GraphQL Scraper (Python + requests)]
        ↓  cron / push to scraper/ (GitHub Actions)
[MongoDB Atlas — raw_posts]
        ↓  LLM batch processor (OpenAI) + Tavily Fallback Search
[MongoDB Atlas — questions]
        ↓
[Next.js API Routes]
        ↓
[Frontend UI — /recent-questions?company=Amazon]
```

---

## Project Structure

```
InterviewSignal/
├── frontend/                          # Next.js app (App Router + Tailwind CSS v4)
│   ├── app/
│   │   ├── api/
│   │   │   ├── questions/route.ts     # GET /api/questions
│   │   │   ├── companies/route.ts     # GET /api/companies
│   │   │   └── stats/route.ts         # GET /api/stats
│   │   ├── recent-questions/
│   │   │   ├── page.tsx
│   │   │   └── RecentQuestionsContent.tsx
│   │   ├── icon.tsx                   # Dynamic Zap favicon (ImageResponse)
│   │   ├── not-found.tsx              # 404 page
│   │   ├── layout.tsx
│   │   └── page.tsx                   # Redirects → /recent-questions
│   ├── components/
│   │   ├── CompanySelector.tsx        # Searchable dropdown
│   │   ├── QuestionTable.tsx          # Table (desktop) + cards (mobile)
│   │   ├── QuestionModal.tsx          # Description + links modal
│   │   └── TypeBadge.tsx              # CODING / DESIGN / CONCEPTUAL badge
│   └── lib/
│       ├── mongodb.ts                 # Singleton MongoClient
│       ├── types.ts                   # Shared TypeScript interfaces
│       └── utils.ts
├── scraper/
│   ├── scraper.py                     # GraphQL HTTP scraper (no browser)
│   ├── processor.py                   # OpenAI LLM batch processor + Tavily Integration
│   ├── manual_company_scraper.py      # Interactive CLI scraper for specific companies
│   ├── db.py                          # MongoDB connection + indexes
│   ├── .env.example
│   └── requirements.txt
└── .github/
    └── workflows/
        └── scrape.yml                 # Cron job — only triggers on scraper/ changes
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
|------|---------|-----------|
| `frontend/.env.local` | Next.js | `MONGODB_URI`, `MONGODB_DB_NAME` |
| `scraper/.env` | Python scripts | `MONGODB_URI`, `MONGODB_DB_NAME`, `OPENAI_API_KEY`, `AI_MODEL`, `TAVILY_API_KEY` |

### 1. MongoDB Atlas

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create a database named `interviewsignal`
3. Create a DB user and whitelist `0.0.0.0/0` (required for GitHub Actions)
4. Copy the connection string into both `.env` files

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

No browser installation required — the scraper uses LeetCode's internal GraphQL API over plain HTTP.

```bash
cd scraper
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in MONGODB_URI, OPENAI_API_KEY, and AI_MODEL in .env

# Step 1: Fetch posts from LeetCode Discuss → raw_posts collection
python scraper.py

# Step 2: Extract & structure questions via GPT → questions collection
python processor.py

# Alternative: Fetch & process a specific company interactively
python manual_company_scraper.py
```

---

## API Routes

| Route | Params | Description |
|-------|--------|-------------|
| `GET /api/questions` | `company`, `page`, `limit` | Paginated question list |
| `GET /api/companies` | — | Distinct company list |
| `GET /api/stats` | — | Total question + company counts |

---

## Deployment

### Frontend → Vercel

1. Push the repo to GitHub
2. Import the `frontend/` folder at [vercel.com](https://vercel.com) (set root directory to `frontend`)
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
| `AI_MODEL` | e.g. `gpt-4o-mini` |
| `TAVILY_API_KEY` | Your Tavily Search API key |

The workflow runs on two schedules with a randomized delay (up to 30 min) to avoid predictable scraping patterns:

| Schedule | Time |
|----------|------|
| Daily | ~02:00 UTC |
| Mid-week refresh | ~14:00 UTC every Wednesday |

> **Note**: The workflow only triggers on push when files inside `scraper/` or the workflow file itself change. Frontend-only commits do not start the scraper.

---

## Deduplication

Three layers prevent re-processing and duplicate storage:

1. **Scraper** — `raw_posts.post_url` has a unique index; scraper skips URLs already in the collection.
2. **Processor** — queries `{ processed: false }` so each post is sent to the LLM exactly once. After processing (success **or** permanent failure), the post is marked `processed: true`.
3. **Questions** — `questions.question_hash` (SHA-256 of the normalized title) has a unique index; identical questions from different posts are silently dropped.

```
question_hash = sha256(lowercase(strip(remove_punctuation(title))))
```

---

## MongoDB Schema

### `raw_posts`

| Field | Type | Notes |
|-------|------|-------|
| `post_url` | string | unique index |
| `title` | string | |
| `company` | string \| null | inferred from title/content |
| `content` | string | full post body |
| `posted_at` | string | |
| `processed` | boolean | `false` until LLM runs |
| `llm_failed` | boolean | set if all OpenAI retries fail |
| `created_at` | datetime | |

### `questions`

| Field | Type | Notes |
|-------|------|-------|
| `company` | string \| null | normalized — no region suffix |
| `title` | string | canonical problem name |
| `description` | string \| null | 2–3 sentence technical description |
| `type` | `CODING` \| `DESIGN` \| `CONCEPTUAL` | |
| `tags` | string[] | |
| `difficulty` | `easy` \| `medium` \| `hard` \| `unknown` | |
| `problem_link` | string \| null | Direct linking to articles or reputable prep sites |
| `source_post_url` | string | link to original LeetCode Discuss post |
| `question_hash` | string | unique index |
| `posted_at` | string \| null | |
| `created_at` | datetime | |

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Database**: MongoDB Atlas
- **Scraper**: Python 3.11, `requests` (GraphQL over HTTP — no browser)
- **AI**: OpenAI GPT-4o / GPT-4o-mini
- **Deployment**: Vercel (frontend), GitHub Actions (scraper cron)
