import { NextRequest, NextResponse } from "next/server";
import { chunkText, normalizeText } from "@/lib/chunkText";
import { embedDocuments } from "@/lib/ai";
import { extractPdfText } from "@/lib/pdf";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AppError,
  errorResponse,
  getMaxChunksPerPdf,
  requireAppPassword,
  validatePdf,
} from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let documentId: string | undefined;

  try {
    requireAppPassword(request);
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError(
        'Send multipart/form-data with the PDF in field name "file".',
        400,
      );
    }
    const value = formData.get("file");
    if (!(value instanceof File)) {
      throw new AppError('Upload a PDF using multipart field name "file".', 400);
    }

    validatePdf(value);
    const buffer = Buffer.from(await value.arrayBuffer());
    const extracted = await extractPdfText(buffer);
    const cleanText = normalizeText(extracted.text);
    const allChunks = chunkText(cleanText);
    const chunks = allChunks.slice(0, getMaxChunksPerPdf());
    if (!chunks.length) {
      throw new AppError("Text was extracted, but no usable chunks could be created.", 422);
    }

    const embeddings = await embedDocuments(chunks);
    const supabase = getSupabaseAdmin();
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        file_name: value.name,
        chunk_count: chunks.length,
      })
      .select("id")
      .single();

    if (documentError || !document) {
      throw new AppError(
        `Could not create the document record: ${documentError?.message ?? "unknown database error"}`,
        502,
      );
    }
    documentId = document.id;

    const rows = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_number: index + 1,
      content,
      characters: content.length,
      embedding: embeddings[index],
    }));

    for (let index = 0; index < rows.length; index += 50) {
      const { error } = await supabase
        .from("document_chunks")
        .insert(rows.slice(index, index + 50));
      if (error) {
        throw new AppError(`Chunk storage failed: ${error.message}`, 502);
      }
    }

    return NextResponse.json({
      success: true,
      documentId,
      fileName: value.name,
      chunksStored: chunks.length,
      message: "PDF indexed successfully and is ready for questions.",
    });
  } catch (error) {
    if (documentId) {
      await getSupabaseAdmin().from("documents").delete().eq("id", documentId);
    }
    return errorResponse(error);
  }
}
