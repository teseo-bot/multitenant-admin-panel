# Límite de Dominios y Reglas de Arquitectura (Night Run - 22 Abril 2026)

## 1. Aislamiento Topológico Estricto
- **CRM Agéntico (`Teseo-AI-CRM`)** y **`fleetco-plus`** son dominios de software y negocio totalmente independientes. 
- Queda estrictamente prohibido cruzar referencias, componentes o heredar dependencias entre ellos.

## 2. Restricciones de Layout (CRM Agéntico)
El sistema solo reconoce y da soporte a dos (2) layouts:
1. **Mission Control Layout:** Para la operación táctica y orquestación.
2. **Control Panel Layout:** Para administración y configuración (Ej. Panel de Gestión de Usuarios).

*Cualquier otro layout detectado en el repositorio (ej. GlobalLayout, BaseLayout genérico) debe ser tratado como código muerto/residual de otro dominio y ser ignorado o purgado.*

## 3. UI System
- El estándar obligatorio para el CRM Agéntico es **Shadcn UI**.
- Todas las interfaces del Panel de Gestión de Usuarios deben construirse utilizando los componentes primitivos de Shadcn sobre Tailwind CSS.
