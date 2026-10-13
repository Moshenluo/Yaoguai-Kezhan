"""Collect the completed V12 film and reproducible source; do not run render/tests."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent
DEFAULT_DEST = ROOT / 'delivery'
SOURCE_FILES = ['index.html', 'film.js', 'timeline.js', 'score.json', 'render.cjs', 'verify.cjs',
                'build_preview.py', 'package.json', 'font-text.txt', 'validate_media.py',
                'visual_review.cjs', 'make_contact.py', 'package_delivery.py']
ROOT_FILES = ['README.md', 'provenance.json', 'font-check.json', 'preview-standalone.html']
OUTPUT_FILES = ['yaoguai-type-v12.mp4', 'storyboard.jpg', 'cover.jpg', 'validation.json']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dest', type=Path, default=DEFAULT_DEST)
    args = parser.parse_args()
    dest = args.dest.resolve()
    # Check all inputs before creating a partially populated delivery directory.
    root_inputs = {name: (ROOT / name if (ROOT / name).is_file() else ROOT.parent / name) for name in ROOT_FILES}
    required = [ROOT / name for name in SOURCE_FILES] + list(root_inputs.values())
    required += [ROOT / 'output' / name for name in OUTPUT_FILES]
    required += [ROOT / 'assets/music.m4a']
    missing = [str(file) for file in required if not file.is_file()]
    if missing:
        raise FileNotFoundError('Finish the deliverable before packaging: ' + ', '.join(missing))
    source = dest / 'source'
    source.mkdir(parents=True, exist_ok=True)
    for name in SOURCE_FILES:
        shutil.copy2(ROOT / name, source / name)
    shutil.copytree(ROOT / 'assets', source / 'assets', dirs_exist_ok=True)
    for name in ROOT_FILES:
        shutil.copy2(root_inputs[name], dest / name)
    for name in OUTPUT_FILES:
        shutil.copy2(ROOT / 'output' / name, dest / name)
    shutil.copy2(ROOT / 'assets/music.m4a', dest / 'music-excerpt.m4a')
    files = sorted(p for p in dest.rglob('*') if p.is_file()
                   and p.name not in ['SHA256SUMS', 'manifest.json'] and p.suffix != '.zip')
    manifest = {'title': '妖怪客栈 · 等你当家｜文字 PV V12', 'duration_seconds': 27,
                'width': 1080, 'height': 1920, 'fps': 60, 'files': []}
    for file in files:
        manifest['files'].append({'path': str(file.relative_to(dest)), 'bytes': file.stat().st_size,
                                  'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    (dest / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    archive = dest / 'yaoguai-type-v12-delivery.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as packed:
        for file in files + [dest / 'manifest.json']:
            packed.write(file, arcname='yaoguai-type-v12/' + str(file.relative_to(dest)))
    with zipfile.ZipFile(archive) as packed:
        assert packed.testzip() is None
        assert len(packed.namelist()) == len(files) + 1
    hashfiles = sorted(p for p in dest.iterdir() if p.is_file() and p.name != 'SHA256SUMS')
    (dest / 'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n'
                                           for p in hashfiles), encoding='utf-8')
    assert all(p.stat().st_size < 100 * 1024 ** 2 for p in dest.rglob('*') if p.is_file())
    print(json.dumps({'directory': str(dest), 'zip_bytes': archive.stat().st_size,
                      'film_bytes': (dest / 'yaoguai-type-v12.mp4').stat().st_size,
                      'files': len(files), 'zip_crc': 'passed'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
