import { BookOpen, Moon, Sun, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/lib/theme";

const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "sepia", label: "Sepia", icon: BookOpen },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "white", label: "White", icon: Waves },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-full border bg-card/60 p-1 backdrop-blur">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            title={`${option.label} theme`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
