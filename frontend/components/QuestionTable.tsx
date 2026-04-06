"use client";

import { useState } from "react";
import { Question } from "@/lib/types";
import { TypeBadge } from "@/components/TypeBadge";
import { QuestionModal } from "@/components/QuestionModal";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface QuestionTableProps {
  questions: Question[];
  total: number;
  page: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const BTN_AMBER =
  "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 transition-colors whitespace-nowrap";
const BTN_EMERALD =
  "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors whitespace-nowrap";

export function QuestionTable({ questions, total, page, hasMore, onPageChange }: QuestionTableProps) {
  const [activeModal, setActiveModal] = useState<Question | null>(null);
  const totalPages = Math.ceil(total / 10);
  const pageStart = (page - 1) * 10 + 1;
  const pageEnd = Math.min(page * 10, total);

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
          <span className="text-3xl">🔍</span>
        </div>
        <p className="text-foreground font-semibold mb-1">No questions found</p>
        <p className="text-muted-foreground text-sm">
          No interview questions found for this company yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground mb-3">
        Tap a description to expand details
      </p>

      {/* ─── Mobile: card list (hidden on sm+) ─── */}
      <div className="sm:hidden space-y-3">
        {questions.map((q, idx) => (
          <div
            key={q._id}
            className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3"
          >
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-xs text-muted-foreground mt-0.5 flex-shrink-0">
                  {pageStart + idx}.
                </span>
                <p className="font-semibold text-sm text-foreground leading-snug">{q.title}</p>
              </div>
              <TypeBadge type={q.type} className="flex-shrink-0" />
            </div>

            {/* Description — tap to open modal */}
            {q.description && (
              <p
                className="text-xs text-muted-foreground line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                onClick={() => setActiveModal(q)}
              >
                {q.description}
              </p>
            )}

            {/* Footer: date + buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{formatDate(q.posted_at ?? q.created_at)}</span>
              <div className="flex items-center gap-2">
                <a
                  href={q.problem_link ?? q.source_post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BTN_AMBER}
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  View Problem
                </a>
                <a
                  href={q.source_post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BTN_EMERALD}
                >
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  View Post
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Desktop: full table (hidden below sm) ─── */}
      <div className="hidden sm:block rounded-xl border border-border/50 overflow-hidden bg-card/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left text-muted-foreground font-medium px-4 py-3 w-10">#</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3 min-w-[180px]">Title</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3 min-w-[260px]">Description</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3 w-24">Type</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3 w-28">Posted At</th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3 w-36">Link(s)</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr
                  key={q._id}
                  className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-4 text-muted-foreground text-xs">{pageStart + idx}</td>
                  <td className="px-4 py-4 font-medium text-foreground">{q.title}</td>
                  <td
                    className="px-4 py-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => setActiveModal(q)}
                  >
                    <span className="line-clamp-1">{q.description || "—"}</span>
                  </td>
                  <td className="px-4 py-4">
                    <TypeBadge type={q.type} />
                  </td>
                  <td className="px-4 py-4 text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(q.posted_at ?? q.created_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1.5">
                      <a
                        href={q.problem_link ?? q.source_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={BTN_AMBER}
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        View Problem
                      </a>
                      <a
                        href={q.source_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={BTN_EMERALD}
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        View Post
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm flex-wrap gap-2">
          <span className="text-muted-foreground text-xs">
            Showing {pageStart}–{pageEnd} of {total} questions
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore}
              className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {activeModal && (
        <QuestionModal question={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </>
  );
}
