"""Generate local demo WAVs from content.js SPEECH_LINES using installed macOS voices.

This writes files only. It neither records the microphone nor uploads any text.
Run with the task's normal approval mechanism when macOS speech services are
unavailable in the restricted shell. Empty audio is treated as a failure.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import re
import subprocess
import wave

ROOT = Path('/Users/zyb/Documents/Codex/2026-11-02/yin')
APP = ROOT / 'outputs/first-day-demo'
OUT = APP / 'assets/audio'
BUILD = ROOT / 'work/audio-build'
NODE = '/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
OUT.mkdir(parents=True, exist_ok=True)
BUILD.mkdir(parents=True, exist_ok=True)

extract = "import { SPEECH_LINES } from './content.js'; process.stdout.write(JSON.stringify(SPEECH_LINES));"
result = subprocess.run([NODE, '--input-type=module', '-e', extract], cwd=APP, check=True, capture_output=True, text=True)
lines = json.loads(result.stdout)


def generate(entry):
    key, value = entry
    if not re.fullmatch(r'[A-Za-z0-9_-]+', key):
        return {'key': key, 'error': 'Unsupported filename characters'}
    text = value if isinstance(value, str) else value.get('text', '')
    lang = ('zh-CN' if re.search(r'[\u4e00-\u9fff]', text) else 'en-US') if isinstance(value, str) else value.get('lang', 'en-US')
    if not text:
        return {'key': key, 'error': 'Empty speech text'}
    voice = 'Tingting' if lang.startswith('zh') else 'Samantha'
    rate = '180' if lang.startswith('zh') else '135'
    source = BUILD / f'{key}.aiff'
    destination = OUT / f'{key}.wav'
    try:
        subprocess.run(['say', '-v', voice, '-r', rate, '-o', str(source), text], check=True, capture_output=True, text=True)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@22050', str(source), str(destination)], check=True, capture_output=True, text=True)
        with wave.open(str(destination), 'rb') as audio:
            frames, sample_rate = audio.getnframes(), audio.getframerate()
            if not frames:
                raise ValueError('Speech service created empty audio')
            duration = round(frames / sample_rate, 3)
        body = destination.read_bytes()
        return {'key': key, 'text': text, 'lang': lang, 'voice': voice, 'rate': int(rate), 'path': f'audio/{key}.wav', 'duration_seconds': duration, 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
    except (subprocess.CalledProcessError, ValueError, wave.Error) as exc:
        return {'key': key, 'text': text, 'lang': lang, 'error': str(exc), 'detail': getattr(exc, 'stderr', '')}


with ThreadPoolExecutor(max_workers=3) as pool:
    records = list(pool.map(generate, lines.items()))
failures = [row for row in records if 'error' in row]
manifest = {'generated_on': '2026-11-02', 'method': 'macOS installed say voices; afconvert to 22050Hz 16-bit PCM WAV', 'source': 'content.js SPEECH_LINES', 'microphone_recorded': False, 'external_service_used': False, 'audio': records}
(APP / 'assets/audio-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'generated': len(records) - len(failures), 'failed': failures, 'total_seconds': round(sum(row.get('duration_seconds', 0) for row in records), 1)}, ensure_ascii=False))
if failures:
    raise SystemExit(1)
