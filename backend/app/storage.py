"""Object storage behind an interface. LocalStorage for now; swap for S3/Supabase later."""
from __future__ import annotations
import os
from pathlib import Path
import aiofiles

STORAGE_DIR = Path(__file__).resolve().parents[1] / "storage"


class LocalStorage:
    async def save(self, document_id: str, filename: str, data: bytes) -> str:
        d = STORAGE_DIR / str(document_id)
        d.mkdir(parents=True, exist_ok=True)
        path = d / filename
        async with aiofiles.open(path, "wb") as f:
            await f.write(data)
        return str(path)

    async def read(self, path: str) -> bytes:
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    def delete(self, path: str) -> None:
        try:
            os.remove(path)
        except OSError:
            pass


storage = LocalStorage()
