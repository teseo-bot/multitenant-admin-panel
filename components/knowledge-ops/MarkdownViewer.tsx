// components/knowledge-ops/MarkdownViewer.tsx
// UXUI-OKF-Knowledge-Ops.md — MarkdownViewer { content, onLinkClick } — usado en P2 y P3.
// No hay renderer markdown instalado en el panel (grep de "markdown|remark|rehype" en
// package.json → 0 resultados) y la spec prohíbe instalar librerías nuevas de UI.
// Se implementa un render seguro propio: parsea un subconjunto de Markdown (headings,
// párrafos, listas, código, negrita/cursiva, enlaces) a elementos React — NUNCA
// dangerouslySetInnerHTML de HTML crudo sin sanitizar. Cross-links internos relativos
// (`[texto](/c-comercial/otro-concepto.md)`, TRD §3) disparan onLinkClick en vez de
// navegar, para integrarse con el visor de P3.

import { Fragment } from "react";

export interface MarkdownViewerProps {
  content: string;
  onLinkClick?: (path: string) => void;
}

interface InlineToken {
  type: "text" | "bold" | "italic" | "code" | "link";
  text: string;
  href?: string;
}

function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Orden: código `x`, negrita **x**, cursiva *x*, enlace [texto](href)
  const regex = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ type: "code", text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "bold", text: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: "italic", text: match[3] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      tokens.push({ type: "link", text: match[4], href: match[5] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) });
  }
  return tokens;
}

function InlineContent({
  text,
  onLinkClick,
}: {
  text: string;
  onLinkClick?: (path: string) => void;
}) {
  const tokens = tokenizeInline(text);
  return (
    <Fragment>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case "code":
            return (
              <code key={idx} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                {token.text}
              </code>
            );
          case "bold":
            return <strong key={idx}>{token.text}</strong>;
          case "italic":
            return <em key={idx}>{token.text}</em>;
          case "link": {
            const href = token.href ?? "";
            const isInternal = href.startsWith("/") || !/^[a-z]+:\/\//i.test(href);
            if (isInternal && onLinkClick) {
              return (
                <button
                  key={idx}
                  type="button"
                  className="text-primary underline underline-offset-2 hover:opacity-80"
                  onClick={() => onLinkClick(href)}
                >
                  {token.text}
                </button>
              );
            }
            return (
              <a
                key={idx}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                {token.text}
              </a>
            );
          }
          default:
            return <Fragment key={idx}>{token.text}</Fragment>;
        }
      })}
    </Fragment>
  );
}

export function MarkdownViewer({ content, onLinkClick }: MarkdownViewerProps) {
  const lines = (content ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Bloque de código fenced ```
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // salta la línea de cierre
      blocks.push(
        <pre key={key++} className="overflow-x-auto rounded-md bg-muted p-3 text-xs font-mono">
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Encabezados
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const HeadingTag = (`h${Math.min(level + 1, 6)}`) as keyof React.JSX.IntrinsicElements;
      const sizeClass =
        level === 1
          ? "text-xl font-bold mt-4 mb-2"
          : level === 2
            ? "text-lg font-semibold mt-3 mb-2"
            : "text-base font-semibold mt-2 mb-1";
      blocks.push(
        <HeadingTag key={key++} className={sizeClass}>
          <InlineContent text={text} onLinkClick={onLinkClick} />
        </HeadingTag>
      );
      i++;
      continue;
    }

    // Lista (- o *)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-2 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>
              <InlineContent text={item} onLinkClick={onLinkClick} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Lista numerada
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-2 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>
              <InlineContent text={item} onLinkClick={onLinkClick} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Párrafo: acumula líneas contiguas no vacías
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s+/.test(lines[i]) && !lines[i].trim().startsWith("```") && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed">
        <InlineContent text={paraLines.join(" ")} onLinkClick={onLinkClick} />
      </p>
    );
  }

  return <div className="prose-sm max-w-none text-sm">{blocks}</div>;
}
