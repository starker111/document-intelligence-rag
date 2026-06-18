import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { errorResponse, requireAppPassword } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    requireAppPassword(request);
    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .select("id, file_name, chunk_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(`Could not load documents: ${error.message}`);

    return NextResponse.json({
      success: true,
      documents: (data ?? []).map((document) => ({
        id: document.id,
        fileName: document.file_name,
        chunkCount: document.chunk_count,
        createdAt: document.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
