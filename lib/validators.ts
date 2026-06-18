import { NextRequest } from "next/server";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function getMaxFileBytes(): number {
  const maxMb = Number(process.env.APP_MAX_FILE_MB ?? "10");
  return (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 10) * 1024 * 1024;
}

export function getMaxChunksPerPdf(): number {
  const configured = Number(process.env.MAX_CHUNKS_PER_PDF ?? "100");
  return Number.isInteger(configured) && configured > 0 ? configured : 100;
}

export function validatePdf(file: File): void {
  if (!file || file.size === 0) {
    throw new AppError("Choose a PDF file to upload.", 400);
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    throw new AppError("Only PDF files are supported.", 415);
  }

  if (file.size > getMaxFileBytes()) {
    const maxMb = Math.round(getMaxFileBytes() / 1024 / 1024);
    throw new AppError(`The PDF exceeds the ${maxMb} MB upload limit.`, 413);
  }
}

export function validateAskBody(body: unknown): {
  question: string;
  documentId: string;
} {
  if (!body || typeof body !== "object") {
    throw new AppError("Send a JSON body with question and documentId.", 400);
  }

  const { question, documentId } = body as Record<string, unknown>;
  if (typeof question !== "string" || !question.trim()) {
    throw new AppError("Question is required.", 400);
  }
  if (question.trim().length > 2000) {
    throw new AppError("Question must be 2,000 characters or fewer.", 400);
  }
  if (typeof documentId !== "string" || !documentId.trim()) {
    throw new AppError("Select an indexed document before asking a question.", 400);
  }

  return { question: question.trim(), documentId: documentId.trim() };
}

export function requireAppPassword(request: NextRequest): void {
  if (process.env.APP_REQUIRE_PASSWORD?.toLowerCase() !== "true") return;

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new AppError(
      "Password protection is enabled, but APP_PASSWORD is not configured.",
      503,
    );
  }

  if (request.headers.get("x-app-password") !== expected) {
    throw new AppError("The app password is missing or incorrect.", 401);
  }
}

export function errorResponse(error: unknown): Response {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          error instanceof Error ? error.message : "An unexpected error occurred.",
        );

  return Response.json(
    { success: false, message: appError.message },
    { status: appError.status },
  );
}
