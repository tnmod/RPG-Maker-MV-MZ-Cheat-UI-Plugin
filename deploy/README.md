# Build release folders

## Usage

Run from the repository root:

```sh
python deploy/main.py
python deploy/main.py --version v1.4
python deploy/main.py -v 2
```

Without a version argument, the builder finds the highest major and minor version in `deploy/output/` and increments the minor. For example, `v1.9` becomes `v1.10`, then `v1.11`. An empty output directory starts at `v1.1`. An explicit version is used as given. `-v 2` produces `v2`, and the next automatic version after it is `v2.1`.

The builder writes `deploy/output/rpg-cheat-v<VERSION>/`. The release contains `menu.bat` and both engine payloads under `source/`. Existing release folders are preserved.

Copy the entire `rpg-cheat-v<VERSION>` folder next to `Game.exe` and open `menu.bat`. Close the game before using Install or Uninstall. The menu shows the game title, engine, and engine version.

For supported Seed of Profanity ModLoader builds on Windows, Install registers a separate `mods/RpgMakerCheatUI` mod. The existing launcher, HTML, mod folders and Mod Manager settings stay intact. Enable **RPG Maker Cheat UI** in the Mod Manager if needed. Saves created with the mod active may show the loader's missing-mod warning after uninstall.

For other supported MV/MZ games, Install adds a loader hook to `index.html`, creates `index.html.rpg-cheat.bak`, and keeps the game's `js/main.js`. Uninstall removes the hook while preserving other HTML edits. Either uninstall method moves the owned cheat files into the release folder.

For a legacy installation, choose **Uninstall** first. The menu restores `main.js.rpg-cheat.bak` and retains a copy of the current launcher in the release folder. Then choose **Install** to use the detected loader.

If a supported installation reports an older version, **4. Update** replaces the Cheat UI files in place and archives the previous version. Installations without version metadata can still use **Archive old install and install new version**.
