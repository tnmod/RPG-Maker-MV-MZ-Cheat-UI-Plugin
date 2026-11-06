# Cheat UI preview

This page loads the actual cheat components with a small mock RPG Maker engine. It provides sample gold, inventory, actors, switches, variables and map data for reviewing the interface. It does not launch an installed game or read or write real game saves.

## Run

Start a local server from the repository root:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Open [http://127.0.0.1:8765/preview/](http://127.0.0.1:8765/preview/). Open **Cheats** using the launcher or **Ctrl+C**. Close the console using its close button or **Esc**. If a nested dialog is open, close that dialog first.

The default fixture uses an MZ label. Add `?engine=MV` to use the MV label and fixture branch. Use `?records=10000` to try long inventory, game-data and map lists.

## Review

- Search navigation by a tool name or description, then select a result.
- Use the Inventory category selector for Items, Weapons or Armor. Use tabs in Travel, Game data and Settings.
- Open **Play** to use Gold, Party, Movement & speed, Combat, and Save & session groups.
- Change gold, select **Apply**, and try an invalid amount to see validation feedback.
- Adjust movement and game speed, and switch between the other tool panels.
- Resize the browser window to check the compact console layout.
- Select **Maximize console** to fill the window. Scroll lists with the wheel, Page Up, Page Down, Home, or End while the list has focus.
- Type and scroll inside the console, then click or use keys outside it to check input boundaries.

All required UI styles, JavaScript libraries and icon fonts are served from the repository. No CDN connection is needed. Some optional translation tools still require a separately configured translation service.

## Automated checks

From the repository root:

```sh
node --test tests/*.test.mjs
```

For the browser smoke test, install Python Playwright and its Chromium browser once:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/ui_smoke.py
```

The mock and browser checks verify UI behavior only. They cannot establish compatibility with NW.js file access, real save/load operations, game-specific plugins, ModLoader startup, or older embedded Chromium versions. Actual game integration remains untested in this UI pass.
