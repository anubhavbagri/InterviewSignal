// lib/types.ts — Shared TypeScript interfaces for InterviewSignal

export type QuestionType = "CODING" | "DESIGN";
export type Difficulty = "easy" | "medium" | "hard" | "unknown";

export interface Question {
  _id: string;
  company: string | null;
  /** Concise problem/question title (e.g. "LRU Cache") */
  title: string;
  /** One-to-two sentence description of the problem */
  description: string | null;
  type: QuestionType;
  tags: string[];
  difficulty: Difficulty;
  /** Direct LeetCode problem URL if applicable */
  problem_link: string | null;
  /** LeetCode Discuss post that mentioned this question */
  source_post_url: string;
  question_hash: string;
  created_at: string;
  /** When the source post was originally published */
  posted_at: string | null;
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}
