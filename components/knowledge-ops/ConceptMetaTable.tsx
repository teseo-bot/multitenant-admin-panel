// components/knowledge-ops/ConceptMetaTable.tsx
// UXUI-OKF-Knowledge-Ops.md — ConceptMetaTable { frontmatter } — usado en P2 y P3.
// P3: "frontmatter como tabla de metadatos (type, altitude con chip, confidence con
// badge de color, pii, tags)".

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AltitudeChip } from "./AltitudeChip";
import { ConfidenceBadge, type Confidence } from "./ConfidenceBadge";
import type { ConceptFrontmatter } from "@/lib/kdb/schemas";

export interface ConceptMetaTableProps {
  frontmatter: Partial<ConceptFrontmatter> & Record<string, unknown>;
}

export function ConceptMetaTable({ frontmatter }: ConceptMetaTableProps) {
  const altitude = frontmatter.altitude;
  const confidence = frontmatter.confidence as Confidence | undefined;

  return (
    <Table aria-label="Metadatos del concepto">
      <TableBody>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground w-32">Tipo</TableCell>
          <TableCell>{frontmatter.type ?? "—"}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Título</TableCell>
          <TableCell>{frontmatter.title ?? "—"}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Descripción</TableCell>
          <TableCell>{frontmatter.description ?? "—"}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Altitud</TableCell>
          <TableCell>
            {altitude ? <AltitudeChip altitude={altitude as 1 | 2 | 3 | 4 | 5} /> : "—"}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Confianza</TableCell>
          <TableCell>{confidence ? <ConfidenceBadge confidence={confidence} /> : "—"}</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">PII</TableCell>
          <TableCell>
            <Badge variant={frontmatter.pii === "redacted" ? "secondary" : "outline"}>
              {frontmatter.pii ?? "—"}
            </Badge>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Tags</TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1">
              {Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0
                ? frontmatter.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))
                : "—"}
            </div>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium text-muted-foreground">Fuentes</TableCell>
          <TableCell>
            {Array.isArray(frontmatter.sources) && frontmatter.sources.length > 0
              ? frontmatter.sources.join(", ")
              : "—"}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
