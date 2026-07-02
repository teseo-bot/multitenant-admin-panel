// lib/knowledge-ops/tree-utils.ts
// K7-W3: Utilidades para agrupar y organizar conceptos en árbol (P3 browser).
// Lógica pura, testeble, sin dependencias de React.

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  order: number; // para ordenar: directorios primero, luego alfabético
}

/**
 * Agrupa paths de conceptos por estructura de directorio.
 * Ej: "c-comercial/objeciones.md", "c-comercial/precios.md" -> árbol con directorio "c-comercial"
 * Retorna nodos raíz (los 7 sistemas + "_staging") ordenados.
 */
export function buildConceptTree(paths: string[]): TreeNode[] {
  const systemOrder: Record<string, number> = {
    "h-talento-humano": 0,
    "o-operaciones": 1,
    "c-comercial": 2,
    "f-finanzas": 3,
    "l-legal": 4,
    "i-innovacion": 5,
    "t-tecnologia": 6,
    "_staging": 7,
  };

  const map = new Map<string, TreeNode>();

  paths.forEach((path) => {
    const parts = path.split("/");
    let currentPath = "";

    parts.forEach((part, idx) => {
      if (!part) return; // saltar paths vacíos
      const isLast = idx === parts.length - 1;
      const prevPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!map.has(currentPath)) {
        const order =
          idx === 0
            ? systemOrder[part] ?? 999 // sistemas ordenados, resto al final
            : 999; // subdirectorios alfabético implícito
        map.set(currentPath, {
          name: part,
          path: currentPath,
          isDirectory: !isLast || !part.endsWith(".md"),
          children: [],
          order,
        });
      }

      // Añadir como hijo del padre
      if (prevPath) {
        const parent = map.get(prevPath);
        const child = map.get(currentPath);
        if (parent && child && !parent.children.find((c) => c.path === currentPath)) {
          parent.children.push(child);
        }
      }
    });
  });

  // Retornar solo raíces (primer nivel) ordenadas
  const roots = Array.from(map.values())
    .filter((node) => !node.path.includes("/"))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  // Ordenar hijos recursivamente
  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortChildren);
  }

  roots.forEach(sortChildren);
  return roots;
}

/**
 * Extrae el nombre del concepto (último componente del path sin .md).
 * Ej: "c-comercial/objeciones.md" -> "objeciones"
 */
export function getConceptName(path: string): string {
  const part = path.split("/").pop() ?? path;
  return part.endsWith(".md") ? part.slice(0, -3) : part;
}
