import ReactMarkdown from "react-markdown";

/** Muestra texto Markdown (consentimientos, políticas). No interpreta HTML incrustado. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="[&_blockquote]:border-acento [&_blockquote]:bg-acento/15 [&_h2]:text-primario flex flex-col gap-3 text-sm leading-relaxed [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      <ReactMarkdown skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
