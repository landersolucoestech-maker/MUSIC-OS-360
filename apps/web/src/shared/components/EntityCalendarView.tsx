/**
 * EntityCalendarView — generic Day/Week/Month/Year calendar that plots events
 * by date/time. Same visual identity as the Marketing content calendar
 * (MarketingCalendarView), but decoupled from any specific type: it receives
 * a generic list of `CalendarEvent`.
 */

import { cn } from "@/shared/lib/utils";

export type EntityCalendarViewMode = "dia" | "semana" | "mes" | "ano";

export interface CalendarEvent {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD or with time). */
  dateISO: string;
  time?: string | null;
  /** Chip color class (status). */
  toneClass?: string;
  /** Helper text (tooltip). */
  hint?: string;
}

interface EntityCalendarViewProps {
  view: EntityCalendarViewMode;
  referenceDate: Date;
  events: CalendarEvent[];
  onSelect?: (id: string) => void;
}

const WEEKDAYS_SUN = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_MON = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAY_INITIALS_MON = ["S", "T", "Q", "Q", "S", "S", "D"];
const HEAD_CELL = "text-[10px] font-semibold tracking-widest text-muted-foreground/60";
const DEFAULT_TONE = "border-border bg-muted/40 text-foreground";

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

const byTimeAsc = (a: CalendarEvent, b: CalendarEvent) => (a.time ?? "").localeCompare(b.time ?? "");

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = ev.dateISO.slice(0, 10);
    const bucket = map.get(key) ?? [];
    bucket.push(ev);
    map.set(key, bucket);
  }
  for (const bucket of map.values()) bucket.sort(byTimeAsc);
  return map;
}

function EventItem({ event, onSelect }: { event: CalendarEvent; onSelect?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(event.id)}
      className={cn(
        "block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[10px] font-medium",
        "transition-colors duration-100 hover:bg-muted hover:text-foreground",
        event.toneClass ?? DEFAULT_TONE,
      )}
      title={event.hint ?? event.title}
    >
      {event.time && <span className="tabular-nums">{event.time} </span>}
      {event.title}
    </button>
  );
}

export function EntityCalendarView({ view, referenceDate, events, onSelect }: EntityCalendarViewProps) {
  if (view === "dia") return <DayView referenceDate={referenceDate} events={events} onSelect={onSelect} />;
  if (view === "semana") return <WeekView referenceDate={referenceDate} events={events} onSelect={onSelect} />;
  if (view === "ano") return <YearView referenceDate={referenceDate} events={events} />;
  return <MonthView referenceDate={referenceDate} events={events} onSelect={onSelect} />;
}

function DayView({ referenceDate, events, onSelect }: { referenceDate: Date; events: CalendarEvent[]; onSelect?: (id: string) => void }) {
  const dayIso = isoDay(referenceDate);
  const dayEvents = events.filter((e) => e.dateISO.slice(0, 10) === dayIso).sort(byTimeAsc);
  const byHour = new Map<number, CalendarEvent[]>();
  for (const ev of dayEvents) {
    const hour = timeHour(ev.time) ?? 0;
    const bucket = byHour.get(hour) ?? [];
    bucket.push(ev);
    byHour.set(hour, bucket);
  }
  const now = new Date();
  const isToday = isoDay(now) === dayIso;
  const currentHour = now.getHours();
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {dayEvents.length === 0 && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Nenhum evento agendado neste dia.
        </div>
      )}
      <div className="max-h-[640px] overflow-y-auto">
        {hours.map((hour) => {
          const items = byHour.get(hour) ?? [];
          const highlight = isToday && hour === currentHour;
          return (
            <div key={hour} className="flex border-b border-border/60 last:border-b-0">
              <div className={cn("w-16 shrink-0 border-r border-border/60 px-2 py-2 text-right text-[11px] tabular-nums", highlight ? "font-semibold text-primary" : "text-muted-foreground")}>
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className={cn("min-h-[44px] flex-1 space-y-1 p-1.5", highlight && "bg-primary/5")}>
                {items.map((ev) => <EventItem key={ev.id} event={ev} onSelect={onSelect} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ referenceDate, events, onSelect }: { referenceDate: Date; events: CalendarEvent[]; onSelect?: (id: string) => void }) {
  const start = startOfWeekMonday(referenceDate);
  const todayIso = isoDay(new Date());
  const currentHour = new Date().getHours();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { date, iso: isoDay(date) };
  });
  const byDayHour = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const iso = ev.dateISO.slice(0, 10);
    const hour = timeHour(ev.time) ?? 0;
    const key = `${iso}#${hour}`;
    const bucket = byDayHour.get(key) ?? [];
    bucket.push(ev);
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
              <div className={cn("mx-auto mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-sm", isToday ? "font-medium text-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background" : "text-foreground")}>
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
                <div key={day.iso} className={cn("min-h-[44px] flex-1 space-y-1 border-r border-border/60 p-1 last:border-r-0", highlight && "bg-primary/5")}>
                  {items.map((ev) => <EventItem key={ev.id} event={ev} onSelect={onSelect} />)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ referenceDate, events, onSelect }: { referenceDate: Date; events: CalendarEvent[]; onSelect?: (id: string) => void }) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; key: string }> = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push({ date: null, key: `empty-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ date: new Date(year, month, day), key: `day-${day}` });
  const byDay = groupByDay(events);
  const todayIso = isoDay(new Date());

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS_SUN.map((day) => (
          <div key={day} className={cn("px-2 py-1.5 text-center", HEAD_CELL)}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          if (!cell.date) return <div key={cell.key} className="min-h-[92px] border-b border-r border-border/60 bg-muted/20" />;
          const dayIso = isoDay(cell.date);
          const items = byDay.get(dayIso) ?? [];
          const isToday = dayIso === todayIso;
          return (
            <div key={cell.key} className="min-h-[92px] space-y-1 border-b border-r border-border/60 p-1.5">
              <div className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-medium", isToday ? "text-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background" : "text-muted-foreground")}>
                {cell.date.getDate()}
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((ev) => <EventItem key={ev.id} event={ev} onSelect={onSelect} />)}
                {items.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} mais</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ referenceDate, events }: { referenceDate: Date; events: CalendarEvent[] }) {
  const year = referenceDate.getFullYear();
  const todayIso = isoDay(new Date());
  const presentDays = new Set<string>();
  const counts = new Array<number>(12).fill(0);
  for (const ev of events) {
    const iso = ev.dateISO.slice(0, 10);
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
          const lead = (firstWeekday + 6) % 7;
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
                  <span key={`w-${index}`} className="text-[10px] font-semibold text-muted-foreground/60">{label}</span>
                ))}
                {cells.map((day, index) => {
                  if (day === null) return <span key={`empty-${index}`} />;
                  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasEvent = presentDays.has(iso);
                  const isToday = iso === todayIso;
                  return (
                    <span key={iso} className={cn(
                      "mx-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] tabular-nums",
                      isToday && hasEvent && "bg-primary font-medium text-primary-foreground",
                      isToday && !hasEvent && "font-medium text-primary ring-1 ring-primary/50",
                      !isToday && hasEvent && "bg-primary/15 font-medium text-primary",
                      !isToday && !hasEvent && "text-muted-foreground",
                    )}>
                      {day}
                    </span>
                  );
                })}
              </div>
              {total > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{total} {total === 1 ? "evento" : "eventos"}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
