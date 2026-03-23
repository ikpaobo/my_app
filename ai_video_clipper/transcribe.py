"""Local Whisper transcription module.

This file ensures all speech-to-text runs locally once the model is downloaded.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional

import whisper

from config import WHISPER_LANGUAGE, WHISPER_MODEL_SIZE, WHISPER_MODELS_DIR


def transcribe_video(
    video_path: Path,
    model_size: str = WHISPER_MODEL_SIZE,
    language: Optional[str] = WHISPER_LANGUAGE,
    on_status=None,
) -> Dict:
    """Transcribe an input video/audio file using local Whisper.

    Args:
        video_path: Input media path.
        model_size: Whisper model size string.
        language: Language code (e.g., "en") or None for auto-detection.
        on_status: Optional callback for progress text.

    Returns:
        Whisper transcription dictionary, including `segments`.
    """
    video_path = Path(video_path)

    if on_status:
        on_status(f"Loading Whisper model '{model_size}' from local cache...")

    # Uses local download/cache directory, so repeated runs are offline.
    model = whisper.load_model(model_size, download_root=str(WHISPER_MODELS_DIR))

    if on_status:
        on_status("Running transcription locally (this can take a while)...")

    result = model.transcribe(str(video_path), language=language, verbose=False)

    if on_status:
        on_status(
            f"Transcription complete. Detected {len(result.get('segments', []))} segments."
        )

    return result
