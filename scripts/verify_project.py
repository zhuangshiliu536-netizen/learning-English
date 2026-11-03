#!/usr/bin/env python3
"""Verify preserved migration inputs, local resources and existing regressions.

Uses Python/Node standard libraries only. Does not regenerate or modify assets.
"""
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'outputs' / 'first-day-demo'


def fail(message):
    raise RuntimeError(message)


def verify_originals():
    manifest = json.loads((ROOT / 'migration/original-file-inventory.json').read_text(encoding='utf-8'))
    preserved = [item for item in manifest['files'] if item['decision'] == 'preserve']
    for item in preserved:
        path = ROOT / item['path']
        if not path.is_file():
            fail(f"Missing original: {item['path']}")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item['sha256']:
            fail(f"Original changed: {item['path']} (review the change; use --current for ongoing development)")
    print(f'Originals: {len(preserved)} preserved files match SHA-256.', flush=True)


def verify_assets():
    manifests = [APP / 'assets/audio-manifest.json', APP / 'assets/audio-neural/manifest.json',
                 APP / 'assets/audio-neural/yunxi/manifest.json', APP / 'assets/art/assets-manifest.json',
                 APP / 'assets/icon-manifest.json']
    paths = set()

    def visit(value, manifest):
        if isinstance(value, dict):
            path = value.get('path')
            if isinstance(path, str) and not path.startswith(('http:', 'https:', '/')):
                if path.startswith('assets/'):
                    resolved = APP / path
                elif path.startswith(('audio/', 'icons/')):
                    resolved = APP / 'assets' / path
                else:
                    resolved = manifest.parent / path
                if not resolved.is_file():
                    fail(f'Missing asset: {manifest.name}: {path}')
                paths.add(resolved)
                expected = value.get('sha256')
                if expected and hashlib.sha256(resolved.read_bytes()).hexdigest() != expected:
                    fail(f'Asset checksum mismatch: {path}')
            for key, child in value.items():
                visit(child, manifest)
        elif isinstance(value, list):
            for child in value:
                visit(child, manifest)

    for manifest in manifests:
        visit(json.loads(manifest.read_text(encoding='utf-8')), manifest)
    for html in (APP / 'index.html', APP / 'preview.html'):
        for ref in re.findall(r'(?:src|href)=[\'"]([^\'"]+)[\'"]', html.read_text(encoding='utf-8')):
            if ref.startswith(('http:', 'https:', '#', 'data:')):
                continue
            path = ref.split('?', 1)[0].split('#', 1)[0]
            if path and not (html.parent / path).exists():
                fail(f'Missing HTML resource: {html.name}: {ref}')
    archives = list((ROOT / 'outputs').glob('*.zip'))
    for archive in archives:
        with zipfile.ZipFile(archive) as z:
            if z.testzip() is not None:
                fail(f'Invalid ZIP: {archive.name}')
            if any(Path(name).is_absolute() or '..' in Path(name).parts for name in z.namelist()):
                fail(f'Unsafe ZIP entry: {archive.name}')
    print(f'Resources: {len(paths)} manifest paths, HTML references and {len(archives)} archive verified.', flush=True)


def regressions():
    node = shutil.which('node')
    if not node:
        fail('Node.js 20+ is required for existing regressions; install it and rerun.')
    for path in sorted(APP.glob('*.js')):
        subprocess.run([node, '--check', str(path)], cwd=ROOT, check=True)
    for relative in ('work/test-journey.mjs', 'work/test-evidence.mjs', 'work/voice-upgrade/audio-regression.mjs'):
        subprocess.run([node, relative], cwd=ROOT, check=True)


def main():
    if set(sys.argv[1:]) - {'--current'}:
        fail('Usage: python3 scripts/verify_project.py [--current]')
    if '--current' not in sys.argv:
        verify_originals()
    verify_assets()
    regressions()
    print('Verification passed.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
