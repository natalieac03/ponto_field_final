import type {
  BankReport, DailyRecord, Employee, MonthlyReport,
  RecordCreate, RecordPatchBreak, RecordPatchExit, RecordPatchNote, RecordPatchTimes,
  Settings, SettingsUpdate, WeeklySchedule,
  CalendarDay, CalendarDayCreate, HolidaySuggestion,
} from "../types";

const rawBase = import.meta.env.VITE_API_URL || "http://localhost:8080";
const BASE = rawBase.startsWith("http") ? rawBase : `https://${rawBase}`;

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
    headers: { "Content-Type": "application/json" },
    ...options,
  });
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

// Upload precisa de Content-Type diferente (multipart)
async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try { const b = await res.json(); msg = b.detail ?? msg; } catch { /* noop */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export const api = {
  authEmployee: (employee_id: number, password: string) =>
    request<{ id: number; name: string }>("/auth/employee", {
      method: "POST", body: JSON.stringify({ employee_id, password }),
    }),
  authAdmin: (password: string) =>
    request<{ ok: boolean }>("/auth/admin", {
      method: "POST", body: JSON.stringify({ password }),
    }),

  getEmployees:   () => request<Employee[]>("/employees"),
  renameEmployee: (id: number, name: string) =>
    request<Employee>(`/employees/${id}/name`, {
      method: "PATCH", body: JSON.stringify({ name }),
    }),
  createEmployee: (name: string, pin?: string) =>
    request<Employee>("/employees", {
      method: "POST",
      body: JSON.stringify(pin ? { name, pin } : { name }),
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

  getRecords: () => request<DailyRecord[]>("/records"),
  getRecordsByEmployee: (id: number) => request<DailyRecord[]>(`/records/employee/${id}`),
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

  getCalendar: (start?: string, end?: string) =>
    request<CalendarDay[]>(start && end ? `/calendar?start=${start}&end=${end}` : "/calendar"),
  upsertCalendarDay: (data: CalendarDayCreate) =>
    request<CalendarDay>("/calendar", { method: "PUT", body: JSON.stringify(data) }),
  deleteCalendarDay: (id: number) =>
    request<void>(`/calendar/${id}`, { method: "DELETE" }),
  getHolidaySuggestions: (year: number) =>
    request<HolidaySuggestion[]>(`/calendar/suggestions?year=${year}`),
  importHolidays: (year: number, includeFacultativos: boolean) =>
    request<{ added: number }>(`/calendar/import?year=${year}&include_facultativos=${includeFacultativos}`, { method: "POST" }),

  getBankReport: () => request<BankReport>("/reports/bank"),
  getMonthlyReport: (year: number, month: number) =>
    request<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`),
};
