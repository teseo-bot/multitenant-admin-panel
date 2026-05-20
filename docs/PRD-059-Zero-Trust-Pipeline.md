# PRD-001: Pipeline Agéntico Zero-Trust (Modelo de 3 Nodos)

## 1. Meta y Visión
Establecer un flujo de desarrollo de software B2B completamente autónomo, auditable y libre de confianza implícita (Zero-Trust). El sistema debe prevenir la inyección de deuda técnica, fallos de seguridad (SAST/SCA) y sobrecostes de infraestructura (FinOps) mediante la separación estricta de responsabilidades entre agentes especializados.

## 2. Perfiles Agénticos (El Equipo)

La topología de la fuerza de trabajo se define en 3 nodos con fronteras duras:

### 2.1. Nodo Arquitecto (Planificación y TDD)
*   **Responsabilidad:** Comprender requerimientos, auditar contexto histórico y definir la arquitectura.
*   **Entregables:** Documentos de Diseño (ADRs), Planes de ejecución Markdown, y Tests de Integración/Unitarios (que deben fallar inicialmente).
*   **Restricción:** No implementa lógica de negocio en producción.

### 2.2. Nodo Ejecutor (Implementación)
*   **Responsabilidad:** Consumir los planes del Arquitecto y escribir el código que satisfaga los tests (Green Phase).
*   **Mecanismo:** Se lanzan como sub-agentes efímeros y paralelos limitados a un contexto de archivo específico.
*   **Restricción:** Operan en ramas aisladas. Tienen prohibido modificar la infraestructura o las reglas de CI/CD.

### 2.3. Nodo Auditor (Review & SecOps)
*   **Responsabilidad:** Actuar como el "Gatekeeper" implacable. Valida cobertura, seguridad y FinOps.
*   **Herramientas Asignadas:** `Semgrep` (SAST), `Trivy` (SCA), `Infracost` (FinOps).
*   **Restricción:** Solo este nodo puede aprobar la fusión de ramas (Merges) y el despliegue. Si detecta fuga de datos (ej. bypass de RLS), rechaza el PR.

## 3. Criterios de Aceptación (Zero Trust Workflow)

1.  **Código sin Tests se Rechaza:** Ningún Ejecutor puede comenzar si el Arquitecto no ha provisto la suite de pruebas.
2.  **Aislamiento de Estado:** Los Ejecutores no comparten memoria de contexto; se comunican únicamente mediante el código fuente escrito y los resultados del linter/compilador.
3.  **Auditoría CI/CD:** Todo código debe compilar en frío en un entorno Dockerizado antes de ser revisado por el Auditor.
4.  **Presupuesto Restringido:** El Auditor debe rechazar implementaciones que incrementen el uso de tokens/recursos de cómputo por encima del umbral FinOps definido sin justificación en un ADR.

## 4. Stack Tecnológico de Control
*   **Framework de Ejecución:** Hermes Agent (Sub-agent delegation).
*   **Métricas y Trazabilidad:** LangSmith / W&B (para telemetría de decisiones).
*   **Pipeline Base:** GitHub Actions / GitLab CI emulado localmente vía Docker.
