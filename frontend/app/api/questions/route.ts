// app/api/questions/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getQuestionsCollection } from "@/lib/mongodb";
import { Filter, Document } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const col = await getQuestionsCollection();

    const filter: Filter<Document> = {};
    if (company && company !== "all") filter.company = { $regex: company, $options: "i" };

    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    const questions = docs.map((d) => ({
      ...d,
      _id: d._id.toString(),
      // backward compat: old docs use `question`, new docs use `title`
      title: d.title ?? d.question ?? "Untitled",
      description: d.description ?? null,
      problem_link: d.problem_link ?? null,
      posted_at: d.posted_at ?? null,
      // normalize type to CODING/DESIGN for backward compat
      type: normalizeType(d.type),
      created_at: d.created_at?.toISOString?.() ?? d.created_at,
    }));

    return NextResponse.json({
      data: questions,
      total,
      page,
      limit,
      hasMore: skip + questions.length < total,
    });
  } catch (err) {
    console.error("[/api/questions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function normalizeType(type: string): "CODING" | "DESIGN" {
  if (!type) return "CODING";
  const t = type.toUpperCase();
  if (t === "SYSTEM_DESIGN" || t === "DESIGN" || t === "LLD" || t === "HLD") return "DESIGN";
  return "CODING"; // DSA, BEHAVIORAL, unknown → CODING
}
