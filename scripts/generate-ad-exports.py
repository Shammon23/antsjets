#!/usr/bin/env python3
"""Generate platform-ready Ant's Jets ad image exports with valid Meta and Google Ads dimensions.

Requires ffmpeg/ffprobe. Outputs JPEG files plus JSON/CSV manifests under assets/ad-exports/.
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "ad-exports"

CREATIVES = [
    # Real proof first
    ("real-block-paved-driveway-before-after", "assets/images/real-work/real-block-paved-driveway-before-after.webp", "Real driveway 50/50", "Driveway kerb appeal", "real-proof"),
    ("real-sandstone-patio-main-before-after", "assets/images/real-work/real-sandstone-patio-main-before-after.webp", "Real sandstone patio 50/50", "Patio refresh", "real-proof"),
    ("real-sandstone-patio-side-before-after", "assets/images/real-work/real-sandstone-patio-side-before-after.webp", "Real patio side angle", "Patio carousel backup", "real-proof"),
    ("real-block-driveway-garage-before-after", "assets/images/real-work/real-block-driveway-garage-before-after.webp", "Real garage driveway 50/50", "Driveway retargeting", "real-proof"),
    # Test images
    ("driveway-large-clean-stripe-guildford", "assets/images/ai-visuals/webp/driveway-large-clean-stripe-guildford.webp", "Driveway clean stripe", "Driveway broad test", "test-image"),
    ("patio-large-garden-before-after", "assets/images/ai-visuals/webp/patio-large-garden-before-after.webp", "Patio garden before/after", "Patio refresh", "test-image"),
    ("luxury-front-block-drive", "assets/images/ai-visuals/webp/luxury-front-block-drive.webp", "Larger Surrey driveway", "Higher-value driveway", "test-image"),
    ("luxury-indian-sandstone-patio", "assets/images/ai-visuals/webp/luxury-indian-sandstone-patio.webp", "Indian sandstone patio", "Premium patio", "test-image"),
    ("luxury-driveway-courtyard", "assets/images/ai-visuals/webp/luxury-driveway-courtyard.webp", "Courtyard driveway", "Higher-value home", "test-image"),
    ("luxury-gate-driveway", "assets/images/ai-visuals/webp/luxury-gate-driveway.webp", "Gated driveway", "Premium driveway", "test-image"),
    ("path-cleaning-side-return", "assets/images/ai-visuals/webp/path-cleaning-side-return.webp", "Side path clean-up", "Slippery paths", "test-image"),
    ("decking-cleaning-garden", "assets/images/ai-visuals/webp/decking-cleaning-garden.webp", "Decking cleaning", "Garden/decking refresh", "test-image"),
    ("commercial-forecourt-large-before-after", "assets/images/ai-visuals/webp/commercial-forecourt-large-before-after.webp", "Commercial forecourt", "Commercial cleaning", "test-image"),
    ("commercial-shopfront-pavement-before-after", "assets/images/ai-visuals/webp/commercial-shopfront-pavement-before-after.webp", "Shopfront pavement", "Commercial entrances", "test-image"),
    ("commercial-bin-yard-before-after", "assets/images/ai-visuals/webp/commercial-bin-yard-before-after.webp", "Bin yard / service area", "Commercial service yards", "test-image"),
    ("commercial-school-playground-before-after", "assets/images/ai-visuals/webp/commercial-school-playground-before-after.webp", "School paved areas", "Schools/community", "test-image"),
    ("patio-repointing-before-after", "assets/images/ai-visuals/webp/patio-repointing-before-after.webp", "Patio repointing", "Repair/repointing", "test-image"),
    ("patio-repair-loose-slabs-before-after", "assets/images/ai-visuals/webp/patio-repair-loose-slabs-before-after.webp", "Patio repair", "Loose slabs", "test-image"),
    ("paving-repointing-path-before-after", "assets/images/ai-visuals/webp/paving-repointing-path-before-after.webp", "Paving repointing", "Paving joints", "test-image"),
    ("high-pressure-jet-washing-clean-stripe", "assets/images/ai-visuals/webp/high-pressure-jet-washing-clean-stripe.webp", "High-pressure clean stripe", "Close-up proof", "test-image"),
    ("roof-cleaning-moss-before-after", "assets/images/ai-visuals/webp/roof-cleaning-moss-before-after.webp", "Roof moss clean", "Roof cleaning", "test-image"),
    ("gutter-clearing-before-after", "assets/images/ai-visuals/webp/gutter-clearing-before-after.webp", "Gutter clearing", "Guttering", "test-image"),
]

FORMATS = [
    # Meta/Facebook accepted image formats
    ("meta", "feed-square-1080x1080", 1080, 1080, "1:1", "Facebook/Instagram Feed square"),
    ("meta", "feed-portrait-1080x1350", 1080, 1350, "4:5", "Facebook/Instagram Feed portrait"),
    ("meta", "stories-reels-1080x1920", 1080, 1920, "9:16", "Stories/Reels vertical"),
    ("meta", "link-landscape-1200x628", 1200, 628, "1.91:1", "Facebook link/ad landscape"),
    # Google Ads/PMax asset formats
    ("google", "landscape-1200x628", 1200, 628, "1.91:1", "Google Ads landscape image"),
    ("google", "square-1200x1200", 1200, 1200, "1:1", "Google Ads square image"),
    ("google", "portrait-960x1200", 960, 1200, "4:5", "Google Ads portrait image"),
    # Common Google Display fixed sizes
    ("google", "display-300x250", 300, 250, "6:5", "Medium rectangle"),
    ("google", "display-728x90", 728, 90, "728:90", "Leaderboard"),
    ("google", "display-160x600", 160, 600, "4:15", "Wide skyscraper"),
    ("google", "display-300x600", 300, 600, "1:2", "Half page"),
    ("google", "display-320x50", 320, 50, "32:5", "Mobile leaderboard"),
]

COPY_BANK = [
    {
        "angle": "Driveway kerb appeal",
        "platform": "Meta + Google",
        "primary_text": "Driveway looking tired? Ant's Jets cleans driveways, patios and paths across Guildford, Surrey and nearby areas. Send a few photos and we'll come back with a quick quote.",
        "headline": "Driveway Cleaning Quotes",
        "description": "Local pressure washing. Quick quote from photos.",
        "utm_campaign": "antsjets_guildford_driveway_quote",
    },
    {
        "angle": "Patio summer refresh",
        "platform": "Meta + Google",
        "primary_text": "Patio gone green or slippery? Get it cleaned up ready for summer. Send Ant's Jets a few photos and we'll give you a straightforward local quote.",
        "headline": "Patio Cleaning Near You",
        "description": "Freshen up the garden without replacing the patio.",
        "utm_campaign": "antsjets_surrey_patio_quote",
    },
    {
        "angle": "Before and after proof",
        "platform": "Meta + Google",
        "primary_text": "Outdoor surfaces can look a lot better after a proper clean. If your driveway, patio or path needs sorting, send over a few photos and Ant's Jets will quote the job.",
        "headline": "Before & After Cleaning",
        "description": "Driveways, patios and paths cleaned locally.",
        "utm_campaign": "antsjets_before_after_quote",
    },
    {
        "angle": "Commercial entrances",
        "platform": "Meta + Google",
        "primary_text": "Shopfront, forecourt or business entrance looking dirty? Ant's Jets handles practical exterior cleaning for local businesses. Send photos of the area for a quick quote.",
        "headline": "Commercial Pressure Washing",
        "description": "Entrances, forecourts and hardstanding areas.",
        "utm_campaign": "antsjets_commercial_quote",
    },
    {
        "angle": "Patio repair / repointing",
        "platform": "Meta + Google Search",
        "primary_text": "Loose slabs or tired patio joints? Ant's Jets can help with patio cleaning, repairs and repointing in the local area. Send photos and we'll advise on the next step.",
        "headline": "Patio Repair & Repointing",
        "description": "Useful for higher-value repair enquiries.",
        "utm_campaign": "antsjets_patio_repair_repointing_quote",
    },
    {
        "angle": "Slippery paths",
        "platform": "Meta + Google",
        "primary_text": "Green, slippery paths and side access areas can be cleaned up properly. Send a few photos to Ant's Jets and get a straightforward local quote.",
        "headline": "Path Cleaning Quotes",
        "description": "Algae, grime and outdoor build-up cleaned.",
        "utm_campaign": "antsjets_path_cleaning_quote",
    },
]


def ffprobe_size(path: Path) -> tuple[int, int]:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(path)
    ])
    st = json.loads(out)["streams"][0]
    return int(st["width"]), int(st["height"])


def q(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def make_export(src: Path, dst: Path, width: int, height: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Blurred cover background + contain foreground prevents awkward hard crops in narrow Google display sizes.
    filt = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},gblur=sigma=18,eq=brightness=-0.04:saturation=0.85[bg];"
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuvj420p"
    )
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
        "-filter_complex", filt, "-frames:v", "1", "-q:v", "3", str(dst)
    ], check=True)


def main() -> None:
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise SystemExit("ffmpeg and ffprobe are required")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for cid, rel, title, angle, tier in CREATIVES:
        src = ROOT / rel
        if not src.exists():
            raise FileNotFoundError(src)
        sw, sh = ffprobe_size(src)
        for platform, fmt, w, h, ratio, purpose in FORMATS:
            dst = OUT / platform / fmt / f"antsjets-{cid}-{w}x{h}.jpg"
            make_export(src, dst, w, h)
            manifest.append({
                "creative_id": cid,
                "title": title,
                "angle": angle,
                "tier": tier,
                "source": rel,
                "source_width": sw,
                "source_height": sh,
                "platform": platform,
                "format": fmt,
                "purpose": purpose,
                "ratio": ratio,
                "width": w,
                "height": h,
                "file": str(dst.relative_to(ROOT)),
            })
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    with (OUT / "manifest.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(manifest[0].keys()))
        writer.writeheader(); writer.writerows(manifest)
    with (OUT / "copy-bank.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(COPY_BANK[0].keys()))
        writer.writeheader(); writer.writerows(COPY_BANK)
    readme = """# Ant's Jets ad exports

Platform-ready JPEG exports generated from the internal creative gallery assets.

## Meta / Facebook / Instagram

- `meta/feed-square-1080x1080/` — 1:1 feed and carousel images.
- `meta/feed-portrait-1080x1350/` — 4:5 feed images.
- `meta/stories-reels-1080x1920/` — 9:16 Stories/Reels placements.
- `meta/link-landscape-1200x628/` — 1.91:1 link/ad landscape.

## Google Ads

- `google/landscape-1200x628/` — 1.91:1 Performance Max / responsive display landscape.
- `google/square-1200x1200/` — 1:1 square image.
- `google/portrait-960x1200/` — 4:5 portrait image.
- `google/display-300x250/`, `display-728x90/`, `display-160x600/`, `display-300x600/`, `display-320x50/` — common fixed display banner sizes.

## Copy and manifests

- `manifest.csv` and `manifest.json` list every export, source creative, platform, size and path.
- `copy-bank.csv` contains the current campaign copy/headlines/descriptions/UTM campaign starters.

Real Ant's Jets before/after composites should be used first. Generated/test images should be reviewed for realism before upload.
"""
    (OUT / "README.md").write_text(readme)
    print(f"Generated {len(manifest)} image exports")
    print(OUT.relative_to(ROOT))

if __name__ == "__main__":
    main()
