import { LAUNCHER_SETTINGS, LAUNCHER_POSITIONS } from '../js/LauncherSettings.js'
import { GLOBAL_SHORTCUT } from '../js/GlobalShortcut.js'

export default {
    name: 'LauncherSettingsPanel',
    template: `
<div class="cheat-settings-page">
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Launcher Position</h3><p>Choose where the launcher button appears on screen.</p></div>
        <div class="cheat-settings-controls">
            <label class="cheat-settings-field">
                <span>Position</span>
                <select class="cheat-number-input" v-model="position" @change="onChangePosition">
                    <option v-for="(pos, key) in positions" :key="key" :value="key">{{pos.label}}</option>
                </select>
            </label>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Appearance</h3><p>Customize how the launcher looks when the cheat console is closed.</p></div>
        <div class="cheat-settings-controls cheat-settings-checks">
            <label class="cheat-toggle">
                <input type="checkbox" v-model="compactMode" @change="onChangeCompactMode">
                <span class="cheat-control-copy"><strong>Compact mode</strong><span>Show only the icon, hide "Cheats" text and shortcut.</span></span>
            </label>
            <label class="cheat-toggle">
                <input type="checkbox" v-model="showShortcut" @change="onChangeShowShortcut">
                <span class="cheat-control-copy"><strong>Show shortcut hint</strong><span>Display the keyboard shortcut next to the launcher (hidden in compact mode).</span></span>
            </label>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Behavior when hidden</h3><p>How the launcher behaves when the cheat console is closed.</p></div>
        <div class="cheat-settings-controls cheat-settings-checks">
            <label class="cheat-toggle">
                <input type="checkbox" v-model="fadeWhenHidden" @change="onChangeFadeWhenHidden">
                <span class="cheat-control-copy"><strong>Fade when hidden</strong><span>Make the launcher semi-transparent when the console is closed.</span></span>
            </label>
            <template v-if="fadeWhenHidden">
                <label class="cheat-settings-field" style="margin-top: 8px; padding-left: 28px;">
                    <span>Fade opacity</span>
                    <input class="cheat-number-input" type="range" min="0" max="1" step="0.05" v-model.number="fadeOpacity" @change="onChangeFadeOpacity">
                    <output>{{(fadeOpacity * 100).toFixed(0)}}%</output>
                </label>
            </template>
            <label class="cheat-toggle">
                <input type="checkbox" v-model="autoHide" @change="onChangeAutoHide">
                <span class="cheat-control-copy"><strong>Auto-hide completely</strong><span>Hide the launcher entirely until you hover over its position.</span></span>
            </label>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Preview</h3><p>Current launcher appearance based on your settings.</p></div>
        <div class="cheat-settings-controls">
            <div class="cheat-launcher" :class="previewClasses" :style="previewStyle">
                <span class="cheat-launcher__symbol" aria-hidden="true">✦</span>
                <span v-if="!compactMode">Cheats</span>
                <kbd v-if="!compactMode && showShortcut">{{shortcutDisplay}}</kbd>
            </div>
        </div>
    </section>

    <div class="cheat-page-status" :role="'status'" aria-live="polite">{{statusMessage || 'Settings save when you change a control.'}}</div>
</div>`,

    data () {
        return {
            position: 'top-right',
            compactMode: false,
            fadeWhenHidden: true,
            fadeOpacity: 0.3,
            showShortcut: true,
            autoHide: false,
            statusMessage: '',
            positions: LAUNCHER_POSITIONS,
            shortcutDisplay: 'Ctrl + C'
        }
    },

    created () {
        this.initializeVariables()
    },

    computed: {
        previewStyle () {
            return LAUNCHER_SETTINGS.getPositionStyle()
        },
        previewClasses () {
            return {
                'cheat-launcher--compact': this.compactMode,
                'cheat-launcher--faded': this.fadeWhenHidden,
                'cheat-launcher--auto-hide': this.autoHide
            }
        }
    },

    methods: {
        initializeVariables () {
            this.position = LAUNCHER_SETTINGS.getPosition()
            this.compactMode = LAUNCHER_SETTINGS.isCompactMode()
            this.fadeWhenHidden = LAUNCHER_SETTINGS.isFadeWhenHidden()
            this.fadeOpacity = LAUNCHER_SETTINGS.getFadeOpacity()
            this.showShortcut = LAUNCHER_SETTINGS.isShowShortcut()
            this.autoHide = LAUNCHER_SETTINGS.isAutoHide()
            this.shortcutDisplay = GLOBAL_SHORTCUT.getShortcut('toggleCheatModal').asDisplayString()
        },

        onChangePosition () {
            LAUNCHER_SETTINGS.setPosition(this.position)
            this.statusMessage = 'Launcher position updated.'
        },

        onChangeCompactMode () {
            LAUNCHER_SETTINGS.setCompactMode(this.compactMode)
            this.statusMessage = this.compactMode ? 'Compact mode enabled.' : 'Compact mode disabled.'
        },

        onChangeShowShortcut () {
            LAUNCHER_SETTINGS.setShowShortcut(this.showShortcut)
            this.statusMessage = 'Shortcut display updated.'
        },

        onChangeFadeWhenHidden () {
            LAUNCHER_SETTINGS.setFadeWhenHidden(this.fadeWhenHidden)
            this.statusMessage = this.fadeWhenHidden ? 'Fade when hidden enabled.' : 'Fade when hidden disabled.'
        },

        onChangeFadeOpacity () {
            LAUNCHER_SETTINGS.setFadeOpacity(this.fadeOpacity)
            this.statusMessage = 'Fade opacity updated.'
        },

        onChangeAutoHide () {
            LAUNCHER_SETTINGS.setAutoHide(this.autoHide)
            this.statusMessage = this.autoHide ? 'Auto-hide enabled. Hover the launcher position to reveal it.' : 'Auto-hide disabled.'
        }
    }
}