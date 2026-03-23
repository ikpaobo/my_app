"""Video editing pipeline for clipping + smart 9:16 reframing."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

import cv2
from moviepy import VideoFileClip

from config import CLIPS_DIR, FACE_CASCADE_PATH, OUTPUT_FPS, VERTICAL_RESOLUTION
from subtitle_generator import burn_subtitles, collect_segment_subtitles, write_srt
from utils import slugify


def _load_face_detector() -> cv2.CascadeClassifier:
    """Load Haar cascade model for lightweight local face detection."""
    cascade_path = FACE_CASCADE_PATH or (
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    detector = cv2.CascadeClassifier(cascade_path)
    return detector


def _estimate_subject_center_x(video_path: Path, sample_time: float = 1.0) -> float:
    """Estimate horizontal center using a sampled frame + face detection.

    Returns x center as a fraction [0, 1]. Fallback is 0.5.
    """
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        return 0.5

    fps = capture.get(cv2.CAP_PROP_FPS) or 30
    capture.set(cv2.CAP_PROP_POS_FRAMES, int(sample_time * fps))
    ok, frame = capture.read()
    capture.release()

    if not ok or frame is None:
        return 0.5

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detector = _load_face_detector()
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        return 0.5

    # Pick largest face as likely speaker.
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    center_x = x + w / 2
    return max(0.0, min(1.0, center_x / frame.shape[1]))


def _crop_to_vertical(clip, center_x_ratio: float):
    """Crop source clip to 9:16 region centered around detected subject."""
    source_w, source_h = clip.w, clip.h
    target_w, target_h = VERTICAL_RESOLUTION
    target_ratio = target_w / target_h

    # Decide whether to crop width or height.
    source_ratio = source_w / source_h
    if source_ratio > target_ratio:
        # Wider than target: crop width.
        new_w = int(source_h * target_ratio)
        center_x = int(source_w * center_x_ratio)
        x1 = max(0, min(source_w - new_w, center_x - new_w // 2))
        cropped = clip.cropped(x1=x1, y1=0, x2=x1 + new_w, y2=source_h)
    else:
        # Taller than target: crop height.
        new_h = int(source_w / target_ratio)
        y1 = max(0, (source_h - new_h) // 2)
        cropped = clip.cropped(x1=0, y1=y1, x2=source_w, y2=y1 + new_h)

    return cropped.resized((target_w, target_h))


def generate_clips(
    video_path: Path,
    candidates,
    transcription: Dict,
    burn_in_subtitles: bool = True,
    on_status=None,
) -> List[Dict]:
    """Create vertical clips + subtitles from selected candidates."""
    video_path = Path(video_path)
    all_segments = transcription.get("segments", [])

    if on_status:
        on_status("Opening source video for clip rendering...")

    subject_x = _estimate_subject_center_x(video_path)
    results: List[Dict] = []

    with VideoFileClip(str(video_path)) as base:
        duration = base.duration

        for idx, candidate in enumerate(candidates, start=1):
            start = max(0.0, min(duration - 0.1, candidate.start))
            end = max(start + 0.1, min(duration, candidate.end))

            clip_name = f"clip_{idx:02}_{slugify(candidate.text_preview[:40])}"
            mp4_path = CLIPS_DIR / f"{clip_name}.mp4"
            srt_path = CLIPS_DIR / f"{clip_name}.srt"

            if on_status:
                on_status(
                    f"Rendering clip {idx}/{len(candidates)} ({end - start:.1f}s): {clip_name}"
                )

            raw_clip = base.subclipped(start, end)
            vertical_clip = _crop_to_vertical(raw_clip, center_x_ratio=subject_x)

            subtitles = collect_segment_subtitles(all_segments, start, end)
            write_srt(subtitles, srt_path)

            final_clip = vertical_clip
            if burn_in_subtitles and subtitles:
                try:
                    final_clip = burn_subtitles(vertical_clip, subtitles)
                except Exception:
                    # Fallback to no burned-in subs if environment lacks text render backend.
                    final_clip = vertical_clip

            final_clip.write_videofile(
                str(mp4_path),
                fps=OUTPUT_FPS,
                codec="libx264",
                audio_codec="aac",
                logger=None,
            )

            results.append(
                {
                    "clip_path": str(mp4_path),
                    "srt_path": str(srt_path),
                    "start": start,
                    "end": end,
                    "score": candidate.score,
                    "reason": candidate.reason,
                    "preview_text": candidate.text_preview,
                }
            )

            # close references explicitly
            raw_clip.close()
            vertical_clip.close()
            if final_clip is not vertical_clip:
                final_clip.close()

    if on_status:
        on_status(f"Done. Generated {len(results)} clips.")

    return results
