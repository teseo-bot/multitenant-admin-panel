// app/api/partners/me/sources/route.ts
// KL2-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §3.2/§3.3): biblioteca de
// fuentes del aliado.
//
// GET: lista partner_sources del partner de sesión, orden created_at desc.
// POST:
//   - JSON {kind:'url', title, url} → source_ref = 'url:'+url → INSERT directo.
//   - multipart/form-data (kind='doc' implícito por la presencia de `file`) → proxy del
//     binario a context-kdb-compiler `/internal/partner-source-upload` (KL2-W1 en el
//     compiler) → source_ref = 'doc:sha256:'+sha256, guarda gcs_object → INSERT.
// Duplicado (UNIQUE partner_id, source_ref) → 409 con la fila existente.
// created_by = uid del guard (RP-KL7: requirePartnerMember, sin restricción de rol — registrar
// fuentes no es una acción de publicar/firmar, tanto member como curator pueden usarla).

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  RegisterUrlSourceSchema,
  RegisterDocSourceMetaSchema,
  type PartnerSourceRow,
} from "@/lib/partners/sources";
import { uploadPartnerSourceToCompiler, CompilerCallError } from "@/lib/partners/compiler-client";

export const dynamic = "force-dynamic";

const SOURCE_COLUMNS =
  "id, partner_id, kind, title, source_ref, gcs_object, ingest_status, created_by, created_at";

export async function GET() {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const { rows } = await pool.query<PartnerSourceRow>(
      `SELECT ${SOURCE_COLUMNS}
         FROM partner_sources
        WHERE partner_id = $1
        ORDER BY created_at DESC`,
      [guard.partner.id]
    );

    return NextResponse.json({ sources: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.sources.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

async function insertSourceRow(params: {
  partnerId: string;
  kind: "doc" | "url";
  title: string;
  sourceRef: string;
  gcsObject: string | null;
  createdBy: string;
}): Promise<{ row: PartnerSourceRow; status: 201 } | { row: PartnerSourceRow; status: 409 }> {
  try {
    const { rows } = await pool.query<PartnerSourceRow>(
      `INSERT INTO partner_sources (partner_id, kind, title, source_ref, gcs_object, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SOURCE_COLUMNS}`,
      [params.partnerId, params.kind, params.title, params.sourceRef, params.gcsObject, params.createdBy]
    );
    return { row: rows[0], status: 201 };
  } catch (err: any) {
    if (err.code === "23505") {
      const { rows } = await pool.query<PartnerSourceRow>(
        `SELECT ${SOURCE_COLUMNS} FROM partner_sources WHERE partner_id = $1 AND source_ref = $2`,
        [params.partnerId, params.sourceRef]
      );
      return { row: rows[0], status: 409 };
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const partnerId = guard.partner.id;
    const contentType = req.headers.get("content-type") || "";

    // --- Rama multipart: kind='doc' (subir archivo) ---
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const titleRaw = formData.get("title");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Validación fallida", details: [{ path: "file", message: "Se requiere un archivo" }] },
          { status: 422 }
        );
      }

      const metaParsed = RegisterDocSourceMetaSchema.safeParse({ title: titleRaw });
      if (!metaParsed.success) {
        return NextResponse.json(
          { error: "Validación fallida", details: zodDetails(metaParsed.error.issues) },
          { status: 422 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const content_base64 = Buffer.from(arrayBuffer).toString("base64");

      let uploadResult;
      try {
        uploadResult = await uploadPartnerSourceToCompiler({
          partner_id: partnerId,
          filename: file.name,
          content_base64,
        });
      } catch (err) {
        if (err instanceof CompilerCallError) {
          const status = err.status === 413 ? 413 : 502;
          return NextResponse.json({ error: err.message }, { status });
        }
        throw err;
      }

      const sourceRef = `doc:sha256:${uploadResult.sha256}`;
      const result = await insertSourceRow({
        partnerId,
        kind: "doc",
        title: metaParsed.data.title,
        sourceRef,
        gcsObject: uploadResult.gcs_object,
        createdBy: guard.uid,
      });

      return NextResponse.json(result.row, { status: result.status });
    }

    // --- Rama JSON: kind='url' ---
    const body = await req.json().catch(() => null);
    const parsed = RegisterUrlSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const sourceRef = `url:${parsed.data.url}`;
    const result = await insertSourceRow({
      partnerId,
      kind: "url",
      title: parsed.data.title,
      sourceRef,
      gcsObject: null,
      createdBy: guard.uid,
    });

    return NextResponse.json(result.row, { status: result.status });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.sources.post.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
