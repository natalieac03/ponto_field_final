"""Erros de aplicação — mapeados para HTTP na camada de apresentação.

Mantém os casos de uso independentes do FastAPI.
"""


class AppError(Exception):
    status = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ValidationError(AppError):
    status = 400


class UnauthorizedError(AppError):
    status = 401


class ForbiddenError(AppError):
    status = 403


class NotFoundError(AppError):
    status = 404


class ConflictError(AppError):
    status = 409


class PreconditionRequired(AppError):
    status = 428


class TooManyRequests(AppError):
    status = 429
