import { NextRequest, NextResponse } from "next/server";
import { answerDocumentQuestion } from "@/lib/rag";
import {
  errorResponse,
  requireAppPassword,
  validateAskBody,
} from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    requireAppPassword(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Send valid JSON with question and documentId." },
        { status: 400 },
      );
    }
    const { question, documentId } = validateAskBody(body);
    const result = await answerDocumentQuestion(question, documentId);

    return NextResponse.json({
      success: true,
      question,
      answer: result.answer,
      references: result.references,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
