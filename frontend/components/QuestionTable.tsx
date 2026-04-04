"use client";

import { useState } from "react";
import { Question } from "@/lib/types";
import { TypeBadge } from "@/components/TypeBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Building2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionTableProps {
  questions: Question[];
  total: number;
  page: number;
  hasMore: boolean;
  onPageChange: (p: number) => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-red-400",
  unknown: "text-muted-foreground",
};

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function QuestionTable({
  questions,
  total,
  page,
  hasMore,
  onPageChange,
}: QuestionTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg font-medium text-foreground/80">
          No questions found
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Try adjusting your filters or check back after the next scrape run.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead className="font-semibold text-foreground/80">
                Question
              </TableHead>
              <TableHead className="font-semibold text-foreground/80 w-36">
                Type
              </TableHead>
              <TableHead className="font-semibold text-foreground/80 w-32 hidden sm:table-cell">
                Company
              </TableHead>
              <TableHead className="font-semibold text-foreground/80 w-28 hidden md:table-cell">
                Difficulty
              </TableHead>
              <TableHead className="font-semibold text-foreground/80 w-28 hidden lg:table-cell">
                Date
              </TableHead>
              <TableHead className="w-16 text-right font-semibold text-foreground/80">
                Source
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => {
              const isOpen = expanded.has(q._id);
              return (
                <>
                  <TableRow
                    key={q._id}
                    onClick={() => toggle(q._id)}
                    className={cn(
                      "cursor-pointer border-border/40 transition-colors group",
                      isOpen
                        ? "bg-primary/5 hover:bg-primary/8"
                        : "hover:bg-muted/30"
                    )}
                  >
                    {/* Expand chevron */}
                    <TableCell className="pr-0 pl-4">
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                    </TableCell>

                    {/* Question text */}
                    <TableCell className="font-medium text-foreground/90 py-4">
                      <span className="line-clamp-2 leading-snug">
                        {q.question}
                      </span>
                    </TableCell>

                    {/* Type badge */}
                    <TableCell>
                      <TypeBadge type={q.type} />
                    </TableCell>

                    {/* Company */}
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {q.company ?? (
                        <span className="italic opacity-50">Unknown</span>
                      )}
                    </TableCell>

                    {/* Difficulty */}
                    <TableCell className="hidden md:table-cell">
                      <span
                        className={cn(
                          "text-sm font-medium capitalize",
                          DIFFICULTY_COLORS[q.difficulty] ??
                            "text-muted-foreground"
                        )}
                      >
                        {q.difficulty}
                      </span>
                    </TableCell>

                    {/* Date */}
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {formatDate(q.created_at)}
                    </TableCell>

                    {/* Source link */}
                    <TableCell className="text-right pr-4">
                      <a
                        href={q.source_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Post</span>
                      </a>
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {isOpen && (
                    <TableRow
                      key={`${q._id}-expanded`}
                      className="border-border/40 bg-primary/5 hover:bg-primary/5"
                    >
                      <TableCell colSpan={7} className="py-4 px-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Full question */}
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
                              Full Question
                            </p>
                            <p className="text-foreground/90 leading-relaxed">
                              {q.question}
                            </p>
                          </div>

                          {/* Tags + metadata */}
                          <div className="flex flex-col gap-3 sm:w-56">
                            {q.tags.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                  <Tag className="h-3 w-3" /> Tags
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {q.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-0.5 rounded-md text-xs bg-muted/60 text-muted-foreground border border-border/40"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {q.company && (
                              <div>
                                <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                  <Building2 className="h-3 w-3" /> Company
                                </p>
                                <p className="text-sm text-foreground/80">
                                  {q.company}
                                </p>
                              </div>
                            )}

                            <a
                              href={q.source_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium mt-auto"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View original interview post
                            </a>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          Showing {(page - 1) * 20 + 1}–
          {Math.min(page * 20, total)} of{" "}
          <span className="font-medium text-foreground">{total}</span> questions
        </span>
        <div className="flex items-center gap-2">
          <button
            id="prev-page-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            ← Prev
          </button>
          <span className="px-2 tabular-nums">
            {page} / {Math.ceil(total / 20) || 1}
          </span>
          <button
            id="next-page-btn"
            disabled={!hasMore}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
