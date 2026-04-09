"""
processor.py — LLM batch processor for InterviewSignal.

Flow:
  1. Fetch unprocessed raw_posts in batches
  2. Send to OpenAI GPT-4o with structured system prompt
  3. Parse JSON response
  4. Deduplicate via question_hash (sha256 of normalized question)
  5. Upsert into questions collection
  6. Mark raw_post as processed
"""

import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
import requests
from openai import OpenAI
from pymongo.errors import DuplicateKeyError

from db import ensure_indexes, get_questions_collection, get_raw_posts_collection

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────
BATCH_SIZE = 5          # posts per OpenAI call
MODEL = os.environ["AI_MODEL"]
MAX_TOKENS = 2048
RETRY_MAX = 3
RETRY_DELAY = 5.0       # seconds base delay for API retries

# ─── System Prompt (exact as specified) ──────────────────────────────────────
SYSTEM_PROMPT = """You are an expert technical interview data extraction and enrichment engine.

Your task is to extract structured technical interview questions from raw interview experience posts, then enrich each question with a problem link and description using your knowledge.

---

## STEP 1 — EXTRACT

Carefully read the post and extract ONLY real technical interview questions asked during interviews.

Rules:
* Extract coding, system design, AND conceptual questions. SKIP behavioral/HR questions entirely.
* Normalize vague references into standard problem names:
  - "they asked about LRU" → "LRU Cache"
  - "binary search variation" → "Search in Rotated Sorted Array"
  - "how garbage collection works" → "Understanding JVM Garbage Collection"
* Do NOT hallucinate or invent questions not present in the post.
* If no valid technical questions are found, return an empty array.

---

## STEP 2 — ENRICH EACH QUESTION

For every extracted question, you MUST do the following:

### 2a. Company Name
* The company field MUST be the name of a REAL, WELL-KNOWN TECH/BUSINESS COMPANY that is mentioned as the interviewing/hiring company in the post.
* IMPORTANT: Do NOT put any of the following in the company field:
  - Programming concepts (e.g. "Graph", "Immutable", "Recursion")
  - Data structures (e.g. "Array", "HashMap", "Tree")
  - Technologies (e.g. "Docker", "Kubernetes", "REST API")
  - Question topics, tags, or categories of any kind
* NORMALIZATION RULES (apply exact casing as used in tech industry):
  - "Linkedin" or "linkedIn" → "LinkedIn"
  - "Goldman" or "GS" → "Goldman Sachs"
  - "JPMorgan" or "JPMC" → "JPMorgan Chase"
  - "Amazon India" → "Amazon", "Google Bangalore" → "Google"
  - "Facebook" → "Meta"
  - "TCS" or "Tcs Prime" → "TCS"
  - "Phonepe" or "Phone pe" → "PhonePe"
* If UNSURE or the company is not explicitly named → return null.

### 2b. Title
* Use the canonical, well-known name of the problem or concept.
* Examples: "LRU Cache", "Median of Two Sorted Arrays", "Design Rate Limiter", "CAP Theorem"

### 2c. Description
* For CODING and DESIGN questions: Write 2-3 clear sentences describing what the problem asks. Be specific and technical.
  - Example: "Given a data structure that follows LRU eviction policy, implement get and put operations in O(1) time."
* For CONCEPTUAL questions: Extract and use the EXACT relevant explanation or description from the original post content — do NOT paraphrase or generate your own text. Copy the most relevant sentences directly from the post.

### 2d. Problem Link (MANDATORY — you MUST provide a URL)
You MUST always provide a direct URL using your vast internal knowledge base. null is only acceptable if NO known resource exists anywhere.

For CODING questions:
1. First, search your knowledge base for an exact match on LeetCode (standard or premium).
2. If not available on LeetCode, act as a web search and return the closest/similar coding problem link available on the web from any reputable platform (e.g., GeeksForGeeks, HackerRank, CodingNinjas, InterviewBit, algo.monster).

For DESIGN questions:
1. Do a simulated web search in your knowledge base and return the most similar/exact/closest system design question link available on the web (e.g., HelloInterview, GeeksForGeeks, algo.monster, interviewready.io, algomaster.io, codewitharyan.com/system-design).

For CONCEPTUAL questions:
1. Provide a direct link to a high-quality web article or resource preferably GeeksForGeeks or InterviewBit(e.g., official docs, reputable engineering blogs, medium article) that thoroughly explains the concept.

Rules:
* Use your training knowledge to provide a correct, real URL.
* Only provide URLs you are highly confident actually exist.
* Do NOT invent URLs. If unsure of the exact slug, use the closest parent page URL.
* Return null ONLY for completely obscure questions with no online resource anywhere.

### 2e. Classification
* "CODING" → algorithmic problems, data structures, implementation, LeetCode-style DSA problems (e.g. "Two Sum", "LRU Cache", "Binary Search")
* "DESIGN" → system design, LLD (Low Level Design), HLD (High Level Design), scalability, distributed systems architecture
* "CONCEPTUAL" → conceptual theory questions, language-specific internals, OS concepts, database internals, networking, runtime behavior (e.g. "How does GC work?", "Explain CAP theorem", "What is DDL vs DML?", "REST API concepts")

⚠️ IMPORTANT: If a question is about a concept or theory (not a specific coding problem to solve), classify it as CONCEPTUAL — NOT CODING.

---

## OUTPUT FORMAT (STRICT JSON)

Return ONLY valid JSON. The response MUST be an object with a "results" key containing exactly one element per input post:

{
  "results": [
    {
      "company": "Company name only (no region)",
      "questions": [
        {
          "title": "Canonical problem title",
          "description": "2-3 sentence technical description of the problem.",
          "type": "CODING | DESIGN | CONCEPTUAL",
          "tags": ["array", "dp", "graph", etc.],
          "difficulty": "easy | medium | hard | unknown",
          "problem_link": "https://... (required, null only if truly unknown)"
        }
      ]
    }
  ]
}

---

## EDGE CASES

* If company not explicitly mentioned as the HIRING company → "company": null (never put concept names here)
* Remove exact duplicates within a post
* Maximum 10 questions per post
* Limit to meaningful technical questions only"""


# ─── Normalization & Hashing ─────────────────────────────────────────────────

def normalize_question(q: str) -> str:
    """Lowercase, strip whitespace, remove punctuation for hashing."""
    q = q.lower().strip()
    q = re.sub(r"[^\w\s]", "", q)   # remove punctuation
    q = re.sub(r"\s+", " ", q)      # collapse whitespace
    return q


def compute_hash(question: str) -> str:
    normalized = normalize_question(question)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ─── OpenAI Calling ──────────────────────────────────────────────────────────

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def call_openai(posts_batch: list[dict]) -> Optional[list[dict]]:
    """
    Send a batch of raw posts to OpenAI.
    Returns a list of (post, parsed_result) or None on failure.
    """
    # Build combined user message with separator
    parts = []
    for i, post in enumerate(posts_batch):
        parts.append(
            f"=== POST {i+1} ===\n"
            f"Title: {post['title']}\n"
            f"Company hint: {post.get('company') or 'unknown'}\n\n"
            f"{post['content'][:3000]}"   # truncate very long posts
        )
    user_message = "\n\n".join(parts)

    for attempt in range(RETRY_MAX):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Extract interview questions from the following {len(posts_batch)} post(s). "
                            f"Return a JSON object with a 'results' array where each element corresponds to one post, "
                            f"following the schema exactly. You MUST return exactly {len(posts_batch)} elements in the array.\n\n{user_message}"
                        ),
                    },
                ],
                max_tokens=MAX_TOKENS,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            parsed = json.loads(raw)

            # Normalize: API may return array or object with "results" key
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, dict) and "results" in parsed:
                return parsed["results"]
            # Single post response wrapped in object
            if isinstance(parsed, dict) and "questions" in parsed:
                return [parsed]
            return None

        except json.JSONDecodeError as e:
            print(f"  ⚠️  JSON parse error (attempt {attempt+1}): {e}")
        except Exception as e:
            print(f"  ⚠️  OpenAI error (attempt {attempt+1}): {e}")

        delay = RETRY_DELAY * (2 ** attempt)
        print(f"  Retrying in {delay}s…")
        time.sleep(delay)

    return None


# ─── Tavily Fallback ─────────────────────────────────────────────────────────

def search_tavily(title: str, q_type: str) -> Optional[str]:
    """Fallback search if GPT cannot find a valid problem link."""
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return None
        
    query = title
    if q_type == "CODING":
        query = f"(site:leetcode.com OR site:geeksforgeeks.org OR site:hackerrank.com OR site:codingninjas.com OR site:interviewbit.com OR site:algo.monster) {title} coding problem"
    elif q_type == "DESIGN":
        query = f"(site:hellointerview.com OR site:geeksforgeeks.org OR site:algo.monster OR site:interviewready.io OR site:algomaster.io OR site:codewitharyan.com) system design {title}"
    elif q_type == "CONCEPTUAL":
        query = f"(site:geeksforgeeks.org OR site:interviewbit.com OR site:medium.com) {title} explanation"

    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": 1,
            },
            timeout=10
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            if results:
                return results[0].get("url")
    except Exception as e:
        print(f"  ⚠️ Tavily search failed for '{title}': {e}")
    return None


# ─── Saving Questions ─────────────────────────────────────────────────────────

def save_questions(result: dict, source_post_url: str, fallback_company: Optional[str], posted_at: Optional[str] = None) -> int:
    """Upsert extracted questions into MongoDB; return count of new questions saved."""
    q_col = get_questions_collection()
    questions = result.get("questions", [])
    company = result.get("company") or fallback_company
    saved = 0

    for q in questions:
        title = (q.get("title") or q.get("question", "")).strip()
        if not title or len(title) < 3:
            continue

        q_hash = compute_hash(title)
        
        problem_link = q.get("problem_link")
        if not problem_link or str(problem_link).lower() == "null":
            tavily_link = search_tavily(title, q.get("type", "CODING"))
            if tavily_link:
                problem_link = tavily_link

        doc = {
            "company": company,
            "title": title,
            "description": q.get("description") or None,
            "type": q.get("type", "CODING"),
            "tags": q.get("tags", []),
            "difficulty": q.get("difficulty", "unknown"),
            "problem_link": problem_link or None,
            "source_post_url": source_post_url,
            "question_hash": q_hash,
            "posted_at": posted_at,
            "created_at": datetime.now(timezone.utc),
        }

        try:
            q_col.insert_one(doc)
            saved += 1
        except DuplicateKeyError:
            pass  # Already exists, skip silently

    return saved


# ─── Main Processing Loop ─────────────────────────────────────────────────────

def process_batch(posts: list[dict]) -> tuple[int, int]:
    """
    Process a batch of raw posts via OpenAI, then save extracted questions.

    Deduplication guarantees:
    ─ raw_posts.post_url has a unique index → scraper never inserts the same URL twice.
    ─ run_processor() queries {"processed": False} → posts are never re-sent to OpenAI.
    ─ After processing (success OR permanent failure), processed=True is set → post leaves queue.
    ─ questions.question_hash has a unique index → identical questions from different posts are dropped.
    """
    results = call_openai(posts)
    raw_col = get_raw_posts_collection()

    if results is None:
        # OpenAI failed after all retries — mark posts as processed so they don't loop forever
        print(f"  ❌ OpenAI permanently failed for batch of {len(posts)} posts — marking as processed to avoid infinite retry.")
        for post in posts:
            raw_col.update_one(
                {"_id": post["_id"]},
                {"$set": {"processed": True, "llm_failed": True}}
            )
        return 0, 0

    total_questions = 0

    for i, post in enumerate(posts):
        result = results[i] if i < len(results) else {}
        if not isinstance(result, dict):
            result = {}

        n_saved = save_questions(result, post["post_url"], post.get("company"), post.get("posted_at"))
        total_questions += n_saved

        # Mark post as processed — will never be sent to OpenAI again
        raw_col.update_one(
            {"_id": post["_id"]},
            {"$set": {"processed": True}}
        )
        print(f"  ✅ Post processed: {post['title'][:50]} → {n_saved} questions saved")

    return total_questions, len(posts)



def run_processor():
    ensure_indexes()
    raw_col = get_raw_posts_collection()

    total_q = 0
    total_p = 0

    # Fetch all unprocessed posts
    cursor = raw_col.find({"processed": False}).sort("created_at", 1)
    batch = []

    for post in cursor:
        batch.append(post)
        if len(batch) >= BATCH_SIZE:
            print(f"\n🔄 Processing batch of {len(batch)} posts…")
            q, p = process_batch(batch)
            total_q += q
            total_p += p
            batch = []
            time.sleep(2)  # Rate limiting

    # Process remaining
    if batch:
        print(f"\n🔄 Processing final batch of {len(batch)} posts…")
        q, p = process_batch(batch)
        total_q += q
        total_p += p

    print(f"\n🎉 Processor done! Posts processed: {total_p}, Questions saved: {total_q}")


if __name__ == "__main__":
    run_processor()
