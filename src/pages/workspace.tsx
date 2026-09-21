import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AudioLines,
  BookOpenCheck,
  Clock,
  Download,
  FileScan,
  FileText,
  Library,
  Loader2,
  MessageCircle,
  PencilLine,
  Play,
  Presentation,
  Send,
  Sparkles,
  StopCircle,
  Timer,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownMessage } from "@/components/markdown-message";
import { DrawingBoard } from "@/components/drawing-board";
import { cn } from "@/lib/utils";
import {
  analyzeExam,
  chatWithTeacher,
  EXAM_BOARDS,
  EXAM_LEVELS,
  generateExamPaper,
  generateMaterial,
  generateSlides,
  generateVideoPlan,
  gradeExam,
  type ChatMessage,
  type ExamAnswer,
  type ExamLevel,
  type SlideDeck,
  type WeakArea,
} from "@/lib/ai";
import { composeAudio } from "@/lib/audio";
import { composeVideo } from "@/lib/video";
import { deleteMedia, loadMedia, saveMedia } from "@/lib/media-store";
import { useWorkspacesStore, type GeneratedItem, type RevisionFile } from "@/features/revision/workspaces-store";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fileKind(file: File): RevisionFile["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "text";
}

/** Grounds the tutor + video AI in the workspace's files and weak areas. */
function workspaceContext(subject: string, files: RevisionFile[], summary: string, weakAreas: WeakArea[]) {
  const parts: string[] = [`Subject: ${subject}`];
  for (const f of files) {
    if (f.text.trim()) parts.push(`Document "${f.name}":\n${f.text.trim()}`);
    else parts.push(`Attached document: ${f.name}`);
  }
  if (summary.trim()) parts.push(`Analysis summary:\n${summary.trim()}`);
  if (weakAreas.length) {
    parts.push(
      "Weak areas:\n" +
        weakAreas.map((a) => `- ${a.subject}: ${a.topic} (${a.level}) — ${a.insight}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

const FALLBACK_WEAK_AREAS: WeakArea[] = [
  {
    subject: "This workspace",
    topic: "Upload an exam or notes",
    level: "Needs work",
    insight: "Scan an exam or add notes to get AI-highlighted weak areas.",
  },
];

/** Format seconds as "MM:SS" (or "H:MM:SS" past an hour). */
function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspacesStore((s) => s.workspaces.find((w) => w.id === id));

  useEffect(() => {
    if (id && !workspace) navigate("/revision", { replace: true });
  }, [id, workspace, navigate]);

  if (!workspace) return null;

  return <Workspace workspace={workspace} />;
}

type WorkspaceView = ReturnType<typeof useWorkspacesStore.getState>["workspaces"][number];

function Workspace({ workspace }: { workspace: WorkspaceView }) {
  const addMessage = useWorkspacesStore((s) => s.addMessage);
  const setMessages = useWorkspacesStore((s) => s.setMessages);
  const addFile = useWorkspacesStore((s) => s.addFile);
  const removeFile = useWorkspacesStore((s) => s.removeFile);
  const setAnalysis = useWorkspacesStore((s) => s.setAnalysis);
  const setVideoPlan = useWorkspacesStore((s) => s.setVideoPlan);
  const setSlides = useWorkspacesStore((s) => s.setSlides);
  const setAudioUrl = useWorkspacesStore((s) => s.setAudioUrl);
  const addGenerated = useWorkspacesStore((s) => s.addGenerated);
  const updateGenerated = useWorkspacesStore((s) => s.updateGenerated);
  const removeGenerated = useWorkspacesStore((s) => s.removeGenerated);
  const setExamPaper = useWorkspacesStore((s) => s.setExamPaper);
  const setExamGrade = useWorkspacesStore((s) => s.setExamGrade);

  // Chat state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const context = useMemo(
    () => workspaceContext(workspace.subject, workspace.files, workspace.summary, workspace.weakAreas),
    [workspace],
  );

  // Files state
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Study state
  const [materialTopic, setMaterialTopic] = useState("");

  // Video state
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoProgress, setVideoProgress] = useState("");

  // Audio + slides state
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [audioProgress, setAudioProgress] = useState("");
  const [audioUrl, setAudioUrlLocal] = useState<string | null>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [slidesError, setSlidesError] = useState("");
  const [slides, setSlidesLocal] = useState<SlideDeck | null>(null);

  // Exam preparation state
  const [examLevel, setExamLevel] = useState<ExamLevel>("GCSE");
  const [customLevel, setCustomLevel] = useState("");
  const [examBoard, setExamBoard] = useState("AQA");
  const [examTopic, setExamTopic] = useState("");
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState("");
  const [examAnswers, setExamAnswers] = useState<Record<number, string>>({});
  const [examDrawings, setExamDrawings] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState(false);
  const [gradingError, setGradingError] = useState("");

  // Timed test state
  const [examRunning, setExamRunning] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [examDuration, setExamDuration] = useState(30); // minutes
  const [examDeadline, setExamDeadline] = useState<number | null>(null); // epoch ms
  const [examTimeLeft, setExamTimeLeft] = useState(0); // seconds
  // Fullscreen "lockdown" — true while the test is running but the user has
  // left fullscreen (e.g. pressed Esc), so we can block the page until they
  // resume fullscreen or finish the test.
  const [fullscreenExited, setFullscreenExited] = useState(false);

  const uploadLabel = file ? file.name : "Upload an exam PDF or image";

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    addMessage(workspace.id, { id: crypto.randomUUID(), role: "user", content: question });
    setInput("");
    setLoading(true);

    const history: ChatMessage[] = workspace.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const answer = await chatWithTeacher(
        [...history, { role: "user", content: question }],
        context,
      );
      addMessage(workspace.id, { id: crypto.randomUUID(), role: "assistant", content: answer });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      addMessage(workspace.id, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Sorry, I couldn't reach the AI just now. ${message}`,
      });
    } finally {
      setLoading(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  }

  async function handleUpload() {
    if (!file) return;
    let text = "";
    let imageDataUrl = "";
    if (file.type.startsWith("image/")) {
      imageDataUrl = await fileToDataUrl(file);
    } else {
      const readable = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
      if (readable) text = await file.text();
    }
    addFile(workspace.id, { name: file.name, kind: fileKind(file), text, imageDataUrl });
    setFile(null);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      let imageDataUrl: string | undefined;
      let notesForModel = notes.trim();

      if (file?.type.startsWith("image/")) {
        imageDataUrl = await fileToDataUrl(file);
      } else if (file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf")) {
        notesForModel =
          `${notesForModel}\n\n(PDF uploaded: ${file.name}. Summarize likely weak areas from the filename and student notes; full PDF text extraction is not available yet.)`.trim();
      } else if (file) {
        const text = await file.text();
        notesForModel = `${notesForModel}\n\n${text}`.trim();
      }

      if (!notesForModel && !imageDataUrl) {
        throw new Error("Add notes or upload an exam image first.");
      }

      const result = await analyzeExam({
        notes: notesForModel,
        fileName: file?.name,
        imageDataUrl,
      });
      setAnalysis(workspace.id, { weakAreas: result.weakAreas, summary: result.summary });
      if (result.weakAreas[0]) setMaterialTopic(result.weakAreas[0].topic);
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleMakeVideo() {
    setVideoLoading(true);
    setVideoError("");
    setVideoProgress("");
    try {
      const plan = await generateVideoPlan({
        subject: workspace.subject,
        topic: materialTopic.trim() || workspace.subject || "General revision",
        notes: context,
      });
      setVideoPlan(workspace.id, plan);
      setVideoProgress("Rendering video…");
      const blob = await composeVideo(plan, setVideoProgress);

      const itemId = crypto.randomUUID();
      const mediaKey = `${workspace.id}:${itemId}`;
      await saveMedia(mediaKey, blob);

      const url = URL.createObjectURL(blob);
      addGenerated(workspace.id, {
        id: itemId,
        kind: "video",
        title: plan.title,
        createdAt: new Date().toISOString(),
        url,
      });
      setVideoProgress("");
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Video generation failed");
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleGenerateAudio() {
    setAudioLoading(true);
    setAudioError("");
    setAudioProgress("");
    setAudioUrlLocal(null);
    try {
      // Build a narration script from the topic + workspace context, then speak it.
      const script = await generateMaterial({
        kind: "audio",
        topic: materialTopic.trim() || workspace.subject || "General revision",
        subject: workspace.subject,
      });
      const blob = await composeAudio(script.content, {
        lang: workspace.subject ? "en" : "en",
        onProgress: setAudioProgress,
      });
      if (!blob) throw new Error("The AI produced no audio.");

      const itemId = crypto.randomUUID();
      const mediaKey = `${workspace.id}:${itemId}`;
      await saveMedia(mediaKey, blob);

      const url = URL.createObjectURL(blob);
      setAudioUrl(workspace.id, url);
      setAudioUrlLocal(url);
      addGenerated(workspace.id, {
        id: itemId,
        kind: "audio",
        title: script.title,
        createdAt: new Date().toISOString(),
        url,
      });
      setAudioProgress("");
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Audio generation failed");
    } finally {
      setAudioLoading(false);
    }
  }

  async function handleGenerateSlides() {
    setSlidesLoading(true);
    setSlidesError("");
    try {
      const deck = await generateSlides({
        subject: workspace.subject,
        topic: materialTopic.trim() || workspace.subject || "General revision",
        notes: workspace.files.map((f) => f.text).filter(Boolean).join("\n\n"),
      });
      setSlides(workspace.id, deck);
      setSlidesLocal(deck);
      addGenerated(workspace.id, {
        id: crypto.randomUUID(),
        kind: "slides",
        title: deck.title,
        createdAt: new Date().toISOString(),
        slides: deck,
      });
    } catch (error) {
      setSlidesError(error instanceof Error ? error.message : "Slide generation failed");
    } finally {
      setSlidesLoading(false);
    }
  }

  async function handleGenerateExam() {
    setExamLoading(true);
    setExamError("");
    try {
      const level = examLevel === "Custom" ? customLevel.trim() : examLevel;
      // Base the paper on the student's saved course notes/files when present.
      const notes = [
        workspace.summary.trim(),
        ...workspace.files.map((f) => (f.text.trim() ? `${f.name}:\n${f.text.trim()}` : "")),
      ]
        .filter(Boolean)
        .join("\n\n");
      const paper = await generateExamPaper({
        subject: workspace.subject || "General",
        level: level || "General",
        board: examBoard,
        topic: examTopic.trim() || undefined,
        notes: notes || undefined,
      });
      setExamPaper(workspace.id, paper);
      setExamAnswers({});
      setExamGrade(workspace.id, null);
    } catch (error) {
      setExamError(error instanceof Error ? error.message : "Exam generation failed");
    } finally {
      setExamLoading(false);
    }
  }

  async function handleGradeExam() {
    if (!workspace.examPaper) return;
    setGrading(true);
    setGradingError("");
    try {
      const answers: ExamAnswer[] = workspace.examPaper.questions.map((q) => ({
        number: q.number,
        answer: (examAnswers[q.number] || "").trim(),
        drawingDataUrl: examDrawings[q.number] || undefined,
      }));
      const grade = await gradeExam({ paper: workspace.examPaper, answers });
      setExamGrade(workspace.id, grade);
    } catch (error) {
      setGradingError(error instanceof Error ? error.message : "Grading failed");
    } finally {
      setGrading(false);
    }
  }

  // Timer for the timed test: count down every second and auto-finish at zero.
  useEffect(() => {
    if (!examRunning || examDeadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((examDeadline - Date.now()) / 1000));
      setExamTimeLeft(left);
      if (left <= 0) {
        setExamRunning(false);
        setExamFinished(true);
        if (document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => {});
        }
        // Auto-submit once time is up.
        void handleGradeExam();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examRunning, examDeadline]);

  // Enter fullscreen when the test starts and watch for the user leaving
  // fullscreen mid-test (Esc, etc.). If they do and the test is still running,
  // show a blocking overlay prompting them to resume or finish.
  useEffect(() => {
    if (!examRunning) return;

    let cancelled = false;
    const enterFullscreen = async () => {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        // Fullscreen may not be available; that's fine — we still track it.
      }
      if (!cancelled) setFullscreenExited(false);
    };
    void enterFullscreen();

    const onFullscreenChange = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      if (!isFullscreen) setFullscreenExited(true);
      else setFullscreenExited(false);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      cancelled = true;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [examRunning]);

  function handleStartExam() {
    setExamAnswers({});
    setExamDrawings({});
    setExamGrade(workspace.id, null);
    setExamFinished(false);
    setFullscreenExited(false);
    const durationSeconds = Math.max(1, examDuration) * 60;
    setExamDeadline(Date.now() + durationSeconds * 1000);
    setExamTimeLeft(durationSeconds);
    setExamRunning(true);
  }

  function handleFinishExam() {
    setExamRunning(false);
    setExamFinished(true);
    setExamDeadline(null);
    setFullscreenExited(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
    void handleGradeExam();
  }

  const weakAreas = workspace.weakAreas.length ? workspace.weakAreas : FALLBACK_WEAK_AREAS;
  const totalMarks = workspace.examPaper
    ? workspace.examPaper.questions.reduce((sum, q) => sum + q.marks, 0)
    : 0;

  // Re-hydrate generated video/audio blobs from IndexedDB on mount, since
  // `blob:` URLs do not survive a page reload or navigation.
  useEffect(() => {
    let cancelled = false;
    const items = workspace.generated;
    (async () => {
      for (const item of items) {
        if (item.kind === "slides") continue;
        // Skip if we already have a live object URL for this session.
        if (item.url && item.url.startsWith("blob:")) continue;
        try {
          const blob = await loadMedia(`${workspace.id}:${item.id}`);
          if (cancelled) return;
          if (blob) {
            const url = URL.createObjectURL(blob);
            updateGenerated(workspace.id, { ...item, url });
          }
        } catch {
          // ignore individual failures
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function handleRemoveGenerated(item: GeneratedItem) {
    try {
      await deleteMedia(`${workspace.id}:${item.id}`);
    } catch {
      // ignore
    }
    if (item.url?.startsWith("blob:")) URL.revokeObjectURL(item.url);
    removeGenerated(workspace.id, item.id);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/revision"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All workspaces
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: workspace.color }} />
            <h2 className="truncate font-display text-3xl font-semibold tracking-tight">
              {workspace.subject}
            </h2>
            <Badge variant="accent">Revision workspace</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Chat, upload files, and generate videos and study materials for this subject.
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="chat">
            <MessageCircle className="mr-1.5 h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="mr-1.5 h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="study">
            <Sparkles className="mr-1.5 h-4 w-4" />
            Study
          </TabsTrigger>
          <TabsTrigger value="exam">
            <BookOpenCheck className="mr-1.5 h-4 w-4" />
            Exam preparation
          </TabsTrigger>
        </TabsList>

        {/* ============ CHAT ============ */}
        <TabsContent value="chat" className="mt-4">
          <div className="flex h-[calc(100vh-16rem)] flex-col gap-4">
            {workspace.files.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">
                  Using {workspace.files.length} file{workspace.files.length > 1 ? "s" : ""} from this workspace
                </span>
              </div>
            )}

            <div className="flex-1 space-y-5 overflow-y-auto rounded-xl border bg-card p-4 shadow-sm">
              {workspace.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <MessageCircle className="h-8 w-8 text-accent" />
                  <p className="max-w-sm">
                    Ask a question about {workspace.subject || "this subject"}. Upload files in the
                    Files tab to ground the tutor's answers in your material.
                  </p>
                </div>
              ) : (
                workspace.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col",
                      message.role === "user" ? "items-end" : "items-start",
                    )}
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
                        <MarkdownMessage content={message.content} />
                      )}
                    </div>
                  </div>
                ))
              )}

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

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={`Ask about ${workspace.subject || "this subject"}…`}
                autoComplete="off"
                className="h-12 flex-1 rounded-md border border-input bg-card px-4 py-2 text-[1.05rem] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="h-12 px-5 text-[1.05rem]">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                Send
              </Button>
            </form>

            {workspace.messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end text-muted-foreground"
                onClick={() => setMessages(workspace.id, [])}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Clear conversation
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ============ FILES ============ */}
        <TabsContent value="files" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileScan className="h-5 w-5 text-accent" />
                Upload files
              </CardTitle>
              <CardDescription>
                Upload exams, notes, and images. Text files are read so the AI can use them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed bg-secondary/40 px-4 py-3 text-sm transition-colors hover:bg-secondary/70">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="max-w-[220px] truncate font-medium">{uploadLabel}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf,.txt,.md"
                    className="hidden"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <Button onClick={handleUpload} disabled={!file}>
                  Add file
                </Button>
              </div>

              {workspace.files.length > 0 && (
                <div className="space-y-2">
                  {workspace.files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.kind === "image"
                              ? "Image"
                              : f.kind === "pdf"
                                ? "PDF"
                                : "Text"}{" "}
                            {f.text.trim() ? "· text extracted" : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(workspace.id, f.id)}
                        aria-label="Remove file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileScan className="h-5 w-5 text-accent" />
                Analyze for weak areas
              </CardTitle>
              <CardDescription>
                Upload a graded exam image or paste notes. AI highlights weak areas for this subject.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exam-notes">Exam notes / mistakes</Label>
                <Textarea
                  id="exam-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Describe what went wrong, paste marked answers, or list topics you missed…"
                  className="min-h-[110px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {analyzing ? "Analyzing…" : "Analyze with AI"}
                </Button>
                <Badge variant="accent">Groq connected</Badge>
              </div>
              {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}
              {workspace.summary && (
                <div className="rounded-lg bg-secondary/60 px-4 py-3 text-sm leading-relaxed">
                  {workspace.summary}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3">
            {weakAreas.map((area) => (
              <Card key={`${area.subject}-${area.topic}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{area.subject}</CardTitle>
                    <Badge
                      variant={
                        area.level === "Needs work"
                          ? "warning"
                          : area.level === "Solid"
                            ? "success"
                            : "secondary"
                      }
                    >
                      {area.level}
                    </Badge>
                  </div>
                  <CardDescription>{area.topic}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{area.insight}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ============ STUDY ============ */}
        <TabsContent value="study" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-accent" />
                Make a study video
              </CardTitle>
              <CardDescription>
                The AI turns your notes into a real playable video with animated visuals and voiced
                narration, in the language of your material.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleMakeVideo} disabled={videoLoading}>
                {videoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {videoLoading ? "Rendering…" : "Create video"}
              </Button>

              {videoProgress && (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                  {videoProgress}
                </p>
              )}
              {videoError && <p className="text-sm text-destructive">{videoError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Study materials
              </CardTitle>
              <CardDescription>
                Generate audio narration and slides for this subject.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="material-subject">Subject</Label>
                <Input id="material-subject" value={workspace.subject} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material-topic">Topic</Label>
                <Input
                  id="material-topic"
                  value={materialTopic}
                  onChange={(event) => setMaterialTopic(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* ===== Audio ===== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AudioLines className="h-5 w-5 text-accent" />
                  Audio narration
                </CardTitle>
                <CardDescription>
                  Generate a listen-while-you-revise audio track from the topic and your notes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleGenerateAudio}
                  disabled={audioLoading || slidesLoading}
                >
                  {audioLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {audioLoading ? "Generating…" : "Generate audio"}
                </Button>
                {audioProgress && (
                  <p className="text-sm text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    {audioProgress}
                  </p>
                )}
                {audioError && <p className="text-sm text-destructive">{audioError}</p>}
                {audioUrl && (
                  <div className="space-y-2">
                    <audio controls src={audioUrl} className="w-full" />
                    <a
                      href={audioUrl}
                      download="study-audio.wav"
                      className="inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download audio
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ===== Slides ===== */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Presentation className="h-5 w-5 text-accent" />
                  Slide deck
                </CardTitle>
                <CardDescription>
                  Generate a presentable slide deck you can revise from or present.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full"
                  onClick={handleGenerateSlides}
                  disabled={slidesLoading || audioLoading}
                >
                  {slidesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {slidesLoading ? "Generating…" : "Generate slides"}
                </Button>
                {slidesError && <p className="text-sm text-destructive">{slidesError}</p>}
                {slides && <SlideDeckViewer deck={slides} />}
              </CardContent>
            </Card>
          </div>

          {/* ===== Generated (persistent, like NotebookLM) ===== */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5 text-accent" />
                Generated
              </CardTitle>
              <CardDescription>
                Everything the AI has created for this workspace is saved here — even after you
                close the workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspace.generated.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing generated yet. Create a video, audio, or slide deck to see it here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {workspace.generated.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {item.kind === "video" ? (
                            <Video className="h-4 w-4 shrink-0 text-accent" />
                          ) : item.kind === "audio" ? (
                            <AudioLines className="h-4 w-4 shrink-0 text-accent" />
                          ) : (
                            <Presentation className="h-4 w-4 shrink-0 text-accent" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.kind.charAt(0).toUpperCase() + item.kind.slice(1)} ·{" "}
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveGenerated(item)}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {item.kind === "video" && item.url && (
                        <video controls src={item.url} className="w-full rounded-lg border" />
                      )}
                      {item.kind === "audio" && item.url && (
                        <audio controls src={item.url} className="w-full" />
                      )}
                      {item.kind === "slides" && item.slides && (
                        <SlideDeckViewer deck={item.slides} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ EXAM PREPARATION ============ */}
        <TabsContent value="exam" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5 text-accent" />
                Exam paper
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" onClick={handleGenerateExam} disabled={examLoading}>
                {examLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                {examLoading ? "Generating paper…" : "Generate exam paper"}
              </Button>
              {(workspace.summary.trim() || workspace.files.some((f) => f.text.trim())) && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
                  This paper will be based on your saved course notes.
                </p>
              )}
              {examError && <p className="text-sm text-destructive">{examError}</p>}

              <details className="rounded-lg border bg-muted/20 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Exam settings
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-level">Level</Label>
                      <select
                        id="exam-level"
                        value={examLevel}
                        onChange={(event) => setExamLevel(event.target.value as ExamLevel)}
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {EXAM_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                      {examLevel === "Custom" && (
                        <Input
                          value={customLevel}
                          onChange={(event) => setCustomLevel(event.target.value)}
                          placeholder="e.g. 3e année collège, Bac, CAP, university…"
                          className="mt-1"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="exam-board">Board / system</Label>
                      <select
                        id="exam-board"
                        value={examBoard}
                        onChange={(event) => setExamBoard(event.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {EXAM_BOARDS.map((board) => (
                          <option key={board} value={board}>
                            {board}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="exam-topic">Topic focus (optional)</Label>
                    <Input
                      id="exam-topic"
                      value={examTopic}
                      onChange={(event) => setExamTopic(event.target.value)}
                      placeholder="e.g. Algebra, Cell biology, Shakespeare — leave blank for the full specification"
                    />
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          {workspace.examPaper && (
            <div className="space-y-4">
              {/* ===== Exam paper cover ===== */}
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Practice exam
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                    {workspace.examPaper.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {workspace.examPaper.subject} · {workspace.examPaper.level} ·{" "}
                    {workspace.examPaper.board}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {workspace.examPaper.paper} · Total: {totalMarks} marks
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t pt-4">
                  {examRunning ? (
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-4 py-3",
                        examTimeLeft <= 60
                          ? "border-destructive/50 bg-destructive/10"
                          : "border-accent/30 bg-accent/5",
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Timer className="h-5 w-5 text-accent" />
                        Time remaining
                      </div>
                      <p className="font-display text-2xl font-semibold tabular-nums">
                        {formatTime(examTimeLeft)}
                      </p>
                      <Button variant="secondary" onClick={handleFinishExam} disabled={grading}>
                        <StopCircle className="h-4 w-4" />
                        Finish test
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-accent" />
                        Recommended time: {examDuration} minutes
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={examDuration}
                          onChange={(event) =>
                            setExamDuration(Math.max(1, Number(event.target.value) || 1))
                          }
                          className="w-28"
                          aria-label="Time limit in minutes"
                        />
                        <Button onClick={handleStartExam}>
                          <Play className="h-4 w-4" />
                          Start test
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {examFinished && (
                  <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
                    <BookOpenCheck className="h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-sm font-medium">Test submitted</p>
                      <p className="text-xs text-muted-foreground">
                        {grading ? "The AI is marking your answers…" : "Your answers have been marked."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== Instructions ===== */}
              {workspace.examPaper.overview && (
                <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                  <p className="mb-1 flex items-center gap-1.5 font-medium">
                    <PencilLine className="h-4 w-4 text-accent" />
                    Instructions
                  </p>
                  <MarkdownMessage content={workspace.examPaper.overview} />
                </div>
              )}

              {/* ===== Questions (paper-like) ===== */}
              <div className="space-y-5">
                {workspace.examPaper.questions.map((q) => (
                  <div key={q.number} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">
                        Question {q.number}
                        {q.topic && (
                          <span className="font-normal text-muted-foreground"> · {q.topic}</span>
                        )}
                      </p>
                      <Badge variant="secondary">{q.marks} marks</Badge>
                    </div>
                    <div className="mt-2 text-[1.02rem] leading-relaxed">
                      <MarkdownMessage content={q.question} />
                    </div>
                    <div className="mt-4">
                      <Label htmlFor={`answer-${q.number}`}>Your answer</Label>
                      <Textarea
                        id={`answer-${q.number}`}
                        value={examAnswers[q.number] || ""}
                        onChange={(event) =>
                          setExamAnswers((prev) => ({
                            ...prev,
                            [q.number]: event.target.value,
                          }))
                        }
                        placeholder="Write your answer here…"
                        className="mt-1 min-h-[120px] border-dashed bg-secondary/20 leading-relaxed"
                      />
                    </div>
                    {q.needsDrawing && (
                      <div className="mt-4 space-y-2">
                        <Label>Draw your answer / diagram</Label>
                        <DrawingBoard
                          onChange={(dataUrl) =>
                            setExamDrawings((prev) => ({ ...prev, [q.number]: dataUrl }))
                          }
                          disabled={examFinished && !examRunning}
                        />
                      </div>
                    )}
                    {q.markScheme && !examRunning && !examFinished && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-accent">
                          Mark scheme
                        </summary>
                        <div className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          <MarkdownMessage content={q.markScheme} />
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* ===== Submit / grade ===== */}
              <div className="flex flex-wrap items-center gap-2">
                {examRunning ? (
                  <Button onClick={handleFinishExam} disabled={grading}>
                    <StopCircle className="h-4 w-4" />
                    {grading ? "Submitting…" : "Finish & submit test"}
                  </Button>
                ) : (
                  <Button onClick={handleGradeExam} disabled={grading || examFinished}>
                    {grading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BookOpenCheck className="h-4 w-4" />
                    )}
                    {grading ? "Marking…" : examFinished ? "Re-mark my answers" : "Grade my answers"}
                  </Button>
                )}
                {gradingError && <p className="text-sm text-destructive">{gradingError}</p>}
              </div>

              {/* ===== Result ===== */}
              {workspace.examGrade && (
                <div className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Result</p>
                      <p className="font-display text-3xl font-semibold">
                        {workspace.examGrade.grade}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Score</p>
                      <p className="text-2xl font-semibold">
                        {workspace.examGrade.totalAwarded}
                        <span className="text-muted-foreground"> / {workspace.examGrade.totalMax}</span>
                      </p>
                    </div>
                  </div>
                  {workspace.examGrade.feedback && (
                    <div className="mt-3 text-sm leading-relaxed">
                      <MarkdownMessage content={workspace.examGrade.feedback} />
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    {workspace.examGrade.questions.map((g) => (
                      <div key={g.number} className="rounded-lg border bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            Question {g.number}
                          </span>
                          <Badge variant="secondary">
                            {g.marksAwarded} / {g.marksMax}
                          </Badge>
                        </div>
                        {g.feedback && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            <MarkdownMessage content={g.feedback} />
                          </div>
                        )}
                        {(g.correctPoints.length > 0 ||
                          g.missingPoints.length > 0 ||
                          g.spag.length > 0 ||
                          g.mistakes.length > 0) && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {g.correctPoints.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                                  Correct points
                                </p>
                                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                  {g.correctPoints.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {g.missingPoints.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                                  Missing points
                                </p>
                                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                  {g.missingPoints.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {g.mistakes.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                                  Mistakes
                                </p>
                                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                  {g.mistakes.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {g.spag.length > 0 && (
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-violet-700">
                                  SPaG (spelling, punctuation, grammar)
                                </p>
                                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                                  {g.spag.map((p, i) => (
                                    <li key={i}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ===== Sources ===== */}
              {workspace.examPaper.sources.length > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm">
                  <p className="mb-1 font-medium">Inspired by these past-paper sources</p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {workspace.examPaper.sources.map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent underline underline-offset-2 hover:text-accent/80"
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Fullscreen lockdown overlay ===== */}
      {examRunning && fullscreenExited && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm">
          <StopCircle className="h-10 w-10 text-destructive" />
          <h2 className="font-display text-2xl font-semibold">The test is still running</h2>
          <p className="max-w-md text-muted-foreground">
            You left fullscreen. Return to fullscreen to continue the test, or finish the test to
            submit your answers.
          </p>
          <div className="font-display text-5xl font-semibold tabular-nums">
            {formatTime(examTimeLeft)}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => {
                void document.documentElement.requestFullscreen?.().catch(() => {});
              }}
            >
              <Play className="h-4 w-4" />
              Resume fullscreen
            </Button>
            <Button variant="secondary" onClick={handleFinishExam} disabled={grading}>
              {grading ? "Submitting…" : "Finish & submit test"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlideDeckViewer({ deck }: { deck: SlideDeck }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const slide = deck.slides[index];
  const total = deck.slides.length;

  if (!slide) {
    return <p className="text-sm text-muted-foreground">No slides to show.</p>;
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 to-secondary/40",
          fullscreen && "fixed inset-0 z-50 flex flex-col",
        )}
        style={fullscreen ? { backgroundColor: "var(--primary)" } : undefined}
      >
        <div className="flex min-h-[220px] flex-col justify-between p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              {deck.title}
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">
              {slide.title}
            </h3>
          </div>
          <ul className="mt-6 space-y-2">
            {slide.bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="[&_p]:mb-0"><MarkdownMessage content={bullet} /></span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {index + 1} / {total}
            </span>
            <span>Study Hub</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          disabled={index === total - 1}
        >
          Next
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setFullscreen((f) => !f)}
        >
          {fullscreen ? "Exit" : "Fullscreen"}
        </Button>
      </div>
    </div>
  );
}
