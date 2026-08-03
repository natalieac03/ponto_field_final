"""Rate limiter simples (janela fixa, em memória) — anti brute-force no login.

Suficiente para uma instância única. Em cenário multi-processo/produção com vários
workers, trocar por um backend compartilhado (ex.: Redis).
"""
import threading
import time


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        """Registra uma tentativa. Retorna True se dentro do limite, False se excedeu."""
        now = time.time()
        with self._lock:
            start, count = self._hits.get(key, (now, 0))
            if now - start > self.window:
                start, count = now, 0
            count += 1
            self._hits[key] = (start, count)
            return count <= self.max_attempts

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


# Login: 8 tentativas por IP a cada 5 minutos.
login_limiter = RateLimiter(max_attempts=8, window_seconds=300)
