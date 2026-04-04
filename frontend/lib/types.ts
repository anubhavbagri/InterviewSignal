// lib/types.ts — Shared TypeScript interfaces for InterviewSignal

export type QuestionType = "DSA" | "SYSTEM_DESIGN" | "BEHAVIORAL";
export type Difficulty = "easy" | "medium" | "hard" | "unknown";

export interface Question {
  _id: string;
  company: string | null;
  question: string;
  type: QuestionType;
  tags: string[];
  difficulty: Difficulty;
  source_post_url: string;
  question_hash: string;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}
