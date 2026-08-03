"""Implementações SQLModel das portas de repositório."""
from sqlmodel import Session, select

from app.domain.models import ActivityLog, DailyRecord, Employee, Settings


class SqlEmployeeRepository:
    def __init__(self, session: Session):
        self.s = session

    def get(self, employee_id: int) -> Employee | None:
        return self.s.get(Employee, employee_id)

    def list_all(self) -> list[Employee]:
        return list(self.s.exec(select(Employee)).all())

    def find_by_name(self, name_lower: str) -> Employee | None:
        for e in self.list_all():
            if e.name.lower() == name_lower:
                return e
        return None

    def count(self) -> int:
        return len(self.list_all())

    def add(self, emp: Employee) -> Employee:
        self.s.add(emp)
        self.s.commit()
        self.s.refresh(emp)
        return emp

    def update(self, emp: Employee) -> Employee:
        self.s.add(emp)
        self.s.commit()
        self.s.refresh(emp)
        return emp

    def delete(self, emp: Employee) -> None:
        for r in self.s.exec(select(DailyRecord).where(DailyRecord.employee_id == emp.id)).all():
            self.s.delete(r)
        self.s.delete(emp)
        self.s.commit()


class SqlRecordRepository:
    def __init__(self, session: Session):
        self.s = session

    def get(self, record_id: int) -> DailyRecord | None:
        return self.s.get(DailyRecord, record_id)

    def get_for_day(self, employee_id: int, date: str) -> DailyRecord | None:
        return self.s.exec(
            select(DailyRecord)
            .where(DailyRecord.employee_id == employee_id)
            .where(DailyRecord.date == date)
        ).first()

    def list_all(self) -> list[DailyRecord]:
        return list(self.s.exec(select(DailyRecord).order_by(DailyRecord.date.desc())).all())

    def list_by_employee(self, employee_id: int) -> list[DailyRecord]:
        return list(self.s.exec(
            select(DailyRecord)
            .where(DailyRecord.employee_id == employee_id)
            .order_by(DailyRecord.date.desc())
        ).all())

    def list_by_month(self, prefix: str) -> list[DailyRecord]:
        return list(self.s.exec(
            select(DailyRecord)
            .where(DailyRecord.date.startswith(prefix))
            .order_by(DailyRecord.date)
        ).all())

    def list_by_status(self, status: str) -> list[DailyRecord]:
        return list(self.s.exec(
            select(DailyRecord)
            .where(DailyRecord.status == status)
            .order_by(DailyRecord.date.desc())
        ).all())

    def add(self, rec: DailyRecord) -> DailyRecord:
        self.s.add(rec)
        self.s.commit()
        self.s.refresh(rec)
        return rec

    def update(self, rec: DailyRecord) -> DailyRecord:
        self.s.add(rec)
        self.s.commit()
        self.s.refresh(rec)
        return rec

    def delete(self, rec: DailyRecord) -> None:
        self.s.delete(rec)
        self.s.commit()


class SqlSettingsRepository:
    def __init__(self, session: Session):
        self.s = session

    def get_or_create(self) -> Settings:
        s = self.s.exec(select(Settings)).first()
        if not s:
            s = Settings(std_minutes=480, h1_minutes=480, h2_minutes=240)
            self.s.add(s)
            self.s.commit()
            self.s.refresh(s)
        return s

    def update(self, settings: Settings) -> Settings:
        self.s.add(settings)
        self.s.commit()
        self.s.refresh(settings)
        return settings

    def journey_params(self) -> tuple[int, int]:
        s = self.get_or_create()
        return s.h1_minutes, s.h2_minutes


class SqlActivityLogRepository:
    def __init__(self, session: Session):
        self.s = session

    def add(self, log: ActivityLog) -> ActivityLog:
        self.s.add(log)
        self.s.commit()
        self.s.refresh(log)
        return log

    def list_since(self, since_iso: str) -> list[ActivityLog]:
        return list(self.s.exec(
            select(ActivityLog)
            .where(ActivityLog.created_at >= since_iso)
            .order_by(ActivityLog.id.desc())
        ).all())

    def list_for_employee(self, employee_id: int, since_iso: str, until_iso: str) -> list[ActivityLog]:
        return list(self.s.exec(
            select(ActivityLog)
            .where(ActivityLog.employee_id == employee_id)
            .where(ActivityLog.created_at >= since_iso)
            .where(ActivityLog.created_at < until_iso)
            .order_by(ActivityLog.id.desc())
        ).all())
