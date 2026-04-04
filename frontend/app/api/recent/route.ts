// app/api/recent/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getQuestionsCollection } from "@/lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));

    const col = await getQuestionsCollection();
    const docs = await col.find({}).sort({ created_at: -1 }).limit(limit).toArray();

    const questions = docs.map((d) => ({
      ...d,
      _id: d._id.toString(),
      created_at: d.created_at?.toISOString?.() ?? d.created_at,
    }));

    return NextResponse.json({ data: questions });
  } catch (err) {
    console.error("[/api/recent]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
