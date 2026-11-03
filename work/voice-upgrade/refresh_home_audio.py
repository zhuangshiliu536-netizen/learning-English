"""Refresh only two fixed home prompts after replacing the old start button."""
import asyncio
from array import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import wave

import generate_neural as neural

ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'outputs/first-day-demo'
WORK=ROOT/'work/voice-upgrade/home-prompt-refresh'
NODE='/Users/zyb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'

def load_lines():
    script="import{SPEECH_LINES}from'./content.js';import{EXTRA_SPEECH_LINES}from'./curriculum.js';process.stdout.write(JSON.stringify({home:SPEECH_LINES.home,breakfast_home:EXTRA_SPEECH_LINES.breakfast_home}));"
    r=subprocess.run([NODE,'--input-type=module','-e',script],cwd=APP,check=True,capture_output=True,text=True)
    return json.loads(r.stdout)

def backup(path):
    if path.exists():shutil.copy2(path,WORK/'before'/path.name)

def make_wav(key,line):
    source=WORK/f'{key}.aiff';partial=WORK/f'{key}.part.wav';output=APP/'assets/audio'/f'{key}.wav'
    backup(output)
    subprocess.run(['say','-v','Tingting','-r','180','-o',str(source),line['text']],check=True,capture_output=True,timeout=20)
    subprocess.run(['afconvert','-f','WAVE','-d','LEI16@22050',str(source),str(partial)],check=True,capture_output=True,timeout=15)
    with wave.open(str(partial),'rb') as audio:
        frames=audio.getnframes();rate=audio.getframerate();channels=audio.getnchannels();samples=array('h',audio.readframes(frames))
    if sys.byteorder!='little':samples.byteswap()
    peak=max((abs(v) for v in samples),default=0)
    rms=math.sqrt(sum(v*v for v in samples)/len(samples)) if samples else 0
    if frames<1 or peak<100 or rms<10:raise RuntimeError(f'Silent WAV: {key}')
    partial.replace(output)
    return {'key':key,**line,'voice':'Tingting','rate':180,'path':f'assets/audio/{key}.wav','pathBase':'app-root','duration_seconds':round(frames/rate,3),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'decodedSampleRate':rate,'channels':channels,'peak':peak,'rms':round(rms,1)}

def merge(manifest_path,new):
    manifest=json.loads(manifest_path.read_text());replacement={r['key']:r for r in new}
    rows=[]
    for old in manifest['audio']:
        if old['key'] in replacement:rows.append(replacement.pop(old['key']))
        else:rows.append(old)
    rows.extend(replacement.values());manifest['audio']=rows
    manifest['homePromptRefresh']='2026-11-03: home and breakfast_home now refer to the conversation bubble'
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

async def main():
    (WORK/'before').mkdir(parents=True,exist_ok=True)
    lines=load_lines();wav=[];mp3=[]
    for key,line in lines.items():
        if line['lang']!='zh-CN' or '气泡' not in line['text']:raise RuntimeError(f'Unexpected source line: {key}')
        backup(APP/'assets/audio-neural'/f'{key}.mp3')
        record=await neural.synthesize(key,line,APP/'assets/audio-neural')
        mp3.append({'key':key,**record})
        wav.append(make_wav(key,line))
        print(f"OK {key}: neural={record['duration']}s legacy={wav[-1]['duration_seconds']}s",flush=True)
    merge(APP/'assets/audio-neural/manifest.json',mp3)
    merge(APP/'assets/audio-manifest.json',wav)
    (WORK/'results.json').write_text(json.dumps({'neural':mp3,'legacy':wav},ensure_ascii=False,indent=2)+'\n')
    print('Refreshed exactly 2 neural MP3 + 2 legacy WAV.',flush=True)

if __name__=='__main__':asyncio.run(main())
