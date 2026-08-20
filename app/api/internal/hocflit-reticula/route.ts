// app/api/internal/hocflit-reticula/route.ts
// ADR-218 D-218.2 — endpoint M2M (S2S) que sirve la retícula HOCFLIT desde el plano de
// control. Es la PRIMERA lectura de `hocflit_blocks`: hasta hoy la tabla existía aplicada
// (migrations-gcp/012, 2026-08-05) y no la leía nadie.
//
// Por qué S2S y no una conexión de BD desde el panel del tenant: el panel del tenant no
// tiene —ni debe tener— credencial contra el plano de control ni contra el Cold-Tier. La
// costura ya existe y es esta misma (ver /api/internal/user-modules y /api/internal/tenant/aliados,
// consumida por tenant-admin-panel/app/api/aliados/route.ts con CONTROL_PLANE_URL + M2M_API_KEY).
// Añadir CONTROL_DB_URL al panel del tenant reintroduciría el acoplamiento que ADR-206 cerró.
//
// Dos orígenes distintos y con destinos de fallo distintos:
//   - taxonomía y geometría → `hocflit_blocks` en el plano de control (pool). Si falla, 500:
//     sin retícula no hay página.
//   - volumen por sistema → `okf_concepts` en el Cold-Tier (withTenant, RLS por tenant). Si
//     falla, `volumen: null` y 200: la retícula se dibuja igual, sin cifras.
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withTenant } from "@/lib/kdb/pool";
import { HOCFLIT_SYSTEMS } from "@/lib/kdb/schemas";
import {
  construirReticula,
  normalizarVolumen,
  type HocflitBlockRow,
} from "@/lib/kdb/reticula";
import {
  construirEjeMarca,
  construirEjeProyecto,
  type EjeAlcance,
  type TenantBrandRow,
} from "@/lib/kdb/alcance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Guard S2S: header x-api-key === M2M_API_KEY (mismo patrón que /api/internal/user-modules).
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.M2M_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // tenant_id es OPCIONAL: la taxonomía es global y el volumen es lo único por tenant.
  // Sin tenant_id se sirve la retícula sin cifras, que es un uso legítimo (catálogo).
  const tenantId = new URL(request.url).searchParams.get("tenant_id");

  let grupos;
  try {
    const { rows } = await pool.query<HocflitBlockRow>(
      `SELECT code, group_code, group_name, placement, level, name, description, system_slug
         FROM hocflit_blocks`
    );
    grupos = construirReticula(rows);
  } catch (err) {
    logger.error("api.internal.hocflit_reticula.control_db_error", { error: String(err) });
    return NextResponse.json({ error: "database error" }, { status: 500 });
  }

  if (grupos.length === 0) {
    // No es un 500: la query funcionó. Es una tabla vacía, y el consumidor debe poder
    // distinguir «el catálogo está vacío» de «el plano de control está caído».
    logger.warn("api.internal.hocflit_reticula.tabla_vacia", {});
  }

  // ADR-220 D-220.5 — el eje de alcance del tenant. Va en la MISMA respuesta que la
  // retícula porque es la misma pantalla y la misma consulta al mismo pool: si el plano de
  // control no responde, la página ya se cae arriba y no hay un modo de fallo nuevo.
  //
  // Tres estados y no dos, igual que el volumen: `null` con `alcance_error` es «no se pudo
  // leer el catálogo» y `null` a secas es «este tenant no declara ejes». Pintarlos igual
  // haría que un fallo de lectura se leyera como una decisión de configuración, y el efecto
  // sería subir sin acotar creyendo que no había nada que acotar.
  let alcance: EjeAlcance | null = null;
  let alcanceError: string | null = null;

  if (tenantId) {
    try {
      // Los dos catálogos en un viaje. `to_regclass` guarda la lectura de `tenant_projects`
      // porque la 016 no la aplica ningún CD: sin la guarda, este endpoint —del que depende
      // TODA la pantalla de conocimiento— daría 500 en cualquier entorno sin migrar.
      const { rows: marcas } = await pool.query<TenantBrandRow>(
        `SELECT slug, display_name
           FROM tenant_brands
          WHERE tenant_id = $1 AND is_active = true
          ORDER BY display_name`,
        [tenantId]
      );

      let proyectos: TenantBrandRow[] = [];
      const { rows: existe } = await pool.query<{ hay: string | null }>(
        `SELECT to_regclass('public.tenant_projects') AS hay`
      );
      if (existe[0]?.hay) {
        const res = await pool.query<TenantBrandRow>(
          `SELECT slug, display_name
             FROM tenant_projects
            WHERE tenant_id = $1 AND is_active = true
            ORDER BY display_name`,
          [tenantId]
        );
        proyectos = res.rows;
      }

      const ejeProyecto = construirEjeProyecto(proyectos);
      const ejeMarca = construirEjeMarca(marcas);

      // ⚠️ UN TENANT CON LOS DOS EJES NO SE SIRVE A MEDIAS. La superficie de carga dibuja UN
      // paso de alcance, así que elegir uno en silencio haría desaparecer el otro selector —y
      // con él, la posibilidad de acotar por ese eje— sin que nadie se entere. Que un tenant
      // pueda tener marca Y proyecto es explícito en D-220.1, así que este caso llegará; lo que
      // no puede es llegar callado. Se sirve como error, que el panel ya pinta en tono de aviso.
      if (ejeProyecto && ejeMarca) {
        alcance = null;
        alcanceError =
          "este tenant declara marca Y proyecto, y la superficie de carga sólo dibuja un eje";
        logger.warn("api.internal.hocflit_reticula.dos_ejes", { tenantId });
      } else {
        // El proyecto gana cuando existe: es el eje más restrictivo de los dos.
        alcance = ejeProyecto ?? ejeMarca;
      }
    } catch (err) {
      logger.error("api.internal.hocflit_reticula.alcance_error", { error: String(err) });
      alcanceError = "no se pudo leer el catálogo de alcance del tenant";
    }
  }

  let volumen: Record<string, number> | null = null;
  let volumenError: string | null = null;

  if (!tenantId) {
    volumenError = "sin tenant_id: la retícula se sirve sin volumen";
  } else {
    try {
      const rows = await withTenant(tenantId, async (client) => {
        const res = await client.query<{ system_slug: string | null; total: number }>(
          `SELECT system_slug, COUNT(*)::int AS total
             FROM okf_concepts
            GROUP BY system_slug`
        );
        return res.rows;
      });
      volumen = normalizarVolumen(rows, HOCFLIT_SYSTEMS);
    } catch (err) {
      // Degradación deliberada: `volumen: null` NUNCA se convierte en ceros. Un 0 dibujado
      // afirma «este sistema está vacío», y eso es justo lo que D-218.7 usa para medir.
      logger.error("api.internal.hocflit_reticula.cold_tier_error", { error: String(err) });
      volumenError = "no se pudo contar el conocimiento por sistema";
    }
  }

  return NextResponse.json({
    grupos,
    alcance,
    alcance_error: alcanceError,
    volumen,
    volumen_error: volumenError,
    // D-218.5: quien dibuje esto para un cliente debe rotular que la geometría es nuestra.
    // Viaja en la respuesta para que la condición no dependa de que alguien recuerde el ADR.
    geometria_es_interpretacion_propia: true,
  });
}
