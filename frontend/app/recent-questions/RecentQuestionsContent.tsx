"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Question } from "@/lib/types";
import { CompanySelector } from "@/components/CompanySelector";
import { QuestionTable } from "@/components/QuestionTable";
import { Zap, Check, Database, Building2 } from "lucide-react";

export function RecentQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const company = searchParams.get("company") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalQuestions: number; totalCompanies: number } | null>(null);

  // Fetch companies + stats once on mount
  useEffect(() => {
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.data ?? []))
      .catch(() => { });

    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => { });
  }, []);

  // Fetch questions when company/page changes
  const fetchQuestions = useCallback(async () => {
    if (!company) {
      setQuestions([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("company", company);
      params.set("page", String(page));
      params.set("limit", "10");

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQuestions(data.data ?? []);
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
    } catch {
      setError("Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [company, page]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleCompanySelect = (c: string) => {
    if (c) {
      router.push(`/recent-questions?company=${encodeURIComponent(c)}`);
    } else {
      router.push("/recent-questions");
    }
  };

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams();
    if (company) params.set("company", company);
    params.set("page", String(p));
    router.push(`/recent-questions?${params.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-violet-500/5 rounded-full blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="w-full px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Interview<span className="text-primary">Signal</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Updated daily
          </div>
        </div>
      </header>

      {/* ── Main (flex-1 so footer is always at bottom) ── */}
      <main className="flex-1 flex flex-col">

        {/* Hero + company selector */}
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-14 pb-8 space-y-10">

          {/* Hero */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Real Interview Questions,<br />
              <span className="text-primary">Not Practice Problems</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Curated from real candidate experiences — know{" "}
              <strong className="text-foreground">exactly what companies are asking right now</strong>
              , without digging through forums or paying for premium prep tool.
            </p>

            {/* Bullet points */}
            <ul className="mt-6 space-y-2.5 text-left inline-block text-sm sm:text-base">
              {[
                "Recently asked coding & system design questions",
                "Company-specific & sorted by date",
                "No fluff, no guesswork, no outdated problems",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Company selector */}
          <div className="flex justify-center w-full px-2 sm:px-0">
            <CompanySelector
              companies={companies}
              selected={company}
              onSelect={handleCompanySelect}
            />
          </div>
        </div>

        {/* ── Content area ── */}
        {company ? (
          /* Questions table */
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pb-14 space-y-4">
            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-muted/30 animate-pulse"
                    style={{ opacity: 1 - i * 0.12 }}
                  />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-400 text-sm flex items-center gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold">Could not load questions</p>
                  <p className="text-red-400/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && (
              <QuestionTable
                questions={questions}
                total={total}
                page={page}
                hasMore={hasMore}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        ) : (
          /* Placeholder — vertically centered in remaining space */
          <div className="flex-1 flex items-center justify-center pb-14">
            <p className="text-muted-foreground text-sm">
              Please select a company to view recent questions
            </p>
          </div>
        )}

        {/* Always-visible stats: Total Questions (left) & Companies (right) */}
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pb-6">
          <div className="flex items-center justify-between py-4 border-t border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground leading-none">
                  {stats ? stats.totalQuestions.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Questions</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div>
                <p className="text-base font-bold text-foreground leading-none text-right">
                  {stats ? stats.totalCompanies.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 text-right">Companies</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* ── Footer — always at bottom ── */}
      <footer className="border-t border-border/30">
        <div className="w-full px-6 lg:px-10 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} InterviewSignal. All rights reserved.</span>
          <span className="hidden sm:inline">Built with Next.js</span>
        </div>
      </footer>
    </div>
  );
}
