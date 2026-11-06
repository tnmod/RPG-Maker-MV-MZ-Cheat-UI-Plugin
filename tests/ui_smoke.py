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
    def log_message(self, *_args):
        pass


class ConsoleSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
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
        expect(self.page.get_by_role('button', name='Open cheat console')).to_be_visible()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Browser runtime errors')
        self.assertEqual(self.remote_requests, [], 'The UI must not require remote assets')

    def open_console(self):
        self.page.get_by_role('button', name='Open cheat console').click()
        expect(self.page.get_by_role('dialog', name='Cheat console')).to_be_visible()

    def select(self, name):
        self.page.locator('.cheat-nav-button').get_by_text(name, exact=True).click()
        expect(self.page.get_by_role('heading', name=name, exact=True)).to_be_visible()

    def test_find_tool_close_and_keyboard_reopen(self):
        self.open_console()
        search = self.page.get_by_label('Find a tool')
        search.fill('gold')
        expect(self.page.locator('.cheat-nav-button')).to_have_count(1)
        search.fill('does not exist')
        expect(self.page.get_by_text('No tools found. Try another name.')).to_be_visible()
        search.fill('')
        expect(self.page.locator('.cheat-nav-button')).to_have_count(12)
        self.page.keyboard.press('Escape')
        expect(self.page.locator('.cheat-console')).to_have_count(0)
        expect(self.page.get_by_role('button', name='Open cheat console')).to_be_focused()
        self.page.keyboard.press('Control+c')
        expect(self.page.locator('.cheat-console')).to_be_visible()
        expect(self.page.get_by_label('Find a tool')).to_be_focused()

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

    def test_all_existing_tools_render_and_detached_menu_dismisses(self):
        self.open_console()
        for name in ['Battle', 'Stats', 'Items', 'Weapons', 'Armor', 'Variables',
                     'Switches', 'Locations', 'Teleport', 'Shortcuts', 'Translation']:
            with self.subTest(panel=name):
                self.select(name)
        self.select('Items')
        self.page.locator('.cheat-section-body input').first.fill('Ether')
        expect(self.page.get_by_role('cell', name='Ether', exact=True)).to_be_visible()
        expect(self.page.get_by_role('cell', name='Healing potion', exact=True)).to_have_count(0)
        self.page.locator('.v-data-footer__select .v-input').click()
        menu = self.page.locator('.v-menu__content.menuable__content__active')
        expect(menu).to_be_visible()
        self.page.keyboard.press('Escape')
        expect(menu).to_have_count(0)
        expect(self.page.locator('.cheat-console')).to_be_visible()

    def test_title_screen_guard_and_game_readiness(self):
        self.page.evaluate('SceneManager._scene = new Scene_Title()')
        self.open_console()
        expect(self.page.get_by_text('Start your adventure first')).to_be_visible()
        self.select('Shortcuts')
        expect(self.page.get_by_text('Start your adventure first')).to_have_count(0)
        self.select('General')
        self.page.evaluate('SceneManager._scene = new Scene_Map()')
        expect(self.page.get_by_label('Set amount', exact=True)).to_be_visible()

    def test_mv_fixture_uses_the_same_console(self):
        self.page.goto(self.base + '/preview/?engine=MV')
        self.open_console()
        expect(self.page.locator('.cheat-engine-badge')).to_have_text('MV')
        self.page.get_by_role('checkbox', name=re.compile('Walk through walls')).check()
        self.assertTrue(self.page.evaluate('$gamePlayer._through'))

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
