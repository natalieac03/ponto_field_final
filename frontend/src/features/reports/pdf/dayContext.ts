import { api } from "../../../api/client";
import { LEAVE_KIND_LABEL } from "../../../types";
import type { LeaveKind } from "../../../types";

export type DayCategory = "escala" | "leave" | "feriado" | "facultativo" | "evento";

export interface DayInfo {
  category: DayCategory;
  label: string;
}

/** Chave `${employeeId}|${date}` para dias específicos do colaborador (escala/férias);
 *  `*|${date}` para dias globais (feriado/facultativo/evento). */
export type DayCtx = Map<string, DayInfo>;

const LEAVE_LABEL = (kind: LeaveKind) => LEAVE_KIND_LABEL[kind].replace(/^\S+\s/, "");

const nextDay = (iso: string): string => {
  const d = new Date(`${iso}T12:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Busca escalas, férias/licenças e feriados/facultativos/eventos vigentes no
 *  período do relatório, para colorir o PDF com a mesma paleta do calendário. */
export async function buildDayCtx(start: string, end: string): Promise<DayCtx> {
  const [shifts, leaves, days] = await Promise.all([
    api.getShifts(), api.getLeaves(), api.getCalendar(),
  ]);
  const inRange = (d: string) => d >= start && d <= end;
  const ctx: DayCtx = new Map();

  for (const d of days) {
    if (inRange(d.date)) ctx.set(`*|${d.date}`, { category: d.kind, label: d.label });
  }
  for (const l of leaves) {
    for (let d = l.start_date; d <= l.end_date && d <= end; d = nextDay(d)) {
      if (inRange(d)) ctx.set(`${l.employee_id}|${d}`, { category: "leave", label: LEAVE_LABEL(l.kind) });
    }
  }
  for (const s of shifts) {
    if (!inRange(s.date)) continue;
    const key = `${s.employee_id}|${s.date}`;
    if (!ctx.has(key)) ctx.set(key, { category: "escala", label: "Escala extra" });
  }
  return ctx;
}

/** Dia específico do colaborador (escala/férias) tem prioridade sobre o feriado/facultativo/evento global do mesmo dia. */
export function lookupDay(ctx: DayCtx, employeeId: number, date: string): DayInfo | undefined {
  return ctx.get(`${employeeId}|${date}`) ?? ctx.get(`*|${date}`);
}

export interface AgendaItem extends DayInfo {
  date: string;
  note: string | null;
}

/** Agenda de um único colaborador no período: escalas e férias/licenças dele + feriados/facultativos/eventos gerais. */
export async function buildAgendaItems(employeeId: number, start: string, end: string): Promise<AgendaItem[]> {
  const [shifts, leaves, days] = await Promise.all([
    api.getShifts(), api.getLeaves(), api.getCalendar(),
  ]);
  const inRange = (d: string) => d >= start && d <= end;
  const items: AgendaItem[] = [];

  for (const d of days) {
    if (inRange(d.date)) items.push({ category: d.kind, label: d.label, date: d.date, note: null });
  }
  for (const s of shifts) {
    if (s.employee_id === employeeId && inRange(s.date)) {
      items.push({ category: "escala", label: "Escala extra", date: s.date, note: s.note });
    }
  }
  for (const l of leaves) {
    if (l.employee_id !== employeeId) continue;
    for (let d = l.start_date; d <= l.end_date && d <= end; d = nextDay(d)) {
      if (inRange(d)) items.push({ category: "leave", label: LEAVE_LABEL(l.kind), date: d, note: l.note });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
