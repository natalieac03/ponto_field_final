from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from database import get_session
from schemas import BankReport, MonthlyReport
import services.report_service as svc

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/bank", response_model=BankReport)
def bank_report(session: Session = Depends(get_session)):
    return svc.get_bank(session)


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    session: Session = Depends(get_session),
):
    return svc.get_monthly(session, year, month)
