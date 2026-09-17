import { create } from "zustand";
import { persist } from "zustand/middleware";

type RevisionDocument = {
  /** Free-form notes the student types on the Revision page. */
  notes: string;
  /** Name of the last uploaded document (image / pdf / text). */
  fileName: string;
  /** Extracted text from uploaded text/markdown files (empty for images/PDFs). */
  fileText: string;
  /** Data URL of an uploaded image file, so it can be used as a visual in the video. */
  imageDataUrl: string;
};

type RevisionDocumentState = RevisionDocument & {
  setNotes: (notes: string) => void;
  setDocument: (fileName: string, fileText: string, imageDataUrl?: string) => void;
  clear: () => void;
};

const EMPTY: RevisionDocument = { notes: "", fileName: "", fileText: "", imageDataUrl: "" };

export const useRevisionDocumentStore = create<RevisionDocumentState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setNotes: (notes) => set({ notes }),
      setDocument: (fileName, fileText, imageDataUrl = "") => set({ fileName, fileText, imageDataUrl }),
      clear: () => set({ ...EMPTY }),
    }),
    { name: "study-hub-revision-documents" },
  ),
);

/** A human-friendly summary of the current documents, for passing to the AI. */
export function describeDocuments(doc: RevisionDocument): string {
  const parts: string[] = [];
  if (doc.fileName) parts.push(`Attached document: ${doc.fileName}`);
  if (doc.fileText.trim()) parts.push(`Document text:\n${doc.fileText.trim()}`);
  if (doc.notes.trim()) parts.push(`Student notes:\n${doc.notes.trim()}`);
  return parts.join("\n\n");
}
