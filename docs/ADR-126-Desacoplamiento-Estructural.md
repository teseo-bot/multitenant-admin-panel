# ADR-126: Desacoplamiento Estructural de Playbooks y Estado Transaccional

| Campo          | Valor                          |
|----------------|--------------------------------|
| **Estado**     | Aceptado                       |
| **Fecha**      | 2026-04-21                     |
| **Autor**      | Builder (Arquitecto)           |
| **Aprobado por** | Jorge (CEO)                  |
| **Inspiración** | Modelo `jobs.json` / `jobs-state.json` de OpenClaw |

---

## Contexto

Teseo AI CRM opera con dos equipos que tocan dominios complementarios pero fundamentalmente distintos:

- **Team-L (Estructura):** Define la lógica de negocio declarativa — playbooks de campaña, system prompts y workflows. Estos artefactos representan la *intención* del negocio y cambian con baja frecuencia, de forma deliberada y revisada.
- **Team-C (Estado):** Opera sobre los datos transaccionales vivos — leads, mensajes de inbox, hilos de conversación y la outbox de asignación. Estos datos mutan constantemente en tiempo real, impulsados por el Motor Agéntico (LangGraph).

Sin una frontera arquitectónica explícita, existe el riesgo de que los grafos de LangGraph —diseñados para mutar estado transaccional— terminen alterando accidentalmente la configuración estructural, corrompiendo playbooks o workflows. Esta mezcla de dominios es la fuente clásica de bugs silenciosos y regresiones difíciles de diagnosticar.

El modelo de OpenClaw (`jobs.json` como estructura inmutable vs. `jobs-state.json` como estado mutable) demuestra que esta separación es viable y produce sistemas más predecibles y auditables.

---

## Decisión

Se establece la siguiente **restricción arquitectónica obligatoria**:

### 1. Zona de Estructura / Configuración (Solo-Lectura para el Orquestador)

Estos artefactos son propiedad de **Team-L** y son tratados como **inmutables** por el Motor Agéntico:

| Artefacto                | Descripción                                                    |
|--------------------------|----------------------------------------------------------------|
| **Playbooks de Campaña** | Secuencias, reglas de calificación, cadencias de contacto      |
| **System Prompts**       | Instrucciones base para los agentes conversacionales           |
| **Workflows**            | Definiciones de flujos (nodos, transiciones, condiciones)      |

**Regla:** Los grafos de LangGraph pueden **leer** estos artefactos para guiar su comportamiento, pero tienen **estrictamente prohibido escribir, modificar o eliminar** cualquier registro en las tablas de configuración.

Las modificaciones a la Zona de Estructura se realizan exclusivamente a través de procesos controlados de Team-L (PRs, migraciones versionadas, panel de administración con auditoría).

### 2. Zona de Estado / Transaccional (Zona Mutable del Motor Agéntico)

Estas tablas son la **zona dinámica** que el Motor Agéntico (LangGraph) puede mutar libremente durante la ejecución:

| Tabla                        | Descripción                                              |
|------------------------------|----------------------------------------------------------|
| `leads`                      | Estado actual del lead (etapa, score, metadata dinámica) |
| `inbox_messages`             | Mensajes entrantes y salientes de conversaciones         |
| `thread_id`                  | Identificadores de hilo para continuidad conversacional  |
| `lead_assignment_outbox`     | Cola de asignaciones pendientes de leads a agentes       |

**Regla:** El Motor Agéntico opera libremente dentro de esta zona. Toda mutación de estado vivo ocurre aquí.

### 3. Diagrama de Fronteras

```
┌─────────────────────────────────────────────────────┐
│                   TESEO AI CRM                      │
│                                                     │
│  ┌───────────────────────┐  ┌────────────────────┐  │
│  │  ZONA DE ESTRUCTURA   │  │  ZONA DE ESTADO    │  │
│  │  (Team-L / Read-Only) │  │  (Team-C / Mutable)│  │
│  │                       │  │                    │  │
│  │  • Playbooks          │  │  • leads           │  │
│  │  • System Prompts     │  │  • inbox_messages  │  │
│  │  • Workflows          │  │  • thread_id       │  │
│  │                       │  │  • lead_assignment  │  │
│  │                       │  │    _outbox         │  │
│  └───────────┬───────────┘  └────────┬───────────┘  │
│              │ READ ONLY             │ READ/WRITE   │
│              └──────────┐ ┌──────────┘              │
│                         ▼ ▼                         │
│               ┌─────────────────┐                   │
│               │  Motor Agéntico │                   │
│               │   (LangGraph)   │                   │
│               └─────────────────┘                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4. Mecanismos de Enforcement

- **Permisos de base de datos:** El rol/usuario de conexión del Motor Agéntico debe tener `SELECT` sobre tablas de configuración y `SELECT/INSERT/UPDATE/DELETE` solo sobre tablas transaccionales.
- **Validación en capa de aplicación:** Los adaptadores de acceso a datos del orquestador deben exponer interfaces de solo-lectura para artefactos de estructura.
- **Tests de integración:** Incluir tests que verifiquen que ningún grafo de LangGraph emite operaciones de escritura contra tablas de configuración.
- **Code review:** Cualquier PR que toque la capa de acceso a datos de configuración requiere aprobación explícita de Team-L.

---

## Consecuencias

### Positivas

- **Predictibilidad:** Los playbooks y prompts no pueden ser alterados por ejecución agéntica, eliminando una clase entera de bugs silenciosos.
- **Auditabilidad:** Los cambios a estructura pasan por procesos controlados con trazabilidad completa. Los cambios a estado son atribuibles al Motor Agéntico.
- **Autonomía de equipos:** Team-L itera sobre estructura sin miedo a interferencia del runtime. Team-C itera sobre lógica agéntica sin riesgo de corromper configuración.
- **Alineación con patrones probados:** El modelo es análogo a `jobs.json` (inmutable) vs. `jobs-state.json` (mutable) de OpenClaw, validado en producción.

### Negativas

- **Rigidez inicial:** Si surge la necesidad de que el Motor Agéntico "sugiera" cambios a playbooks, se necesitará un mecanismo indirecto (e.g., una tabla de `suggested_changes` en la zona transaccional, revisada por humanos).
- **Disciplina de clasificación:** Cada nueva tabla o artefacto debe clasificarse explícitamente en una de las dos zonas. Esto requiere diligencia continua.
- **Overhead de permisos:** Configurar y mantener permisos granulares de DB añade complejidad operativa.

### Riesgos Mitigados

| Riesgo                                         | Mitigación                                      |
|------------------------------------------------|-------------------------------------------------|
| Grafo de LangGraph sobrescribe un playbook     | Permisos de DB + interfaces read-only           |
| Nueva tabla creada sin clasificar              | Checklist obligatorio en PR template             |
| Necesidad futura de mutación cruzada           | Patrón de outbox/sugerencia en zona transaccional|

---

## Notas de Implementación

1. **Fase 1:** Documentar la clasificación de todas las tablas existentes en las dos zonas.
2. **Fase 2:** Aplicar permisos de DB para el rol del Motor Agéntico.
3. **Fase 3:** Añadir tests de integración que validen la restricción.
4. **Fase 4:** Actualizar el PR template con checklist de clasificación de zona.

---

*Este ADR es vinculante para toda modificación al esquema de datos y a los grafos de LangGraph del sistema Teseo AI CRM.*
