import "server-only";
import { CanvasFactory, getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { AppError } from "./validators";

PDFParse.setWorker(getData());

export interface ExtractedPdf {
  text: string;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AppError("The uploaded file is not a valid PDF.", 400);
  }

  let parser: PDFParse | undefined;

  try {
    parser = new PDFParse({
      data: new Uint8Array(buffer),
      CanvasFactory,
    });
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";

    if (!text || text.replace(/\s/g, "").length < 20) {
      throw new AppError(
        "No extractable text found. This may be a scanned/image-only PDF.",
        422,
      );
    }

    return { text };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PDF text extraction failed. The file may be damaged, encrypted, or unsupported.",
      422,
    );
  } finally {
    try {
      await parser?.destroy();
    } catch (error) {
      console.warn("ingest:pdf_parser_cleanup_failed", {
        error: error instanceof Error ? error.message : "Unknown cleanup error",
      });
    }
  }
}
