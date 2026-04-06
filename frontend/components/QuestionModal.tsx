"use client";

import { Question } from "@/lib/types";
import { ExternalLink, X } from "lucide-react";

interface QuestionModalProps {
  question: Question;
  onClose: () => void;
}

export function QuestionModal({ question, onClose }: QuestionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative z-10 w-full max-w-xl rounded-2xl bg-card border border-border/60 shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {question.title}
          </h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        {question.description && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Description:
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {question.description}
            </p>
          </div>
        )}

        {/* Problem link */}
        {question.problem_link && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Problem Link:
            </p>
            <a
              href={question.problem_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Problem
            </a>
          </div>
        )}

        {/* Post link */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Post Link:
          </p>
          <a
            href={question.source_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Post
          </a>
        </div>
      </div>
    </div>
  );
}
