// lib/kdb/review.ts
// Lógica de validación y armado del UPDATE para POST /api/kdb/[tenantId]/proposals/[proposalId]/review
// (TRD §9, BACKEND §D2). Extraída del route handler para poder testearse sin depender
// de Next.js request/response ni de una conexión real a Postgres.

import { ReviewRequestSchema, type ReviewRequest } from "./schemas";

export type ReviewValidationResult =
  | { ok: true; data: ReviewRequest }
  | { ok: false; error: string };

/** Valida el body de POST .../review contra ReviewRequestSchema (TRD §9). */
export function validateReviewBody(body: unknown): ReviewValidationResult {
  const parsed = ReviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, data: parsed.data };
}

export interface ExistingProposalRow {
  proposal_id: string;
  new_content: string;
  review_meta: Record<string, unknown> | null;
}

export interface ReviewUpdatePlan {
  status: "approved" | "rejected";
  reviewer: string;
  newContent: string;
  reviewMeta: Record<string, unknown>;
}

/**
 * Construye el plan de actualización de la proposal según BACKEND §D2:
 * si llegó `corrected_content`, primero se guarda el contenido original en
 * `review_meta.original_content` y luego se reemplaza `new_content` por el corregido.
 */
export function buildReviewUpdatePlan(
  existing: ExistingProposalRow,
  review: ReviewRequest
): ReviewUpdatePlan {
  const baseMeta = existing.review_meta ?? {};

  if (review.decision === "approved" && review.corrected_content) {
    return {
      status: "approved",
      reviewer: review.reviewer,
      newContent: review.corrected_content,
      reviewMeta: {
        ...baseMeta,
        original_content: existing.new_content,
      },
    };
  }

  if (review.decision === "rejected" && review.reason) {
    return {
      status: "rejected",
      reviewer: review.reviewer,
      newContent: existing.new_content,
      reviewMeta: {
        ...baseMeta,
        rejection_reason: review.reason,
      },
    };
  }

  return {
    status: review.decision,
    reviewer: review.reviewer,
    newContent: existing.new_content,
    reviewMeta: baseMeta,
  };
}
