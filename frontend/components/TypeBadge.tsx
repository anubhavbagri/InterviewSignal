import { QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TypeBadgeProps {
  type: QuestionType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const isCoding = type === "CODING";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        isCoding
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-violet-500/15 text-violet-400 border border-violet-500/30",
        className
      )}
    >
      {isCoding ? "Coding" : "Design"}
    </span>
  );
}
