import GeneralPanel from './panels/GeneralPanel.js'
import HealthSettingPanel from './panels/HealthSettingPanel.js'
import StatsSettingPanel from './panels/StatsSettingPanel.js'
import ItemSettingPanel from './panels/ItemSettingPanel.js'
import WeaponSettingPanel from './panels/WeaponSettingPanel.js'
import ArmorSettingPanel from './panels/ArmorSettingPanel.js'
import VariableSettingPanel from './panels/VariableSettingPanel.js'
import SwitchSettingPanel from './panels/SwitchSettingPanel.js'
import SaveRecallPanel from './panels/SaveRecallPanel.js'
import TeleportPanel from './panels/TeleportPanel.js'
import ShortcutPanel from './panels/ShortcutPanel.js'
import TranslateSettingsPanel from './panels/TranslateSettingsPanel.js'

const navigationGroups = [
    {
        name: 'Play',
        items: [
            { name: 'General', component: 'general-panel', description: 'Gold, movement and game speed.' },
            { name: 'Battle', component: 'health-setting-panel', description: 'Manage encounters and party or enemy health.' },
            { name: 'Stats', component: 'stats-setting-panel', description: 'Adjust character levels and attributes.' }
        ]
    },
    {
        name: 'Inventory',
        items: [
            { name: 'Items', component: 'item-setting-panel', description: 'Find items and change the amount you carry.' },
            { name: 'Weapons', component: 'weapon-setting-panel', description: 'Browse weapons and add them to your inventory.' },
            { name: 'Armor', component: 'armor-setting-panel', description: 'Browse armor and add it to your inventory.' }
        ]
    },
    {
        name: 'World',
        items: [
            { name: 'Variables', component: 'variable-setting-panel', description: 'Find and edit game variables.' },
            { name: 'Switches', component: 'switch-setting-panel', description: 'Find game switches and turn them on or off.' },
            { name: 'Locations', component: 'save-recall-panel', description: 'Bookmark your position and return to saved locations.' },
            { name: 'Teleport', component: 'teleport-panel', description: 'Choose a map and move to a new position.' }
        ]
    },
    {
        name: 'Preferences',
        items: [
            { name: 'Shortcuts', component: 'shortcut-panel', description: 'Choose keyboard shortcuts for your cheat tools.', titleScreen: true },
            { name: 'Translation', component: 'translate-settings-panel', description: 'Configure the translation service for game data.', titleScreen: true }
        ]
    }
]

export default {
    name: 'CheatModal',

    components: {
        GeneralPanel,
        HealthSettingPanel,
        StatsSettingPanel,
        ItemSettingPanel,
        WeaponSettingPanel,
        ArmorSettingPanel,
        VariableSettingPanel,
        SwitchSettingPanel,
        SaveRecallPanel,
        TeleportPanel,
        ShortcutPanel,
        TranslateSettingsPanel
    },

    template: `
<section class="cheat-console" role="dialog" aria-labelledby="cheat-console-title">
    <header class="cheat-console__header">
        <div class="cheat-console__brand">
            <span class="cheat-console__mark" aria-hidden="true">+</span>
            <h1 id="cheat-console-title">Cheat console</h1>
            <span class="cheat-engine-badge">{{engineName}}</span>
        </div>
        <button type="button" class="cheat-close-button" aria-label="Close cheat console" @click="$emit('close')">
            <span aria-hidden="true">×</span>
        </button>
    </header>

    <div class="cheat-console__body">
        <nav class="cheat-console__sidebar" aria-label="Cheat tools">
            <div class="cheat-nav-search">
                <label for="cheat-tool-search">Find a tool</label>
                <input id="cheat-tool-search" v-model="search" type="search" placeholder="Search tools…" autocomplete="off" @keydown.stop @keyup.stop>
            </div>
            <div class="cheat-nav-groups">
                <section v-for="group in filteredGroups" :key="group.name" class="cheat-nav-group">
                    <h2 class="cheat-nav-group__title">{{group.name}}</h2>
                    <button v-for="item in group.items" :key="item.component" type="button"
                        class="cheat-nav-button" :class="{'is-active': activeItem.component === item.component}"
                        :aria-current="activeItem.component === item.component ? 'page' : null"
                        @click="selectPanel(item.component)">
                        {{item.name}}
                    </button>
                </section>
                <p v-if="!filteredGroups.length" class="cheat-nav-empty" role="status">No tools found. Try another name.</p>
            </div>
        </nav>

        <div class="cheat-console__content">
            <header class="cheat-section-header">
                <h2>{{activeItem.name}}</h2>
                <p>{{activeItem.description}}</p>
            </header>
            <div class="cheat-section-body">
                <component v-if="gameReady || activeItem.titleScreen" :is="activeItem.component"></component>
                <div v-else class="cheat-empty-state" role="status">
                    <span class="cheat-empty-state__symbol" aria-hidden="true">◇</span>
                    <h3>Start your adventure first</h3>
                    <p>Start a new game or load a save to use {{activeItem.name.toLowerCase()}}. Shortcuts and Translation are available now.</p>
                </div>
            </div>
        </div>
    </div>

    <footer class="cheat-console__footer">
        <span class="cheat-session-state"><span class="cheat-state-dot" :class="{'is-ready': gameReady}" aria-hidden="true"></span>{{gameReady ? 'Game connected' : 'Waiting for a game'}}</span>
        <span>Esc to close · Changes apply to the current game</span>
    </footer>
</section>`,

    model: { prop: 'currentComponentName', event: 'change' },

    props: { currentComponentName: { type: String, default: 'general-panel' } },

    data () {
        return { search: '', gameReady: false, readinessTimer: null, navigationGroups }
    },

    computed: {
        activeItem () {
            for (const group of this.navigationGroups) {
                const item = group.items.find(item => item.component === this.currentComponentName)
                if (item) return item
            }
            return this.navigationGroups[0].items[0]
        },

        filteredGroups () {
            const query = this.search.trim().toLowerCase()
            if (!query) return this.navigationGroups
            return this.navigationGroups.map(group => ({
                name: group.name,
                items: group.items.filter(item => (group.name + ' ' + item.name + ' ' + item.description).toLowerCase().includes(query))
            })).filter(group => group.items.length)
        },

        engineName () {
            return typeof Utils !== 'undefined' ? Utils.RPGMAKER_NAME || 'RPG Maker' : 'RPG Maker'
        }
    },

    created () {
        this.refreshGameReady()
        if (this.currentComponentName !== this.activeItem.component) {
            this.$emit('change', this.activeItem.component)
        }
    },

    mounted () {
        this.readinessTimer = setInterval(this.refreshGameReady, 500)
    },

    beforeDestroy () {
        clearInterval(this.readinessTimer)
    },

    methods: {
        selectPanel (component) {
            this.$emit('change', component)
        },

        refreshGameReady () {
            const scene = typeof SceneManager !== 'undefined' ? SceneManager._scene : null
            const onTitle = typeof Scene_Title !== 'undefined' && scene instanceof Scene_Title
            const booting = typeof Scene_Boot !== 'undefined' && scene instanceof Scene_Boot
            this.gameReady = !onTitle && !booting &&
                typeof $gameParty !== 'undefined' && !!$gameParty &&
                typeof $gamePlayer !== 'undefined' && !!$gamePlayer
        }
    }
}
