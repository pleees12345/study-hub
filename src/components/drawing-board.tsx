import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DrawingBoardProps = {
  /** Called whenever the sketch changes, with a data URL PNG (or "" if empty). */
  onChange: (dataUrl: string) => void;
  height?: number;
  disabled?: boolean;
};

/** A simple freehand drawing board (paper-style) for diagram questions. */
export function DrawingBoard({ onChange, height = 220, disabled = false }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [brush, setBrush] = useState<"pencil" | "eraser">("pencil");

  // Initialise the canvas background to white once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  }, [onChange]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = getPos(e);
    lastPointRef.current = p;
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(e);
    ctx.strokeStyle = brush === "eraser" ? "#ffffff" : "#1a1a1a";
    ctx.lineWidth = brush === "eraser" ? 14 : 2.4;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    setIsEmpty(false);
  }

  function onPointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
    emit();
  }

  function clearBoard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    emit();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={brush === "pencil" ? "default" : "outline"}
          onClick={() => setBrush("pencil")}
          disabled={disabled}
        >
          ✏️ Pencil
        </Button>
        <Button
          type="button"
          size="sm"
          variant={brush === "eraser" ? "default" : "outline"}
          onClick={() => setBrush("eraser")}
          disabled={disabled}
        >
          <Eraser className="h-4 w-4" />
          Eraser
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearBoard} disabled={disabled}>
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
        {!isEmpty && (
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Drawing saved with your answer
          </span>
        )}
      </div>
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed bg-white">
        <canvas
          ref={canvasRef}
          width={800}
          height={height}
          className={`h-auto w-full touch-none ${disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair"}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
