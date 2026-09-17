import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ExamGrade,
  ExamPaper,
  SlideDeck,
  StudyMaterial,
  VideoPlan,
  WeakArea,
} from "@/lib/ai";

export type RevisionFile = {
  id: string;
  name: string;
  kind: "image" | "pdf" | "text";
  /** Extracted text (for text/markdown files; empty for images/PDFs). */
  text: string;
  /** Data URL for images, so they can be reused as visuals. */
  imageDataUrl: string;
  uploadedAt: string;
};

export type WorkspaceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** A single generated study asset (video, audio, or slides). */
export type GeneratedItem = {
  id: string;
  kind: "video" | "audio" | "slides";
  title: string;
  createdAt: string;
  /** For slides: the persisted SlideDeck JSON. */
  slides?: SlideDeck;
  /** For video/audio: object URL hydrated from IndexedDB on load. */
  url?: string;
};

export type RevisionWorkspace = {
  id: string;
  subject: string;
  color: string;
  createdAt: string;
  messages: WorkspaceMessage[];
  files: RevisionFile[];
  weakAreas: WeakArea[];
  summary: string;
  materials: Partial<Record<StudyMaterial["kind"], StudyMaterial>>;
  videoPlan: VideoPlan | null;
  slides: SlideDeck | null;
  /** Data URL of the generated narration audio (wav/mp3). */
  audioUrl: string;
  examPaper: ExamPaper | null;
  examGrade: ExamGrade | null;
  /** Persistent list of every AI-generated asset, shown like NotebookLM. */
  generated: GeneratedItem[];
};

type WorkspacesState = {
  workspaces: RevisionWorkspace[];
  addWorkspace: (subject: string) => string;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, subject: string) => void;
  addMessage: (id: string, message: WorkspaceMessage) => void;
  setMessages: (id: string, messages: WorkspaceMessage[]) => void;
  addFile: (id: string, file: Omit<RevisionFile, "id" | "uploadedAt">) => void;
  removeFile: (id: string, fileId: string) => void;
  setAnalysis: (id: string, analysis: { weakAreas: WeakArea[]; summary: string }) => void;
  setMaterial: (id: string, kind: StudyMaterial["kind"], material: StudyMaterial) => void;
  setVideoPlan: (id: string, plan: VideoPlan | null) => void;
  setSlides: (id: string, slides: SlideDeck) => void;
  setAudioUrl: (id: string, audioUrl: string) => void;
  setExamPaper: (id: string, paper: ExamPaper | null) => void;
  setExamGrade: (id: string, grade: ExamGrade | null) => void;
  addGenerated: (id: string, item: GeneratedItem) => void;
  updateGenerated: (id: string, item: GeneratedItem) => void;
  removeGenerated: (id: string, itemId: string) => void;
};

const WORKSPACE_COLORS = ["#1F4B3A", "#2F6F8F", "#6B4C9A", "#8B3A4A", "#3F6B4A", "#C47A3A"];

function colorForSubject(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
}

function makeWorkspace(subject: string): RevisionWorkspace {
  return {
    id: crypto.randomUUID(),
    subject: subject.trim(),
    color: colorForSubject(subject),
    createdAt: new Date().toISOString(),
    messages: [],
    files: [],
    weakAreas: [],
    summary: "",
    materials: {},
    videoPlan: null,
    slides: null,
    audioUrl: "",
    examPaper: null,
    examGrade: null,
    generated: [],
  };
}

export const useWorkspacesStore = create<WorkspacesState>()(
  persist(
    (set) => ({
      workspaces: [],
      addWorkspace: (subject) => {
        const workspace = makeWorkspace(subject);
        set((state) => ({ workspaces: [workspace, ...state.workspaces] }));
        return workspace.id;
      },
      removeWorkspace: (id) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== id),
        })),
      renameWorkspace: (id, subject) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, subject: subject.trim() } : w,
          ),
        })),
      addMessage: (id, message) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, messages: [...w.messages, message] } : w,
          ),
        })),
      setMessages: (id, messages) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, messages } : w)),
        })),
      addFile: (id, file) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id
              ? {
                  ...w,
                  files: [
                    { ...file, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() },
                    ...w.files,
                  ],
                }
              : w,
          ),
        })),
      removeFile: (id, fileId) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, files: w.files.filter((f) => f.id !== fileId) } : w,
          ),
        })),
      setAnalysis: (id, analysis) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id
              ? { ...w, weakAreas: analysis.weakAreas, summary: analysis.summary }
              : w,
          ),
        })),
      setMaterial: (id, kind, material) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, materials: { ...w.materials, [kind]: material } } : w,
          ),
        })),
      setVideoPlan: (id, plan) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, videoPlan: plan } : w)),
        })),
      setSlides: (id, slides) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, slides } : w)),
        })),
      setAudioUrl: (id, audioUrl) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, audioUrl } : w)),
        })),
      setExamPaper: (id, paper) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, examPaper: paper } : w)),
        })),
      setExamGrade: (id, grade) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, examGrade: grade } : w)),
        })),
      addGenerated: (id, item) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, generated: [item, ...w.generated] } : w,
          ),
        })),
      updateGenerated: (id, item) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id
              ? { ...w, generated: w.generated.map((g) => (g.id === item.id ? item : g)) }
              : w,
          ),
        })),
      removeGenerated: (id, itemId) =>
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id
              ? { ...w, generated: w.generated.filter((g) => g.id !== itemId) }
              : w,
          ),
        })),
    }),
    {
      name: "study-hub-revision-workspaces",
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as { workspaces?: RevisionWorkspace[] };
        return {
          ...(state as object),
          workspaces: (state.workspaces ?? []).map((w) => ({
            ...w,
            generated: w.generated ?? [],
            examPaper: w.examPaper ?? null,
          })),
        } as WorkspacesState;
      },
    },
  ),
);
