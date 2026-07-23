"""Pydantic request/response models."""
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


# --- auth ---
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    email_verified: bool = False
    model_config = {"from_attributes": True}


class EmailVerifyIn(BaseModel):
    token: str


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6, max_length=128)


class OkOut(BaseModel):
    ok: bool = True


# --- workspaces ---
class WorkspaceOut(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    created_at: datetime
    model_config = {"from_attributes": True}


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


# --- collections ---
class CollectionOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


# --- documents ---
class DocumentOut(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    source_type: str
    source_ref: str
    status: str
    error: str | None
    num_chunks: int
    created_at: datetime
    model_config = {"from_attributes": True}


# --- chat ---
class ScopeIn(BaseModel):
    type: Literal["workspace", "collection", "document"]
    id: uuid.UUID


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    scope: ScopeIn | None = None
    conversation_id: uuid.UUID | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list
    created_at: datetime
    model_config = {"from_attributes": True}


# --- evaluation ---
class EvalItemIn(BaseModel):
    question: str
    expected_answer: str | None = None
    gold_source: str | None = None


class EvalSetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    items: list[EvalItemIn] = Field(min_length=1)


class EvalSetOut(BaseModel):
    id: uuid.UUID
    collection_id: uuid.UUID
    name: str
    created_at: datetime
    model_config = {"from_attributes": True}
