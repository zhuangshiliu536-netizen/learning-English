"""Add local audio for the original breakfast sample without changing old clips."""
import asyncio
from array import array
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import wave

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'outputs/first-day-demo'
WORK=ROOT/'work/voice-upgrade'
BUILD=ROOT/'work/breakfast-audio'
NODE='/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
sys.path.insert(0,str(WORK))
import generate_neural as neural

def load_lines():
    script="import { EXTRA_SPEECH_LINES } from './curriculum.js';process.stdout.write(JSON.stringify(EXTRA_SPEECH_LINES));"
    result=subprocess.run([NODE,'--input-type=module','-e',script],cwd=APP,check=True,capture_output=True,text=True)
    return json.loads(result.stdout)

def wave_metadata(path):
    with wave.open(str(path),'rb') as stream:
        frames=stream.getnframes();rate=stream.getframerate();channels=stream.getnchannels()
        samples=array('h',stream.readframes(frames))
    if sys.byteorder!='little':samples.byteswap()
    peak=max((abs(v) for v in samples),default=0)
    rms=math.sqrt(sum(v*v for v in samples)/len(samples)) if samples else 0
    if not frames or peak<100 or rms<10:raise RuntimeError(f'Empty/silent WAV {path}')
    return {'duration_seconds':round(frames/rate,3),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'decodedSampleRate':rate,'channels':channels,'peak':peak,'rms':round(rms,1)}

def english_one(item):
    key,line=item
    output=APP/'assets/audio'/f'{key}.wav'
    source=BUILD/f'{key}.aiff';partial=BUILD/f'{key}.part.wav'
    if output.exists():
        raise RuntimeError(f'Refusing to overwrite existing audio {key}')
    subprocess.run(['say','-v','Samantha','-r','135','-o',str(source),line['text']],check=True,capture_output=True,timeout=20)
    subprocess.run(['afconvert','-f','WAVE','-d','LEI16@22050',str(source),str(partial)],check=True,capture_output=True,timeout=15)
    stats=wave_metadata(partial);partial.replace(output)
    print(f'EN OK {key} {stats["duration_seconds"]}s',flush=True)
    return {'key':key,**line,'voice':'Samantha','rate':135,'path':f'assets/audio/{key}.wav','pathBase':'app-root',**stats}

def english_all(lines):
    BUILD.mkdir(parents=True,exist_ok=True)
    english=[item for item in lines.items() if item[1]['lang']=='en-US']
    with ThreadPoolExecutor(max_workers=2) as executor:
        records=list(executor.map(english_one,english))
    path=APP/'assets/audio-manifest.json';manifest=json.loads(path.read_text())
    oldkeys={row['key'] for row in manifest['audio']}
    if oldkeys.intersection(row['key'] for row in records):raise RuntimeError('Duplicate old English key')
    manifest['audio'].extend(records)
    manifest['extended_on']='2026-11-03'
    manifest['additional_source']='curriculum.js EXTRA_SPEECH_LINES: original breakfast sample'
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return records

async def chinese_all(lines):
    records=[]
    for key,line in lines.items():
        if line['lang']!='zh-CN':continue
        if (APP/'assets/audio-neural'/f'{key}.mp3').exists():raise RuntimeError(f'Refusing to overwrite existing audio {key}')
        record=await neural.synthesize(key,line,APP/'assets/audio-neural')
        records.append({'key':key,**record})
        print(f'ZH OK {key} {record["duration"]}s',flush=True)
    path=APP/'assets/audio-neural/manifest.json';manifest=json.loads(path.read_text())
    oldkeys={row['key'] for row in manifest['audio']}
    if oldkeys.intersection(row['key'] for row in records):raise RuntimeError('Duplicate old Chinese key')
    manifest['audio'].extend(records)
    manifest['extendedAt']='2026-11-03'
    manifest['additionalSource']='curriculum.js EXTRA_SPEECH_LINES: original breakfast sample'
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return records

async def main():
    lines=load_lines()
    en,zh=await asyncio.gather(asyncio.to_thread(english_all,lines),chinese_all(lines))
    (BUILD/'generated-manifest.json').write_text(json.dumps({'english':en,'chinese':zh},ensure_ascii=False,indent=2)+'\n')
    print(f'ALL COMPLETE English={len(en)} Chinese={len(zh)}',flush=True)

if __name__=='__main__':asyncio.run(main())
