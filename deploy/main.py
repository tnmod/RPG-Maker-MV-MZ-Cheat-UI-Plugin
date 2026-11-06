"""Build copy-ready MV and MZ release folders from the repository sources."""

import argparse
import json
from pathlib import Path
import re
import shutil


DEPLOY = Path(__file__).resolve().parent
SOURCE = DEPLOY.parent / 'cheat-engine' / 'www'
OUTPUT = DEPLOY / 'output'
VERSION_PATTERN = re.compile(r'(?P<major>[0-9]+)(?:\.(?P<minor>[0-9]+)(?:\.[0-9]+)?)?(?:-[0-9A-Za-z.-]+)?')
RELEASE_FOLDER_PATTERN = re.compile(r'rpg-cheat-(.+)|rpg-(?:mv|mz)-cheat-(.+)-core')


def next_version():
    versions = []
    if OUTPUT.is_dir():
        for folder in OUTPUT.iterdir():
            release = RELEASE_FOLDER_PATTERN.fullmatch(folder.name)
            if not release or not folder.is_dir():
                continue
            version = VERSION_PATTERN.fullmatch((release[1] or release[2]).removeprefix('v'))
            if version:
                versions.append((int(version['major']), int(version['minor'] or 0)))
    major, minor = max(versions, default=(1, 0))
    return f'{major}.{minor + 1}'


def build(version=None):
    version = next_version() if version is None else version.removeprefix('v')
    if not VERSION_PATTERN.fullmatch(version):
        raise ValueError('Expected a version such as 2, v1.4, or 1.1.0-preview.1.')

    OUTPUT.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT / f'rpg-cheat-v{version}'
    destination.mkdir()
    try:
        for engine in ('mv', 'mz'):
            payload = destination / 'source' / f'rpg-{engine}-cheat-{version}-core'
            game_files = payload / 'www' if engine == 'mv' else payload
            shutil.copytree(SOURCE / 'cheat', game_files / 'cheat')
            shutil.copytree(SOURCE / '_cheat_initialize' / engine / 'js', game_files / 'js')
            (game_files / 'cheat-version-description.json').write_text(
                json.dumps({'version': f'v{version}'}, indent=2) + '\n', encoding='utf-8'
            )
        shutil.copy2(DEPLOY / 'menu.bat', destination / 'menu.bat')
        shutil.copy2(DEPLOY / 'install.ps1', destination / 'source' / 'install.ps1')
        shutil.copy2(DEPLOY / 'ModLoaderBootstrap.js', destination / 'source' / 'ModLoaderBootstrap.js')
    except OSError:
        if not destination.is_symlink() and destination.resolve().parent == OUTPUT.resolve():
            shutil.rmtree(destination)
        raise
    print(destination)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('-v', '--version', help='Exact release version. Omit to increment the latest minor version.')
    args = parser.parse_args()
    try:
        build(args.version)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')
