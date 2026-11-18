#!/usr/bin/env python3
"""
TWS MotionForge AI — Local Speech Alignment Engine
Brand: Tech With Salman
Architecture: 100% Local, Offline, Free

Uses Faster-Whisper (CTranslate2 on CPU) to extract millisecond-accurate
word timestamps from narration audio and format them for the animation engine.
Includes intelligent fallback for offline robustness.
"""

import argparse
import json
import os
import sys
import wave

# Ensure HuggingFace Hub runs 100% offline and suppresses symlink warnings on Windows
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

def find_local_whisper_model(preferred='small.en'):
    """Finds a locally downloaded Whisper model snapshot for 100% offline operation."""
    if os.path.isdir(preferred) and os.path.isfile(os.path.join(preferred, 'model.bin')):
        return preferred

    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    bundled_models = os.environ.get('TWS_MODELS_DIR')
    if bundled_models:
        for name in (preferred, 'small.en'):
            d = os.path.join(bundled_models, 'whisper', name)
            if os.path.isdir(d) and os.path.isfile(os.path.join(d, 'model.bin')):
                return d
    local_dir = os.path.join(repo_root, 'models', 'whisper', preferred)
    if os.path.isdir(local_dir) and os.path.isfile(os.path.join(local_dir, 'model.bin')):
        return local_dir

    default_small = os.path.join(repo_root, 'models', 'whisper', 'small.en')
    if os.path.isdir(default_small) and os.path.isfile(os.path.join(default_small, 'model.bin')):
        return default_small

    candidates = [
        os.path.expanduser('~/.cache/huggingface/hub/models--Systran--faster-whisper-small.en/snapshots/d1d751a5f8271d482d14ca55d9e2deeebbae577f'),
        'D:/DevCache/huggingface/hub/models--Systran--faster-whisper-small.en/snapshots/d1d751a5f8271d482d14ca55d9e2deeebbae577f',
        'D:/DevCache/huggingface/hub/models--Systran--faster-whisper-medium/snapshots/08e178d48790749d25932bbc082711ddcfdfbc4f'
    ]
    for c in candidates:
        if os.path.isdir(c) and os.path.isfile(os.path.join(c, 'model.bin')):
            return c
    return default_small if os.path.isdir(default_small) else preferred

def align_faster_whisper(audio_path, model_name='small.en', language=None):
    """Aligns speech using Faster-Whisper on CPU with INT8 quantization."""
    from faster_whisper import WhisperModel
    import numpy as np

    resolved_model = find_local_whisper_model(model_name)
    model = WhisperModel(resolved_model, device='cpu', compute_type='int8', local_files_only=True)
    segments, info = model.transcribe(audio_path, word_timestamps=True, language=language)

    words = []
    full_text = []
    for segment in segments:
        full_text.append(segment.text.strip())
        for w in segment.words:
            start = float(w.start)
            end = float(w.end)
            if end > start:
                words.append({
                    'word': w.word.strip(),
                    'start': round(start, 3),
                    'end': round(end, 3),
                    'prob': round(float(w.probability), 3) if hasattr(w, 'probability') else 1.0
                })

    return {
        'method': 'faster-whisper',
        'model': model_name,
        'language': info.language if hasattr(info, 'language') else 'en',
        'duration': round(float(info.duration), 3) if hasattr(info, 'duration') else 0.0,
        'text': ' '.join(full_text),
        'words': words
    }

def align_heuristic_fallback(audio_path, text_hint=None):
    """Fallback aligner based on audio duration and word length."""
    duration = 5.0
    if os.path.isfile(audio_path):
        try:
            with wave.open(audio_path, 'rb') as w:
                duration = w.getnframes() / float(w.getframerate())
        except Exception:
            pass

    if not text_hint or not text_hint.strip():
        text_hint = "Voice narration without transcribed text."

    tokens = text_hint.split()
    weights = [max(1, len(t)) for t in tokens]
    total_weight = sum(weights) or 1
    
    pad_start = 0.1
    usable_duration = max(0.5, duration - 0.2)

    words = []
    curr = pad_start
    for t, w in zip(tokens, weights):
        span = (w / total_weight) * usable_duration
        words.append({
            'word': t,
            'start': round(curr, 3),
            'end': round(curr + span, 3),
            'prob': 0.95
        })
        curr += span

    return {
        'method': 'heuristic_fallback',
        'duration': round(duration, 3),
        'text': text_hint,
        'words': words
    }

def main():
    parser = argparse.ArgumentParser(description="TWS MotionForge AI - Local Speech Alignment")
    parser.add_argument('audio', type=str, help="Path to narration audio (.wav)")
    parser.add_argument('--output', type=str, required=True, help="Path to output JSON")
    parser.add_argument('--model', type=str, default='tiny', help="Whisper model size")
    parser.add_argument('--language', type=str, default='en', help="Language code")
    parser.add_argument('--text-hint', type=str, default='', help="Optional known text of the narration")
    args = parser.parse_args()

    audio_file = os.path.abspath(args.audio)
    if not os.path.isfile(audio_file):
        print(f"Error: Audio file not found: {audio_file}", file=sys.stderr)
        sys.exit(1)

    result = None
    try:
        result = align_faster_whisper(audio_file, model_name=args.model, language=args.language)
        if not result['words']:
            raise ValueError("No words detected by Whisper")
    except Exception as e:
        print(f"[WARN] Faster-Whisper alignment failed ({e}), using heuristic aligner...", file=sys.stderr)
        result = align_heuristic_fallback(audio_file, text_hint=args.text_hint)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(json.dumps({
        'output': os.path.abspath(args.output),
        'method': result['method'],
        'words_count': len(result['words']),
        'duration': result.get('duration', 0)
    }, indent=2))

if __name__ == '__main__':
    main()
