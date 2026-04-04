"use client";

import { QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<
  QuestionType,
  { label: string; className: string }
> = {
  DSA: {
    label: "DSA",
    className:
      "bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25",
  },
  SYSTEM_DESIGN: {
    label: "System Design",
    className:
      "bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25",
  },
  BEHAVIORAL: {
    label: "Behavioral",
    className:
      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25",
  },
};

interface TypeBadgeProps {
  type: QuestionType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG["DSA"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-default",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
