import { QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TypeBadgeProps {
  type: QuestionType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  let colorClass = "";
  let label = "";

  switch (type) {
    case "CODING":
      colorClass = "bg-primary/15 text-primary border border-primary/30";
      label = "Coding";
      break;
    case "DESIGN":
      colorClass = "bg-violet-500/15 text-violet-400 border border-violet-500/30";
      label = "Design";
      break;
    case "CONCEPTUAL":
      colorClass = "bg-orange-500/15 text-orange-500 border border-orange-500/30";
      label = "Conceptual";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
        colorClass,
        className
      )}
    >
      {label}
    </span>
  );
}
