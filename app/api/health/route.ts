import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const environment = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
    GEMINI_EMBEDDING_MODEL: Boolean(process.env.GEMINI_EMBEDDING_MODEL),
    GEMINI_EMBEDDING_DIMENSIONS:
      Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768") === 768,
    GEMINI_CHAT_MODEL: Boolean(process.env.GEMINI_CHAT_MODEL),
  };
  const ready = Object.values(environment).every(Boolean);

  return NextResponse.json(
    {
      status: ready ? "ok" : "configuration_required",
      ready,
      services: {
        database: environment.NEXT_PUBLIC_SUPABASE_URL && environment.SUPABASE_SERVICE_ROLE_KEY,
        ai: environment.GEMINI_API_KEY,
      },
      environment,
      passwordRequired: process.env.APP_REQUIRE_PASSWORD?.toLowerCase() === "true",
      maxFileMb: Number(process.env.APP_MAX_FILE_MB ?? "10") || 10,
      maxChunksPerPdf: Number(process.env.MAX_CHUNKS_PER_PDF ?? "100") || 100,
      embeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "768") || 768,
      topK: Number(process.env.APP_TOP_K ?? "5") || 5,
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
