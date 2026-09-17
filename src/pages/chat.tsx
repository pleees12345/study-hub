import { FormEvent, useRef, useState } from "react";
import { FileText, Globe, Loader2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownMessage } from "@/components/markdown-message";
import { cn } from "@/lib/utils";
import { chatWithTeacher, researchWithTeacher, type ChatMessage } from "@/lib/ai";
import { describeDocuments, useRevisionDocumentStore } from "@/features/revision/store";

type DisplayMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string }>;
};

const WELCOME: DisplayMessage = {
  role: "assistant",
  content:
    "Hi, I'm your Study Hub tutor. Ask me anything — a concept from class, a homework question, or how to plan your revision. I'll explain it step by step.",
};

export function ChatPage() {
  const docs = useRevisionDocumentStore();
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webEnabled, setWebEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasDocuments = Boolean(docs.notes.trim() || docs.fileName);
  const context = describeDocuments(docs);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // Build the chat history for the model (skip the local welcome message).
    const history: ChatMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .filter((m) => m.content !== WELCOME.content)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      if (webEnabled) {
        const result = await researchWithTeacher(question, context);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.answer, sources: result.sources },
        ]);
      } else {
        const answer = await chatWithTeacher(
          [...history, { role: "user", content: question }],
          context,
        );
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't reach the AI just now. ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col gap-4">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Tutor chat</h2>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Ask a question and get a teacher-style explanation, with conversation history kept on screen.
        </p>
        <button
          type="button"
          onClick={() => setWebEnabled((v) => !v)}
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            webEnabled
              ? "border-accent bg-accent/10 text-accent"
              : "border-input bg-card text-muted-foreground hover:bg-secondary/60",
          )}
        >
          <Globe className="h-4 w-4" />
          {webEnabled ? "Web research: on" : "Web research: off"}
        </button>
        {hasDocuments && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0 text-accent" />
            <span className="truncate">
              Using your Revision document{docs.fileName ? `: ${docs.fileName}` : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-6 w-6 shrink-0"
              onClick={() => {
                useRevisionDocumentStore.getState().clear();
              }}
              aria-label="Disconnect document"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
          >
            <span
              className={cn(
                "mb-1 text-[0.7rem] font-medium uppercase tracking-wider",
                message.role === "user" ? "text-primary/70" : "text-accent",
              )}
            >
              {message.role === "user" ? "You" : "Tutor"}
            </span>
            <div
              className={cn(
                "max-w-[88%] rounded-2xl px-5 py-4",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap text-[1.05rem] leading-[1.8]">
                  {message.content}
                </p>
              ) : (
                <>
                  <MarkdownMessage content={message.content} />
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 border-t border-secondary-foreground/10 pt-2">
                      <p className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                        Sources
                      </p>
                      <ul className="space-y-1">
                        {message.sources.map((source, i) => (
                          <li key={i} className="text-xs">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent underline-offset-2 hover:underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="mb-1 text-[0.7rem] font-medium uppercase tracking-wider text-accent">
              Tutor
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary px-5 py-4 text-[1.05rem] text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask your tutor a question…"
          autoComplete="off"
          className="h-12 flex-1 rounded-md border border-input bg-card px-4 py-2 text-[1.05rem] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={loading || !input.trim()} className="h-12 px-5 text-[1.05rem]">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          Send
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-end text-muted-foreground"
        onClick={() => {
          setMessages([WELCOME]);
          setInput("");
        }}
      >
        <Sparkles className="mr-1 h-3 w-3" />
        Clear conversation
      </Button>
    </div>
  );
}
