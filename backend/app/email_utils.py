"""Email delivery. Dev mode logs the link; wire a real provider (Resend/SMTP) for production."""
from __future__ import annotations
import logging

from .config import settings

log = logging.getLogger("nexus.email")

_PATHS = {"verify": "verify-email", "reset": "reset-password"}


def send_link(kind: str, email: str, token: str) -> str:
    url = f"{settings.APP_BASE_URL}/{_PATHS[kind]}?token={token}"
    if settings.EMAIL_ENABLED:
        # TODO(prod): send via Resend/SMTP. Not configured in dev.
        pass
    log.warning("[email:%s] to=%s link=%s", kind, email, url)
    return url
