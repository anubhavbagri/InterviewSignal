"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Question } from "@/lib/types";
import { FilterBar } from "@/components/FilterBar";
import { QuestionTable } from "@/components/QuestionTable";
import { StatsBar } from "@/components/StatsBar";
import { Zap, RefreshCw } from "lucide-react";

export function RecentQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const company = searchParams.get("company") || "";
  const type = searchParams.get("type") || "";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch companies once
  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.data ?? []))
      .catch(() => { });
  }, []);

  // Fetch questions on filter/page change
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (company) params.set("company", company);
      if (type) params.set("type", type);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQuestions(data.data ?? []);
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      setError("Failed to load questions. Is your MongoDB connected?");
    } finally {
      setLoading(false);
    }
  }, [company, type, search, page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/recent-questions?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Interview<span className="text-primary">Signal</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              Updated daily via LLM pipeline
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Hero heading */}
        <div className="space-y-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider">
            <Zap className="h-3 w-3" />
            AI-Extracted from Real Candidate Posts
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Real Interview Questions,{" "}
            <span className="text-primary">Not Practice Problems</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            Aggregated from real interview experiences on LeetCode Discuss. Extracted, structured, and deduplicated using GPT-4o.
          </p>
        </div>

        {/* Stats */}
        <StatsBar total={total} questions={questions} />

        {/* Filters */}
        <FilterBar
          companies={companies}
          currentCompany={company}
          currentType={type}
          currentSearch={search}
        />

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-400 text-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold">Database not connected</p>
              <p className="text-red-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-muted/40 animate-pulse"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        )}

        {/* Question table */}
        {!loading && !error && (
          <QuestionTable
            questions={questions}
            total={total}
            page={page}
            hasMore={hasMore}
            onPageChange={handlePageChange}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} InterviewSignal. Data sourced from
            public LeetCode Discuss posts.
          </span>
          <span className="hidden sm:inline">
            Built with Next.js · MongoDB · GPT-4o
          </span>
        </div>
      </footer>
    </div>
  );
}
