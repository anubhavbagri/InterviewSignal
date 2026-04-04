"""
scraper.py — Playwright async scraper for LeetCode Discuss interview experience posts.

Features:
  - Navigates to LeetCode Discuss /topic/interview category
  - Filters posts by relevant keywords
  - Extracts post_url, title, company, posted_at, content
  - Upserts into MongoDB raw_posts (unique index on post_url prevents dupes)
  - Retry logic: up to 3 attempts with exponential backoff
  - Handles pagination up to MAX_PAGES
"""

import asyncio
import hashlib
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from playwright.async_api import async_playwright, Page, TimeoutError as PwTimeout

from db import ensure_indexes, get_raw_posts_collection

load_dotenv()

# ─── Config ──────────────────────────────────────────────────────────────────
BASE_URL = "https://leetcode.com/discuss/topic/interview/"
KEYWORDS = ["round", "problem solving", "system design", "LLD", "HLD", "interview", "experience", "onsite", "phone screen", "online assessment", "behavioral"]
MAX_PAGES = 10          # pages to paginate through per run
PAGE_DELAY = 3.0        # seconds between page navigations
RETRY_MAX = 3           # max retries per page load
RETRY_BASE_DELAY = 2.0  # seconds (doubled each attempt)

COMPANY_PATTERNS = [
    r"\b(google|amazon|meta|facebook|apple|microsoft|netflix|uber|lyft|airbnb|"
    r"stripe|square|twitter|linkedin|salesforce|adobe|oracle|ibm|intel|nvidia|"
    r"bloomberg|citadel|two sigma|jane street|palantir|bytedance|tiktok|"
    r"doordash|coinbase|robinhood|atlassian|shopify|dropbox|pinterest|snap|"
    r"spotify|databricks|snowflake|confluent)\b"
]
COMPANY_RE = re.compile("|".join(COMPANY_PATTERNS), re.IGNORECASE)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def extract_company(text: str) -> Optional[str]:
    match = COMPANY_RE.search(text)
    if match:
        return match.group(0).title()
    return None


def is_relevant(title: str) -> bool:
    title_lower = title.lower()
    return any(kw in title_lower for kw in KEYWORDS)


async def retry_goto(page: Page, url: str, max_attempts: int = RETRY_MAX) -> bool:
    """Navigate to URL with exponential backoff retry."""
    for attempt in range(max_attempts):
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            return True
        except PwTimeout:
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            print(f"  ⚠️  Timeout on {url} (attempt {attempt+1}/{max_attempts}), retrying in {delay}s…")
            await asyncio.sleep(delay)
        except Exception as e:
            delay = RETRY_BASE_DELAY * (2 ** attempt)
            print(f"  ⚠️  Error on {url}: {e} (attempt {attempt+1}/{max_attempts}), retrying in {delay}s…")
            await asyncio.sleep(delay)
    return False


# ─── Scraper Core ─────────────────────────────────────────────────────────────

async def scrape_post_list(page: Page, page_num: int) -> list[dict]:
    """Scrape the list page and return post stubs [{url, title}]."""
    url = f"{BASE_URL}?currentPage={page_num}&orderBy=newest_to_oldest"
    print(f"\n📄 Fetching list page {page_num}: {url}")

    ok = await retry_goto(page, url)
    if not ok:
        print(f"  ❌ Failed to load list page {page_num}, skipping.")
        return []

    # Wait for post cards to load
    try:
        await page.wait_for_selector("a[href*='/discuss/post/']", timeout=15_000)
    except PwTimeout:
        # Try alternative selector
        try:
            await page.wait_for_selector("a[href*='/discuss/']", timeout=10_000)
        except PwTimeout:
            print(f"  ❌ Selectors timed out on page {page_num}")
            return []

    # Extract post links and titles
    posts = await page.evaluate("""
        () => {
            const results = [];
            // LeetCode discuss post cards
            const links = document.querySelectorAll('a[href*="/discuss/post/"], a[href*="/discuss/topic/"]');
            links.forEach(a => {
                const href = a.getAttribute('href');
                let title = '';
                // The title is sometimes in an inner element
                const titleSpan = a.querySelector('.truncate, .font-medium, .text-sm, .text-base');
                if (titleSpan) {
                    title = titleSpan.innerText?.trim();
                } else if (a.innerText) {
                    title = a.innerText?.trim();
                }
                
                if (href && title && href.includes('/discuss/') && title.length > 5 && !href.includes('/interview-question/')) {
                    const fullUrl = href.startsWith('http') ? href : 'https://leetcode.com' + href;
                    results.push({ url: fullUrl, title: title });
                }
            });
            return results;
        }
    """)

    # Deduplicate by URL on list level
    seen = set()
    unique = []
    for p in posts:
        if p["url"] not in seen:
            seen.add(p["url"])
            unique.append(p)

    relevant = [p for p in unique if is_relevant(p["title"])]
    print(f"  Found {len(unique)} posts, {len(relevant)} relevant to interview experience.")
    return relevant


async def scrape_post_content(page: Page, post_url: str, title: str) -> Optional[dict]:
    """Navigate to individual post and extract full content."""
    print(f"  🔍 Scraping: {title[:60]}…")
    ok = await retry_goto(page, post_url)
    if not ok:
        print(f"    ❌ Failed to load post: {post_url}")
        return None

    try:
        await page.wait_for_selector("div.discuss-markdown-container, div[class*='content-'], article", timeout=15_000)
    except PwTimeout:
        pass  # Try to extract anyway

    data = await page.evaluate("""
        () => {
            // Content selectors in order of preference
            const selectors = [
                'div[class*="markdown"]',
                '.content',
                'div.discuss-markdown-container',
                'div[class*="content-"]',
                'div.content__QRGW',
                'article',
                'div[class*="post-content"]',
            ];
            let content = '';
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) { content = el.innerText?.trim(); break; }
            }

            // Attempt to extract date
            const timeEl = document.querySelector('time, span[class*="time"], span[class*="ago"]');
            const postedAt = timeEl ? (timeEl.getAttribute('datetime') || timeEl.textContent?.trim()) : null;

            return { content, postedAt };
        }
    """)


    content = data.get("content", "").strip()
    if not content or len(content) < 50:
        print(f"    ⚠️  No substantial content found, skipping.")
        return None

    company = extract_company(title) or extract_company(content[:500])
    posted_at = data.get("postedAt") or datetime.now(timezone.utc).isoformat()

    return {
        "post_url": post_url,
        "title": title,
        "company": company,
        "content": content,
        "posted_at": posted_at,
        "processed": False,
        "created_at": datetime.now(timezone.utc),
    }


async def upsert_raw_post(doc: dict) -> bool:
    """Insert post into MongoDB, skip if already exists."""
    col = get_raw_posts_collection()
    try:
        col.insert_one(doc)
        return True
    except Exception as e:
        if "duplicate key" in str(e).lower() or "E11000" in str(e):
            return False  # Already exists
        raise


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    ensure_indexes()
    col = get_raw_posts_collection()

    total_new = 0
    total_skipped = 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        list_page = await context.new_page()
        detail_page = await context.new_page()

        for page_num in range(1, MAX_PAGES + 1):
            post_stubs = await scrape_post_list(list_page, page_num)
            if not post_stubs:
                print(f"  No posts on page {page_num}, stopping pagination.")
                break

            for stub in post_stubs:
                post_url = stub["url"]
                title = stub["title"]

                # Quick existence check before full scrape
                if col.find_one({"post_url": post_url}, {"_id": 1}):
                    total_skipped += 1
                    continue

                doc = await scrape_post_content(detail_page, post_url, title)
                if doc:
                    inserted = await upsert_raw_post(doc)
                    if inserted:
                        print(f"    ✅ Saved: {title[:50]}")
                        total_new += 1
                    else:
                        total_skipped += 1

                await asyncio.sleep(1.5)  # polite delay between posts

            await asyncio.sleep(PAGE_DELAY)

        await browser.close()

    print(f"\n🎉 Done! New posts: {total_new}, Skipped (existing): {total_skipped}")


if __name__ == "__main__":
    asyncio.run(main())
