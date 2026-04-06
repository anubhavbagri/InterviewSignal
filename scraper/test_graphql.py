"""
test_graphql.py — Quick test to probe LeetCode's GraphQL API for Discuss posts.
Run: python3 test_graphql.py
"""

import json
import requests

GRAPHQL_URL = "https://leetcode.com/graphql"

HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://leetcode.com/discuss/",
    "Origin": "https://leetcode.com",
}

# ─── Test 1: Fetch topic list from interview category ────────────────────────

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

LIST_VARIABLES = {
    "categories": ["interview-question"],
    "first": 10,
    "orderBy": "hot",
    "skip": 0,
    "query": "",
    "tags": [],
}


def test_list():
    print("=" * 60)
    print("TEST 1: Fetching interview topic list via GraphQL...")
    print("=" * 60)
    resp = requests.post(
        GRAPHQL_URL,
        headers=HEADERS,
        json={"query": LIST_QUERY, "variables": LIST_VARIABLES},
        timeout=15,
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print("Response body:", resp.text[:500])
        return None

    data = resp.json()
    print("\n--- RAW JSON (list) ---")
    print(json.dumps(data, indent=2))
    print("--- END ---\n")
    if "errors" in data:
        print("GraphQL errors:", json.dumps(data["errors"], indent=2))
        return None

    topics = data.get("data", {}).get("categoryTopicList", {})
    total = topics.get("totalNum", 0)
    edges = topics.get("edges", [])
    print(f"✅ Total topics: {total}")
    print(f"✅ Returned: {len(edges)} topics")
    for e in edges[:3]:
        n = e["node"]
        snippet = (n["post"]["content"] or "")[:80].replace("\n", " ")
        print(f"  • [{n['id']}] {n['title'][:60]} | snippet: {snippet}...")
    return edges


# ─── Test 2: Fetch a single topic's full content ─────────────────────────────

TOPIC_QUERY = """
query DiscussTopic($topicId: Int!) {
  topic(id: $topicId) {
    id
    title
    post {
      id
      content
      creationDate
      author { username }
    }
  }
}
"""


def test_topic(topic_id: int):
    print()
    print("=" * 60)
    print(f"TEST 2: Fetching topic detail for id={topic_id}...")
    print("=" * 60)
    resp = requests.post(
        GRAPHQL_URL,
        headers=HEADERS,
        json={"query": TOPIC_QUERY, "variables": {"topicId": topic_id}},
        timeout=15,
    )
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print("Response body:", resp.text[:500])
        return

    data = resp.json()
    print("\n--- RAW JSON (topic) ---")
    print(json.dumps(data, indent=2))
    print("--- END ---\n")
    if "errors" in data:
        print("GraphQL errors:", json.dumps(data["errors"], indent=2))
        return

    topic = data.get("data", {}).get("topic", {})
    if not topic:
        print("❌ Empty topic response")
        return

    content = (topic["post"]["content"] or "")[:300].replace("\n", " ")
    print(f"✅ Title: {topic['title']}")
    print(f"✅ Content snippet: {content}...")


if __name__ == "__main__":
    edges = test_list()
    if edges:
        first_id = int(edges[0]["node"]["id"])
        test_topic(first_id)
    else:
        print("\n❌ List fetch failed — GraphQL approach won't work from this IP.")
