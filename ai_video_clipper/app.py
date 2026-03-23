"""Gradio web app entrypoint for offline AI video clipping."""

from __future__ import annotations

import traceback
from pathlib import Path
from typing import List, Tuple

import gradio as gr

from clip_detector import detect_clip_candidates
from config import CLIPS_DIR
from transcribe import transcribe_video
from utils import seed_everything
from video_editor import generate_clips


def _build_results_markdown(clips: List[dict]) -> str:
    """Format generated clip metadata for friendly display in UI."""
    if not clips:
        return "No clips were generated."

    lines = ["### Generated Clips", ""]
    for idx, clip in enumerate(clips, start=1):
        lines.append(
            f"**{idx}.** `{Path(clip['clip_path']).name}` | "
            f"{clip['end'] - clip['start']:.1f}s | score={clip['score']:.2f}"
        )
        lines.append(f"- Reason: {clip['reason']}")
        lines.append(f"- Preview: {clip['preview_text']}")
    return "\n".join(lines)


def process_video(
    video_file,
    whisper_model_size,
    clip_count,
    burn_subtitles,
    use_transformers,
    progress=gr.Progress(track_tqdm=False),
) -> Tuple[str, List[str], str]:
    """Main pipeline: transcribe -> detect -> edit -> return downloadable clips."""
    seed_everything()

    if video_file is None:
        return "Please upload a video first.", [], None

    status_lines: List[str] = []

    def on_status(message: str):
        status_lines.append(message)
        progress(0, desc=message)

    try:
        video_path = Path(video_file)
        on_status("Starting pipeline...")

        progress(0.15, desc="Transcribing with Whisper")
        transcription = transcribe_video(
            video_path=video_path,
            model_size=whisper_model_size,
            language="en",
            on_status=on_status,
        )

        progress(0.45, desc="Finding best moments")
        candidates = detect_clip_candidates(
            transcription=transcription,
            target_count=int(clip_count),
            use_transformers=use_transformers,
            on_status=on_status,
        )

        progress(0.65, desc="Generating vertical clips")
        clips = generate_clips(
            video_path=video_path,
            candidates=candidates,
            transcription=transcription,
            burn_in_subtitles=burn_subtitles,
            on_status=on_status,
        )

        progress(1.0, desc="Completed")

        file_outputs = [clip["clip_path"] for clip in clips] + [clip["srt_path"] for clip in clips]
        preview_clip = clips[0]["clip_path"] if clips else None

        status = "\n".join(["✅ Pipeline finished successfully!"] + status_lines)
        results_md = _build_results_markdown(clips)
        return f"{status}\n\n{results_md}", file_outputs, preview_clip

    except Exception as exc:  # keep UI resilient for beginners
        err = "\n".join(status_lines)
        tb = traceback.format_exc(limit=4)
        return f"❌ Error: {exc}\n\n{err}\n\n```\n{tb}\n```", [], None


def clear_outputs():
    """Clear generated clips from disk."""
    removed = 0
    for path in CLIPS_DIR.glob("*"):
        if path.is_file():
            path.unlink()
            removed += 1
    return f"Cleared {removed} generated files from {CLIPS_DIR}."


def build_interface() -> gr.Blocks:
    """Create Gradio Blocks UI."""
    css_path = Path(__file__).parent / "static" / "styles.css"
    custom_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None

    with gr.Blocks(title="Offline AI Video Clipper", css=custom_css) as demo:
        gr.Markdown("# 🎬 Offline AI Video Clipper")
        gr.Markdown(
            "Upload a long video, transcribe it locally with Whisper, detect viral moments, "
            "and generate vertical short clips with subtitles."
        )

        with gr.Row():
            with gr.Column(scale=2):
                video_input = gr.Video(label="Upload Source Video")

                whisper_model = gr.Dropdown(
                    choices=["tiny", "base", "small", "medium"],
                    value="base",
                    label="Whisper Model Size",
                )
                clip_count = gr.Slider(1, 10, value=5, step=1, label="Number of Clips")
                burn_subs = gr.Checkbox(value=True, label="Burn subtitles into video")
                use_nlp = gr.Checkbox(
                    value=True,
                    label="Use local Transformers model for extra scoring (optional)",
                )

                run_btn = gr.Button("Generate Clips", variant="primary")
                clear_btn = gr.Button("Clear Generated Files")

            with gr.Column(scale=2):
                status_output = gr.Markdown(label="Status")
                preview_video = gr.Video(label="First Generated Clip Preview")
                files_output = gr.Files(label="Download Generated Clips + SRT")

        run_btn.click(
            fn=process_video,
            inputs=[video_input, whisper_model, clip_count, burn_subs, use_nlp],
            outputs=[status_output, files_output, preview_video],
        )

        clear_btn.click(fn=clear_outputs, outputs=[status_output])

    return demo


if __name__ == "__main__":
    app = build_interface()
    app.queue(default_concurrency_limit=1).launch(server_name="0.0.0.0", server_port=7860)
