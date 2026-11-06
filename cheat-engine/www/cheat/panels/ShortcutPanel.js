import VirtualList from '../components/VirtualList.js'
import { GLOBAL_SHORTCUT } from '../js/GlobalShortcut.js'
import { Key } from '../js/KeyCodes.js'

export default {
    name: 'ShortcutPanel',
    components: { VirtualList },
    template: `
<div class="cheat-data-page cheat-shortcuts-page">
    <div class="cheat-data-toolbar">
        <input class="cheat-search" type="search" v-model="search" aria-label="Search shortcuts"
            placeholder="Search actions or key bindings…" @input="onSearchChange">
        <span class="cheat-result-count">{{filteredShortcuts.length}} actions</span>
        <button type="button" class="cheat-button" @click="restoreToDefault">Restore defaults</button>
    </div>
    <div class="cheat-filter-row">
        <label class="cheat-key-filter">Filter by key
            <input class="cheat-key-input" readonly :value="shortcutSearch.asDisplayString()" placeholder="Press a key…"
                aria-label="Filter by shortcut" @keydown="onFilterKeydown">
        </label>
        <button v-if="!shortcutSearch.isEmpty()" type="button" class="cheat-button cheat-button--quiet" @click="clearKeyFilter">Clear key filter</button>
        <span class="cheat-control-help">Select a binding and press your new shortcut.</span>
    </div>
    <div v-if="errorMessage || statusMessage" class="cheat-list-status" :class="{'cheat-inline-error': !!errorMessage}"
        :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage}}</div>
    <section v-if="selectedShortcut" class="cheat-shortcut-inspector" :aria-label="'Options for ' + selectedShortcut.name">
        <div class="cheat-control-heading"><h3>{{selectedShortcut.name}} options</h3><button type="button" class="cheat-button cheat-button--quiet" @click="selectedId = null">Done</button></div>
        <div class="cheat-settings-fields">
            <label v-for="paramId in Object.keys(selectedShortcut.paramDesc)" :key="paramId" class="cheat-settings-field">
                <span>{{selectedShortcut.paramDesc[paramId].name}}</span>
                <input class="cheat-number-input" v-model="selectedShortcut.param[paramId].value" :aria-label="selectedShortcut.paramDesc[paramId].name"
                    @change="onParameterChange(selectedShortcut, paramId)">
                <small>{{selectedShortcut.paramDesc[paramId].desc}}</small>
            </label>
        </div>
    </section>
    <div class="cheat-shortcut-header" aria-hidden="true"><span>Action</span><span>Key binding</span><span>Options</span></div>
    <virtual-list ref="list" :items="filteredShortcuts" :item-height="80" label="Keyboard shortcuts"
        empty-message="No matching shortcuts. Clear the search or key filter.">
        <template v-slot:default="{item}">
            <div class="cheat-shortcut-row">
                <div class="cheat-row-copy"><span class="cheat-row-name">{{item.name}}</span><span class="cheat-row-meta">{{item.desc || (item.necessary ? 'Required to open the console.' : 'Customize this action.')}}</span></div>
                <div class="cheat-binding-control">
                    <input class="cheat-key-input" readonly :value="item.shortcut.asDisplayString()" placeholder="Not assigned"
                        :aria-label="'Shortcut for ' + item.name" @keydown="onBindingKeydown($event, item)">
                    <button type="button" class="cheat-icon-button" :disabled="item.necessary || item.shortcut.isEmpty()"
                        :aria-label="'Clear shortcut for ' + item.name" @click="setShortcut(Key.createEmpty(), item)">×</button>
                </div>
                <button v-if="Object.keys(item.paramDesc).length" type="button" class="cheat-button cheat-button--quiet"
                    :aria-label="'Options for ' + item.name" :aria-expanded="String(selectedId === item.id)"
                    @click="selectedId = selectedId === item.id ? null : item.id">Options</button>
                <span v-else class="cheat-row-meta">—</span>
            </div>
        </template>
    </virtual-list>
</div>`,

    data () {
        return { shortcuts: [], search: '', shortcutSearch: Key.createEmpty(), selectedId: null, errorMessage: '', statusMessage: '', Key }
    },
    created () { this.initializeVariables() },
    computed: {
        filteredShortcuts () {
            const query = this.search.trim().toLowerCase()
            return this.shortcuts.filter(item => (this.shortcutSearch.isEmpty() || item.shortcut.contains(this.shortcutSearch)) &&
                (!query || (item.name + ' ' + item.desc + ' ' + item.shortcut.asDisplayString()).toLowerCase().includes(query)))
        },
        selectedShortcut () { return this.shortcuts.find(item => item.id === this.selectedId) }
    },
    methods: {
        initializeVariables () {
            this.shortcuts = Object.keys(GLOBAL_SHORTCUT.shortcutConfig).map(id => {
                const config = GLOBAL_SHORTCUT.getConfig(id)
                const settings = GLOBAL_SHORTCUT.getSettings(id)
                const param = {}
                for (const key of Object.keys(settings.param || {})) param[key] = { value: settings.param[key] }
                return { id, name: config.name, desc: config.desc, necessary: config.necessary,
                    combiningKeyAlone: config.combiningKeyAlone, paramDesc: config.param || {},
                    shortcut: Key.fromKey(settings.shortcut), param }
            })
        },
        resetScroll () { if (this.$refs.list) this.$refs.list.resetScroll() },
        onSearchChange () { this.shortcutSearch = Key.createEmpty(); this.resetScroll() },
        clearKeyFilter () { this.shortcutSearch = Key.createEmpty(); this.resetScroll() },
        onFilterKeydown (event) {
            if (event.key === 'Tab') return
            event.preventDefault()
            event.stopPropagation()
            this.shortcutSearch = Key.fromEvent(event)
            this.search = ''
            this.resetScroll()
        },
        onBindingKeydown (event, item) {
            if (event.key === 'Tab') return
            event.preventDefault()
            event.stopPropagation()
            const key = Key.fromEvent(event)
            if (!item.combiningKeyAlone && key.isCombiningKey()) return
            this.setShortcut(key, item)
        },
        setShortcut (key, item) {
            try {
                GLOBAL_SHORTCUT.setShortcut(item.id, key)
                item.shortcut = Key.fromKey(GLOBAL_SHORTCUT.getShortcut(item.id))
                this.errorMessage = ''
                this.statusMessage = item.name + ' binding updated.'
            } catch (error) { this.errorMessage = error.message; this.statusMessage = '' }
        },
        onParameterChange (item, paramId) {
            try {
                GLOBAL_SHORTCUT.setParam(item.id, paramId, item.param[paramId].value)
                item.param[paramId].value = GLOBAL_SHORTCUT.getParam(item.id, paramId)
                this.errorMessage = ''
                this.statusMessage = item.name + ' options updated.'
            } catch (error) { this.errorMessage = error.message; this.statusMessage = '' }
        },
        restoreToDefault () {
            try {
                GLOBAL_SHORTCUT.restoreDefaultSettings()
                this.initializeVariables()
                this.errorMessage = ''
                this.statusMessage = 'Default bindings restored.'
            } catch (error) { this.errorMessage = error.message }
        }
    }
}
