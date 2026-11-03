from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import subprocess

BASE = Path('/Users/zyb/Documents/Codex/2026-11-02/yin/outputs/first-day-demo/assets')
ICONS = BASE / 'icons'
ICONS.mkdir(parents=True, exist_ok=True)
NAMES = '''apple banana milk bread basket robot book book-2 map volume volume-off player-play player-pause arrow-left arrow-right check home settings microphone help-circle repeat x users headphones refresh star clipboard-check chevron-right logout photo download clock route'''.split()


def fetch(name):
    url = f'https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/{name}.svg'
    path = ICONS / f'{name}.svg'
    result = subprocess.run(['curl', '--silent', '--show-error', '--fail', '--location', '--max-time', '40', '--retry', '1', url, '-o', str(path)], capture_output=True, text=True)
    if result.returncode:
        return {'name': name, 'url': url, 'error': result.stderr.strip()}
    body = path.read_bytes()
    if b'<svg' not in body:
        return {'name': name, 'url': url, 'error': 'not SVG'}
    return {'name': name, 'path': f'icons/{name}.svg', 'url': url, 'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}


with ThreadPoolExecutor(max_workers=6) as executor:
    records = list(executor.map(fetch, NAMES))
license_url = 'https://raw.githubusercontent.com/tabler/tabler-icons/main/LICENSE'
subprocess.run(['curl', '--silent', '--show-error', '--fail', '--location', '--max-time', '40', license_url, '-o', str(BASE / 'TABLER-LICENSE.txt')], check=True)
(BASE / 'icon-manifest.json').write_text(json.dumps({'library': 'Tabler Icons', 'license': 'MIT', 'source': 'https://github.com/tabler/tabler-icons', 'retrieved_on': '2026-11-02', 'icons': records}, ensure_ascii=False, indent=2) + '\n')
failures = [row for row in records if 'error' in row]
print(json.dumps({'downloaded': len(records) - len(failures), 'failed': failures}, ensure_ascii=False))
if failures:
    raise SystemExit(1)
