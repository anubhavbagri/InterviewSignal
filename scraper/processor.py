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
SYSTEM_PROMPT = """You are an expert technical interview data extraction engine.

Your task is to extract structured interview questions from raw interview experience posts written by candidates.

The input will be an unstructured text describing an interview process. The text may include noise, storytelling, irrelevant details, or incomplete information.

You must carefully read and extract ONLY actual interview questions or clearly implied questions.

---

## STRICT INSTRUCTIONS

1. Extract ONLY real interview questions asked during interviews.
2. Ignore:
   * candidate opinions
   * preparation tips
   * generic statements
   * repeated content
3. If a question is implied but clear, normalize it into a proper question format.
4. Do NOT hallucinate or invent questions.
5. If no valid questions are found, return an empty array.

---

## CLASSIFICATION

For each question, classify into ONE:

* "DSA" → coding, algorithms, data structures
* "SYSTEM_DESIGN" → scalability, architecture, distributed systems
* "BEHAVIORAL" → HR, past experience, teamwork

---

## NORMALIZATION RULES

* Convert statements into proper question form:
  Example:
  "they asked about LRU cache"
  → "Design an LRU Cache"

* Keep questions concise and standardized

---

## OUTPUT FORMAT (STRICT JSON)

Return ONLY valid JSON. The response MUST be an object with a "results" key containing an array of objects (one for each input post), following this schema:

{
  "results": [
    {
      "company": "string or null",
      "questions": [
        {
          "question": "string",
          "type": "DSA | SYSTEM_DESIGN | BEHAVIORAL",
          "tags": ["optional", "keywords"],
          "difficulty": "easy | medium | hard | unknown"
        }
      ]
    }
  ]
}

---

## TAGGING GUIDELINES

* Add relevant tags:
  * DSA: array, graph, dp, tree, hashmap
  * System Design: scalability, caching, database, load-balancing
  * Behavioral: leadership, conflict, ownership

---

## EDGE CASES

* If company not explicitly mentioned → return null
* Remove duplicates
* Limit to meaningful questions only"""


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


# ─── Saving Questions ─────────────────────────────────────────────────────────

def save_questions(result: dict, source_post_url: str, fallback_company: Optional[str]) -> int:
    """Upsert extracted questions into MongoDB; return count of new questions saved."""
    q_col = get_questions_collection()
    questions = result.get("questions", [])
    company = result.get("company") or fallback_company
    saved = 0

    for q in questions:
        question_text = q.get("question", "").strip()
        if not question_text or len(question_text) < 5:
            continue

        q_hash = compute_hash(question_text)

        doc = {
            "company": company,
            "question": question_text,
            "type": q.get("type", "DSA"),
            "tags": q.get("tags", []),
            "difficulty": q.get("difficulty", "unknown"),
            "source_post_url": source_post_url,
            "question_hash": q_hash,
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
    """Process a batch of raw posts. Returns (questions_saved, posts_processed)."""
    results = call_openai(posts)
    if results is None:
        print(f"  ❌ OpenAI failed for batch of {len(posts)} posts.")
        return 0, 0

    total_questions = 0
    raw_col = get_raw_posts_collection()

    for i, post in enumerate(posts):
        result = results[i] if i < len(results) else {}
        if not isinstance(result, dict):
            result = {}

        n_saved = save_questions(result, post["post_url"], post.get("company"))
        total_questions += n_saved

        # Mark post as processed
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
