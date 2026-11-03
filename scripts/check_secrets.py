#!/usr/bin/env python3
"""Scan Git-tracked files and ZIP members without printing secret values.

This is a pattern-based migration check, not a substitute for credential hygiene.
"""
import argparse
import io
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    'private-key': rb'-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
    'github-token': rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
    'openai-style-key': rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b',
    'aws-access-key': rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'google-api-key': rb'\bAIza[A-Za-z0-9_-]{35}\b',
    'slack-token': rb'\bxox[baprs]-[A-Za-z0-9-]{20,}\b',
    'credential-url': rb'https?://[^\s/:@\"\']{1,80}:[^\s/@\"\']{6,160}@',
    'literal-secret-assignment': rb'''(?i)(?:api[_-]?key|client[_-]?secret|password|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']([^\s"'{}]{12,})["']''',
}
COMPILED = {name: re.compile(pattern) for name, pattern in PATTERNS.items()}


def scan(data, name, findings):
    for rule, pattern in COMPILED.items():
        for match in pattern.finditer(data):
            candidate = match.group(1) if rule == 'literal-secret-assignment' else match.group()
            if rule == 'literal-secret-assignment' and any(word in candidate.lower() for word in
                    (b'example', b'placeholder', b'your_', b'replace_', b'process.env', b'os.environ')):
                continue
            findings.append({'path': name, 'rule': rule, 'byte_offset': match.start()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, check=True, stdout=subprocess.PIPE)
    files = [name.decode('utf-8') for name in result.stdout.split(b'\0') if name]
    findings = []
    members = 0
    for name in files:
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            raise RuntimeError(f'Unexpected tracked entry: {name}')
        data = path.read_bytes()
        scan(data, name, findings)
        if path.suffix.lower() == '.zip':
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for info in archive.infolist():
                    if not info.is_dir():
                        scan(archive.read(info), name + '::' + info.filename, findings)
                        members += 1
    report = {'scope': 'git ls-files plus ZIP members; excluded environments not uploaded',
              'tracked_files': len(files), 'archive_members': members,
              'rules': list(PATTERNS), 'findings': findings,
              'result': 'passed' if not findings else 'review-required',
              'limitation': 'Pattern scan; does not prove the absence of every possible credential.'}
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
