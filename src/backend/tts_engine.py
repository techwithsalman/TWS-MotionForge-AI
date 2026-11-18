#!/usr/bin/env python3
"""
TWS MotionForge AI — Local Text-To-Speech Engine
Brand: Tech With Salman
Architecture: 100% Local, Offline, Free

Supported Engines:
1. 'kokoro': Neural studio-quality 24kHz TTS (Kokoro ONNX on CPU)
2. 'sapi': Instant zero-download Windows native speech (SAPI5 via pyttsx3)
"""

import argparse
import json
import os
import sys
import wave

def get_sapi_voices():
    """Returns available Windows SAPI voices."""
    try:
        import pyttsx3
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        res = []
        for v in voices:
            res.append({'id': v.id, 'name': v.name, 'gender': getattr(v, 'gender', 'unknown')})
        return res
    except Exception as e:
        return []

def synthesize_sapi(text, output_path, voice_id=None, rate=165):
    """Synthesizes speech using Windows native SAPI5."""
    import pyttsx3
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    engine = pyttsx3.init()
    engine.setProperty('rate', rate)
    voices = engine.getProperty('voices')
    if voice_id:
        for v in voices:
            if voice_id.lower() in v.id.lower() or voice_id.lower() in v.name.lower():
                engine.setProperty('voice', v.id)
                break
    elif voices:
        engine.setProperty('voice', voices[0].id)
    
    engine.save_to_file(text, output_path)
    engine.runAndWait()

    if not os.path.isfile(output_path) or os.path.getsize(output_path) < 100:
        raise RuntimeError(f"SAPI synthesis failed to create valid audio: {output_path}")

    with wave.open(output_path, 'rb') as w:
        duration = w.getnframes() / float(w.getframerate())
        channels = w.getnchannels()
        rate = w.getframerate()

    return {
        'engine': 'sapi5',
        'output': os.path.abspath(output_path),
        'duration': round(duration, 3),
        'channels': channels,
        'sample_rate': rate,
        'size': os.path.getsize(output_path)
    }

def synthesize_kokoro(text, output_path, model_path, voices_path, voice='af_bella', speed=1.0):
    """Synthesizes speech using Kokoro ONNX neural model."""
    import soundfile as sf
    from kokoro_onnx import Kokoro

    if not os.path.isfile(model_path) or not os.path.isfile(voices_path):
        raise FileNotFoundError(f"Kokoro model or voice weights missing: {model_path}, {voices_path}")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    kokoro = Kokoro(model_path, voices_path)
    samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')
    
    sf.write(output_path, samples, sample_rate)
    duration = len(samples) / float(sample_rate)

    return {
        'engine': 'kokoro_onnx',
        'voice': voice,
        'output': os.path.abspath(output_path),
        'duration': round(duration, 3),
        'channels': 1,
        'sample_rate': sample_rate,
        'size': os.path.getsize(output_path)
    }

def main():
    parser = argparse.ArgumentParser(description="TWS MotionForge AI - Local TTS Engine")
    parser.add_argument('--text', type=str, required=True, help="Text to speak")
    parser.add_argument('--output', type=str, required=True, help="Destination WAV file")
    parser.add_argument('--engine', type=str, choices=['auto', 'kokoro', 'sapi'], default='auto')
    parser.add_argument('--voice', type=str, default='default')
    parser.add_argument('--speed', type=float, default=1.0)
    parser.add_argument('--rate', type=int, default=165)
    # Resolve bundled models: TWS_MODELS_DIR (set by the desktop app) or repo-root/models.
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    models_dir = os.environ.get('TWS_MODELS_DIR') or os.path.join(repo_root, 'models')
    parser.add_argument('--model-path', type=str, default=os.path.join(models_dir, 'tts', 'kokoro-v0_19.onnx'))
    parser.add_argument('--voices-path', type=str, default=os.path.join(models_dir, 'tts', 'voices-v1.0.bin'))
    args = parser.parse_args()

    engine = args.engine
    if engine == 'auto':
        if os.path.isfile(args.model_path) and os.path.isfile(args.voices_path):
            engine = 'kokoro'
        else:
            engine = 'sapi'

    result = None
    if engine == 'kokoro':
        try:
            v = args.voice if args.voice != 'default' else 'af_bella'
            result = synthesize_kokoro(args.text, args.output, args.model_path, args.voices_path, voice=v, speed=args.speed)
        except Exception as e:
            # Automatic fallback to SAPI if Kokoro encounters an issue
            print(f"[WARN] Kokoro synthesis failed ({e}), falling back to Windows SAPI5...", file=sys.stderr)
            result = synthesize_sapi(args.text, args.output, voice_id=None, rate=args.rate)
            result['fallback_from'] = 'kokoro'
    else:
        result = synthesize_sapi(args.text, args.output, voice_id=args.voice if args.voice != 'default' else None, rate=args.rate)

    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
