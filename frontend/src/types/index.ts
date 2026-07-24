export interface WeeklySchedule {
  mon_minutes: number | null;
  tue_minutes: number | null;
  wed_minutes: number | null;
  thu_minutes: number | null;
  fri_minutes: number | null;
  sat_minutes: number | null;
  sun_minutes: number | null;
}

export interface Employee extends WeeklySchedule {
  id: number;
  name: string;
  has_password: boolean;
}

export interface DailyRecord {
  id: number;
  employee_id: number;
  date: string;
  entry_time: string;
  break_start: string | null;
  break_end: string | null;
  exit_time: string | null;
  standard_minutes: number;
  break_minutes: number | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  note: string | null;
  attachments: string[];
}

export interface RecordCreate {
  employee_id: number;
  date: string;
  entry_time: string;
  standard_minutes: number;
  note?: string;
}

export interface RecordPatchBreak {
  break_start?: string;
  break_end?: string;
}

export interface RecordPatchExit {
  exit_time: string;
  standard_minutes?: number;
  note?: string;
}

export interface RecordPatchNote {
  note: string | null;
}

export interface RecordPatchTimes {
  entry_time?: string;
  break_start?: string;
  break_end?: string;
  exit_time?: string;
  standard_minutes?: number;
}

export interface Settings {
  id: number;
  std_minutes: number;
  has_admin_password: boolean;
}

export interface SettingsUpdate {
  std_minutes: number;
}

export interface BankEntry {
  employee_id: number;
  employee_name: string;
  total_records: number;
  open_records: number;
  worked_minutes: number;
  standard_minutes: number;
  positive_overtime: number;
  negative_overtime: number;
  balance: number;
}

export interface BankReport {
  employees: BankEntry[];
  total_balance: number;
  employees_positive: number;
  employees_negative: number;
  total_records: number;
  open_records: number;
}

export interface MonthlyRecord extends DailyRecord {
  employee_name: string;
}

export interface MonthlySummary {
  employee_id: number;
  employee_name: string;
  days: number;
  worked_minutes: number;
  standard_minutes: number;
  positive_overtime: number;
  negative_overtime: number;
  balance: number;
}

export interface WeeklyEntry {
  employee_id: number;
  employee_name: string;
  week_start: string;
  week_end: string;
  days: number;
  worked_minutes: number;
  expected_minutes: number;
  deducted_minutes: number;
  deduction_labels: string[];
  balance: number;
}

export type CalendarKind = "feriado" | "facultativo" | "evento";

export interface CalendarDay {
  id: number;
  date: string;
  kind: CalendarKind;
  label: string;
  deduct_minutes: number | null;
}

export interface CalendarDayCreate {
  date: string;
  kind: CalendarKind;
  label: string;
  deduct_minutes?: number | null;
}

export interface HolidaySuggestion {
  date: string;
  label: string;
  kind: CalendarKind;
  already_added: boolean;
}

export interface MonthlyReport {
  year: number;
  month: number;
  records: MonthlyRecord[];
  weeks: WeeklyEntry[];
  summary: MonthlySummary[];
  total_worked: number;
  total_overtime: number;
  positive_overtime: number;
  negative_overtime: number;
}

export interface AuthSession {
  role: "employee";
  employee: { id: number; name: string };
}
export interface AdminSession { role: "admin"; }
export type Session = AuthSession | AdminSession | null;
