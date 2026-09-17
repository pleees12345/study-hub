import { Link } from "react-router-dom";
import { ArrowRight, Apple, BrainCircuit, Download, MonitorDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORMS } from "@/lib/downloads";

const sections = [
  {
    to: "/revision",
    title: "Revision",
    description: "Scan exams and generate study materials with AI.",
    icon: BrainCircuit,
  },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl border bg-card px-6 py-10 md:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(28_55%_52%/0.18),transparent_45%),radial-gradient(circle_at_bottom_left,hsl(158_42%_22%/0.14),transparent_40%)]" />
        <div className="relative max-w-2xl space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Study Hub 2.0</p>
          <h2 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            A calm place to plan, practice, and improve.
          </h2>
          <p className="text-lg text-muted-foreground">
            Use AI on Revision to analyze exams and generate study materials.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link to="/revision">
                Explore revision
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.to} className="transition-transform hover:-translate-y-0.5">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full">
                  <Link to={section.to}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="rounded-2xl border bg-card p-6 md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">Download the app</h2>
            <p className="text-sm text-muted-foreground">
              Take Study Hub offline with the desktop app. Free, no account needed.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => {
            const Icon = p.id === "mac" ? Apple : MonitorDown;
            return (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-xl border p-4 transition-colors hover:border-accent hover:bg-accent/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.label}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.detail} · {p.ext}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors group-hover:bg-accent/90">
                  <Download className="h-4 w-4" />
                  Download
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
