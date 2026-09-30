/**
 * Editorial calendar — real Day / Week / Month / Year views that plot
 * scheduled content on its publish date/time. Channel/status come through as
 * colored chips per item. Visual identity follows the DatePicker (shared/ui).
 */

import { cn } from "@/shared/lib/utils";
import { CONTENT_CHANNEL_LABEL, CONTENT_STATUS_TONE, TONE_CLASS } from "../constants/marketing.constants";
import type { MarketingContent } from "../types/marketing.types";

export type MarketingCalendarViewMode = "day" | "week" | "month" | "year";

interface MarketingCalendarViewProps {
  view: MarketingCalendarViewMode;
  referenceDate: Date;
  contents: MarketingContent[];
  onSelect?: (content: MarketingContent) => void;
}

const WEEKDAYS_SUN = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_MON = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
// Single-letter weekday labels, Monday-first (Seg→Dom): S T Q Q S S D
const WEEKDAY_INITIALS_MON = ["S", "T", "Q", "Q", "S", "S", "D"];

const HEAD_CELL = "text-[10px] font-semibold tracking-widest text-muted-foreground/60";

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  return d;
}

function timeHour(time: string | null | undefined): number | null {
  const [raw] = String(time ?? "").split(":");
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(23, Math.max(0, value));
}

function byTimeAsc(a: MarketingContent, b: MarketingContent): number {
  return (a.publishTime ?? "").localeCompare(b.publishTime ?? "");
}

function groupByDay(contents: MarketingContent[]): Map<string, MarketingContent[]> {
  const map = new Map<string, MarketingContent[]>();
  for (const content of contents) {
    const key = content.publishDate.slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(content);
    map.set(key, bucket);
  }
  for (const bucket of map.values()) bucket.sort(byTimeAsc);
  return map;
}

/** Content chip — reused by every view. Click to edit. */
function ContentItem({
  content,
  onSelect,
}: {
  content: MarketingContent;
  onSelect?: (content: MarketingContent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(content)}
      className={cn(
        "block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[10px] font-medium",
        "transition-colors duration-100 hover:bg-muted hover:text-foreground",
        TONE_CLASS[CONTENT_STATUS_TONE[content.status]],
      )}
      title={`${content.title} · ${CONTENT_CHANNEL_LABEL[content.channel]}`}
    >
      {content.publishTime && <span className="tabular-nums">{content.publishTime} </span>}
      {content.title}
    </button>
  );
}

export function MarketingCalendarView({ view, referenceDate, contents, onSelect }: MarketingCalendarViewProps) {
  if (view === "day") return <DayView referenceDate={referenceDate} contents={contents} onSelect={onSelect} />;
  if (view === "week") return <WeekView referenceDate={referenceDate} contents={contents} onSelect={onSelect} />;
  if (view === "year") return <YearView referenceDate={referenceDate} contents={contents} />;
  return <MonthView referenceDate={referenceDate} contents={contents} onSelect={onSelect} />;
}

// ---------------------------------------------------------------------------
// Day view — vertical timeline with hour column 00:00–23:00.
// ---------------------------------------------------------------------------

function DayView({
  referenceDate,
  contents,
  onSelect,
}: {
  referenceDate: Date;
  contents: MarketingContent[];
  onSelect?: (content: MarketingContent) => void;
}) {
  const dayIso = isoDay(referenceDate);
  const dayContents = contents.filter((content) => content.publishDate.slice(0, 10) === dayIso).sort(byTimeAsc);

  const byHour = new Map<number, MarketingContent[]>();
  for (const content of dayContents) {
    const hour = timeHour(content.publishTime) ?? 0;
    const bucket = byHour.get(hour) ?? [];
    bucket.push(content);
    byHour.set(hour, bucket);
  }

  const now = new Date();
  const isToday = isoDay(now) === dayIso;
  const currentHour = now.getHours();
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {dayContents.length === 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Nenhum conteúdo agendado neste dia.
        </div>
      )}
      <div className="max-h-[640px] overflow-y-auto">
        {hours.map((hour) => {
          const items = byHour.get(hour) ?? [];
          const highlight = isToday && hour === currentHour;
          return (
            <div key={hour} className="flex border-b border-border/60 last:border-b-0">
              <div
                className={cn(
                  "w-16 shrink-0 border-r border-border/60 px-2 py-2 text-right text-[11px] tabular-nums",
                  highlight ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className={cn("min-h-[44px] flex-1 space-y-1 p-1.5", highlight && "bg-primary/5")}>
                {items.map((content) => (
                  <ContentItem key={content.id} content={content} onSelect={onSelect} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week view — hour timeline (00:00–23:00) across 7 columns, Monday to Sunday.
// ---------------------------------------------------------------------------

function WeekView({
  referenceDate,
  contents,
  onSelect,
}: {
  referenceDate: Date;
  contents: MarketingContent[];
  onSelect?: (content: MarketingContent) => void;
}) {
  const start = startOfWeekMonday(referenceDate);
  const todayIso = isoDay(new Date());
  const currentHour = new Date().getHours();

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, iso: isoDay(date) };
  });

  const byDayHour = new Map<string, MarketingContent[]>();
  for (const content of contents) {
    const iso = content.publishDate.slice(0, 10);
    const hour = timeHour(content.publishTime) ?? 0;
    const key = `${iso}#${hour}`;
    const bucket = byDayHour.get(key) ?? [];
    bucket.push(content);
    byDayHour.set(key, bucket);
  }
  for (const bucket of byDayHour.values()) bucket.sort(byTimeAsc);

  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex border-b border-border bg-muted/40">
        <div className="w-16 shrink-0 border-r border-border/60" />
        {days.map((day, index) => {
          const isToday = day.iso === todayIso;
          return (
            <div key={day.iso} className="flex-1 border-r border-border/60 px-2 py-1.5 text-center last:border-r-0">
              <div className={HEAD_CELL}>{WEEKDAYS_MON[index]}</div>
              <div
                className={cn(
                  "mx-auto mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-sm",
                  isToday
                    ? "font-medium text-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background"
                    : "text-foreground",
                )}
              >
                {day.date.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="max-h-[640px] overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="flex border-b border-border/60 last:border-b-0">
            <div className="w-16 shrink-0 border-r border-border/60 px-2 py-2 text-right text-[11px] tabular-nums text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
            {days.map((day) => {
              const items = byDayHour.get(`${day.iso}#${hour}`) ?? [];
              const highlight = day.iso === todayIso && hour === currentHour;
              return (
                <div
                  key={day.iso}
                  className={cn(
                    "min-h-[44px] flex-1 space-y-1 border-r border-border/60 p-1 last:border-r-0",
                    highlight && "bg-primary/5",
                  )}
                >
                  {items.map((content) => (
                    <ContentItem key={content.id} content={content} onSelect={onSelect} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month view — month grid with content per day.
// ---------------------------------------------------------------------------

function MonthView({
  referenceDate,
  contents,
  onSelect,
}: {
  referenceDate: Date;
  contents: MarketingContent[];
  onSelect?: (content: MarketingContent) => void;
}) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push({ date: null, key: `empty-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ date: new Date(year, month, day), key: `day-${day}` });

  const byDay = groupByDay(contents);
  const todayIso = isoDay(new Date());

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS_SUN.map((day) => (
          <div key={day} className={cn("px-2 py-1.5 text-center", HEAD_CELL)}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="min-h-[92px] border-b border-r border-border/60 bg-muted/20" />;
          }
          const dayIso = isoDay(cell.date);
          const items = byDay.get(dayIso) ?? [];
          const isToday = dayIso === todayIso;
          return (
            <div key={cell.key} className="min-h-[92px] space-y-1 border-b border-r border-border/60 p-1.5">
              <div
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-medium",
                  isToday
                    ? "text-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background"
                    : "text-muted-foreground",
                )}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((content) => (
                  <ContentItem key={content.id} content={content} onSelect={onSelect} />
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year view — 12 mini month calendars, days with content highlighted.
// ---------------------------------------------------------------------------

function YearView({ referenceDate, contents }: { referenceDate: Date; contents: MarketingContent[] }) {
  const year = referenceDate.getFullYear();
  const todayIso = isoDay(new Date());

  const presentDays = new Set<string>();
  const counts = new Array<number>(12).fill(0);
  for (const content of contents) {
    const iso = content.publishDate.slice(0, 10);
    const date = new Date(`${iso}T00:00:00`);
    if (date.getFullYear() === year) {
      presentDays.add(iso);
      counts[date.getMonth()] += 1;
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{year}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MONTHS_FULL.map((monthName, month) => {
          const firstWeekday = new Date(year, month, 1).getDay();
          const lead = (firstWeekday + 6) % 7; // Monday-first offset
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const cells: Array<number | null> = [];
          for (let i = 0; i < lead; i += 1) cells.push(null);
          for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
          const total = counts[month];

          return (
            <div key={monthName} className="rounded-lg border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">{monthName}</p>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {WEEKDAY_INITIALS_MON.map((label, index) => (
                  <span key={`w-${index}`} className="text-[10px] font-semibold text-muted-foreground/60">
                    {label}
                  </span>
                ))}
                {cells.map((day, index) => {
                  if (day === null) return <span key={`empty-${index}`} />;
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasContent = presentDays.has(iso);
                  const isToday = iso === todayIso;
                  return (
                    <span
                      key={iso}
                      className={cn(
                        "mx-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] tabular-nums",
                        isToday && hasContent && "bg-primary font-medium text-primary-foreground",
                        isToday && !hasContent && "font-medium text-primary ring-1 ring-primary/50",
                        !isToday && hasContent && "bg-primary/15 font-medium text-primary",
                        !isToday && !hasContent && "text-muted-foreground",
                      )}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>
              {total > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {total} {total === 1 ? "publicação" : "publicações"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
