"""
db.py — MongoDB connection and collection accessors for InterviewSignal scraper.
Creates required indexes on startup.
"""

import os
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from dotenv import load_dotenv

load_dotenv()

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.environ["MONGODB_URI"]
        _client = MongoClient(uri)
    return _client


def get_db():
    db_name = os.environ.get("MONGODB_DB_NAME", "interviewsignal")
    return get_client()[db_name]


def get_raw_posts_collection() -> Collection:
    col = get_db()["raw_posts"]
    return col


def get_questions_collection() -> Collection:
    col = get_db()["questions"]
    return col


def ensure_indexes():
    """Create all required indexes. Safe to call multiple times (idempotent)."""
    raw = get_raw_posts_collection()
    raw.create_index([("post_url", ASCENDING)], unique=True, name="post_url_unique")
    raw.create_index([("processed", ASCENDING)], name="processed_idx")
    raw.create_index([("created_at", DESCENDING)], name="created_at_idx")

    questions = get_questions_collection()
    questions.create_index(
        [("question_hash", ASCENDING)], unique=True, name="question_hash_unique"
    )
    questions.create_index([("company", ASCENDING)], name="company_idx")
    questions.create_index([("type", ASCENDING)], name="type_idx")
    questions.create_index([("created_at", DESCENDING)], name="created_at_desc")

    print("✅ Indexes ensured on raw_posts and questions collections.")


if __name__ == "__main__":
    ensure_indexes()
