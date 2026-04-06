// "use client";

// import { Question } from "@/lib/types";
// import { TypeBadge } from "@/components/TypeBadge";
// import { BarChart2, Hash, Building2, Zap } from "lucide-react";

// interface StatsBarProps {
//   total: number;
//   questions: Question[];
// }

// export function StatsBar({ total, questions }: StatsBarProps) {
//   const typeCounts = questions.reduce(
//     (acc, q) => {
//       acc[q.type] = (acc[q.type] || 0) + 1;
//       return acc;
//     },
//     {} as Record<string, number>
//   );

//   const companies = new Set(questions.map((q) => q.company).filter(Boolean));

//   const stats = [
//     {
//       icon: <Hash className="h-4 w-4" />,
//       label: "Total Questions",
//       value: total.toLocaleString(),
//     },
//     {
//       icon: <Building2 className="h-4 w-4" />,
//       label: "Companies",
//       value: companies.size,
//     },
//     {
//       icon: <BarChart2 className="h-4 w-4" />,
//       label: "DSA",
//       value: typeCounts["DSA"] ?? 0,
//     },
//     {
//       icon: <Zap className="h-4 w-4" />,
//       label: "System Design",
//       value: typeCounts["SYSTEM_DESIGN"] ?? 0,
//     },
//   ];

//   return (
//     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
//       {stats.map((s) => (
//         <div
//           key={s.label}
//           className="flex flex-col gap-1 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm px-4 py-3"
//         >
//           <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
//             {s.icon}
//             {s.label}
//           </div>
//           <p className="text-2xl font-bold text-foreground tabular-nums">
//             {s.value}
//           </p>
//         </div>
//       ))}
//     </div>
//   );
// }
