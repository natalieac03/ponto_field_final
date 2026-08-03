import type {
  ActivityLog, BankEntry, BankReport, DailyRecord, Employee, EmployeeProfileUpdate,
  MonthlyReport, RecordCreate, RecordPatchBreak, RecordPatchExit, RecordPatchNote,
  RecordPatchTimes, RecordRequestEdit, RecordReview, Settings, SettingsUpdate, WeeklySchedule,
  CalendarDay, CalendarKind, HolidaySuggestion, EmployeeLeave, EmployeeShift, LeaveKind, VacationReport,
} from "../types";

export type EmployeeCreatePayload = { name: string; pin?: string } & EmployeeProfileUpdate;

// VITE_API_URL pode ser:
//  - URL absoluta ("http://localhost:8000", "https://api.exemplo.com") — usada como está;
//  - caminho same-origin ("/api") — produção atrás de proxy reverso (sem CORS);
//  - host puro ("api.exemplo.com") — assume https:// (compat).
const rawBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
const BASE =
  /^https?:\/\//.test(rawBase) || rawBase.startsWith("/")
    ? rawBase.replace(/\/$/, "")
    : `https://${rawBase}`;

// ── Token de sessão ─────────────────────────────────────────────────────────
const TOKEN_KEY = "ponto_field_token";
let authToken: string | null = localStorage.getItem(TOKEN_KEY);

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Callback disparado quando a sessão expira/é rejeitada (401). App usa p/ deslogar.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  onUnauthorized = cb;
}

function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  return authToken ? { ...base, Authorization: `Bearer ${authToken}` } : base;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: authHeaders({ "Content-Type": "application/json", ...(options?.headers as Record<string, string>) }),
  });
  if (res.status === 401) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    let code: string | undefined;
    try {
      const b = await res.json();
      msg = b.detail ?? msg;
      // Quando o backend manda detail = "PASSWORD_NOT_SET" (status 428),
      // o code fica disponível p/ disparar o fluxo de definir senha
      if (typeof msg === "string" && /^[A-Z_]+$/.test(msg)) code = msg;
    } catch { /* noop */ }
    throw new ApiError(res.status, msg, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Download autenticado (xlsx/csv) — busca o blob com Bearer e dispara o save.
async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const b = await res.json(); msg = b.detail ?? msg; } catch { /* noop */ }
    throw new ApiError(res.status, msg);
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Upload precisa de Content-Type diferente (multipart)
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData, headers: authHeaders() });
  if (res.status === 401) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const b = await res.json(); msg = b.detail ?? msg; } catch { /* noop */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

/** Filtros aplicáveis às exportações (mesmos da tela). */
export interface ExportFilter {
  employeeId?: number | null;
  start?: string;
  end?: string;
  suffix?: string;      // sufixo do nome do arquivo
}

function exportQuery(f: ExportFilter): string {
  const p: string[] = [];
  if (f.employeeId) p.push(`employee_id=${f.employeeId}`);
  if (f.start) p.push(`start=${f.start}`);
  if (f.end) p.push(`end=${f.end}`);
  return p.length ? `&${p.join("&")}` : "";
}

export const api = {
  authEmployee: async (employee_id: number, password: string) => {
    const r = await request<{ id: number; name: string; token: string }>("/auth/employee", {
      method: "POST", body: JSON.stringify({ employee_id, password }),
    });
    setAuthToken(r.token);
    return { id: r.id, name: r.name };
  },
  authAdmin: async (password: string) => {
    const r = await request<{ ok: boolean; token: string; name: string; employee_id: number | null }>("/auth/admin", {
      method: "POST", body: JSON.stringify({ password }),
    });
    setAuthToken(r.token);
    return { ok: r.ok, name: r.name, employeeId: r.employee_id };
  },

  deactivateEmployee: (id: number, terminationDate?: string) =>
    request<Employee>(`/employees/${id}/deactivate`, {
      method: "POST", body: JSON.stringify({ termination_date: terminationDate ?? null }),
    }),
  reactivateEmployee: (id: number) =>
    request<Employee>(`/employees/${id}/reactivate`, { method: "POST" }),

  // ── Relatório de férias / afastamentos ──
  getVacationReport: (start: string, end: string, lookbackDays = 90) =>
    request<VacationReport>(`/reports/vacation?start=${start}&end=${end}&lookback_days=${lookbackDays}`),
  downloadVacationCsv: (start: string, end: string, lookbackDays = 90) =>
    downloadFile(`/reports/vacation.csv?start=${start}&end=${end}&lookback_days=${lookbackDays}`,
      `ferias_${start}_a_${end}.csv`),

  // ── Escalas (dias escalados do colaborador) ──
  getShifts: () => request<EmployeeShift[]>("/calendar/shifts"),
  addShifts: (data: { employee_id: number; dates: string[]; note?: string }) =>
    request<{ added: number }>("/calendar/shifts", { method: "POST", body: JSON.stringify(data) }),
  deleteShift: (id: number) => request<void>(`/calendar/shifts/${id}`, { method: "DELETE" }),

  // ── Férias / licenças ──
  getLeaves: () => request<EmployeeLeave[]>("/calendar/leaves"),
  addLeave: (data: { employee_id: number; start_date: string; end_date: string; kind?: LeaveKind; note?: string }) =>
    request<EmployeeLeave>("/calendar/leaves", { method: "POST", body: JSON.stringify(data) }),
  deleteLeave: (id: number) =>
    request<void>(`/calendar/leaves/${id}`, { method: "DELETE" }),

  // ── Calendário editável (feriados/facultativos/eventos) ──
  getCalendar: () => request<CalendarDay[]>("/calendar"),
  upsertCalendarDay: (data: { date: string; kind: CalendarKind; label: string; deduct_minutes?: number | null }) =>
    request<CalendarDay>("/calendar", { method: "PUT", body: JSON.stringify(data) }),
  deleteCalendarDay: (id: number) =>
    request<void>(`/calendar/${id}`, { method: "DELETE" }),
  getHolidaySuggestions: (year: number) =>
    request<HolidaySuggestion[]>(`/calendar/suggestions?year=${year}`),
  importHolidays: (year: number, includeFacultativos: boolean) =>
    request<{ added: number }>(`/calendar/import?year=${year}&include_facultativos=${includeFacultativos}`, { method: "POST" }),

  getEmployees:   () => request<Employee[]>("/employees"),
  getPublicEmployees: () => request<Pick<Employee, "id" | "name" | "has_password">[]>("/employees/public"),
  getEmployee: (id: number) => request<Employee>(`/employees/${id}`),
  renameEmployee: (id: number, name: string) =>
    request<Employee>(`/employees/${id}/name`, {
      method: "PATCH", body: JSON.stringify({ name }),
    }),
  createEmployee: (data: EmployeeCreatePayload) =>
    request<Employee>("/employees", {
      method: "POST", body: JSON.stringify(data),
    }),
  updateEmployeeProfile: (id: number, data: EmployeeProfileUpdate) =>
    request<Employee>(`/employees/${id}/profile`, {
      method: "PATCH", body: JSON.stringify(data),
    }),

  setEmployeePassword: (id: number, password: string) =>
    request<Employee>(`/employees/${id}/password`, {
      method: "POST", body: JSON.stringify({ password }),
    }),
  changeEmployeePassword: (id: number, current_password: string, new_password: string) =>
    request<Employee>(`/employees/${id}/password`, {
      method: "PATCH", body: JSON.stringify({ current_password, new_password }),
    }),
  updateEmployeeSchedule: (id: number, schedule: WeeklySchedule) =>
    request<Employee>(`/employees/${id}/schedule`, {
      method: "PUT", body: JSON.stringify(schedule),
    }),

  deleteEmployee: (id: number) => request<void>(`/employees/${id}`, { method: "DELETE" }),

  uploadEmployeePhoto: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadRequest<Employee>(`/employees/${id}/photo`, fd);
  },
  deleteEmployeePhoto: (id: number) => request<Employee>(`/employees/${id}/photo`, { method: "DELETE" }),
  employeePhotoUrl: (filename: string) => `${BASE}/employees/photos/${filename}`,

  getRecords: () => request<DailyRecord[]>("/records"),
  getPendingRecords: () => request<DailyRecord[]>("/records/pending"),
  reviewRecord: (id: number, data: RecordReview) =>
    request<DailyRecord>(`/records/${id}/review`, { method: "PATCH", body: JSON.stringify(data) }),
  getRecordsByEmployee: (id: number) => request<DailyRecord[]>(`/records/employee/${id}`),
  requestEditRecord: (id: number, data: RecordRequestEdit) =>
    request<DailyRecord>(`/records/${id}/request-edit`, { method: "PATCH", body: JSON.stringify(data) }),
  requestRemoveRecord: (id: number) =>
    request<DailyRecord>(`/records/${id}/request-removal`, { method: "POST" }),
  createRecord: (data: RecordCreate) =>
    request<DailyRecord>("/records", { method: "POST", body: JSON.stringify(data) }),
  patchBreak: (id: number, data: RecordPatchBreak) =>
    request<DailyRecord>(`/records/${id}/break`, { method: "PATCH", body: JSON.stringify(data) }),
  patchExit: (id: number, data: RecordPatchExit) =>
    request<DailyRecord>(`/records/${id}/exit`, { method: "PATCH", body: JSON.stringify(data) }),
  patchTimes: (id: number, data: RecordPatchTimes) =>
    request<DailyRecord>(`/records/${id}/times`, { method: "PATCH", body: JSON.stringify(data) }),
  patchNote: (id: number, data: RecordPatchNote) =>
    request<DailyRecord>(`/records/${id}/note`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRecord: (id: number) => request<void>(`/records/${id}`, { method: "DELETE" }),

  uploadAttachment: (recordId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return uploadRequest<DailyRecord>(`/records/${recordId}/attachments`, fd);
  },
  deleteAttachment: (recordId: number, filename: string) =>
    request<DailyRecord>(`/records/${recordId}/attachments/${filename}`, { method: "DELETE" }),
  attachmentUrl: (filename: string) => `${BASE}/records/attachments/${filename}`,

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (data: SettingsUpdate) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
  updateAdminPassword: (password: string) =>
    request<Settings>("/settings/admin-password", { method: "PUT", body: JSON.stringify({ password }) }),

  getBankReport: () => request<BankReport>("/reports/bank"),
  getMonthlyReport: (year: number, month: number) =>
    request<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),
  getEmployeeMonthly: (employeeId: number, year: number, month: number) =>
    request<MonthlyReport>(`/reports/employee/${employeeId}/monthly?year=${year}&month=${month}`),
  getEmployeeBank: (employeeId: number) =>
    request<BankEntry>(`/reports/employee/${employeeId}/bank`),
  downloadMonthlyXlsx: (year: number, month: number, f: ExportFilter = {}) =>
    downloadFile(`/reports/monthly.xlsx?year=${year}&month=${month}${exportQuery(f)}`,
      `pontofield_${year}${String(month).padStart(2, "0")}${f.suffix ?? ""}.xlsx`),
  downloadMonthlyCsv: (year: number, month: number, f: ExportFilter = {}) =>
    downloadFile(`/reports/monthly.csv?year=${year}&month=${month}${exportQuery(f)}`,
      `pontofield_${year}${String(month).padStart(2, "0")}${f.suffix ?? ""}.csv`),

  getActivity: (days = 90) => request<ActivityLog[]>(`/activity?days=${days}`),
  getEmployeeActivity: (employeeId: number, year: number, month: number) =>
    request<ActivityLog[]>(`/activity/employee/${employeeId}?year=${year}&month=${month}`),
};
