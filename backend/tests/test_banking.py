"""Agregação de período (app/domain/banking.py).

Casos travados aqui foram os 3 bugs reais encontrados comparando o sistema
contra a Folha de Ponto oficial e os fechamentos de agosto/2026 de
Camila, João Vitor e Maria Ronise.
"""
from datetime import date

from app.domain import accounting, banking


def test_extra50_do_periodo_e_liquido_nao_soma_dias_positivos(make_rec):
    """Bug #1: um dia de excesso e um dia de falta no mesmo período não podem
    gerar extra50 = excesso cheio (H10 = MAX(0, trabalhado-referência-extra100)
    na Folha oficial é líquido, não soma dos excessos diários).

    Semana 32 (Aug3-9) fica inteira dentro do mês; escala no sábado (Aug8)
    força referência fixa de 8h nos dias úteis, deixando a conta simples de
    verificar: 480min de referência em Aug3 e Aug4."""
    accounting.set_shifts({1: {"2026-08-08"}})
    recs = [
        make_rec(date="2026-08-03", entry_time="07:00", break_start="12:00",
                 break_end="13:00", exit_time="16:50"),   # útil, worked=530 (+50)
        make_rec(date="2026-08-04", entry_time="07:00", break_start="12:00",
                 break_end="13:00", exit_time="14:10"),   # útil, worked=370 (-110)
    ]
    st = banking.period_stats(recs, date(2026, 8, 3), date(2026, 8, 4),
                              h1=480, h2=240, today=date(2026, 8, 31),
                              employee_id=1)
    # +50 (excesso) - 110 (falta) = líquido -60 => extra50 líquido é 0,
    # não 50 (o que a soma ingênua dos dias positivos daria).
    assert st["balance"] == -60
    assert st["extra50"] == 0


def test_extra50_positivo_quando_saldo_liquido_e_positivo(make_rec):
    accounting.set_shifts({1: {"2026-08-08"}})
    recs = [
        make_rec(date="2026-08-03", entry_time="07:00", break_start="12:00",
                 break_end="13:00", exit_time="16:50"),   # útil, worked=530 (+50)
        make_rec(date="2026-08-04", entry_time="07:00", break_start="12:00",
                 break_end="13:00", exit_time="15:40"),   # útil, worked=460 (-20)
    ]
    st = banking.period_stats(recs, date(2026, 8, 3), date(2026, 8, 4),
                              h1=480, h2=240, today=date(2026, 8, 31),
                              employee_id=1)
    assert st["balance"] == 30
    assert st["extra50"] == 30


def test_effective_do_periodo_usa_recalculo_nao_valor_persistido_antigo(make_rec):
    """Bugs #2+#3 combinados: um dia de abono "como trabalhado" persistido com
    o ponto batido de fato (efetivo antigo, errado) precisa ser recalculado
    pela regra vigente na agregação mensal, não usar o valor gravado então."""
    accounting.set_shifts({1: {"2026-08-08"}})  # semana 32: referência fixa 8h/dia
    rec = make_rec(
        date="2026-08-05", entry_time="07:58", break_start="12:02",
        break_end="13:15", exit_time="17:00",  # ponto batido: ~08:45 (menos que a ref.)
        abono_code="AT",
        effective_minutes=9999,  # valor antigo/persistido, deliberadamente errado
    )
    st = banking.period_stats([rec], date(2026, 8, 5), date(2026, 8, 5),
                              h1=480, h2=240, today=date(2026, 8, 31),
                              employee_id=1)
    # AT credita exatamente a referência do dia (480), nunca 9999 nem o ponto batido.
    assert st["worked"] == 480
    assert st["reference"] == 480
    assert st["balance"] == 0


def test_agosto_2026_sem_escala_fecha_em_188h_como_a_folha_oficial():
    """Regressão do ajuste de virada de mês: agosto/2026 sem nenhuma escala de
    sábado marcada deve fechar a referência em exatamente 188:00 (11280 min),
    igual ao valor apurado na Folha oficial e nos PDFs reais de fechamento —
    e não nos 11040 min que o modelo dinâmico "puro" (sem tratar a virada de
    semana) produzia antes desta correção."""
    st = banking.period_stats([], date(2026, 8, 1), date(2026, 8, 31),
                              h1=480, h2=240, today=date(2026, 9, 30),
                              employee_id=99)
    assert st["reference"] == 11280
