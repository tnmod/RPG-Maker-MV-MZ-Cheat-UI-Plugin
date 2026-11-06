"""Exercise the real desktop overlay against preview/mock-engine.js.

Run: python tests/ui_smoke.py
Needs: pip install playwright; python -m playwright install chromium
These checks do not claim compatibility with a real MV/MZ game or NW.js.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import threading
import unittest

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_args):
        pass


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 128


class ConsoleSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = PreviewServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        cls.server.daemon_threads = True
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1100, 'height': 800})
        self.page = self.context.new_page()
        self.errors = []
        self.remote_requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text) if message.type == 'error' else None)

        def offline(route):
            url = route.request.url
            if url.startswith(self.base + '/'):
                route.continue_()
            elif url.startswith('http://localhost:5000/translate'):
                # The optional translation settings panel probes its local server.
                route.fulfill(status=200, body='test', headers={'Access-Control-Allow-Origin': '*'})
            else:
                self.remote_requests.append(url)
                route.abort()

        self.page.route('**/*', offline)
        self.page.goto(self.base + '/preview/')
        try:
            expect(self.page.get_by_role('button', name='Open cheat console')).to_be_visible(timeout=15000)
        except AssertionError:
            print('Bootstrap diagnostics:', self.errors,
                  self.page.evaluate('window.__rpgCheatUiBootstrap && window.__rpgCheatUiBootstrap.status'))
            self.context.close()
            raise

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Browser runtime errors')
        self.assertEqual(self.remote_requests, [], 'The UI must not require remote assets')

    def open_console(self):
        self.page.get_by_role('button', name='Open cheat console').click()
        expect(self.page.get_by_role('dialog', name='Cheat console')).to_be_visible()

    def select(self, name):
        inventory_categories = {'Items': 'item-setting-panel', 'Weapons': 'weapon-setting-panel', 'Armor': 'armor-setting-panel'}
        tools = {
            'Locations': ('Travel', 'Saved locations'), 'Teleport': ('Travel', 'All maps'),
            'Variables': ('Game data', 'Variables'), 'Switches': ('Game data', 'Switches'),
            'Shortcuts': ('Settings', 'Shortcuts'), 'Translation': ('Settings', 'Translation')
        }
        group, tab = ('Inventory', None) if name in inventory_categories else tools.get(name, (name, None))
        self.page.locator('.cheat-nav-button').get_by_text(group, exact=True).click()
        expect(self.page.get_by_role('heading', name=group, exact=True)).to_be_visible()
        if name in inventory_categories:
            self.page.get_by_label('Inventory category').select_option(inventory_categories[name])
        elif tab:
            self.page.get_by_role('tab', name=tab, exact=True).click()
            expect(self.page.get_by_role('tabpanel', name=tab, exact=True)).to_be_visible()

    def open_play_group(self, group_id):
        self.select('Play')
        group = self.page.locator(f'details[data-play-group="{group_id}"]')
        if group.get_attribute('open') is None:
            group.locator('summary').click()
        expect(group.locator('.cheat-play-group__body')).to_be_visible()
        return group

    def test_find_tool_close_and_keyboard_reopen(self):
        self.open_console()
        search = self.page.get_by_label('Find a tool')
        search.fill('gold')
        expect(self.page.locator('.cheat-nav-button')).to_have_count(1)
        search.fill('does not exist')
        expect(self.page.get_by_text('No tools found. Try another name.')).to_be_visible()
        search.fill('')
        expect(self.page.locator('.cheat-nav-button')).to_have_count(6)
        self.page.keyboard.press('Escape')
        expect(self.page.locator('.cheat-console')).to_have_count(0)
        expect(self.page.get_by_role('button', name='Open cheat console')).to_be_focused()
        self.page.keyboard.press('Control+c')
        expect(self.page.locator('.cheat-console')).to_be_visible()
        expect(self.page.get_by_label('Find a tool')).to_be_focused()

    def test_grouped_navigation_search_tabs_keyboard_and_remembered_selection(self):
        self.open_console()
        nav = self.page.locator('.cheat-nav-button')
        expect(nav).to_have_text(['General', 'Inventory', 'Travel', 'Game data', 'Recorder', 'Settings'])
        search = self.page.get_by_label('Find a tool')
        search.fill('weapons')
        expect(nav).to_have_text(['Inventory'])
        nav.click()
        category = self.page.get_by_label('Inventory category')
        expect(category).to_have_value('weapon-setting-panel')
        self.assert_inventory_icon('Iron sword', 96)
        search.fill('')
        self.select('Play')
        self.select('Inventory')
        expect(category).to_have_value('weapon-setting-panel')
        self.select('Variables')
        self.page.get_by_role('tab', name='Variables', exact=True).press('ArrowRight')
        expect(self.page.get_by_role('tab', name='Switches', exact=True)).to_be_focused()
        self.select('Items')
        self.assert_inventory_icon('Healing potion', 64)
        shots = ROOT / 'work' / 'ui-smoke'
        shots.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(shots / 'navigation-inventory.png'))

    def test_legacy_tool_routes_and_location_shortcut_open_the_right_tabs(self):
        self.open_console()
        self.select('Teleport')
        self.page.get_by_role('tab', name='All maps', exact=True).focus()
        self.page.keyboard.press('Control+m')
        expect(self.page.get_by_role('tabpanel', name='Saved locations', exact=True)).to_be_visible()
        self.page.get_by_role('tab', name='Saved locations', exact=True).focus()
        self.page.keyboard.press('Control+m')
        expect(self.page.locator('.cheat-console')).to_have_count(0)
        self.page.keyboard.press('Control+m')
        expect(self.page.get_by_role('tabpanel', name='Saved locations', exact=True)).to_be_visible()
        self.page.evaluate("async () => { const {GeneralCheat} = await import('/cheat-engine/www/cheat/js/CheatHelper.js'); GeneralCheat.openCheatModal('weapon-setting-panel'); }")
        expect(self.page.get_by_role('heading', name='Inventory', exact=True)).to_be_visible()
        expect(self.page.get_by_label('Inventory category')).to_have_value('weapon-setting-panel')

    def test_travel_bookmarks_delete_and_recall_the_displayed_row_after_sort(self):
        self.open_console()
        self.select('Locations')
        alias = self.page.get_by_role('textbox', name='Location name', exact=True)
        for name, x, y in [('Zulu', 8, 6), ('Alpha', 12, 9), ('Gamma', 20, 6)]:
            self.page.evaluate('([x, y]) => $gamePlayer.setPosition(x, y)', [x, y])
            alias.fill(name)
            alias.press('Enter')
        self.page.get_by_label('Sort saved locations').select_option('name')
        self.page.get_by_role('button', name='Delete location Alpha', exact=True).click()
        expect(self.page.get_by_text('Alpha', exact=True)).to_have_count(0)
        expect(self.page.get_by_text('Zulu', exact=True)).to_be_visible()
        expect(self.page.get_by_text('Gamma', exact=True)).to_be_visible()
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('cheat.locations')).map(item => item.name)"), ['Zulu', 'Gamma'])
        self.page.get_by_role('button', name='Teleport to Zulu', exact=True).click()
        self.assertEqual(self.page.evaluate('[$gamePlayer.x, $gamePlayer.y]'), [8, 6])

    def test_gold_validates_and_applies_only_on_submit(self):
        self.open_console()
        amount = self.page.get_by_label('Set amount', exact=True)
        amount.fill('-1')
        self.page.get_by_role('button', name='Apply', exact=True).click()
        expect(self.page.get_by_role('alert')).to_have_text('Enter a whole number of zero or more.')
        self.assertEqual(self.page.evaluate('$gameParty.gold()'), 12500)
        amount.fill('100000000')
        self.page.get_by_role('button', name='Apply', exact=True).click()
        expect(self.page.get_by_role('alert')).to_contain_text('This game allows up to')
        amount.fill('23000')
        self.assertEqual(self.page.evaluate('$gameParty.gold()'), 12500)
        amount.press('Enter')
        expect(self.page.get_by_text('Gold updated to 23,000.')).to_be_visible()
        self.assertEqual(self.page.evaluate('$gameParty.gold()'), 23000)
        amount.press('Control+a')
        amount.press('Control+c')
        expect(self.page.locator('.cheat-console')).to_be_visible()

    def test_movement_speed_and_scope_controls(self):
        self.open_console()
        self.open_play_group('movement')
        self.page.get_by_role('checkbox', name=re.compile('Walk through walls')).check()
        self.assertTrue(self.page.evaluate('$gamePlayer._through'))
        movement = self.page.get_by_label('Move speed', exact=True)
        movement.focus()
        movement.press('ArrowRight')
        self.assertEqual(self.page.evaluate('$gamePlayer.moveSpeed()'), 4.5)
        speed = self.page.get_by_label('Speed multiplier')
        speed.focus()
        speed.press('ArrowRight')
        self.page.get_by_role('radio', name='Battles only').check()
        scope = self.page.evaluate("async () => { const {GameSpeedCheat:c} = await import('/cheat-engine/www/cheat/js/CheatHelper.js'); return c.getSceneOption() === c.sceneOptions().battle }")
        self.assertTrue(scope)
        self.page.get_by_role('button', name='Reset', exact=True).click()
        expect(speed).to_have_value('1')

    def test_play_groups_party_health_progress_and_attributes(self):
        self.open_console()
        nav = self.page.locator('.cheat-nav-button')
        expect(nav.get_by_text('Play', exact=True)).to_have_count(1)
        for old_name in ['General', 'Battle', 'Stats']:
            expect(nav.get_by_text(old_name, exact=True)).to_have_count(0)
        expect(self.page.locator('.cheat-play-group')).to_have_count(5)
        party = self.open_play_group('party')
        expect(party.get_by_label('Character', exact=True)).to_have_count(1)
        for label, value in [('HP', '120'), ('MP', '40'), ('TP', '55'), ('Level', '25'), ('Max HP', '650')]:
            field = party.get_by_label(label, exact=True)
            field.fill(value)
            field.press('Tab')
        self.assertEqual(self.page.evaluate('previewParty[0].hp'), 120)
        self.assertEqual(self.page.evaluate('previewParty[0].mp'), 40)
        self.assertEqual(self.page.evaluate('previewParty[0].tp'), 55)
        expect(party.get_by_label('EXP', exact=True)).to_have_value('2500')
        self.assertEqual(self.page.evaluate('previewParty[0].param(0)'), 650)
        god_mode = party.get_by_role('checkbox', name=re.compile('God mode'))
        god_mode.check()
        expect(party.get_by_text('God mode enabled.', exact=True)).to_be_visible()
        god_mode.uncheck()
        expect(party.get_by_text('God mode disabled.', exact=True)).to_be_visible()
        party.get_by_role('button', name='Recover party', exact=True).click()
        expect(party.get_by_label('HP', exact=True)).to_have_value('650')
        self.page.evaluate('previewParty[0].setHp(80)')
        self.page.get_by_role('button', name='Refresh values', exact=True).click()
        expect(party.get_by_label('HP', exact=True)).to_have_value('80')

    def test_play_combat_controls_track_battle_and_keep_party_separate(self):
        self.open_console()
        combat = self.open_play_group('combat')
        expect(combat.get_by_role('button', name='Force victory', exact=True)).to_be_disabled()
        expect(combat.get_by_label('Character', exact=True)).to_have_count(0)
        toggle = combat.get_by_role('checkbox', name=re.compile('Disable random encounters'))
        toggle.check()
        expect(combat.get_by_role('button', name='Trigger encounter', exact=True)).to_be_disabled()
        toggle.uncheck()
        self.page.evaluate('previewStartBattle()')
        expect(combat.get_by_role('button', name='Force victory', exact=True)).to_be_enabled()
        hp = combat.get_by_role('spinbutton', name='Slime HP', exact=True)
        hp.fill('15')
        hp.press('Tab')
        self.assertEqual(self.page.evaluate('previewEnemies[0].hp'), 15)
        combat.get_by_role('button', name='Force victory', exact=True).click()
        expect(combat.get_by_role('button', name='Force victory', exact=True)).to_be_disabled()
        expect(combat.get_by_role('spinbutton', name='Slime HP', exact=True)).to_have_count(0)

    def test_all_existing_tools_render_and_inventory_search_matches(self):
        self.open_console()
        for name in ['Play', 'Items', 'Weapons', 'Armor', 'Variables',
                     'Switches', 'Locations', 'Teleport', 'Shortcuts', 'Translation']:
            with self.subTest(panel=name):
                self.select(name)
        self.select('Items')
        self.page.get_by_label('Search inventory').fill('Ether')
        expect(self.page.get_by_text('Ether', exact=True)).to_be_visible()
        expect(self.page.get_by_text('Healing potion', exact=True)).to_have_count(0)

    def test_title_screen_guard_and_game_readiness(self):
        self.page.evaluate('SceneManager._scene = new Scene_Title()')
        self.open_console()
        expect(self.page.get_by_text('Start your adventure first')).to_be_visible()
        self.select('Shortcuts')
        expect(self.page.get_by_text('Start your adventure first')).to_have_count(0)
        self.select('Play')
        self.page.evaluate('SceneManager._scene = new Scene_Map()')
        expect(self.page.get_by_label('Set amount', exact=True)).to_be_visible()

    def test_mv_fixture_uses_the_same_console(self):
        self.page.goto(self.base + '/preview/?engine=MV')
        self.open_console()
        expect(self.page.locator('.cheat-engine-badge')).to_have_text('MV')
        self.open_play_group('movement')
        self.page.get_by_role('checkbox', name=re.compile('Walk through walls')).check()
        self.assertTrue(self.page.evaluate('$gamePlayer._through'))

    def assert_inventory_icon(self, name, index):
        row = self.page.get_by_role('listitem').filter(has=self.page.get_by_text(name, exact=True))
        canvas = row.locator('.cheat-game-icon canvas')
        expect(canvas).to_be_visible()
        self.assertTrue(canvas.evaluate('''(canvas, index) => {
            const sheet = ImageManager.loadSystem('IconSet')._canvas;
            const expected = document.createElement('canvas');
            expected.width = expected.height = 32;
            expected.getContext('2d').drawImage(sheet, (index % 16) * 32,
                Math.floor(index / 16) * 32, 32, 32, 0, 0, 32, 32);
            const pixels = canvas.getContext('2d').getImageData(0, 0, 32, 32).data;
            return pixels.some(value => value !== 0) && canvas.toDataURL() === expected.toDataURL();
        }''', index))

    def test_inventory_icons_follow_names_through_search_sort_and_scroll(self):
        self.page.goto(self.base + '/preview/?records=0')
        self.open_console()
        self.select('Items')
        self.assert_inventory_icon('Healing potion', 64)
        self.assert_inventory_icon('Ether', 65)
        search = self.page.get_by_label('Search inventory')
        search.fill('Ether')
        self.assert_inventory_icon('Ether', 65)
        search.fill('')
        self.page.get_by_label('Sort inventory').select_option('name')
        self.assert_inventory_icon('Antidote', 66)
        self.assert_inventory_icon('Ether', 65)
        row = self.page.get_by_role('listitem').filter(has=self.page.get_by_text('Sealed note', exact=True))
        expect(row.locator('.cheat-game-icon__placeholder')).to_be_visible()
        expect(row.get_by_text('Sealed note', exact=True)).to_be_visible()
        self.page.get_by_role('list', name='Inventory entries').press('End')
        self.assert_inventory_icon('Tonic', 69)
        self.select('Weapons')
        self.assert_inventory_icon('Iron sword', 96)
        self.select('Armor')
        self.assert_inventory_icon('Traveler cloak', 128)

    def test_inventory_icons_use_mv_dimensions_and_keep_narrow_layout(self):
        self.page.goto(self.base + '/preview/?engine=MV')
        self.page.set_viewport_size({'width': 360, 'height': 640})
        self.open_console()
        self.select('Weapons')
        self.assert_inventory_icon('Iron sword', 96)
        self.assertTrue(self.page.locator('.cheat-console').evaluate('(e) => e.scrollWidth <= e.clientWidth'))

    def test_virtual_inventory_scrolls_ten_thousand_entries_and_commits_recycled_edits(self):
        self.page.goto(self.base + '/preview/?records=10000')
        self.open_console()
        self.select('Items')
        rows = self.page.get_by_role('list', name='Inventory entries')
        editor = self.page.get_by_label('Amount for Healing potion', exact=True)
        editor.fill('17')
        toolbar_top = self.page.get_by_label('Search inventory').bounding_box()['y']
        rows.evaluate('(list) => { list.scrollTop = list.scrollHeight; }')
        last = rows.locator('[data-virtual-index="9999"]')
        expect(last).to_be_in_viewport()
        expect(last).to_contain_text('Alchemy reagent 10002')
        self.assertLess(rows.locator('[data-virtual-index]').count(), 30)
        self.assertEqual(self.page.evaluate('$gameParty.numItems($dataItems[1])'), 17)
        self.assertEqual(self.page.get_by_label('Search inventory').bounding_box()['y'], toolbar_top)
        self.page.get_by_label('Search inventory').fill('healing potion')
        expect(rows.locator('[data-virtual-index="0"]')).to_be_in_viewport()
        expect(editor).to_have_value('17')
        self.assertEqual(rows.evaluate('(list) => list.scrollTop'), 0)

    def test_large_game_data_and_maps_scroll_then_edit_the_correct_record(self):
        self.page.goto(self.base + '/preview/?records=10000')
        self.open_console()
        for tool, name in [('Variables', 'Game variables'), ('Switches', 'Game switches'), ('Teleport', 'Maps')]:
            with self.subTest(tool=tool):
                self.select(tool)
                rows = self.page.get_by_role('list', name=name, exact=True)
                expect(rows.locator('[data-virtual-index="0"]')).to_be_in_viewport()
                rows.press('End')
                expect(rows.locator('[data-virtual-index="9999"]')).to_be_in_viewport()
                self.assertLess(rows.locator('[data-virtual-index]').count(), 30)
                if tool == 'Variables':
                    field = self.page.get_by_label('Value for Quest marker 10000', exact=True)
                    field.fill('752')
                    field.press('Enter')
                    self.assertEqual(self.page.evaluate('$gameVariables.value(10000)'), 752)
                    self.page.get_by_label('Search variables', exact=True).fill('#5')
                    expect(self.page.get_by_text('Quest marker 00005', exact=True)).to_be_in_viewport()
                elif tool == 'Switches':
                    toggle = self.page.get_by_role('switch', name='Switch World flag 10000', exact=True)
                    toggle.click()
                    expect(toggle).to_have_attribute('aria-checked', 'false')
                else:
                    self.page.get_by_label('X', exact=True).fill('8')
                    self.page.get_by_label('Y', exact=True).fill('11')
                    self.page.get_by_role('button', name='Teleport to Region checkpoint 10000', exact=True).click()
                    self.assertEqual(self.page.evaluate('$gamePlayer._reservedTransfer'), {'mapId': 10000, 'x': 8, 'y': 11, 'direction': 2})

    def test_workspace_maximize_keeps_controls_and_scroll_region_in_view(self):
        self.open_console()
        self.select('Items')
        console = self.page.get_by_role('dialog', name='Cheat console')
        rows = self.page.get_by_role('list', name='Inventory entries')
        restored_height = rows.bounding_box()['height']
        self.page.get_by_role('button', name='Maximize console').click()
        self.assertEqual(console.bounding_box(), {'x': 0, 'y': 0, 'width': 1100, 'height': 800})
        self.assertGreater(rows.bounding_box()['height'], restored_height)
        self.page.get_by_role('button', name='Restore window').click()
        for width, height in [(816, 624), (360, 640)]:
            self.page.set_viewport_size({'width': width, 'height': height})
            self.assertGreater(rows.bounding_box()['height'], 110)
            self.assertTrue(console.evaluate('(e) => e.scrollWidth <= e.clientWidth'))
            expect(self.page.get_by_label('Search inventory')).to_be_in_viewport()
            rows.press('PageDown')
            self.page.wait_for_function("document.querySelector('.cheat-virtual-list').scrollTop > 0")
        self.page.set_viewport_size({'width': 340, 'height': 400})
        self.page.get_by_role('button', name='Maximize console').click()
        self.assertGreaterEqual(rows.bounding_box()['height'], 124)
        rows.scroll_into_view_if_needed()
        rows.press('Home')
        expect(rows.locator('[data-virtual-index="0"]')).to_be_in_viewport()

    def test_filtered_switch_confirmation_updates_only_matching_records(self):
        self.open_console()
        self.select('Switches')
        self.page.get_by_label('Search switches', exact=True).fill('Arena registered')
        expect(self.page.get_by_role('switch', name='Switch Arena registered')).to_be_visible()
        expect(self.page.get_by_role('switch', name='Switch Gate unlocked')).to_have_count(0)
        self.page.get_by_role('button', name='Change filtered switches').click()
        expect(self.page.get_by_text('Turn on 1 filtered switch?')).to_be_visible()
        self.page.get_by_role('button', name='Turn on', exact=True).click()
        expect(self.page.get_by_role('switch', name='Switch Arena registered')).to_have_attribute('aria-checked', 'true')
        self.assertEqual(self.page.evaluate('[$gameSwitches.value(1), $gameSwitches.value(2), $gameSwitches.value(5)]'), [True, True, 0])

    def test_shortcut_binding_and_translation_settings_work_in_new_layout(self):
        self.open_console()
        self.select('Shortcuts')
        self.page.get_by_label('Search shortcuts').fill('toggle cheat window')
        binding = self.page.get_by_label('Shortcut for Toggle cheat window', exact=True)
        binding.press('Control+j')
        expect(binding).to_have_value('Ctrl + J')
        self.page.get_by_role('button', name='Restore defaults').click()
        expect(binding).to_have_value('Ctrl + C')
        self.select('Translation')
        self.page.get_by_role('button', name='Test connection').click()
        expect(self.page.get_by_text('Service connected.', exact=True)).to_be_visible()
        batch = self.page.get_by_label('Names per request', exact=False)
        batch.fill('2001')
        batch.press('Tab')
        expect(self.page.get_by_role('alert')).to_contain_text('between 1 and 2,000')

    def test_overlay_input_stays_out_of_game_and_game_area_works(self):
        self.open_console()
        self.page.evaluate('previewEvents.keys = previewEvents.clicks = previewEvents.wheel = 0')
        amount = self.page.get_by_label('Set amount', exact=True)
        amount.fill('42')
        amount.press('ArrowLeft')
        self.page.get_by_role('button', name='Apply', exact=True).click()
        self.page.locator('.cheat-console__content').hover()
        self.page.mouse.wheel(0, 200)
        self.assertEqual(self.page.evaluate('previewEvents'), {'keys': 0, 'clicks': 0, 'wheel': 0})
        self.page.mouse.click(8, 780)
        self.assertEqual(self.page.evaluate('previewEvents.clicks'), 1)

    def test_layout_fits_game_and_narrow_windows(self):
        self.open_console()
        shots = ROOT / 'work' / 'ui-smoke'
        shots.mkdir(parents=True, exist_ok=True)
        for width, height, label in [(1100, 800, 'desktop'), (816, 624, 'game-window'), (360, 640, 'narrow')]:
            with self.subTest(viewport=label):
                self.page.set_viewport_size({'width': width, 'height': height})
                shell = self.page.locator('.cheat-console')
                rect = shell.bounding_box()
                self.assertGreaterEqual(rect['x'], 0)
                self.assertGreaterEqual(rect['y'], 0)
                self.assertLessEqual(rect['x'] + rect['width'], width)
                self.assertLessEqual(rect['y'] + rect['height'], height)
                self.assertTrue(shell.evaluate('(e) => e.scrollWidth <= e.clientWidth'))
                expect(self.page.get_by_role('button', name='Close cheat console')).to_be_in_viewport()
                self.page.screenshot(path=str(shots / (label + '.png')))


if __name__ == '__main__':
    unittest.main(verbosity=2)
