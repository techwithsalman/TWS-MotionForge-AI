import os
import sys
import subprocess
import json

# Force invalid proxies so any attempted internet connection fails instantly
os.environ['HTTP_PROXY'] = 'http://127.0.0.1:9'
os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:9'
os.environ['ALL_PROXY'] = 'http://127.0.0.1:9'
os.environ['HF_HUB_OFFLINE'] = '1'

print("=== TWS MotionForge AI: Strict Offline Execution Test ===")

# 1. Test SAPI5 offline
print("\n[1/4] Testing SAPI5 speech synthesis (offline)...")
r = subprocess.run([
    sys.executable, 'src/backend/tts_engine.py',
    '--text', 'Offline testing mode confirmed.',
    '--output', 'test_outputs/offline_sapi.wav',
    '--engine', 'sapi',
    '--voice', 'Microsoft David'
], capture_output=True, text=True)
assert r.returncode == 0, f"SAPI5 offline failed: {r.stderr}"
print("  PASS: SAPI5 generated offline WAV file successfully.")

# 2. Test Kokoro ONNX offline
print("\n[2/4] Testing Kokoro ONNX neural TTS (offline)...")
r = subprocess.run([
    sys.executable, 'src/backend/tts_engine.py',
    '--text', 'Local Kokoro neural speech synthesis operates without cloud dependencies.',
    '--output', 'test_outputs/offline_kokoro.wav',
    '--engine', 'kokoro',
    '--voice', 'am_adam'
], capture_output=True, text=True)
assert r.returncode == 0, f"Kokoro offline failed: {r.stderr}"
print("  PASS: Kokoro ONNX synthesized audio completely offline.")

# 3. Test Faster-Whisper offline
print("\n[3/4] Testing Faster-Whisper alignment (offline)...")
r = subprocess.run([
    sys.executable, 'src/backend/alignment_engine.py',
    'test_outputs/offline_sapi.wav',
    '--output', 'test_outputs/offline_alignment.json',
    '--model', 'small.en'
], capture_output=True, text=True)
assert r.returncode == 0, f"Whisper offline failed: {r.stderr}"
with open('test_outputs/offline_alignment.json') as f:
    align_data = json.load(f)
assert align_data.get('words'), "Whisper extracted no words"
print(f"  PASS: Faster-Whisper extracted {len(align_data['words'])} words offline.")

# 4. Test Offline Storyboard Generator
print("\n[4/4] Testing Rule-Based Storyboard Generator (offline)...")
r = subprocess.run(['node', '-e', """
import('./src/backend/llm_engine.mjs').then(async m => {
  const sb = await m.createStoryboard('Building Local Software', { style: 'B1', ratio: '16:9' });
  if (sb.method !== 'rule_based_storyboard_generator') throw new Error('Wrong method: ' + sb.method);
  console.log('  PASS: Offline Storyboard generated ' + sb.shots.length + ' shots.');
});
"""], capture_output=True, text=True)
assert r.returncode == 0, f"Storyboard offline failed: {r.stderr}"
print(r.stdout.strip())

print("\n=== ALL OFFLINE VERIFICATION CHECKS PASSED 100% ===")
