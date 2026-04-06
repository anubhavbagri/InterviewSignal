export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getQuestionsCollection } from "@/lib/mongodb";

export async function GET() {
  try {
    const col = await getQuestionsCollection();
    const [totalQuestions, companies] = await Promise.all([
      col.countDocuments({}),
      col.distinct("company", { company: { $ne: null } }),
    ]);
    return NextResponse.json({
      totalQuestions,
      totalCompanies: companies.filter(Boolean).length,
    });
  } catch (err) {
    console.error("[/api/stats]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
