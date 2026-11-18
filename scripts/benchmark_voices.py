import os, time, wave
import soundfile as sf
from kokoro_onnx import Kokoro
import pyttsx3

print("--- Testing Kokoro ONNX Voices ---")
model_path = 'models/tts/kokoro-v0_19.onnx'
voices_path = 'models/tts/voices-v1.0.bin'
kokoro = Kokoro(model_path, voices_path)

kokoro_voices = ['af_bella', 'af_sarah', 'am_adam', 'am_michael', 'bf_emma', 'bm_george']
test_phrase = 'MotionForge AI produces clean stickman animation.'

os.makedirs('test_outputs/voices', exist_ok=True)
kokoro_results = {}
for v in kokoro_voices:
    t0 = time.time()
    try:
        samples, sr = kokoro.create(test_phrase, voice=v, speed=1.0, lang='en-us' if v.startswith('a') else 'en-gb')
        gen_time = time.time() - t0
        dur = len(samples) / float(sr)
        out_f = f'test_outputs/voices/kokoro_{v}.wav'
        sf.write(out_f, samples, sr)
        kokoro_results[v] = {'status': 'PASS', 'duration': round(dur, 2), 'gen_time': round(gen_time, 2), 'rtf': round(gen_time/dur, 2), 'sr': sr, 'bytes': os.path.getsize(out_f)}
        print(f'[KOKORO] {v}: PASS (dur={dur:.2f}s, time={gen_time:.2f}s, rtf={gen_time/dur:.2f})')
    except Exception as e:
        kokoro_results[v] = {'status': 'FAIL', 'error': str(e)}
        print(f'[KOKORO] {v}: FAIL - {e}')

print("\n--- Testing Windows SAPI5 Voices ---")
engine = pyttsx3.init()
sapi_results = {}
for s_v in engine.getProperty('voices'):
    engine.setProperty('voice', s_v.id)
    safe_name = s_v.name[:15].replace(" ", "_").replace("(", "").replace(")", "")
    out_f = f'test_outputs/voices/sapi_{safe_name}.wav'
    t0 = time.time()
    engine.save_to_file(test_phrase, out_f)
    engine.runAndWait()
    gen_time = time.time() - t0
    with wave.open(out_f, 'rb') as w:
        dur = w.getnframes() / float(w.getframerate())
        sr = w.getframerate()
    sapi_results[s_v.name] = {'status': 'PASS', 'duration': round(dur, 2), 'gen_time': round(gen_time, 2), 'rtf': round(gen_time/dur, 2), 'sr': sr, 'bytes': os.path.getsize(out_f)}
    print(f'[SAPI5] {s_v.name}: PASS (dur={dur:.2f}s, time={gen_time:.2f}s, rtf={gen_time/dur:.2f})')
