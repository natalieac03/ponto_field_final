"""Normalização, validação e MASCARAMENTO de CPF (portado da versão anterior).
Guardado só em dígitos; a API nunca devolve o número completo."""
import re


def normalize(raw: str | None) -> str | None:
    if raw is None:
        return None
    digits = re.sub(r"\D", "", raw)
    return digits or None


def is_valid(digits: str) -> bool:
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    for pos, weight0 in ((9, 10), (10, 11)):
        total = sum(int(digits[i]) * (weight0 - i) for i in range(pos))
        check = (total * 10) % 11
        if check == 10:
            check = 0
        if check != int(digits[pos]):
            return False
    return True


def mask(digits: str | None) -> str | None:
    """123.***.**4-56 — 3 primeiros, o 9º e os 2 últimos."""
    if not digits or len(digits) != 11:
        return None
    return f"{digits[0:3]}.***.**{digits[8]}-{digits[9:11]}"
