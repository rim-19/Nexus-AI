"""GitHub repo loader — via the API + raw content (no local `git` needed).

Skips binaries, oversized files, dependency/build dirs, and lockfiles.
Accepts 'owner/repo', a full URL, or with a branch.
"""
from __future__ import annotations
import re
import httpx

from ...config import settings
from ..chunking import LoadedFile, lang_for
from ...providers.base import http  # shared async client w/ browser UA

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build",
             ".next", ".idea", ".vscode", "vendor", ".mypy_cache", ".pytest_cache", ".tox"}
SKIP_EXT = {"db", "sqlite", "sqlite3", "png", "jpg", "jpeg", "gif", "svg", "ico", "webp",
            "pdf", "zip", "tar", "gz", "tgz", "whl", "exe", "dll", "so", "dylib", "bin",
            "woff", "woff2", "ttf", "eot", "otf", "mp4", "mov", "avi", "mp3", "wav",
            "parquet", "pyc", "class", "jar", "map", "lock", "ipynb"}
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock",
             "Pipfile.lock", "composer.lock", "Cargo.lock"}
TEXT_KINDS = {"md", "txt", "rst", "yaml", "yml", "json", "toml", "ini", "cfg",
              "html", "css", "scss", "csv", "env", "example", "sh", "sql", "xml"}


def parse_repo(ref: str) -> tuple[str, str, str | None]:
    """Return (owner, repo, branch|None) from url or owner/repo."""
    ref = ref.strip().rstrip("/")
    m = re.search(r"github\.com[/:]([^/]+)/([^/]+?)(?:\.git)?(?:/tree/([^/]+))?$", ref)
    if m:
        return m.group(1), m.group(2), m.group(3)
    parts = ref.split("/")
    if len(parts) == 2:
        return parts[0], parts[1], None
    raise ValueError(f"Cannot parse repo ref: {ref}")


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    if settings.GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return h


def _included(path: str, size: int) -> bool:
    parts = path.split("/")
    if any(p in SKIP_DIRS for p in parts):
        return False
    if parts[-1] in LOCKFILES:
        return False
    ext = path.rsplit(".", 1)[-1].lower() if "." in parts[-1] else ""
    if ext in SKIP_EXT:
        return False
    if size > settings.MAX_FILE_KB * 1024:
        return False
    return True


async def load_github(ref: str) -> list[LoadedFile]:
    owner, repo, branch = parse_repo(ref)
    info = (await http.get(f"https://api.github.com/repos/{owner}/{repo}", headers=_headers())).json()
    if "default_branch" not in info:
        raise ValueError(f"Repo not found or inaccessible: {owner}/{repo} ({info.get('message')})")
    branch = branch or info["default_branch"]

    tree = (await http.get(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
        headers=_headers())).json()

    out: list[LoadedFile] = []
    for node in tree.get("tree", []):
        if node["type"] != "blob" or not _included(node["path"], node.get("size", 0)):
            continue
        raw = await http.get(
            f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{node['path']}",
            headers={"Authorization": _headers()["Authorization"]} if settings.GITHUB_TOKEN else {})
        if raw.status_code != 200:
            continue
        try:
            text = raw.content.decode("utf-8")
        except UnicodeDecodeError:
            continue  # binary that slipped past the extension filter
        if not text.strip():
            continue
        lang = lang_for(node["path"])
        out.append(LoadedFile(
            path=node["path"], content=text,
            kind="code" if lang else "text", language=lang))
    return out
