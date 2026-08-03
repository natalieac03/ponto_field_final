"""Parâmetros de negócio do banco de horas (Folha FieldTech v2).

Fonte única de verdade para jornadas, janela noturna, códigos de abono e feriados.
Camada de domínio — sem I/O, sem framework.
"""

# ── Jornada de referência (aba Parâmetros da planilha) ───────────────────────
H1_MINUTES = 480          # dia útil = 8h
H2_MINUTES = 240          # sábado = 4h
# H3 (domingo/feriado) = 0h

# ── Adicional noturno ────────────────────────────────────────────────────────
NIGHT_START_MIN = 22 * 60  # 22:00
NIGHT_END_MIN = 5 * 60     # 05:00 (dia seguinte)
NIGHT_PCT = 0.20

# ── Alerta de jornada longa ──────────────────────────────────────────────────
DAILY_ALERT_MINUTES = 600  # 10h

# ── Abonos e tratamento ──────────────────────────────────────────────────────
ABONO_AS_WORKED = {"AB", "AT", "VG"}  # contam como trabalhado (sem débito)
ABONO_FOLGA = {"FE"}                  # zera a referência do dia
ABONO_FALTA = {"FA"}                  # sem crédito → gera negativo
ABONO_CODES = ABONO_AS_WORKED | ABONO_FOLGA | ABONO_FALTA

# Rótulos por código (uso em relatórios)
ABONO_LABELS = {
    "AB": "Abono", "AT": "Atestado", "VG": "Viagem", "FA": "Falta", "FE": "Folga",
}

# ── Tipos de contrato (perfil de RH do colaborador) ──────────────────────────
CONTRACT_TYPES = {"CLT", "PJ", "Estágio", "Temporário"}

# ── Feriados nacionais/empresa 2026 (aba Parâmetros) ─────────────────────────
HOLIDAYS_2026 = {
    "2026-01-01", "2026-02-17", "2026-04-03", "2026-04-05", "2026-04-21",
    "2026-05-01", "2026-06-04", "2026-09-07", "2026-10-12", "2026-11-02",
    "2026-11-15", "2026-11-20", "2026-12-25",
}
