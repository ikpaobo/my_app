"""Subtitle generation utilities (SRT + optional burned-in subtitle overlays)."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

from moviepy import TextClip, CompositeVideoClip

from config import (
    SUBTITLE_COLOR,
    SUBTITLE_FONT,
    SUBTITLE_FONTSIZE,
    SUBTITLE_POSITION,
    SUBTITLE_STROKE_COLOR,
    SUBTITLE_STROKE_WIDTH,
)
from utils import seconds_to_srt_timestamp


def collect_segment_subtitles(
    segments: List[Dict], clip_start: float, clip_end: float
) -> List[Tuple[float, float, str]]:
    """Filter and shift transcript segments that fit inside a clip time range."""
    clip_subs: List[Tuple[float, float, str]] = []
    for seg in segments:
        seg_start = float(seg.get("start", 0.0))
        seg_end = float(seg.get("end", seg_start))
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        if seg_end < clip_start or seg_start > clip_end:
            continue

        local_start = max(0.0, seg_start - clip_start)
        local_end = max(local_start + 0.01, min(clip_end, seg_end) - clip_start)
        clip_subs.append((local_start, local_end, text))

    return clip_subs


def write_srt(subtitles: List[Tuple[float, float, str]], output_path: Path) -> Path:
    """Write subtitles to an SRT file for a single clip."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for idx, (start, end, text) in enumerate(subtitles, start=1):
            f.write(f"{idx}\n")
            f.write(
                f"{seconds_to_srt_timestamp(start)} --> {seconds_to_srt_timestamp(end)}\n"
            )
            f.write(f"{text}\n\n")
    return output_path


def burn_subtitles(video_clip, subtitles: List[Tuple[float, float, str]]):
    """Overlay subtitles directly into video using MoviePy TextClip layers.

    If rendering fails in some environments, caller should catch and fallback.
    """
    overlays = [video_clip]

    for start, end, text in subtitles:
        txt = TextClip(
            text=text,
            font=SUBTITLE_FONT,
            font_size=SUBTITLE_FONTSIZE,
            color=SUBTITLE_COLOR,
            stroke_color=SUBTITLE_STROKE_COLOR,
            stroke_width=SUBTITLE_STROKE_WIDTH,
            method="caption",
            size=(int(video_clip.w * 0.9), None),
            text_align="center",
        )
        txt = txt.with_start(start).with_end(end)
        txt = txt.with_position((SUBTITLE_POSITION[0], int(video_clip.h * SUBTITLE_POSITION[1])))
        overlays.append(txt)

    return CompositeVideoClip(overlays)
