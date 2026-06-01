#!/usr/bin/env python3
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlretrieve

ROOT = Path('/opt/data/projects/antsjets')
IMG_DIR = ROOT / 'assets' / 'images' / 'ai-visuals'
VID_DIR = ROOT / 'assets' / 'video' / 'ai-visuals'
IMG_DIR.mkdir(parents=True, exist_ok=True)
VID_DIR.mkdir(parents=True, exist_ok=True)

HIGGS = '/opt/data/bin/higgsfield'
COMMON = 'realistic UK iPhone photo style, overcast natural British daylight, casual phone photo framing, believable local tradesman pressure washing marketing image, no text, no watermark, not CGI, not luxury render'

images = [
    ('driveway-block-paving-surrey-before-after', 'Split-screen before-and-after of a normal block paving driveway outside a Surrey semi-detached house; left side dark algae, moss and weeds between blocks, right side freshly pressure washed clean bright paving, wet surface, clear transformation line, ' + COMMON, '16:9'),
    ('driveway-large-clean-stripe-guildford', 'Large detached Guildford house driveway with a dramatic clean stripe through dirty block paving, one side blackened with algae and grime, cleaned strip bright and wet, ' + COMMON, '16:9'),
    ('driveway-gravel-edge-block-paving', 'Block paving driveway with gravel border and parked family car edge cropped out, clear before-and-after half cleaned paving, mossy joints becoming clean sand-coloured blocks, ' + COMMON, '16:9'),
    ('driveway-closeup-moss-joints', 'Close-up phone photo of block paving driveway being cleaned, dirty moss-filled joints on left, clean wet pavers on right, satisfying surface detail, ' + COMMON, '4:3'),
    ('driveway-suburban-corner-transformation', 'Suburban UK driveway corner and front path, clear diagonal clean line where pressure washer has removed years of grime from block paving, ' + COMMON, '16:9'),
    ('driveway-meta-vertical', 'Vertical Meta ad image: dramatic before-and-after of a dirty UK block paving driveway cleaned by pressure washing, strong visual proof, simple composition with space at top for ad copy but no text in image, ' + COMMON, '9:16'),
    ('patio-large-garden-before-after', 'Split-screen before-and-after of a large back garden patio at a brick Surrey house; left slabs dark green algae and black spots, right slabs freshly jet washed pale and wet, fence and lawn visible, ' + COMMON, '16:9'),
    ('patio-slab-clean-stripe', 'UK garden patio slabs with a strong clean stripe through algae-stained paving, brick extension and garden furniture in background, wet cleaned surface, ' + COMMON, '16:9'),
    ('patio-courtyard-surrey', 'Believable Surrey courtyard patio before-and-after, old stone slabs dirty and mossy on left, professionally pressure washed clean on right, ' + COMMON, '16:9'),
    ('patio-meta-vertical', 'Vertical Meta ad image: dirty garden patio transformed with pressure washing, half green algae and half clean bright slabs, British back garden, space for ad headline but no text, ' + COMMON, '9:16'),
    ('path-cleaning-side-return', 'Narrow UK side path between house and fence, before-and-after cleaning with slippery green algae on one half and clean safe paving on the other, ' + COMMON, '16:9'),
    ('decking-cleaning-garden', 'UK timber garden decking before-and-after, left side grey-green slippery algae, right side freshly cleaned warmer timber boards, wet surface, ' + COMMON, '16:9'),
    ('gutter-fascia-cleaning-closeup', 'Ground-level phone photo looking up at UK house guttering and fascia, one section dirty with black streaks and algae, one section freshly cleaned white, believable exterior cleaning result, ' + COMMON, '16:9'),
    ('commercial-forecourt-clean-stripe', 'Small local commercial forecourt or shop entrance paving in the UK with a clear pressure-washed clean stripe through dirty concrete slabs, practical business exterior cleaning, ' + COMMON, '16:9'),
]

videos = [
    ('driveway-clean-reveal-video', '5 second photorealistic iPhone-style video of a UK block paving driveway outside a Surrey house, camera slowly pushes across a dramatic clean stripe through dirty mossy paving as if freshly pressure washed, wet surface shimmer, satisfying before-to-after reveal, no text, no watermark', '16:9'),
    ('patio-clean-reveal-video', '5 second photorealistic iPhone-style video of a British garden patio, camera pans slowly from dark algae-stained slabs to freshly pressure washed clean wet paving, brick house and fence in background, realistic local tradesman marketing clip, no text, no watermark', '16:9'),
]

manifest = []

def run(cmd):
    proc = subprocess.run(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=900)
    if proc.returncode != 0:
        raise RuntimeError(f'Command failed {proc.returncode}: {cmd}\n{proc.stdout}')
    return proc.stdout

def parse_json_array(out):
    # Higgsfield sometimes prints clean JSON. Keep this tolerant.
    start = out.find('[')
    end = out.rfind(']')
    if start == -1 or end == -1:
        raise ValueError('No JSON array found in output: ' + out[:500])
    return json.loads(out[start:end+1])

def download(url, path):
    tmp = str(path) + '.tmp'
    urlretrieve(url, tmp)
    os.replace(tmp, path)

for slug, prompt, ar in images:
    print(f'IMAGE {slug}', flush=True)
    out = run([HIGGS, 'generate', 'create', 'gpt_image_2', '--prompt', prompt, '--aspect_ratio', ar, '--resolution', '1k', '--quality', 'medium', '--wait', '--json'])
    item = parse_json_array(out)[0]
    url = item.get('result_url')
    path = IMG_DIR / f'{slug}.png'
    download(url, path)
    manifest.append({'type': 'image', 'slug': slug, 'aspect_ratio': ar, 'url': url, 'path': str(path), 'prompt': prompt, 'id': item.get('id')})
    print(f'DOWNLOADED {path}', flush=True)

for slug, prompt, ar in videos:
    print(f'VIDEO {slug}', flush=True)
    out = run([HIGGS, 'generate', 'create', 'seedance_2_0', '--prompt', prompt, '--aspect_ratio', ar, '--duration', '5', '--resolution', '720p', '--mode', 'fast', '--wait', '--json'])
    item = parse_json_array(out)[0]
    url = item.get('result_url')
    path = VID_DIR / f'{slug}.mp4'
    download(url, path)
    manifest.append({'type': 'video', 'slug': slug, 'aspect_ratio': ar, 'url': url, 'path': str(path), 'prompt': prompt, 'id': item.get('id')})
    print(f'DOWNLOADED {path}', flush=True)

manifest_path = ROOT / 'assets' / 'ai-visuals-manifest.json'
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'MANIFEST {manifest_path}')
print(json.dumps({'generated': len(manifest), 'manifest': str(manifest_path)}, indent=2))
