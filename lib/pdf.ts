import "server-only";
import { PDFParse } from "pdf-parse";
import { AppError } from "./validators";

export interface ExtractedPdf {
  text: string;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AppError("The uploaded file is not a valid PDF.", 400);
  }

  let parser: PDFParse | undefined;

  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (!text || text.replace(/\s/g, "").length < 20) {
      throw new AppError(
        "No extractable text was found. This PDF may be scanned or image-only; run OCR first and try again.",
        422,
      );
    }

    return { text };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `PDF extraction failed: ${error instanceof Error ? error.message : "unknown parser error"}`,
      422,
    );
  } finally {
    await parser?.destroy();
  }
}
