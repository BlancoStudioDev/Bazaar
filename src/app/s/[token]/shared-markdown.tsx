import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown in sola lettura per contenuti condivisi. react-markdown non interpreta HTML grezzo e
 * filtra gli schemi pericolosi (javascript:, ecc.); qui in più: link esterni con rel sicuro e
 * nessuna immagine remota (non far partire richieste verso host arbitrari a chi apre il link).
 */
export function SharedMarkdown({ children }: { children: string }) {
  const normalized = children.replace(/([.!?])(\*\*|\[)/g, (match, end: string, next: string) =>
    end === "!" && next === "[" ? match : `${end} ${next}`,
  );
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => {
            const external = Boolean(href && /^https?:\/\//i.test(href));
            return external ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc" referrerPolicy="no-referrer">
                {linkChildren}
              </a>
            ) : (
              <span>{linkChildren}</span>
            );
          },
          table: ({ children: tableChildren }) => (
            <div className="markdown-table-wrap">
              <table>{tableChildren}</table>
            </div>
          ),
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
