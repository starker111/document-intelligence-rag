import { NextRequest, NextResponse } from "next/server";
import { listLocalDocuments } from "@/lib/localDocumentStore";
import {
  getSupabaseAdmin,
  isSupabaseNetworkError,
  supabaseServiceError,
} from "@/lib/supabaseAdmin";
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

    if (error) {
      if (!isSupabaseNetworkError(error)) {
        throw supabaseServiceError("Could not load documents", error);
      }

      const documents = await listLocalDocuments();

      return NextResponse.json({
        success: true,
        storage: "local",
        documents: documents.slice(0, 20).map((document) => ({
          id: document.id,
          fileName: document.file_name,
          chunkCount: document.chunk_count,
          createdAt: document.created_at,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      storage: "supabase",
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
