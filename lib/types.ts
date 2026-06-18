export type WorkflowStep =
  | "idle"
  | "uploading"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "ready"
  | "searching"
  | "answering"
  | "error";

export interface DocumentRecord {
  id: string;
  fileName: string;
  chunkCount: number;
  createdAt: string;
}

export interface Reference {
  referenceNumber: number;
  fileName: string;
  chunkNumber: number;
  similarity: number;
  snippet: string;
}

export interface IngestResponse {
  success: true;
  documentId: string;
  fileName: string;
  chunksStored: number;
  message: string;
}

export interface AskResponse {
  success: true;
  question: string;
  answer: string;
  references: Reference[];
}

export interface MatchedChunk {
  id: string;
  chunk_number: number;
  content: string;
  similarity: number;
  file_name: string | null;
}

export interface LogEntry {
  id: string;
  at: string;
  message: string;
  tone?: "neutral" | "success" | "error";
}
