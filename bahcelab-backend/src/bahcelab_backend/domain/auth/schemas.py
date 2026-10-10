import re
import uuid

from pydantic import BaseModel, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LENGTH = 8


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 320 or not _EMAIL_RE.match(email):
        raise ValueError("Geçerli bir e-posta adresi girin")
    return email


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        name = value.strip()
        if not name or len(name) > 255:
            raise ValueError("Ad boş olamaz")
        return name

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Şifre en az {MIN_PASSWORD_LENGTH} karakter olmalı")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return value.strip().lower()


class AuthUser(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    workspace_id: uuid.UUID
