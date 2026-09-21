import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AppError } from "./validators";

export const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 30;
const MAX_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("503") ||
    message.toLowerCase().includes("quota") ||
    message.toLowerCase().includes("rate limit")
  );
}

function friendlyAiError(error: unknown, operation: "embedding" | "answer"): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")
  ) {
    return "Gemini usage is temporarily limited. Please wait a moment or check the API quota before trying again.";
  }
  if (message.toLowerCase().includes("api key")) {
    return "Gemini authentication failed. Check the configured API key.";
  }
  return operation === "embedding"
    ? "Gemini could not create embeddings for this document."
    : "Gemini could not complete the answer.";
}

function getEmbeddingDimensions(): number {
  const configured = Number(
    process.env.GEMINI_EMBEDDING_DIMENSIONS ?? EMBEDDING_DIMENSIONS,
  );

  if (configured !== EMBEDDING_DIMENSIONS) {
    throw new AppError(
      `GEMINI_EMBEDDING_DIMENSIONS must be ${EMBEDDING_DIMENSIONS} to match the Supabase vector schema.`,
      503,
    );
  }

  return configured;
}

function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("Gemini is not configured. Add GEMINI_API_KEY.", 503);
  }
  return new GoogleGenAI({ apiKey });
}

function normalizeEmbedding(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) throw new AppError("Gemini returned an empty embedding.", 502);
  return values.map((value) => value / magnitude);
}

async function embedBatch(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "QUESTION_ANSWERING",
): Promise<number[][]> {
  const dimensions = getEmbeddingDimensions();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await getGemini().models.embedContent({
        model: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
        contents: texts,
        config: {
          taskType,
          outputDimensionality: dimensions,
        },
      });

      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, received ${embeddings.length}.`);
      }

      return embeddings.map((embedding) => {
        const values = embedding.values;
        if (!values || values.length !== dimensions) {
          throw new Error(
            `Gemini returned ${values?.length ?? 0} dimensions; expected ${dimensions}.`,
          );
        }
        return normalizeEmbedding(values);
      });
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        const backoffMs = 1200 * Math.pow(2, attempt) + Math.floor(Math.random() * 400);
        console.warn(`[lib/ai] Embedding rate-limited. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(backoffMs);
        continue;
      }
      break;
    }
  }

  throw new AppError(friendlyAiError(lastError, "embedding"), 502);
}

export async function embedDocumentsWithMetrics(
  texts: string[],
): Promise<{ embeddings: number[][]; durationMs: number }> {
  if (!texts.length) throw new AppError("No chunks were available to embed.", 422);

  const start = Date.now();
  const all: number[][] = [];
  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    all.push(...(await embedBatch(batch, "RETRIEVAL_DOCUMENT")));
  }
  return { embeddings: all, durationMs: Date.now() - start };
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const result = await embedDocumentsWithMetrics(texts);
  return result.embeddings;
}

export async function embedQuestion(question: string): Promise<number[]> {
  const [embedding] = await embedBatch([question], "QUESTION_ANSWERING");
  return embedding;
}

export async function generateAnswer(prompt: string): Promise<string> {
  try {
    const response = await getGemini().models.generateContent({
      model: process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 1800,
        thinkingConfig: {
          thinkingBudget: 0,
        },
        systemInstruction:
          "You are a precise document intelligence assistant. Use only supplied references, never invent facts, and cite factual claims with bracketed reference numbers.",
      },
    });

    const answer = response.text?.trim();
    if (!answer) throw new Error("Gemini returned an empty answer.");
    return answer;
  } catch (error) {
    throw new AppError(friendlyAiError(error, "answer"), 502);
  }
}
