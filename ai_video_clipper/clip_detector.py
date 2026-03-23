"""Detect engaging moments from transcript segments.

Includes:
1) Rule-based viral score heuristics.
2) Optional local Transformers sentiment/emotion classifier bonus.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from config import (
    EMPHASIS_WORDS,
    EXCLAMATION_BONUS,
    MAX_CLIP_DURATION,
    MIN_CLIP_DURATION,
    NUMBER_BONUS,
    QUESTION_BONUS,
    TARGET_CLIP_COUNT,
)

try:
    from transformers import pipeline
except Exception:  # pragma: no cover - fallback if transformers unavailable
    pipeline = None


@dataclass
class ClipCandidate:
    """Candidate clip details after scoring and duration normalization."""

    start: float
    end: float
    score: float
    reason: str
    text_preview: str


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def _rule_score(text: str) -> float:
    """Simple viral-score heuristic from punctuation + keywords + dynamics."""
    text_clean = _normalize_text(text)
    if not text_clean:
        return 0.0

    words = re.findall(r"\b\w+\b", text_clean.lower())
    emphasis_hits = sum(1 for w in words if w in EMPHASIS_WORDS)

    score = 0.2 + min(0.4, emphasis_hits * 0.07)

    if "?" in text_clean:
        score += QUESTION_BONUS
    if "!" in text_clean:
        score += EXCLAMATION_BONUS
    if re.search(r"\b\d+\b", text_clean):
        score += NUMBER_BONUS

    # Reward text density (often punchier speaking)
    word_count = max(1, len(words))
    char_density = len(text_clean) / word_count
    score += min(0.2, char_density / 80)

    return float(min(1.0, score))


def _build_local_classifier(model_name: str = "distilbert-base-uncased-finetuned-sst-2-english"):
    """Build text classifier pipeline if Transformers is available.

    Note: this model must be pre-downloaded for full offline use.
    """
    if pipeline is None:
        return None

    try:
        return pipeline("text-classification", model=model_name)
    except Exception:
        return None


def _classifier_bonus(classifier, text: str) -> float:
    """Map classifier confidence to bonus score (encourages stronger emotion)."""
    if classifier is None:
        return 0.0
    try:
        pred = classifier(text[:512])[0]
        confidence = float(pred.get("score", 0.0))
        label = str(pred.get("label", "")).upper()
        # Prefer highly confident emotional/polarized content.
        polarity_boost = 0.08 if label in {"POSITIVE", "NEGATIVE"} else 0.0
        return min(0.2, confidence * 0.15 + polarity_boost)
    except Exception:
        return 0.0


def detect_clip_candidates(
    transcription: Dict,
    target_count: int = TARGET_CLIP_COUNT,
    use_transformers: bool = True,
    on_status=None,
) -> List[ClipCandidate]:
    """Return top clip candidates sorted by score descending."""
    segments = transcription.get("segments", [])
    if not segments:
        return []

    if on_status:
        on_status("Scoring transcript segments for viral potential...")

    classifier = _build_local_classifier() if use_transformers else None

    candidates: List[ClipCandidate] = []
    for seg in segments:
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", start + MIN_CLIP_DURATION))
        text = _normalize_text(seg.get("text", ""))

        duration = max(0.01, end - start)
        # Expand very short segments and compress very long ones.
        if duration < MIN_CLIP_DURATION:
            pad = (MIN_CLIP_DURATION - duration) / 2
            start = max(0.0, start - pad)
            end = end + pad
        elif duration > MAX_CLIP_DURATION:
            mid = (start + end) / 2
            start = max(0.0, mid - MAX_CLIP_DURATION / 2)
            end = mid + MAX_CLIP_DURATION / 2

        rule = _rule_score(text)
        bonus = _classifier_bonus(classifier, text)

        # Mild preference for durations around 30 sec.
        final_duration = end - start
        dur_pref = math.exp(-abs(final_duration - 30) / 40) * 0.08

        total = min(1.0, rule + bonus + dur_pref)

        reason = f"rule={rule:.2f}, bonus={bonus:.2f}, dur={final_duration:.1f}s"
        candidates.append(
            ClipCandidate(
                start=start,
                end=end,
                score=total,
                reason=reason,
                text_preview=text[:200],
            )
        )

    # Sort by score descending and remove heavy overlaps.
    candidates.sort(key=lambda c: c.score, reverse=True)

    selected: List[ClipCandidate] = []
    for candidate in candidates:
        overlaps = False
        for chosen in selected:
            overlap = max(0.0, min(candidate.end, chosen.end) - max(candidate.start, chosen.start))
            shortest = min(candidate.end - candidate.start, chosen.end - chosen.start)
            if shortest > 0 and overlap / shortest > 0.5:
                overlaps = True
                break
        if not overlaps:
            selected.append(candidate)
        if len(selected) >= target_count:
            break

    if on_status:
        on_status(f"Selected {len(selected)} top candidate moments.")

    return selected
