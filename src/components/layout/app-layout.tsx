import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BrainCircuit,
  GraduationCap,
  Menu,
  MessageCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { InstallPrompt } from "@/components/install-prompt";
import { useWorkspacesStore } from "@/features/revision/workspaces-store";

const navItems = [
  { to: "/revision", label: "Revision", icon: BrainCircuit, description: "AI exam & study tools" },
  { to: "/chat", label: "Tutor", icon: MessageCircle, description: "Ask the AI tutor anything" },
];

const titles: Record<string, string> = {
  "/": "Home",
  "/revision": "Revision",
  "/chat": "Tutor chat",
};

export function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const workspaceMatch = location.pathname.match(/^\/revision\/([^/]+)$/);
  const activeWorkspace = workspaceMatch
    ? useWorkspacesStore.getState().workspaces.find((w) => w.id === workspaceMatch[1])
    : undefined;

  let title = titles[location.pathname] ?? "Study Hub";
  if (activeWorkspace) title = activeWorkspace.subject;

  const isRevisionActive = location.pathname.startsWith("/revision");

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">Study Hub</p>
            <p className="text-xs text-sidebar-foreground/70">Learn smarter, version 2.0</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
                    isActive || (item.to === "/revision" && isRevisionActive)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs opacity-70">{item.description}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          Groq AI is live on Revision and the Tutor chat.
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {activeWorkspace ? "Revision workspace" : "Study Hub"}
            </p>
            <h1 className="font-display text-xl font-semibold leading-none">{title}</h1>
          </div>
          <div className="ml-auto">
            <ThemeSwitcher />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto mb-4 max-w-5xl">
            <InstallPrompt />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
