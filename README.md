# UI fork in development

This fork is updating the original cheat interface to make its existing tools easier to find and use. The first UI pass adds:

- A visible **Cheats** launcher, a close button and a resizable-window-friendly console.
- Grouped navigation with a **Find a tool** search field.
- Five navigation entries: **Play**, **Inventory**, **Travel**, **Game data** and **Settings**. Inventory categories share a selector, and the other grouped tools use tabs. Direct shortcuts still open the intended tool.
- One **Play** menu groups gold, party health and stats, movement and speed, combat, and save/session actions.
- In-game icons beside item, weapon and armor names, loaded through the engine's IconSet bitmap (including encrypted assets).
- Keyboard focus feedback and input isolation while interacting with the console.
- Local styles and icon fonts, so opening the UI does not require a CDN connection.

The bundled Vue 2.6.14 and Vuetify 2.6.3 JavaScript versions are retained. Styles match Vuetify 2.6.3; icons use Material Design Icons 6.9.96. Their licenses are included beside the vendored assets under `cheat-engine/www/cheat/libs/`.

## Try the UI preview

From the repository root, run:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8765/preview/), then select **Cheats** or press **Ctrl+C**. Use [the MV fixture](http://127.0.0.1:8765/preview/?engine=MV) to show the MV engine label. The preview uses mock game data; it does not open a game or change real saves. See [preview/README.md](preview/README.md) for checks and limitations.

## Development checks

Run the Node tests from the repository root with a current Node.js version:

```sh
node --test tests/*.test.mjs
```

The optional browser smoke test uses Python Playwright:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/ui_smoke.py
```

These checks use simulated engine behavior. This UI pass has not established compatibility with real MV/MZ games or their third-party plugins, and is not a new packaged release.

## Existing game installation

The upstream installation instructions below still describe replacing `js/main.js`. That can overwrite custom startup code, including a game's ModLoader. This UI pass does not add a new installer or resolve that startup conflict; do not treat the browser preview as a ModLoader compatibility test. Keep a backup before trying the legacy installation on a copy of a game.

---

The original upstream README follows. Its screenshots show the earlier interface.

- [RPG-Maker-MV-MZ-Cheat-UI-Plugin](#rpg-maker-mv-mz-cheat-ui-plugin)
- [Intro](#intro)
  * [UI Sample](#ui-sample)
  * [Features](#features)
- [Set up](#set-up)
  * [How to apply](#how-to-apply)
  * [How to use](#how-to-use)
  * [Apply same cheat settings from another game](#apply-same-cheat-settings-from-another-game)
- [Handling Errors](#handling-errors)
  * [If embeded nwjs version of game is lower than 0.26.4](#if-embeded-nwjs-version-of-game-is-lower-than-0264)
  * [If the error occurs after updating the cheat](#if-the-error-occurs-after-updating-the-cheat)



# RPG-Maker-MV-MZ-Cheat-UI-Plugin

- GUI based RPG Maker MV/MZ game cheat tool
- [한국어 도움말](https://github.com/paramonos/RPG-Maker-MV-MZ-Cheat-UI-Plugin/blob/main/README_ko-kr.md)



# Intro


## UI Sample
<p float="left">
  <img src="https://user-images.githubusercontent.com/99193603/153754676-cee2b96e-c03a-491f-b71c-3c57d6dcc474.JPG" width="500"/>
  <img src="https://user-images.githubusercontent.com/99193603/153754683-4e7a09a5-2d31-436d-8546-7a5d658eb282.JPG" width="500"/>
  <img src="https://user-images.githubusercontent.com/99193603/153754687-732648c8-3483-42bb-9634-dd22d674dfed.JPG" width="500"/>
  <img src="https://user-images.githubusercontent.com/99193603/153754692-38e04218-7726-4827-a45b-95485de51a3c.JPG" width="500"/>
  <img src="https://user-images.githubusercontent.com/99193603/153754696-0cbc76f9-99fa-47a7-a0d0-6510a2f76e01.JPG" width="500"/>
</p>


## Features
- Good usability based on GUI.
- Supports both RPG MV/MZ games.
- Editing stats, gold, speed, items, variables, switches ...
- Accelerate game speed (x0.1 ~ x10)
- Supports no clip mode, god mode.
- Disable random encounter.
- Force battle victory/defeat/escape/abort.
- Supports useful customizable shortcuts.
    - Toggle save/load window, quick save/load, goto title, toggle no clip, editing party/enemy HP ...
- Easy to find items, switched, variables, etc by searching text.
- Save location and recall, teleport cheats.
- Supports developers tool.
- Translate variables, switches, maps. (Needs [ezTransWeb](https://github.com/HelloKS/ezTransWeb) : Only supports for Korean.)
- **Maybe more features..?**



# Set up


## How to apply 
1. Unpack game if needed.
2. Download latest version of `rpg-{mv|mz}-cheat-{version}.zip` from **[releases](https://github.com/paramonos/RPG-Maker-MV-Cheat-UI-Plugin/releases)** and unzip.
3. Copy unziped directories to `{game directory}/www` (for MZ, just copy to `{game_directory}`).
    - It will overwrite `www/js/main.js` file, so it is strongly recommended to make a backup file.
    - Example for RPG MV
      <br/><img src="https://user-images.githubusercontent.com/99193603/153755213-b07f1abb-9c99-4157-857c-2f3a81e4a82a.JPG" width="500"/>
      <br/><img src="https://user-images.githubusercontent.com/99193603/155840463-ae64385f-60c1-478c-b266-8e9580a878e6.png" width="500"/>
    - Example for RPG MZ
      <br/><img src="https://user-images.githubusercontent.com/99193603/155840462-028771ef-580c-4b45-969a-85f26329fef0.png" width="500"/>




## How to use
- Press `Ctrl + C` to toggle cheat window.
    - You can change shortcuts in "Shortcuts" tab.
    
    - If you do not hover your mouse over the cheat window, you may not be able to see it well because it is a little bit transparent. Note that it appears in the upper-right corner of the game window.
    
    - <img src="https://user-images.githubusercontent.com/99193603/153754676-cee2b96e-c03a-491f-b71c-3c57d6dcc474.JPG" width="400"/>
- Just enjoy cheat!



## Apply same cheat settings from another game

If you want to apply same shortcut keys, move speed, game speed, translation, etc... settings from another game,

Just copy the `www/cheat-settings` folder of the game that already has settings applied to the other game folder.



# Handling Errors 

## If embeded nwjs version of game is lower than 0.26.4

- Cheats may not work properly in older versions of the game since the script is based on es6.
- In that case, you need to force update to the new nwjs version.

1. Download latest version of [nwjs](https://dl.nwjs.io/v0.61.0/) and unzip. (`{version}/nwjs-symbol-v{version}-win-{ia32|x64}.7z`)
   - If you need developer tools, download the sdk version.
2. Copy `www` directory and `package.json` file from the game directory to nwjs directory.
   - <img src="https://user-images.githubusercontent.com/99193603/153755660-25da5b48-b542-443e-bd38-2e3e95e13a63.JPG" width="500"/>
3. Run `nw.exe` and play game.



> If the game does not work properly after the nwjs update, cheats cannot be applied to the game.
>
> - In this case, please use [another cheat](https://github.com/emerladCoder/RPG-Maker-MV-Cheat-Menu-Plugin).



## If the error occurs after updating the cheat

Settings files created from earlier versions of cheats may cause errors.

Delete the `www/cheat-settings` folder from the game folder.
