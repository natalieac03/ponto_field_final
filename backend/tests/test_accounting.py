"""Regras de referência/efetivo do dia (app/domain/accounting.py).

Casos travados aqui foram confirmados contra a Folha de Ponto oficial
(Folha_de_Ponto_TEMPLATE_FieldTechnology_v2.xlsx) e contra os fechamentos
reais de agosto/2026 (Camila, João Vitor, Maria Ronise).
"""
from app.domain import accounting


# 2026-08-12 (quarta, semana 33: Aug10-16) está inteira dentro do mês e sem
# escala marcada => referência dinâmica de 8h48 (528min), não 8h flat.
def test_abono_as_worked_credits_exact_reference_even_if_worked_more():
    res = accounting.compute_day(
        "2026-08-12", "07:00", "12:00", "13:00", "19:00",  # 11h trabalhadas
        abono="AT", h1=480, h2=240,
    )
    assert res.effective == res.reference == 528
    assert res.balance == 0


def test_abono_as_worked_credits_exact_reference_even_if_worked_zero():
    res = accounting.compute_day(
        "2026-08-12", None, None, None, None,
        abono="VG", h1=480, h2=240,
    )
    assert res.worked == 0
    assert res.effective == res.reference == 528


def test_falta_injustificada_gera_debito_cheio():
    res = accounting.compute_day(
        "2026-08-12", None, None, None, None,
        abono="FA", h1=480, h2=240,
    )
    assert res.effective == 0
    assert res.reference == 528
    assert res.shortfall == 528


def test_folga_zera_referencia():
    res = accounting.compute_day(
        "2026-08-12", None, None, None, None,
        abono="FE", h1=480, h2=240,
    )
    assert res.reference == 0
    assert res.effective == 0
    assert res.balance == 0


# ── Regra CLT 44h/semana: sem escala redistribui, com escala é fixo 8h+4h ──
def test_semana_sem_escala_redistribui_8h48_por_dia_util():
    # 2026-08-17 a 21 (seg-sex), semana 32 (Aug17-23), inteira dentro do mês.
    for iso in ("2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"):
        ref = accounting.employee_reference(1, iso, None, 480, 240, None)
        assert ref == 528  # (480*5+240)//5 = 8h48
    sat = accounting.employee_reference(1, "2026-08-22", None, 480, 240, None)
    sun = accounting.employee_reference(1, "2026-08-23", None, 480, 240, None)
    assert sat == 0 and sun == 0
    assert 528 * 5 == 2640  # == 44h


def test_semana_com_escala_sabado_e_fixa_8h_mais_4h():
    accounting.set_shifts({1: {"2026-08-22"}})  # sábado escalado, semana 32
    for iso in ("2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"):
        ref = accounting.employee_reference(1, iso, None, 480, 240, None)
        assert ref == 480
    assert accounting.employee_reference(1, "2026-08-22", None, 480, 240, None) == 240
    assert accounting.employee_reference(1, "2026-08-23", None, 480, 240, None) == 0
    assert 480 * 5 + 240 == 2640  # == 44h, igual à semana sem escala


# ── Bug: semana que cruza a virada do mês não pode usar a redistribuição
# dinâmica (44h "vazaria" para o outro mês) — usa jornada fixa, como a Folha.
def test_semana_de_virada_de_mes_usa_referencia_fixa():
    # Semana 31/2026: seg 2026-07-27 a dom 2026-08-02 — cruza jul/ago.
    assert accounting.week_crosses_month("2026-08-01") is True
    assert accounting.week_crosses_month("2026-07-27") is True
    # Sábado (Aug 1) = 4h fixo mesmo sem escala marcada (sem redistribuir).
    sat = accounting.employee_reference(1, "2026-08-01", None, 480, 240, None)
    assert sat == 240
    sun = accounting.employee_reference(1, "2026-08-02", None, 480, 240, None)
    assert sun == 0
    # Dia útil da mesma semana (do lado de julho) = 8h fixo, não 8h48.
    fri = accounting.employee_reference(1, "2026-07-31", None, 480, 240, None)
    assert fri == 480


def test_semana_de_virada_de_mes_fixa_mesmo_com_escala_marcada():
    # Escala não deveria mudar nada numa semana de virada: já é fixa.
    accounting.set_shifts({1: {"2026-08-01"}})
    sat = accounting.employee_reference(1, "2026-08-01", None, 480, 240, None)
    assert sat == 240
    fri = accounting.employee_reference(1, "2026-07-31", None, 480, 240, None)
    assert fri == 480


def test_semana_interna_ao_mes_nao_e_afetada_pela_regra_de_virada():
    assert accounting.week_crosses_month("2026-08-17") is False


def test_semana_completa_soma_sempre_44h_mesmo_dividida_entre_meses():
    """Propriedade central da correção: dividir a semana entre dois meses não
    pode alterar o total de 44h daquela semana quando os dois meses são
    somados — só desloca ONDE cada minuto é contabilizado."""
    # Semana 31/2026 (Jul27–Ago2): 5 dias úteis de julho + sáb/dom de agosto.
    dias_julho = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"]
    dias_agosto = ["2026-08-01", "2026-08-02"]
    total = sum(accounting.employee_reference(1, d, None, 480, 240, None) for d in dias_julho)
    total += sum(accounting.employee_reference(1, d, None, 480, 240, None) for d in dias_agosto)
    assert total == 2640  # 44h, igual a qualquer outra semana

    # Semana 36/2026 (Ago31–Set6): 1 dia útil de agosto + resto em setembro.
    dias_agosto2 = ["2026-08-31"]
    dias_setembro = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]
    total2 = sum(accounting.employee_reference(1, d, None, 480, 240, None) for d in dias_agosto2)
    total2 += sum(accounting.employee_reference(1, d, None, 480, 240, None) for d in dias_setembro)
    assert total2 == 2640


# ── Regra CLT Art. 59 + Súmula 146/TST: a dobra (100%) é exclusiva de domingo
# e feriado NÃO facultativo. Sábado sem escala, facultativo e evento geram
# extra 50% (não há DSR a dobrar).
def test_sabado_sem_escala_gera_extra50_nao_extra100():
    # 2026-08-22 é sábado, sem escala marcada.
    res = accounting.compute_day(
        "2026-08-22", "08:00", None, None, "12:10",  # 4h10 trabalhadas
        h1=480, h2=240, employee_id=1,
    )
    assert res.reference == 0 and res.rest_day is True
    assert res.extra50 == 250 and res.extra100 == 0


def test_domingo_gera_extra100():
    # 2026-08-23 é domingo.
    res = accounting.compute_day(
        "2026-08-23", "08:00", None, None, "12:00",  # 4h trabalhadas
        h1=480, h2=240, employee_id=1,
    )
    assert res.reference == 0 and res.rest_day is True
    assert res.extra50 == 0 and res.extra100 == 240


def test_feriado_nao_facultativo_gera_extra100():
    accounting.set_calendar({"2026-08-18"}, {}, kinds={"2026-08-18": "feriado"})  # terça
    res = accounting.compute_day(
        "2026-08-18", "08:00", None, None, "12:00",
        h1=480, h2=240, employee_id=1,
    )
    assert res.reference == 0
    assert res.extra100 == 240 and res.extra50 == 0


def test_ponto_facultativo_gera_extra50_nao_extra100():
    accounting.set_calendar({"2026-08-18"}, {}, kinds={"2026-08-18": "facultativo"})  # terça
    res = accounting.compute_day(
        "2026-08-18", "08:00", None, None, "12:00",
        h1=480, h2=240, employee_id=1,
    )
    assert res.reference == 0
    assert res.extra50 == 240 and res.extra100 == 0
