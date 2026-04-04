// app/api/companies/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getQuestionsCollection } from "@/lib/mongodb";

export async function GET() {
  try {
    const col = await getQuestionsCollection();
    const companies = await col.distinct("company", { company: { $ne: null } });
    const sorted = companies.filter(Boolean).sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ data: sorted });
  } catch (err) {
    console.error("[/api/companies]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
