"""Central configuration for the offline AI video clipper app."""

from pathlib import Path

# Project paths
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
WHISPER_MODELS_DIR = MODELS_DIR / "whisper"
OUTPUT_DIR = BASE_DIR / "outputs"
TEMP_DIR = OUTPUT_DIR / "temp"
CLIPS_DIR = OUTPUT_DIR / "clips"
SUBTITLES_DIR = OUTPUT_DIR / "subtitles"

# Ensure runtime folders exist
for folder in [OUTPUT_DIR, TEMP_DIR, CLIPS_DIR, SUBTITLES_DIR, WHISPER_MODELS_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Whisper settings
WHISPER_MODEL_SIZE = "base"  # tiny, base, small, medium, large
WHISPER_LANGUAGE = "en"  # use None for auto-detect

# Clip generation limits (seconds)
MIN_CLIP_DURATION = 15
MAX_CLIP_DURATION = 60
TARGET_CLIP_COUNT = 5

# Video output settings
OUTPUT_FPS = 30
VERTICAL_RESOLUTION = (1080, 1920)  # 9:16 for Shorts/Reels/TikTok

# Face detection settings
FACE_CASCADE_PATH = None  # None = use default OpenCV haarcascade file

# Subtitles settings
SUBTITLE_FONT = "DejaVu-Sans"
SUBTITLE_FONTSIZE = 44
SUBTITLE_COLOR = "white"
SUBTITLE_STROKE_COLOR = "black"
SUBTITLE_STROKE_WIDTH = 2
SUBTITLE_POSITION = ("center", 0.82)  # x center, y 82% down

# NLP/viral heuristics settings
EMPHASIS_WORDS = {
    "amazing",
    "insane",
    "crazy",
    "secret",
    "mistake",
    "viral",
    "unbelievable",
    "powerful",
    "best",
    "worst",
    "never",
    "always",
    "must",
    "shocking",
    "incredible",
}

QUESTION_BONUS = 0.12
NUMBER_BONUS = 0.08
EXCLAMATION_BONUS = 0.1

# Runtime behavior
SEED = 42
