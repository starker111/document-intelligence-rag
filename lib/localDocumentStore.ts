import "server-only";
import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import type { MatchedChunk } from "./types";

type LocalDocument = {
  id: string;
  file_name: string;
  chunk_count: number;
  created_at: string;
};

type LocalChunk = {
  id: string;
  document_id: string;
  chunk_number: number;
  content: string;
  characters: number;
  embedding: number[];
  created_at: string;
};

type LocalStore = {
  documents: LocalDocument[];
  chunks: LocalChunk[];
};

const storeDir = path.join(process.cwd(), "tmp");
const storePath = path.join(storeDir, "rag-document-store.json");

async function readStore(): Promise<LocalStore> {
  try {
    const contents = await readFile(storePath, "utf8");
    const parsed = JSON.parse(contents) as Partial<LocalStore>;

    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { documents: [], chunks: [] };
    }

    throw error;
  }
}

async function writeStore(store: LocalStore): Promise<void> {
  await mkdir(storeDir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, storePath);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] * a[index];
    bMagnitude += b[index] * b[index];
  }

  if (!aMagnitude || !bMagnitude) return 0;

  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

export async function listLocalDocuments(): Promise<LocalDocument[]> {
  const store = await readStore();

  return [...store.documents].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createLocalIndexedDocument(
  fileName: string,
  chunks: string[],
  embeddings: number[][],
): Promise<LocalDocument> {
  const store = await readStore();
  const createdAt = new Date().toISOString();
  const document: LocalDocument = {
    id: randomUUID(),
    file_name: fileName,
    chunk_count: chunks.length,
    created_at: createdAt,
  };
  const localChunks = chunks.map((content, index) => ({
    id: randomUUID(),
    document_id: document.id,
    chunk_number: index + 1,
    content,
    characters: content.length,
    embedding: embeddings[index],
    created_at: createdAt,
  }));

  await writeStore({
    documents: [document, ...store.documents],
    chunks: [...store.chunks, ...localChunks],
  });

  return document;
}

export async function deleteLocalDocument(documentId: string): Promise<void> {
  const store = await readStore();

  await writeStore({
    documents: store.documents.filter((document) => document.id !== documentId),
    chunks: store.chunks.filter((chunk) => chunk.document_id !== documentId),
  });
}

export async function matchLocalDocumentChunks(
  queryEmbedding: number[],
  documentId: string,
  matchCount: number,
): Promise<{ fileName: string; chunks: MatchedChunk[] } | null> {
  const store = await readStore();
  const document = store.documents.find((item) => item.id === documentId);

  if (!document) return null;

  const chunks = store.chunks
    .filter((chunk) => chunk.document_id === documentId)
    .map((chunk) => ({
      id: chunk.id,
      chunk_number: chunk.chunk_number,
      content: chunk.content,
      file_name: document.file_name,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.min(Math.max(matchCount, 1), 10));

  return { fileName: document.file_name, chunks };
}
