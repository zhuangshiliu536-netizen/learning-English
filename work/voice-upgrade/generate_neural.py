"""Generate only the demo's original Chinese guidance as local MP3 assets.

Run with this folder's isolated venv. Online synthesis; offline app playback.
The source lines come from content.js, not user profiles or recordings.
"""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import math
import subprocess
import sys
import time
import wave
from array import array
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "outputs/first-day-demo"
WORK = ROOT / "work/voice-upgrade"
NODE = "/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-8%"
PITCH = "+0Hz"
SOURCE = "Microsoft Edge online neural TTS via edge-tts"


def load_lines():
    result = subprocess.run(
        [NODE, "--input-type=module", "-e", "import { SPEECH_LINES } from './content.js'; process.stdout.write(JSON.stringify(SPEECH_LINES));"],
        cwd=APP, check=True, capture_output=True, text=True,
    )
    return {key: value for key, value in json.loads(result.stdout).items() if value["lang"] == "zh-CN"}


def validate_mp3(path):
    if not path.exists() or path.stat().st_size < 1000:
        raise RuntimeError(f"Missing or suspiciously small audio: {path}")
    # Decode the complete file using macOS's native decoder and confirm non-silence.
    decoded = WORK / "decode-check" / f"{path.stem}-{time.time_ns()}.wav"
    decoded.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@24000", str(path), str(decoded)],
                   check=True, capture_output=True, timeout=15)
    try:
        with wave.open(str(decoded), "rb") as stream:
            frames = stream.getnframes()
            sample_rate = stream.getframerate()
            channels = stream.getnchannels()
            samples = array("h", stream.readframes(frames))
        if sys.byteorder != "little":
            samples.byteswap()
        duration = frames / sample_rate
        peak = max((abs(v) for v in samples), default=0)
        rms = math.sqrt(sum(v * v for v in samples) / len(samples)) if samples else 0
        if duration < 0.4 or peak < 500 or rms < 20:
            raise RuntimeError(f"Empty/silent decode: duration={duration} peak={peak} rms={rms}")
        return {"duration": round(duration, 3), "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "decodedSampleRate": sample_rate, "channels": channels,
                "peak": peak, "rms": round(rms, 1)}
    finally:
        decoded.unlink(missing_ok=True)


async def synthesize(key, line, out_dir, voice=VOICE):
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"{key}.mp3"
    partial = out_dir / f"{key}.part.mp3"
    error = None
    for attempt in range(2):
        try:
            partial.unlink(missing_ok=True)
            communicator = edge_tts.Communicate(
                text=line["text"], voice=voice, rate=RATE, pitch=PITCH,
                connect_timeout=10, receive_timeout=25,
            )
            await asyncio.wait_for(communicator.save(str(partial)), timeout=40)
            validation = validate_mp3(partial)
            partial.replace(output)
            return {"text": line["text"], "lang": line["lang"], "voice": voice,
                    "rate": RATE, "pitch": PITCH, "format": "audio/mpeg",
                    "source": SOURCE, "path": str(output.relative_to(APP)) if output.is_relative_to(APP) else str(output.relative_to(ROOT)),
                    **validation}
        except Exception as exc:
            error = exc
            partial.unlink(missing_ok=True)
            if attempt == 0:
                await asyncio.sleep(1)
    raise RuntimeError(f"{key}: {error}") from error


async def main(mode):
    lines = load_lines()
    if mode == "voices":
        voices = await asyncio.wait_for(edge_tts.list_voices(), timeout=30)
        chosen = [v for v in voices if v["ShortName"] in (VOICE, "zh-CN-YunxiNeural")]
        (WORK / "verified-voices.json").write_text(json.dumps(chosen, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(chosen, ensure_ascii=False, indent=2), flush=True)
        if len(chosen) != 2:
            raise RuntimeError("Expected voices not returned by live service")
        return

    if mode == "samples":
        selected = [(key, lines[key]) for key in ("meet", "home", "finish")]
        out_dir = WORK / "samples/xiaoxiao"
    else:
        selected = list(lines.items())
        out_dir = APP / "assets/audio-neural"

    results = {}
    # Keep the public endpoint load modest and deterministic.
    for key, line in selected:
        started = time.monotonic()
        results[key] = await synthesize(key, line, out_dir)
        print(f"OK {key}: {results[key]['duration']}s, {results[key]['bytes']} bytes, {time.monotonic()-started:.1f}s elapsed", flush=True)
    if mode == "samples":
        results["meet_yunxi"] = await synthesize("meet", lines["meet"], WORK / "samples/yunxi", voice="zh-CN-YunxiNeural")
    manifest = {
        "schemaVersion": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "generator": f"edge-tts {importlib.metadata.version('edge-tts')}",
        "source": SOURCE,
        "sourceUrl": "https://github.com/rany2/edge-tts",
        "voiceDocumentation": "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts",
        "playback": "Static local MP3 assets; no network TTS or account required by app",
        "format": "MP3 24 kHz 48 kbps mono",
        "voice": VOICE, "rate": RATE, "pitch": PITCH,
        "audio": [{"key": key, **value} for key, value in results.items()],
    }
    manifest_path = (WORK / "sample-manifest.json") if mode == "samples" else (APP / "assets/audio-neural/manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Verified {len(results)} files. Manifest: {manifest_path}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("voices", "samples", "all"))
    args = parser.parse_args()
    asyncio.run(main(args.mode))
