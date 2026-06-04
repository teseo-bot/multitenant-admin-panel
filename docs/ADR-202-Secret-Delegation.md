# ADR-202-B: Delegación de Secretos y Control Plane Proxy (04 Junio 2026)

## 1. Contexto y Problema
En el desarrollo del Tenant Admin Panel (Multitenant), llegamos al módulo de gestión de **API Keys**. Dado que la arquitectura futura aislará a cada Inquilino en su propio proyecto GCP (Single-Tenant Siloed), almacenar las llaves maestras o de API de todos los clientes en la base de datos central de `teseocontextkdb` representa un riesgo de seguridad de Nivel 1 (Single Point of Failure) y viola el principio de aislamiento.

## 2. Decisión Arquitectónica
Se adopta el patrón de **Control Plane Proxy**.
El panel central (Multitenant) NO alojará las llaves API de los inquilinos. Operará exclusivamente como un orquestador ciego para la gestión de secretos.

- **Almacenamiento Físico:** Cada API Key, token de integración o llave de cifrado se alojará de forma nativa en el **Google Secret Manager** del proyecto GCP individual de cada Inquilino.
- **Mecanismo de Gestión:** Cuando el CEO o un Administrador genere o revoque una llave desde el panel central, el backend (`_apiKeysActions.ts`) no ejecutará un UPDATE en Cloud SQL. En su lugar, emitirá una llamada HTTP segura hacia la `orchestrator_url` del Tenant específico.
- **Responsabilidad del Nodo:** Es responsabilidad del microservicio orquestador del inquilino recibir la instrucción, interactuar con su Secret Manager local y devolver únicamente metadatos o la llave ofuscada (`sk_...***1234`) al panel central para su visualización.

## 3. Directiva Operativa para Ingeniería de Infraestructura
**A la atención del DevOps / Ingeniero de Seguridad:**
Al ejecutar rotación de claves, migraciones o auditorías de seguridad, **las llaves nunca se volcarán ni respaldarán desde la base de datos relacional**. 
El ciclo de vida del secreto (Rotación, Revocación, Auditoría de Acceso) debe gestionarse y auditarse utilizando las políticas de IAM y logs de acceso de Google Secret Manager en el proyecto destino. El Tenant 0 (operando en el proyecto origen por razones de costo inicial) simulará idéntica separación de responsabilidades a nivel de red, consumiendo su propio endpoint como si fuera remoto.

---
**Firmado:** Teseo (Gerente AIDevops)
**Aprobado:** Jorge García (CEO)
