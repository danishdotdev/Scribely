import argparse
import json
import os
import subprocess
import sys
import tempfile


def load_model(model_id):
    try:
        import torch
        from transformers import AutoProcessor, VibeVoiceAsrForConditionalGeneration
    except Exception as exc:
        raise RuntimeError(
            "VibeVoice ASR dependencies are missing. Install torch, accelerate, "
            "and transformers>=5.3.0 in a Python 3.11/3.12 environment. "
            f"Original error: {exc}"
        ) from exc

    processor = AutoProcessor.from_pretrained(model_id)
    model = VibeVoiceAsrForConditionalGeneration.from_pretrained(model_id, device_map="auto")
    model.eval()
    return torch, processor, model


def move_inputs(inputs, model):
    device = getattr(model, "device", None)
    dtype = getattr(model, "dtype", None)
    if device is None:
      return inputs
    try:
        return inputs.to(device, dtype)
    except TypeError:
        return inputs.to(device)


def prepare_audio(audio_path):
    extension = os.path.splitext(audio_path)[1].lower()
    if extension in {".wav", ".mp3", ".flac", ".ogg", ".m4a"}:
        return audio_path, None

    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    temp_path = temp_file.name
    temp_file.close()
    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        audio_path,
        "-ac",
        "1",
        "-ar",
        "16000",
        temp_path,
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg is required to transcribe this audio format with VibeVoice ASR.") from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(f"ffmpeg could not convert audio for VibeVoice ASR. {details}") from exc
    return temp_path, temp_path


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with VibeVoice ASR.")
    parser.add_argument("--audio", required=True, help="Path to an audio file.")
    parser.add_argument("--model-id", default="microsoft/VibeVoice-ASR-HF")
    parser.add_argument("--prompt", default="")
    parser.add_argument("--max-new-tokens", type=int, default=None)
    parser.add_argument(
        "--tokenizer-chunk-size",
        type=int,
        default=None,
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args()

    converted_path = None
    try:
        audio_path, converted_path = prepare_audio(args.audio)
        torch, processor, model = load_model(args.model_id)
        request = {"audio": audio_path}
        if args.prompt:
            request["prompt"] = args.prompt

        inputs = processor.apply_transcription_request(**request)
        inputs = move_inputs(inputs, model)
        generate_kwargs = {}
        if args.max_new_tokens:
            generate_kwargs["max_new_tokens"] = args.max_new_tokens

        with torch.no_grad():
            output_ids = model.generate(**inputs, **generate_kwargs)

        generated_ids = output_ids[:, inputs["input_ids"].shape[1]:]
        raw_output = processor.decode(generated_ids)[0]
        parsed = processor.decode(generated_ids, return_format="parsed")[0]
        transcript = processor.decode(generated_ids, return_format="transcription_only")[0]
    finally:
        if converted_path:
            try:
                os.unlink(converted_path)
            except OSError:
                pass

    if not isinstance(parsed, list):
        parsed = []

    print(json.dumps({
        "provider": "vibevoice",
        "model": args.model_id,
        "transcript": transcript if isinstance(transcript, str) else "",
        "utterances": parsed,
        "rawOutput": raw_output,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
