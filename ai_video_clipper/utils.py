"""Utility helpers used across modules."""

from __future__ import annotations

import json
import random
import re
import shutil
from pathlib import Path
from typing import Any, Dict, Iterable, List

from config import SEED


def seed_everything(seed: int = SEED) -> None:
    """Seed pseudo-random behavior for deterministic-ish clip scoring."""
    random.seed(seed)


def slugify(text: str) -> str:
    """Return a filesystem-safe slug from arbitrary text."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text)
    return text[:80] or "clip"


def seconds_to_srt_timestamp(seconds: float) -> str:
    """Convert float seconds to SRT timestamp HH:MM:SS,mmm."""
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def write_json(data: Dict[str, Any], path: Path) -> None:
    """Write JSON with indentation for easy debugging."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def safe_rmtree(path: Path) -> None:
    """Remove directory if it exists."""
    if path.exists() and path.is_dir():
        shutil.rmtree(path)


def flatten(items: Iterable[Iterable[Any]]) -> List[Any]:
    """Flatten one level of nesting."""
    return [item for group in items for item in group]
