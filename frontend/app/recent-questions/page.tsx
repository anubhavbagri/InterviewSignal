import { Suspense } from "react";
import { RecentQuestionsContent } from "./RecentQuestionsContent";

export const metadata = {
  title: "InterviewSignal — Real Interview Questions, Not Practice Problems",
  description:
    "Aggregated interview questions from real candidate experiences at top tech companies. Filter by company, type, and difficulty.",
};

export default function RecentQuestionsPage() {
  return (
    <Suspense>
      <RecentQuestionsContent />
    </Suspense>
  );
}
