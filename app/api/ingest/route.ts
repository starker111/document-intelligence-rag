import { NextResponse } from "next/server";
import { chunkText, normalizeText } from "@/lib/chunkText";
import { EMBEDDING_DIMENSIONS, embedDocuments } from "@/lib/ai";
import { extractPdfText } from "@/lib/pdf";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  AppError,
  getMaxChunksPerPdf,
  requireAppPassword,
  validatePdf,
} from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(error: unknown): NextResponse {
  const appError =
    error instanceof AppError
      ? error
      : new AppError("PDF indexing failed unexpectedly. Check the server logs.", 500);

  return NextResponse.json(
    {
      success: false,
      error: appError.message,
      message: appError.message,
    },
    { status: appError.status },
  );
}

export async function POST(request: Request) {
  let documentId: string | undefined;
  let step = "ingest:start";

  console.info(step);

  try {
    requireAppPassword(request);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError(
        "Invalid multipart upload. Expected a PDF in form field: file.",
        400,
      );
    }
    step = "ingest:formdata_received";
    console.info(step);

    const value = formData.get("file");
    if (!(value instanceof File)) {
      throw new AppError(
        "No PDF file received. Expected form field name: file.",
        400,
      );
    }
    step = "ingest:file_received";
    console.info(step, {
      fileName: value.name,
      fileType: value.type || "unknown",
      fileSize: value.size,
    });

    validatePdf(value);

    const arrayBuffer = await value.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    step = "ingest:pdf_buffer_created";
    console.info(step, { bytes: buffer.length });

    const extracted = await extractPdfText(buffer);
    const cleanText = normalizeText(extracted.text);
    if (!cleanText) {
      throw new AppError(
        "No extractable text found. This may be a scanned/image-only PDF.",
        422,
      );
    }
    step = "ingest:text_extracted";
    console.info(step, { characters: cleanText.length });

    const chunks = chunkText(cleanText).slice(0, getMaxChunksPerPdf());
    if (!chunks.length) {
      throw new AppError("No usable text chunks could be created from this PDF.", 422);
    }
    step = "ingest:chunks_created";
    console.info(step, { chunks: chunks.length });

    const embeddings = await embedDocuments(chunks);
    const invalidEmbedding = embeddings.findIndex(
      (embedding) =>
        !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS,
    );
    if (embeddings.length !== chunks.length || invalidEmbedding !== -1) {
      throw new AppError(
        `Embedding generation returned invalid vectors. Expected ${EMBEDDING_DIMENSIONS} dimensions.`,
        502,
      );
    }
    step = "ingest:embeddings_created";
    console.info(step, {
      embeddings: embeddings.length,
      dimensions: EMBEDDING_DIMENSIONS,
    });

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
        `Could not create the document record: ${documentError?.message ?? "No row returned."}`,
        502,
      );
    }
    documentId = document.id;
    step = "ingest:supabase_document_created";
    console.info(step, { documentId });

    const rows = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_number: index + 1,
      content,
      characters: content.length,
      embedding: embeddings[index],
    }));

    for (let index = 0; index < rows.length; index += 50) {
      const { error: chunkError } = await supabase
        .from("document_chunks")
        .insert(rows.slice(index, index + 50));
      if (chunkError) {
        throw new AppError(`Chunk storage failed: ${chunkError.message}`, 502);
      }
    }
    step = "ingest:chunks_inserted";
    console.info(step, { chunks: rows.length });

    step = "ingest:success";
    console.info(step, { documentId, chunksStored: chunks.length });

    return NextResponse.json({
      success: true,
      documentId,
      fileName: value.name,
      chunksStored: chunks.length,
      message: "PDF indexed successfully and is ready for questions.",
    });
  } catch (error) {
    console.error("ingest:error", {
      step,
      error: error instanceof Error ? error.message : "Unknown ingest error",
    });

    if (documentId) {
      try {
        const { error: cleanupError } = await getSupabaseAdmin()
          .from("documents")
          .delete()
          .eq("id", documentId);
        if (cleanupError) {
          console.error("ingest:cleanup_error", {
            documentId,
            error: cleanupError.message,
          });
        }
      } catch (cleanupError) {
        console.error("ingest:cleanup_error", {
          documentId,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error",
        });
      }
    }

    return jsonError(error);
  }
}
