export interface WeeklySchedule {
  mon_minutes: number | null;
  tue_minutes: number | null;
  wed_minutes: number | null;
  thu_minutes: number | null;
  fri_minutes: number | null;
  sat_minutes: number | null;
  sun_minutes: number | null;
}

export type ContractType = "CLT" | "PJ" | "Estágio" | "Temporário";
export const CONTRACT_TYPES: ContractType[] = ["CLT", "PJ", "Estágio", "Temporário"];

export interface EmployeeProfileUpdate {
  cpf?: string | null;          // envia: "123.456.789-09" | "" limpa
  is_admin?: boolean;
  termination_date?: string | null;
  role?: string | null;
  hire_date?: string | null;
  department?: string | null;
  registration?: string | null;
  email?: string | null;
  phone?: string | null;
  contract_type?: string | null;
}

export interface Employee extends WeeklySchedule, EmployeeProfileUpdate {
  id: number;
  name: string;
  has_password: boolean;
  photo: string | null;
  cpf_masked: string | null;
  has_cpf: boolean;
  is_admin: boolean;
  active: boolean;
  termination_date: string | null;
}

export type LeaveKind = "ferias" | "licenca" | "folga";

export interface VacationReportRecord {
  date: string;
  entry_time: string | null;
  break_start: string | null;
  break_end: string | null;
  exit_time: string | null;
  worked_minutes: number | null;
  standard_minutes: number | null;
  overtime_minutes: number | null;
  abono_code: string | null;
  day_type: string | null;
  status: string;
}

export interface VacationReportItem {
  employee_id: number;
  employee_name: string;
  cpf_masked: string | null;
  role: string | null;
  leave_kind: string;
  leave_start: string;
  leave_end: string;
  leave_days: number;
  leave_note: string | null;
  window_start: string;
  window_end: string;
  worked_minutes: number;
  reference_minutes: number;
  balance: number;
  normal_minutes: number;
  shortfall_minutes: number;
  extra50_minutes: number;
  extra100_minutes: number;
  days_worked: number;
  records: VacationReportRecord[];
}

export interface VacationReport {
  start: string;
  end: string;
  lookback_days: number;
  items: VacationReportItem[];
}

export interface EmployeeShift {
  id: number;
  employee_id: number;
  date: string;
  note: string | null;
}

export interface EmployeeLeave {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  kind: LeaveKind;
  note: string | null;
}

export type CalendarKind = "feriado" | "facultativo" | "evento";

export interface CalendarDay {
  id: number;
  date: string;
  kind: CalendarKind;
  label: string;
  deduct_minutes: number | null;
}

export interface HolidaySuggestion {
  date: string;
  label: string;
  kind: CalendarKind;
  already_added: boolean;
}

export type AbonoCode = "AB" | "AT" | "VG" | "FA" | "FE";
export type RecordStatus = "aprovado" | "pendente" | "reprovado";

export interface DailyRecord {
  id: number;
  employee_id: number;
  date: string;
  entry_time: string | null;
  break_start: string | null;
  break_end: string | null;
  exit_time: string | null;
  day_type: "H1" | "H2" | "H3" | null;
  abono_code: AbonoCode | null;
  standard_minutes: number;
  break_minutes: number | null;
  worked_minutes: number | null;
  effective_minutes: number | null;
  overtime_minutes: number | null;
  extra50_minutes: number | null;
  extra100_minutes: number | null;
  night_minutes: number | null;
  night_bonus_minutes: number | null;
  over_limit: boolean;
  status: RecordStatus;
  is_retroactive: boolean;
  removal_requested: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  note: string | null;
  attachments: string[];
}

export interface RecordCreate {
  employee_id: number;
  date: string;
  entry_time?: string;
  break_start?: string;
  break_end?: string;
  exit_time?: string;
  abono_code?: AbonoCode;
  note?: string;
}

export interface RecordReview {
  action: "approve" | "reject";
  note?: string;
}

export interface RecordRequestEdit {
  entry_time?: string;
  break_start?: string;
  break_end?: string;
  exit_time?: string;
  abono_code?: string;
  note?: string;
}

export interface ActivityLog {
  id: number;
  created_at: string;
  actor_type: "admin" | "employee";
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  employee_id: number | null;
  description: string;
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
  abono_code?: string;
  standard_minutes?: number;
}

export interface Settings {
  id: number;
  std_minutes: number;
  h1_minutes: number;
  h2_minutes: number;
  has_admin_password: boolean;
}

export interface SettingsUpdate {
  // std_minutes é herança do modelo antigo — o motor usa h1/h2. O backend o
  // deriva de h1 automaticamente, então o front não precisa mais enviá-lo.
  std_minutes?: number;
  h1_minutes?: number;
  h2_minutes?: number;
}

export interface BankEntry {
  employee_id: number;
  employee_name: string;
  total_records: number;
  open_records: number;
  pending_records: number;
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
  pending_records: number;
}

export interface MonthlyRecord extends DailyRecord {
  employee_name: string;
}

export interface WeeklyBucket {
  week: number;
  label: string;
  worked_minutes: number;
  reference_minutes: number;
  balance: number;
}

export interface MonthlySummary {
  employee_id: number;
  employee_name: string;
  days: number;
  days_h1: number;
  days_h2: number;
  days_h3: number;
  worked_minutes: number;
  reference_minutes: number;
  balance: number;
  normal_minutes: number;
  shortfall_minutes: number;
  extra50_minutes: number;
  extra100_minutes: number;
  night_bonus_minutes: number;
  faltas: number;
  atestados: number;
  abonos: number;
  viagens: number;
  folgas: number;
  over_limit_days: number;
  pending: number;
  weeks: WeeklyBucket[];
  standard_minutes: number;
  positive_overtime: number;
  negative_overtime: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  records: MonthlyRecord[];
  summary: MonthlySummary[];
  total_worked: number;
  total_reference: number;
  total_overtime: number;
  positive_overtime: number;
  negative_overtime: number;
  total_extra100: number;
  total_night_bonus: number;
  pending_records: number;
}

export interface AuthSession {
  role: "employee";
  employee: { id: number; name: string };
}
export interface AdminSession { role: "admin"; name: string; employeeId: number | null; }
export type Session = AuthSession | AdminSession | null;
