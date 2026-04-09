import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

# Import database and LLM functions from existing modules
from db import ensure_indexes, get_raw_posts_collection
from scraper import (
    GRAPHQL_URL, HEADERS, LIST_QUERY, PAGE_SIZE, PAGE_DELAY, RETRY_MAX, RETRY_BASE_DELAY,
    build_post_doc
)
from processor import call_openai, save_questions, BATCH_SIZE

load_dotenv()

def fetch_company_topic_list(company: str, page_num: int) -> list[dict]:
    """Fetch one page of interview topics for a specific company."""
    skip = (page_num - 1) * PAGE_SIZE
    # We pass the company as a tag slug to match the /discuss/topic/{companyName} behavior exactly
    company_slug = company.lower().replace(" ", "-")
    variables = {
        "categories": ["interview-question"],
        "first": PAGE_SIZE,
        "orderBy": "newest_to_oldest",
        "skip": skip,
        "query": "",
        "tags": [company_slug], 
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

def process_batch(batch: list[dict], company_hint: str):
    """Send batch to OpenAI and save results."""
    if not batch:
        return
    
    print(f"\n🧠 Sending batch of {len(batch)} to OpenAI...")
    ai_results = call_openai(batch)
    
    if not ai_results:
        print("❌ AI failed to return usable results.")
        return

    # OpenAI usually returns a list mapped exactly to the batch array
    for i, res in enumerate(ai_results):
        if len(res.get("questions", [])) == 0:
            print(f"   [-] No questions extracted for post: {batch[i]['title']}")
            continue
            
        source_url = batch[i]["post_url"]
        posted_at = batch[i]["posted_at"]
        
        saved_count = save_questions(res, source_url, company_hint, posted_at)
        print(f"   [+] Saved {saved_count} questions for: {batch[i]['title']}")
        
    print("✅ Batch complete.\n")

def main():
    ensure_indexes()
    
    print("="*60)
    print(" 🚀 INTERVIEWSIGNAL MANUAL SCRAPER 🚀")
    print("="*60)
    
    company = input("Enter company name (e.g. Amazon): ").strip()
    if not company:
        print("Company name is required. Exiting.")
        return
        
    page_limit_str = input("Enter max pages to scrape (default 5): ").strip()
    page_limit = int(page_limit_str) if page_limit_str.isdigit() else 5
    
    print(f"\n🔍 Searching for '{company}' (Max pages: {page_limit})...")
    
    raw_col = get_raw_posts_collection()
    batch = []
    total_new = 0
    total_skipped = 0
    
    for page in range(1, page_limit + 1):
        print(f"📄 Fetching page {page}...")
        edges = fetch_company_topic_list(company, page)
        
        if not edges:
            print(f"No more posts found on page {page}. Stopping pagination.")
            break
            
        new_posts_on_page = 0
        
        for edge in edges:
            node = edge.get("node")
            if not node:
                continue
                
            doc = build_post_doc(node)
            if not doc:
                continue
                
            # Check if this precise URL is already stored
            if raw_col.find_one({"post_url": doc["post_url"]}):
                total_skipped += 1
                continue
                
            # Mark it immediately as processed so the CRON backend doesn't double-process it later
            doc["processed"] = True
            doc["created_at"] = datetime.now(timezone.utc)
            
            try:
                raw_col.insert_one(doc)
            except Exception as e:
                # Due to duplicates if index is doing its job
                total_skipped += 1
                continue
                
            batch.append(doc)
            new_posts_on_page += 1
            total_new += 1
            
            # If batch is full, process it
            if len(batch) >= BATCH_SIZE:
                process_batch(batch, company)
                batch = []
                
        print(f"   -> Found {new_posts_on_page} new relevant posts.")
        time.sleep(PAGE_DELAY)

    # Process final incomplete batch
    if batch:
        process_batch(batch, company)
        
    print("="*60)
    print(" 🎉 MANUAL SCRAPE FINISHED")
    print(f"   - Company: {company}")
    print(f"   - New Posts Processed: {total_new}")
    print(f"   - Skipped (Already in DB): {total_skipped}")
    print("="*60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nManually interrupted by user. Goodbye!")
