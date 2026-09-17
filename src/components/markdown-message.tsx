import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { MathRender } from "@/components/math-render";

const markdownClasses = {
  p: "mb-4 last:mb-0 text-[1.05rem] leading-[1.8] text-foreground/95 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  ul: "mb-4 space-y-1.5 pl-5 last:mb-0 [&_li]:text-[1.05rem] [&_li]:leading-[1.7]",
  ol: "mb-4 space-y-1.5 pl-5 last:mb-0 [&_li]:text-[1.05rem] [&_li]:leading-[1.7]",
  li: "list-disc marker:text-accent [ol_&]:list-decimal",
  strong: "font-semibold text-foreground",
  em: "italic text-foreground/90",
  a: "font-medium text-accent underline underline-offset-2 hover:text-accent/80",
  h1: "mb-3 mt-2 text-xl font-semibold first:mt-0 [&:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  h2: "mb-3 mt-3 text-lg font-semibold first:mt-0 [&:last-child]:mb-0",
  h3: "mb-2 mt-2 text-base font-semibold first:mt-0 [&:last-child]:mb-0",
  blockquote:
    "mb-4 border-l-4 border-accent/50 pl-4 italic text-foreground/90 last:mb-0",
  code: "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
};

export function MarkdownMessage({ content }: { content: string }) {
  const renderCode = ({ className, children }: { className?: string; children?: ReactNode }) => {
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    const text = String(children ?? "");

    if (lang === "graph" || lang === "svg") {
      return <MathRender kind={lang} value={text} />;
    }

    return <code className={markdownClasses.code}>{children}</code>;
  };

  const renderPre = ({ children }: { children?: ReactNode }) => {
    // Detect if the wrapped code is a special figure block; if so render it
    // directly without a <pre> box (which would apply white-space: pre).
    const child = Array.isArray(children) ? children[0] : children;
    const cls = (child as ReactNode & { props?: { className?: string } })?.props?.className;
    if (/language-(graph|svg)/.test(cls || "")) {
      return <>{children}</>;
    }
    return <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{children}</pre>;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: (props) => <p className={markdownClasses.p} {...props} />,
        ul: (props) => <ul className={markdownClasses.ul} {...props} />,
        ol: (props) => <ol className={markdownClasses.ol} {...props} />,
        li: (props) => <li className={markdownClasses.li} {...props} />,
        strong: (props) => <strong className={markdownClasses.strong} {...props} />,
        em: (props) => <em className={markdownClasses.em} {...props} />,
        a: (props) => <a className={markdownClasses.a} {...props} />,
        h1: (props) => <h1 className={markdownClasses.h1} {...props} />,
        h2: (props) => <h2 className={markdownClasses.h2} {...props} />,
        h3: (props) => <h3 className={markdownClasses.h3} {...props} />,
        blockquote: (props) => <blockquote className={markdownClasses.blockquote} {...props} />,
        pre: renderPre,
        code: renderCode,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
