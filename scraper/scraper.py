"""
scraper.py — LeetCode Discuss GraphQL scraper for interview experience posts.

Uses LeetCode's internal GraphQL API directly — no browser, no Playwright.

Features:
  - Fetches posts via GraphQL (categoryTopicList query)
  - Content is returned inline — no separate detail fetch needed
  - Filters posts by relevant keywords
  - Extracts post_url, title, company, posted_at, content
  - Upserts into MongoDB raw_posts (unique index on post_url prevents dupes)
  - Retry logic: up to 3 attempts with exponential backoff
  - Handles pagination up to MAX_PAGES
"""

import os
import re
import time
from datetime import datetime, timezone
from typing import Optional

import requests
from dotenv import load_dotenv
from pymongo.errors import DuplicateKeyError

from db import ensure_indexes, get_raw_posts_collection

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────
BASE_URL      = "https://leetcode.com"
GRAPHQL_URL   = f"{BASE_URL}/graphql"
KEYWORDS      = [
    "round", "problem solving", "system design", "LLD", "HLD",
    "interview", "experience", "onsite", "phone screen",
    "online assessment", "behavioral",
]
MAX_PAGES      = 10
PAGE_SIZE      = 20
PAGE_DELAY     = 1.5   # seconds between page fetches (polite delay)
RETRY_MAX      = 3
RETRY_BASE_DELAY = 2.0

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://leetcode.com/discuss/",
    "Origin":  "https://leetcode.com",
}

COMPANY_PATTERNS = [
    r"\b(google|amazon|meta|facebook|apple|microsoft|netflix|uber|lyft|airbnb|"
    r"stripe|square|twitter|linkedin|salesforce|adobe|oracle|ibm|intel|nvidia|"
    r"bloomberg|citadel|two sigma|jane street|palantir|bytedance|tiktok|"
    r"doordash|coinbase|robinhood|atlassian|shopify|dropbox|pinterest|snap|"
    r"spotify|databricks|snowflake|confluent|zomato|swiggy|phonepe|paytm|"
    r"flipkart|meesho|razorpay|freshworks|zoho|infosys|wipro|tcs|"
    r"hcl|accenture|capgemini|deloitte|jpmorgan|goldman|morgan stanley|"
    r"optum|united health|walmart|target|instacart|lyft)\b"
]
COMPANY_RE = re.compile("|".join(COMPANY_PATTERNS), re.IGNORECASE)


# ─── GraphQL Query ────────────────────────────────────────────────────────────

LIST_QUERY = """
query categoryTopicList(
  $categories: [String!]!,
  $first: Int!,
  $orderBy: TopicSortingOption,
  $skip: Int,
  $query: String,
  $tags: [String!]
) {
  categoryTopicList(
    categories: $categories
    first: $first
    orderBy: $orderBy
    skip: $skip
    query: $query
    tags: $tags
  ) {
    edges {
      node {
        id
        title
        commentCount
        viewCount
        topLevelCommentCount
        post {
          id
          content
          author { username }
          creationDate
        }
        tags { name slug }
      }
    }
    totalNum
  }
}
"""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def extract_company(text: str) -> Optional[str]:
    match = COMPANY_RE.search(text)
    return match.group(0).title() if match else None


def is_relevant(title: str, content: str = "") -> bool:
    combined = (title + " " + content[:300]).lower()
    return any(kw in combined for kw in KEYWORDS)


# ─── GraphQL Fetcher ─────────────────────────────────────────────────────────

def fetch_topic_list(page_num: int) -> list[dict]:
    """Fetch one page of interview topics from LeetCode GraphQL."""
    skip = (page_num - 1) * PAGE_SIZE
    variables = {
        "categories": ["interview-question"],
        "first": PAGE_SIZE,
        "orderBy": "newest_to_oldest",
        "skip": skip,
        "query": "",
        "tags": [],
    }
    for attempt in range(RETRY_MAX):
        try:
            resp = requests.post(
                GRAPHQL_URL,
                headers=HEADERS,
                json={"query": LIST_QUERY, "variables": variables},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if "errors" in data:
                raise ValueError(f"GraphQL errors: {data['errors']}")
            return data["data"]["categoryTopicList"]["edges"]
        except Exception as e:
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            print(f"  ⚠️  Error fetching page {page_num} (attempt {attempt+1}/{RETRY_MAX}): {e}")
            print(f"     Retrying in {delay}s…")
            time.sleep(delay)
    return []


# ─── Document Builder ─────────────────────────────────────────────────────────

def build_post_doc(node: dict) -> Optional[dict]:
    """Convert a GraphQL topic node to a raw_post MongoDB document."""
    title   = node.get("title", "").strip()
    post    = node.get("post") or {}
    content = (post.get("content") or "").strip()

    if not is_relevant(title, content):
        return None
    if len(content) < 50:
        return None

    topic_id = node["id"]
    post_url  = f"{BASE_URL}/discuss/{topic_id}/"
    company   = extract_company(title) or extract_company(content[:500])

    creation_ts = post.get("creationDate")
    if creation_ts:
        posted_at = datetime.fromtimestamp(int(creation_ts), tz=timezone.utc).isoformat()
    else:
        posted_at = datetime.now(timezone.utc).isoformat()

    return {
        "post_url":   post_url,
        "title":      title,
        "company":    company,
        "content":    content,
        "posted_at":  posted_at,
        "processed":  False,
        "created_at": datetime.now(timezone.utc),
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ensure_indexes()
    col = get_raw_posts_collection()

    total_new     = 0
    total_skipped = 0

    for page_num in range(1, MAX_PAGES + 1):
        print(f"\n📄 Fetching page {page_num} (skip={( page_num - 1) * PAGE_SIZE})…")
        edges = fetch_topic_list(page_num)

        if not edges:
            print(f"  No posts returned on page {page_num}, stopping.")
            break

        page_new = 0
        all_seen = True

        for edge in edges:
            node     = edge["node"]
            topic_id = node["id"]
            post_url = f"{BASE_URL}/discuss/{topic_id}/"

            # Quick existence check before building the full doc
            if col.find_one({"post_url": post_url}, {"_id": 1}):
                total_skipped += 1
                continue

            all_seen = False
            doc = build_post_doc(node)
            if doc is None:
                continue

            try:
                col.insert_one(doc)
                print(f"  ✅ Saved: {doc['title'][:70]}")
                total_new += 1
                page_new  += 1
            except DuplicateKeyError:
                total_skipped += 1

        # If every post on this page was already in DB, stop early
        if all_seen:
            print("  All posts on this page already seen — stopping early.")
            break

        time.sleep(PAGE_DELAY)

    print(f"\n🎉 Done! New posts: {total_new}, Skipped (existing): {total_skipped}")


if __name__ == "__main__":
    main()
