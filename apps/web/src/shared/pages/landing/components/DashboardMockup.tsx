import { Music, TrendingUp } from "lucide-react";
import { PREVIEW_NAV } from "../data";

/**
 * Neutral product preview — illustrative UI chrome, with no fabricated data, metrics
 * or charts (decorative bars/lines instead of numbers).
 */
export function DashboardMockup() {
  return (
    <div className="relative" aria-hidden="true">
      <div className="overflow-hidden rounded-xl border border-black/5 bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
          <span className="ml-3 text-xs text-muted-foreground">MUSIC OS 360 — Painel</span>
        </div>

        <div className="grid grid-cols-[140px_1fr]">
          <aside className="border-r border-border bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-2 px-1">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <Music className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold">MUSIC OS 360</span>
            </div>
            <div className="space-y-1">
              {PREVIEW_NAV.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    i === 0 ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </aside>

          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-foreground/80" />
              <div className="h-6 w-20 rounded-md border border-border" />
            </div>

            {/* Stat cards — placeholders, no fabricated numbers */}
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["Receita total", "Lançamentos", "Contratos ativos", "Colaboradores"].map((label) => (
                <div key={label} className="rounded-lg border border-border p-2.5">
                  <div className="mb-2 h-2 w-14 rounded bg-muted-foreground/25" />
                  <div className="h-3.5 w-10 rounded bg-foreground/70" />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              {/* Chart card — decorative curve, does not represent real data */}
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="h-2.5 w-14 rounded bg-muted-foreground/30" />
                  <TrendingUp className="h-3 w-3 text-primary/60" />
                </div>
                <svg viewBox="0 0 200 60" className="h-16 w-full" preserveAspectRatio="none">
                  <polyline
                    points="0,50 30,42 60,44 90,30 120,32 150,16 180,20 200,8"
                    fill="none"
                    className="stroke-primary/50"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* List — skeleton rows, no real data */}
              <div className="overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-muted/30 px-2.5 py-1.5">
                  <div className="h-2 w-20 rounded bg-muted-foreground/30" />
                </div>
                {[0, 1, 2].map((r) => (
                  <div key={r} className="flex items-center gap-2 border-b border-border px-2.5 py-2 last:border-0">
                    <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
                    <div className="space-y-1">
                      <div className="h-2 w-16 rounded bg-muted-foreground/30" />
                      <div className="h-1.5 w-10 rounded bg-muted-foreground/20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
