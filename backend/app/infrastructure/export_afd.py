"""Geração do AFD (Arquivo Fonte de Dados) — layout REP-P/software da Portaria
MTP 671/2021, Anexo II (registros tipo 1, 3 e 9).

AVISO IMPORTANTE: este sistema NÃO é um REP homologado/certificado pelo INMETRO.
O AFD gerado aqui serve só para uso interno (conferência, backup, migração) e
NÃO substitui o AFD de um REP homologado para fins de fiscalização do MTE.
"""
from datetime import datetime

NSR_START = 1


def _num(v: str | None, size: int) -> str:
    v = v or ""
    return v.rjust(size, "0")[:size]


def _txt(v: str | None, size: int) -> str:
    v = (v or "").upper()
    return v.ljust(size)[:size]


def build_afd(source: dict) -> str:
    """Monta o AFD em texto de largura fixa a partir de `afd_source()`.

    Tipo 1: cabeçalho (NSR, CNPJ, razão social, período, geração, tipo REP, nº REP)
    Tipo 3: uma linha por batida (NSR, data, hora, CPF do trabalhador)
    Tipo 9: trailer (NSR, qtde tipo 3, total de registros, data final)
    """
    now = datetime.now()
    cnpj = _num(source.get("company_cnpj"), 14)
    name = _txt(source.get("company_name"), 150)
    start = source["start"].replace("-", "")
    end = source["end"].replace("-", "")
    rep_number = _num(source.get("rep_number"), 17)

    lines: list[str] = []
    nsr = NSR_START

    header = (
        _num(str(nsr), 9) + "1" + cnpj.rjust(14, "0") + name
        + start + end + now.strftime("%Y%m%d%H%M%S")
        + "P" + rep_number
    )
    lines.append(header)
    nsr += 1

    type3_count = 0
    for p in source["punches"]:
        cpf = _num(p.get("cpf"), 11)
        date_c = p["date"].replace("-", "")
        time_c = p["time"].replace(":", "").ljust(4, "0")
        lines.append(_num(str(nsr), 9) + "3" + date_c + time_c + cpf)
        nsr += 1
        type3_count += 1

    trailer = (
        _num(str(nsr), 9) + "9" + _num(str(type3_count), 9)
        + _num(str(nsr), 9) + end
    )
    lines.append(trailer)

    return "\r\n".join(lines) + "\r\n"
