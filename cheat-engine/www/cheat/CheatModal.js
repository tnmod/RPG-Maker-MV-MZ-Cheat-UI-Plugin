import PlayPanel from './panels/PlayPanel.js'
import RecorderPanel from './panels/RecorderPanel.js'
import GroupedToolsPanel from './components/GroupedToolsPanel.js'
import ItemTableTab from './panels/ItemTableTab.js'
import VariableSettingPanel from './panels/VariableSettingPanel.js'
import SwitchSettingPanel from './panels/SwitchSettingPanel.js'
import SaveRecallPanel from './panels/SaveRecallPanel.js'
import TeleportPanel from './panels/TeleportPanel.js'
import ShortcutPanel from './panels/ShortcutPanel.js'
import TranslateSettingsPanel from './panels/TranslateSettingsPanel.js'
import { KEY_VALUE_STORAGE } from './js/KeyValueStorage.js'
import { readSavedLocations } from './js/SavedLocations.js'

const navigationItems = [
    {
        name: 'General', component: 'general-panel', description: 'Gold, party, movement, combat and saves.',
        keywords: 'general play battle stats level exp health hp mp tp god mode speed no clip encounters attributes',
        aliases: ['play-panel', 'health-setting-panel', 'stats-setting-panel']
    },
    {
        name: 'Inventory', component: 'inventory-panel', keywords: 'equipment amount quantity',
        tools: [
            { name: 'Items', component: 'item-setting-panel', readItems: () => $dataItems, description: 'Find items and consumables.' },
            { name: 'Weapons', component: 'weapon-setting-panel', readItems: () => $dataWeapons, description: 'Browse weapons and swords.' },
            { name: 'Armor', component: 'armor-setting-panel', readItems: () => $dataArmors, description: 'Browse armor, shields and equipment.' }
        ]
    },
    {
        name: 'Travel', component: 'travel-panel', description: 'Save favorite locations or teleport to another map.',
        tools: [
            { name: 'Saved locations', component: 'save-recall-panel', view: SaveRecallPanel, description: 'Bookmark and recall locations.' },
            { name: 'All maps', component: 'teleport-panel', view: TeleportPanel, description: 'Teleport to a map and coordinates.' }
        ]
    },
    {
        name: 'Game data', component: 'game-data-panel', description: '',
        tools: [
            { name: 'Variables', component: 'variable-setting-panel', view: VariableSettingPanel, description: 'Edit variable values.' },
            { name: 'Switches', component: 'switch-setting-panel', view: SwitchSettingPanel, description: 'Turn switches and flags on or off.' }
        ]
    },
    {
        name: 'Recorder', component: 'recorder-panel', keywords: 'record changes tracking variables switches inventory gold money',
        fillHeight: true
    },
    {
        name: 'Settings', component: 'settings-panel', description: 'Customize keyboard shortcuts and translation.', titleScreen: true,
        tools: [
            { name: 'Shortcuts', component: 'shortcut-panel', view: ShortcutPanel, description: 'Customize keyboard shortcuts and key bindings.' },
            { name: 'Translation', component: 'translate-settings-panel', view: TranslateSettingsPanel, description: 'Configure a translation service.' }
        ]
    }
]

export default {
    name: 'CheatModal',

    components: {
        PlayPanel,
        RecorderPanel,
        ItemTableTab,
        GroupedToolsPanel
    },

    template: `
<section class="cheat-console" :class="{'cheat-console--maximized': maximized, 'cheat-console--hidden': !visible}"
    :aria-hidden="visible ? null : 'true'" role="dialog" aria-labelledby="cheat-console-title">
    <header class="cheat-console__header">
        <div class="cheat-console__brand">
            <span class="cheat-console__mark" aria-hidden="true">+</span>
            <h1 id="cheat-console-title">Cheat console</h1>
            <span class="cheat-engine-badge">{{engineName}}</span>
        </div>
        <button type="button" class="cheat-window-button" :aria-label="maximized ? 'Restore window' : 'Maximize console'"
            :title="maximized ? 'Restore window' : 'Maximize console'"
            :aria-pressed="String(maximized)" @click="toggleMaximized">
            <svg v-if="!maximized" width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 6V3h11v11h-3" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="6" width="11" height="11" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
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
                    <button v-for="item in filteredItems" :key="item.component" type="button"
                        class="cheat-nav-button" :class="{'is-active': activeItem.component === item.component, 'cheat-nav-button--settings': item.component === 'settings-panel'}"
                        :aria-current="activeItem.component === item.component ? 'page' : null"
                        @click="selectPanel(item.component)">
                        {{item.name}}
                    </button>
                <p v-if="!filteredItems.length" class="cheat-nav-empty" role="status">No tools found. Try another name.</p>
            </div>
        </nav>

        <div class="cheat-console__content" :class="{'cheat-console__content--workspace': activeItem.tools || activeItem.fillHeight}">
            <header class="cheat-section-header">
                <h2>{{activeItem.name}}</h2>
                <p v-if="activeItem.description">{{activeItem.description}}</p>
            </header>
            <div class="cheat-section-body">
                <template v-if="gameReady || activeItem.titleScreen">
                    <recorder-panel v-if="activeItem.component === 'recorder-panel'" :recorder="recorder" :can-edit="canEditRecording"
                        @start="$emit('start-recording')" @stop="$emit('stop-recording')"></recorder-panel>
                    <play-panel v-else-if="activeItem.component === 'general-panel'"></play-panel>
                    <item-table-tab v-else-if="inventoryTool" :items="inventoryTool.readItems() || []"
                        :categories="activeItem.tools" :category="inventoryTool.component"
                        @category-change="selectTool"></item-table-tab>
                    <grouped-tools-panel v-else-if="activeItem.tools" :key="activeItem.component"
                        :tools="activeTools" :active-component="currentComponentName" :label="activeItem.name"
                        @change="selectTool" @saved-locations-change="setSavedLocationCount"></grouped-tools-panel>
                </template>
                <div v-else class="cheat-empty-state" role="status">
                    <span class="cheat-empty-state__symbol" aria-hidden="true">◇</span>
                    <h3>Start your adventure first</h3>
                    <p>Start a new game or load a save to use {{activeItem.name.toLowerCase()}}. Settings are available now.</p>
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

    props: {
        currentComponentName: { type: String, default: 'general-panel' },
        visible: { type: Boolean, default: true },
        recorder: { type: Object, required: true },
        canEditRecording: { type: Function, required: true }
    },

    data () {
        return { search: '', gameReady: false, maximized: false, readinessTimer: null, navigationItems,
            lastToolByGroup: {}, savedLocationsEmpty: false }
    },

    computed: {
        activeItem () {
            return this.navigationItems.find(item => this.matchesRoute(item, this.currentComponentName)) || this.navigationItems[0]
        },

        inventoryTool () {
            if (this.activeItem.component !== 'inventory-panel') return null
            const tools = this.activeItem.tools
            return tools.find(tool => tool.component === this.currentComponentName) || tools[0]
        },

        activeTools () {
            const { component, tools } = this.activeItem
            return component === 'travel-panel' && this.savedLocationsEmpty ? tools.slice().reverse() : tools
        },

        filteredItems () {
            const query = this.search.trim().toLowerCase()
            if (!query) return this.navigationItems
            return this.navigationItems.filter(item => this.matchesSearch(item, query) ||
                (item.tools && item.tools.some(tool => this.matchesSearch(tool, query))))
        },

        engineName () {
            return typeof Utils !== 'undefined' ? Utils.RPGMAKER_NAME || 'RPG Maker' : 'RPG Maker'
        }
    },

    created () {
        this.refreshGameReady()
        if (!this.navigationItems.some(item => this.matchesRoute(item, this.currentComponentName))) {
            this.$emit('change', this.activeItem.component)
        }
    },

    watch: {
        visible (visible) {
            if (visible) this.refreshGameReady()
        },
        currentComponentName: {
            immediate: true,
            handler (component) { this.rememberTool(component) }
        }
    },

    mounted () {
        this.readinessTimer = setInterval(() => {
            if (this.visible) this.refreshGameReady()
        }, 500)
    },

    beforeDestroy () {
        clearInterval(this.readinessTimer)
    },

    methods: {
        toggleMaximized () {
            this.maximized = !this.maximized
            if (typeof ResizeObserver === 'undefined') {
                this.$nextTick(() => window.dispatchEvent(new Event('resize')))
            }
        },

        matchesRoute (item, component) {
            return item.component === component || (item.aliases && item.aliases.includes(component)) ||
                (item.tools && item.tools.some(tool => tool.component === component))
        },

        matchesSearch (item, query) {
            return (item.name + ' ' + (item.description || '') + ' ' + (item.keywords || '')).toLowerCase().includes(query)
        },

        rememberTool (component) {
            const item = this.navigationItems.find(item => item.tools && this.matchesRoute(item, component))
            if (!item) return
            if (item.component === 'travel-panel') this.refreshSavedLocationCount()
            if (item.component !== component) this.$set(this.lastToolByGroup, item.component, component)
        },

        setSavedLocationCount (count) {
            this.savedLocationsEmpty = count === 0
        },

        refreshSavedLocationCount () {
            try {
                this.setSavedLocationCount(readSavedLocations(KEY_VALUE_STORAGE).length)
            } catch (error) {
                this.savedLocationsEmpty = false
            }
        },

        selectPanel (component) {
            const item = this.navigationItems.find(item => item.component === component)
            if (item && item.tools) {
                const query = this.search.trim().toLowerCase()
                const match = query ? item.tools.find(tool => this.matchesSearch(tool, query)) : null
                if (component === 'travel-panel') this.refreshSavedLocationCount()
                const fallback = component === 'travel-panel' && this.savedLocationsEmpty ? 'teleport-panel' :
                    this.lastToolByGroup[component] || item.tools[0].component
                component = match ? match.component : fallback
            }
            this.$emit('change', component)
        },

        selectTool (component) {
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
