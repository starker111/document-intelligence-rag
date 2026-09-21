import "server-only";
import { embedQuestion, generateAnswer } from "./ai";
import { matchLocalDocumentChunks } from "./localDocumentStore";
import { buildRagPrompt } from "./prompts";
import {
  getSupabaseAdmin,
  isSupabaseNetworkError,
  supabaseServiceError,
} from "./supabaseAdmin";
import type { MatchedChunk, Reference } from "./types";
import { AppError } from "./validators";

function cleanSnippet(text: string, maxLength = 440): string {
  let clean = text.replace(/\s+/g, " ").trim();
  if (/^[a-z]/.test(clean)) {
    clean = clean.replace(/^\S+\s+/, "");
  }
  return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}...` : clean;
}

export async function answerDocumentQuestion(
  question: string,
  documentId: string,
): Promise<{ answer: string; references: Reference[] }> {
  const queryEmbedding = await embedQuestion(question);
  const topK = Math.min(Math.max(Number(process.env.APP_TOP_K ?? "3") || 3, 1), 10);
  const supabase = getSupabaseAdmin();

  async function answerFromLocalStore() {
    const localMatch = await matchLocalDocumentChunks(
      queryEmbedding,
      documentId,
      topK,
    );

    if (!localMatch || !localMatch.chunks.length) return null;

    const answer = await generateAnswer(buildRagPrompt(question, localMatch.chunks));
    const references = localMatch.chunks.map((chunk, index) => ({
      referenceNumber: index + 1,
      fileName: chunk.file_name || localMatch.fileName,
      chunkNumber: chunk.chunk_number,
      similarity: Number(chunk.similarity),
      snippet: cleanSnippet(chunk.content),
    }));

    return { answer, references };
  }

  const [searchResult, documentResult] = await Promise.all([
    supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_document_id: documentId,
      match_count: topK,
    }),
    supabase.from("documents").select("file_name").eq("id", documentId).single(),
  ]);

  if (searchResult.error) {
    if (isSupabaseNetworkError(searchResult.error)) {
      const localAnswer = await answerFromLocalStore();
      if (localAnswer) return localAnswer;
    }

    throw supabaseServiceError("Vector search failed", searchResult.error);
  }
  if (documentResult.error || !documentResult.data) {
    if (!documentResult.error || isSupabaseNetworkError(documentResult.error)) {
      const localAnswer = await answerFromLocalStore();
      if (localAnswer) return localAnswer;
    }

    throw new AppError("The selected document no longer exists.", 404);
  }

  const chunks = ((searchResult.data ?? []) as MatchedChunk[]).map((chunk) => ({
    ...chunk,
    file_name: chunk.file_name || documentResult.data.file_name,
  }));
  if (!chunks.length) {
    const localAnswer = await answerFromLocalStore();
    if (localAnswer) return localAnswer;

    throw new AppError(
      "No indexed passages were found for this document. Try re-indexing the PDF.",
      404,
    );
  }

  const answer = await generateAnswer(buildRagPrompt(question, chunks));
  const references = chunks.map((chunk, index) => ({
    referenceNumber: index + 1,
    fileName: chunk.file_name || documentResult.data.file_name,
    chunkNumber: chunk.chunk_number,
    similarity: Number(chunk.similarity),
    snippet: cleanSnippet(chunk.content),
  }));

  return { answer, references };
}
