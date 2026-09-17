import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  FolderOpen,
  MessageCircle,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspacesStore } from "@/features/revision/workspaces-store";

export function RevisionPage() {
  const navigate = useNavigate();
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const addWorkspace = useWorkspacesStore((s) => s.addWorkspace);
  const removeWorkspace = useWorkspacesStore((s) => s.removeWorkspace);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const name = subject.trim();
    if (!name) return;
    const id = addWorkspace(name);
    setSubject("");
    setOpen(false);
    navigate(`/revision/${id}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Revision workspaces</h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Create a workspace per subject. Each one has its own chat, uploaded files, videos, and
            study materials.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New workspace
        </Button>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FolderOpen className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-xl font-semibold">No workspaces yet</p>
            <p className="mx-auto max-w-sm text-muted-foreground">
              Create your first subject workspace to start revising — chat, upload files, and
              generate videos and materials.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Create a workspace
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => {
            const fileCount = workspace.files.length;
            const messageCount = workspace.messages.length;
            const materialCount =
              Object.values(workspace.materials).filter(Boolean).length +
              (workspace.slides ? 1 : 0) +
              (workspace.audioUrl ? 1 : 0);
            const hasVideo = Boolean(workspace.videoPlan);
            return (
              <Card key={workspace.id} className="group relative transition-transform hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: workspace.color }}
                      />
                      <CardTitle className="truncate">{workspace.subject}</CardTitle>
                    </div>
                    <Badge variant="accent">Revision</Badge>
                  </div>
                  <CardDescription>
                    {new Date(workspace.createdAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                      <FileText className="h-3.5 w-3.5" />
                      {fileCount} file{fileCount === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {messageCount} message{messageCount === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      {materialCount} material{materialCount === 1 ? "" : "s"}
                    </span>
                    {hasVideo && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1">
                        <Video className="h-3.5 w-3.5" />
                        Video
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/revision/${workspace.id}`}>
                        <BookOpen className="h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWorkspace(workspace.id)}
                      aria-label={`Delete ${workspace.subject}`}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New revision workspace</DialogTitle>
            <DialogDescription>
              Name it after a subject, e.g. "Math" or "Physics". You'll be able to chat, upload
              files, and generate study materials inside it.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="workspace-subject">Subject</Label>
              <Input
                id="workspace-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Math"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!subject.trim()}>
              Create workspace
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
