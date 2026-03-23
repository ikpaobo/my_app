# Offline AI Video Clipper

A complete, modular Python app that turns long videos into short vertical clips **fully offline** (after first-time dependency/model installation).

## Features

- Upload a long-form video.
- Local transcription with **OpenAI Whisper** (`openai-whisper`, no cloud API calls).
- AI-assisted clip scoring (rule-based + optional local `transformers` classifier).
- Auto generation of 15–60s clips.
- Smart vertical 9:16 reframing (OpenCV face detection + center fallback).
- Subtitle generation:
  - `.srt` files for every clip
  - optional burned-in subtitles on the clip video
- Simple **Gradio** web UI with upload, status/progress, preview, and downloads.

---

## Project Structure

```text
ai_video_clipper/
├── app.py
├── requirements.txt
├── config.py
├── transcribe.py
├── clip_detector.py
├── video_editor.py
├── subtitle_generator.py
├── utils.py
├── static/
│   └── styles.css
├── templates/
│   └── index.html
├── models/
│   └── whisper/
└── README.md
```

---

## How It Works (Pipeline)

1. **Upload video** in Gradio (`app.py`).
2. `transcribe.py` loads Whisper locally and transcribes speech into timestamped segments.
3. `clip_detector.py` scores transcript segments for engagement/virality.
4. `video_editor.py` extracts top moments and crops them into 9:16 vertical clips.
5. `subtitle_generator.py` writes SRT and can burn subtitles into each output clip.
6. UI shows status and generated clips for preview/download.

---

## Installation (Local PC)

> The app is offline after dependencies and models are installed.

### 1) Install FFmpeg (required)

- **Windows:** install FFmpeg and add it to PATH.
- **macOS:** `brew install ffmpeg`
- **Ubuntu/Debian:** `sudo apt-get install ffmpeg`

Verify:

```bash
ffmpeg -version
```

### 2) Create and activate a Python environment

```bash
cd ai_video_clipper
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

### 3) Install Python dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4) Pre-download models for full offline usage

Run once with internet:

```bash
python -c "import whisper; whisper.load_model('base', download_root='models/whisper')"
python -c "from transformers import pipeline; pipeline('text-classification', model='distilbert-base-uncased-finetuned-sst-2-english')"
```

After this, disconnect internet and the app still works.

---

## Run the App

From `ai_video_clipper/`:

```bash
python app.py
```

Open your browser at:

- `http://127.0.0.1:7860`
- or `http://localhost:7860`

---

## Usage Steps

1. Upload your long video.
2. Pick Whisper model size (`base` is a good default).
3. Choose number of clips.
4. Choose whether to burn subtitles into video.
5. Click **Generate Clips**.
6. Wait for processing to finish.
7. Preview first generated clip and download all clip `.mp4` + `.srt` files.

Outputs are written into `outputs/clips/`.

---

## Run in Google Colab

In a Colab cell:

```python
!apt-get -y install ffmpeg
!pip install -r requirements.txt
!python app.py
```

For Colab notebooks, you may need to use a tunneling setup (e.g., `gradio` share links) if local port access is restricted.

---

## Offline Notes

- Whisper model files are cached under `models/whisper/`.
- Transformers model is cached in Hugging Face cache directory after first download.
- No OpenAI cloud API calls are used by this app.

---

## Testing Checklist

### Quick sanity checks

```bash
python -m py_compile app.py transcribe.py clip_detector.py video_editor.py subtitle_generator.py utils.py config.py
```

### Functional test

1. Use a sample 2–5 minute talking-head video.
2. Generate 3 clips.
3. Confirm:
   - clips are vertical 1080x1920
   - clip lengths are roughly 15–60s
   - `.srt` exists for each clip
   - preview and downloads work

---

## Advanced Feature Ideas

- **Face tracking across frames** instead of single-frame face detection.
- **Hook detection model** (first 3 seconds scoring for retention).
- **Viral subtitle styles** (animated word-by-word, color emphasis, emojis).
- **Batch processing** of entire folders.
- **Speaker diarization** + auto speaker labels in subtitles.
- **Keyword-to-clip mode** (e.g., “find every moment discussing pricing”).
- **Silence trimming** to tighten pacing.
- **Auto B-roll suggestion** using local embedding similarity.

---

## Troubleshooting

- If subtitles fail to burn in, clips are still exported and `.srt` files are generated.
- If `transformers` model is unavailable offline, app falls back to rule-based scoring automatically.
- If FFmpeg is missing, MoviePy export will fail; install FFmpeg and retry.

