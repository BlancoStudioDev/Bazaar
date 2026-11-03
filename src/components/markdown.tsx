"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/ui";

export function Markdown({
  children,
  streaming = false,
  className,
}: {
  children: string;
  streaming?: boolean;
  className?: string;
}) {
  // Some models glue a bold sentence to the previous one ("...marketplace.**Il prezzo").
  // Add the missing space so markdown renders two separate blocks.
  const normalized = children.replace(/([.!?])(\*\*|\[)/g, "$1 $2");

  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const external = Boolean(href && /^https?:\/\//.test(href));
            return (
              <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
              >
                {linkChildren}
                {external ? <ExternalLink className="ml-1 inline h-3 w-3 -translate-y-px" /> : null}
              </a>
            );
          },
          table: ({ children: tableChildren }) => (
            <div className="markdown-table-wrap">
              <table>{tableChildren}</table>
            </div>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="my-3 max-h-64 rounded-xl border border-line object-contain"
            />
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
      {streaming ? <span className="cursor-blink" aria-hidden /> : null}
    </div>
  );
}
