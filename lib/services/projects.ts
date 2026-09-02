// lib/services/projects.ts
// ADR-221 pasos 1 y 3 del loop operativo — el alta del proyecto y el enlace que se comparte.
//
// Hasta hoy `tenant_projects` no tenía CRUD en ningún panel: `acoeq` y `cluster-plasticos`
// entraron por SQL a mano. Eso es lo que este servicio cierra.
//
// ⛔ NO HAY BORRADO, Y ES UNA DECISIÓN. D-221.2 dice que la ventana de vinculación es
// `is_active` y nada más: crear el proyecto lo enciende, apagarlo corta los vínculos NUEVOS y
// no rompe ninguna conversación ya vinculada. Un `DELETE` además chocaría con el
// `ON DELETE RESTRICT` de `tenant_channels.project_id`, que la 016 puso a propósito para que
// borrar un proyecto con canales vivos falle ruidoso.

import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { validarClave } from "@/lib/projects/clave";

export interface ProyectoTenant {
  id: string;
  slug: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Catálogo de proyectos, con TRES estados y no dos.
 *
 * `tabla_ausente` no es lo mismo que «este tenant no tiene proyectos», y confundirlos es el
 * patrón que ya ha mordido siete veces en este programa: `42P01` → `catch` → `[]` → la
 * pantalla dice «no hay proyectos» y alguien se pasa la tarde buscando la configuración que
 * falta, cuando lo que falta es la migración. La 016 NO la aplica ningún CD.
 */
export type CatalogoProyectos =
  | { ok: true; proyectos: ProyectoTenant[] }
  | { ok: false; motivo: "tabla_ausente" };

async function existeTabla(): Promise<boolean> {
  const { rows } = await pool.query<{ hay: string | null }>(
    `SELECT to_regclass('public.tenant_projects') AS hay`
  );
  return Boolean(rows[0]?.hay);
}

/** Proyectos del tenant, activos y apagados: la pantalla del alta los administra a los dos. */
export async function listarProyectos(tenantId: string): Promise<CatalogoProyectos> {
  if (!(await existeTabla())) return { ok: false, motivo: "tabla_ausente" };

  const { rows } = await pool.query(
    `SELECT id, slug, display_name, is_active, created_at
       FROM public.tenant_projects
      WHERE tenant_id = $1
      ORDER BY is_active DESC, created_at DESC`,
    [tenantId]
  );

  return {
    ok: true,
    proyectos: rows.map((r: any) => ({
      id: String(r.id),
      slug: String(r.slug),
      displayName: String(r.display_name),
      isActive: r.is_active === true,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}

/**
 * El número de WhatsApp por el que entra la conferencia, o `null` si el tenant no tiene canal.
 *
 * `null` es hoy el caso esperado y no una avería: Meta exige una línea real y verificada, y
 * ese trámite es de fuera de este repo. La pantalla tiene que decirlo con todas las letras en
 * vez de enseñar un QR que no lleva a ninguna parte.
 *
 * `LIMIT 1` sin ambigüedad: `UNIQUE (channel_type, channel_identifier)` en la 001 permite que
 * un tenant tenga varios números, pero ADR-221 es explícito en que tenant2 tiene UNO —es su
 * modelo de negocio, no una limitación—. Si algún día hay dos, el más antiguo es el estable.
 */
export async function numeroWhatsapp(tenantId: string): Promise<string | null> {
  const { rows } = await pool.query<{ channel_identifier: string }>(
    `SELECT channel_identifier
       FROM public.tenant_channels
      WHERE tenant_id = $1 AND channel_type = 'whatsapp' AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantId]
  );
  return rows[0]?.channel_identifier ?? null;
}

export type ResultadoAlta =
  | { ok: true; proyecto: ProyectoTenant }
  | { ok: false; status: number; error: string };

/**
 * Da de alta el proyecto. La clave se canoniza ANTES de tocar la base: lo que se guarda es
 * exactamente lo que el emparejador buscará y lo que la ingesta aceptará como `project_slugs`.
 *
 * Nace `is_active = true` por el default de la 016, y eso es D-221.2 literal: crear el
 * proyecto es lo que abre su ventana de vinculación.
 */
export async function crearProyecto(
  tenantId: string,
  entrada: { clave: string; displayName: string },
  actor: string
): Promise<ResultadoAlta> {
  const displayName = entrada.displayName?.trim() ?? "";
  if (!displayName) {
    return { ok: false, status: 400, error: "El nombre del proyecto es obligatorio." };
  }

  const clave = validarClave(entrada.clave ?? "");
  if (!clave.ok) return { ok: false, status: 400, error: clave.error };

  if (!(await existeTabla())) {
    return {
      ok: false,
      status: 503,
      error: "La tabla `tenant_projects` no existe en esta base: falta aplicar la migración 016.",
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO public.tenant_projects (tenant_id, slug, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, slug, display_name, is_active, created_at`,
      [tenantId, clave.clave, displayName]
    );
    await client.query(
      `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
       VALUES ($1, $2, NULL, 'tenant_project_create', $3)`,
      [actor, tenantId, JSON.stringify({ slug: clave.clave, display_name: displayName })]
    );
    await client.query("COMMIT");

    const r: any = rows[0];
    return {
      ok: true,
      proyecto: {
        id: String(r.id),
        slug: String(r.slug),
        displayName: String(r.display_name),
        isActive: r.is_active === true,
        createdAt: new Date(r.created_at).toISOString(),
      },
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    // `UNIQUE (tenant_id, slug)` de la 016. Es un choque legítimo y frecuente —la clave se
    // repite entre ediciones de la misma conferencia—, así que se contesta 409 con el motivo
    // en vez de un 500 que obligue a mirar el log.
    if (err?.code === "23505") {
      return {
        ok: false,
        status: 409,
        error: `Ya existe un proyecto con la clave «${clave.clave}» en este tenant.`,
      };
    }
    logger.error("projects.crearProyecto.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Enciende o apaga la ventana de vinculación (D-221.2).
 *
 * Apagar NO rompe las conversaciones ya vinculadas: corta los vínculos nuevos. Y de ahí sale
 * la propiedad de seguridad del ADR — como las conferencias no se solapan, el conjunto de
 * proyectos vinculables en cualquier instante es casi siempre de tamaño 1, y saber el nombre
 * de un evento apagado no compra nada.
 */
export async function activarProyecto(
  tenantId: string,
  projectId: string,
  isActive: boolean,
  actor: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE public.tenant_projects
          SET is_active = $3, updated_at = timezone('utc', now())
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, projectId, isActive]
    );
    if (rowCount === 0) {
      await client.query("ROLLBACK");
      // El `tenant_id` está en el WHERE a propósito: un id de otro tenant se contesta 404 y no
      // «no autorizado», que confirmaría que ese proyecto existe en algún sitio.
      return { ok: false, status: 404, error: "Proyecto no encontrado en este tenant." };
    }
    await client.query(
      `INSERT INTO public.user_management_audit (actor_id, tenant_id, target_user, action, detail)
       VALUES ($1, $2, NULL, 'tenant_project_toggle', $3)`,
      [actor, tenantId, JSON.stringify({ project_id: projectId, is_active: isActive })]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("projects.activarProyecto.error", { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}
