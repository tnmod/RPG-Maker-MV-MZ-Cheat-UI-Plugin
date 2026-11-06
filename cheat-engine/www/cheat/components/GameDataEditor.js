import VirtualList from './VirtualList.js'
import { TRANSLATE_SETTINGS, TRANSLATOR } from '../js/TranslateHelper.js'
import { ConfirmDialog } from '../js/DialogHelper.js'

export default {
    name: 'GameDataEditor',
    components: { VirtualList },
    props: { kind: { type: String, default: 'variables' } },

    template: `
<div class="cheat-data-page cheat-game-data-editor">
    <div class="cheat-data-toolbar">
        <input class="cheat-search" type="search" v-model="search" :aria-label="searchLabel"
            :placeholder="searchLabel + ' by name, ID or value'" autocomplete="off" @keydown.stop @keyup.stop>
        <span class="cheat-result-count" aria-live="polite">{{filteredItems.length.toLocaleString()}} / {{items.length.toLocaleString()}}</span>
        <button type="button" class="cheat-button" :disabled="loading" @click="initializeVariables">Refresh</button>
    </div>
    <div class="cheat-filter-row">
        <label class="cheat-toggle"><input type="checkbox" v-model="hideUnnamed"><span>Hide unnamed</span></label>
        <span class="cheat-control-help">{{isSwitches ? 'Switches apply immediately.' : 'Press Enter or leave a value to apply it.'}}</span>
        <button v-if="isSwitches" type="button" class="cheat-button cheat-button--quiet cheat-bulk-switches"
            :disabled="loading || !filteredItems.length" @click="confirmFilteredSwitches">Change filtered switches</button>
    </div>
    <div v-if="errorMessage || statusMessage" class="cheat-list-status" :class="{'cheat-inline-error': errorMessage}" :id="statusId"
        :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage}}</div>
    <div class="cheat-state-header" aria-hidden="true"><span>Name</span><span>{{isSwitches ? 'State' : 'Value'}}</span></div>
    <virtual-list ref="list" :items="filteredItems" :item-height="64" item-key="id" :label="isSwitches ? 'Game switches' : 'Game variables'"
        :empty-message="loading ? 'Loading game data…' : 'No matching ' + kind + '. Try another name or ID.'">
        <template v-slot:default="{item}">
            <div class="cheat-state-row" :data-record-id="item.id">
                <div class="cheat-row-title">
                    <span class="cheat-record-name" :title="item.name">{{item.name || 'Unnamed ' + singularName}}</span>
                    <span class="cheat-row-meta">#{{item.id}}<span v-if="!isSwitches"> · {{item.type}}</span></span>
                </div>
                <button v-if="isSwitches" type="button" class="cheat-switch" :class="{'is-on': item.value}"
                    role="switch" :aria-checked="String(item.value)" :aria-label="'Switch ' + (item.name || '#' + item.id)"
                    @click="toggleSwitch(item)"><span class="cheat-switch__track" aria-hidden="true"></span>{{item.value ? 'On' : 'Off'}}</button>
                <input v-else-if="!item.readOnly" class="cheat-row-number cheat-row-value" :type="item.type === 'number' ? 'number' : 'text'"
                    step="any" v-model="item.draft" :aria-label="'Value for ' + (item.name || '#' + item.id)"
                    :aria-invalid="invalidId === item.id ? 'true' : 'false'" :aria-describedby="invalidId === item.id ? statusId : null"
                    @change="commitVariable(item)" @keydown.enter.prevent.stop="commitVariable(item)" @keydown.stop @keyup.stop>
                <span v-else class="cheat-value-preview" :title="item.preview + ' (read only)'">{{item.preview}}<small>Read only</small></span>
            </div>
        </template>
    </virtual-list>
</div>`,

    data () {
        return {
            search: '', query: '', hideUnnamed: false, items: [], loading: false,
            errorMessage: '', statusMessage: '', invalidId: null
        }
    },

    computed: {
        isSwitches () { return this.kind === 'switches' },
        singularName () { return this.isSwitches ? 'switch' : 'variable' },
        searchLabel () { return this.isSwitches ? 'Search switches' : 'Search variables' },
        statusId () { return 'cheat-' + this.kind + '-status' },
        filteredItems () {
            const query = this.query.trim().toLowerCase()
            const exactId = /^#\d+$/.test(query) ? Number(query.slice(1)) : null
            return this.items.filter(item => (!this.hideUnnamed || item.name.trim()) &&
                (!query || (exactId !== null ? item.id === exactId : item.searchText.includes(query))))
        }
    },

    watch: {
        search (value) {
            clearTimeout(this._searchTimer)
            this._searchTimer = setTimeout(() => { this.query = value }, 100)
        },
        query () { this.resetListScroll() },
        hideUnnamed () { this.resetListScroll() },
        kind () { this.initializeVariables() }
    },

    created () { this.initializeVariables() },
    beforeDestroy () {
        this._dataRequest = null
        clearTimeout(this._searchTimer)
    },

    methods: {
        confirmFilteredSwitches () {
            if (!this.isSwitches || this.loading || !this.filteredItems.length) return
            const matches = this.filteredItems.slice()
            const store = this.store()
            const value = matches.some(item => !store.value(item.id))
            const action = value ? 'Turn on' : 'Turn off'
            const count = matches.length.toLocaleString()
            const label = matches.length === 1 ? ' switch' : ' switches'
            ConfirmDialog.show({
                width: 420,
                message: action + ' ' + count + ' filtered' + label + '?\nSwitches can affect game progress.',
                actions: [
                    { label: 'Cancel', color: 'white', action: ConfirmDialog.close },
                    { label: action, color: 'primary', action: () => {
                        ConfirmDialog.close()
                        if (this.store() !== store) {
                            this.errorMessage = 'Game data changed. Refresh and try again.'
                            return
                        }
                        try {
                            for (const item of matches) {
                                if (!!store.value(item.id) !== value) store.setValue(item.id, value)
                                this.updateRow(item, store.value(item.id))
                            }
                            this.errorMessage = ''
                            this.statusMessage = count + label + ' updated.'
                        } catch (error) {
                            this.errorMessage = 'Some switches could not be updated. Refresh to see their current state.'
                        }
                    } }
                ]
            })
        },

        resetListScroll () {
            this.$nextTick(() => { if (this.$refs.list) this.$refs.list.resetScroll() })
        },

        store () { return this.isSwitches ? $gameSwitches : $gameVariables },

        previewValue (value) {
            if (value === null) return 'null'
            if (Array.isArray(value)) return 'Array (' + value.length + ')'
            if (typeof value === 'object') return 'Object'
            return String(value)
        },

        rowFor (id, name, value) {
            const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
            const readOnly = !this.isSwitches && (type !== 'string' && type !== 'number' ||
                type === 'number' && !Number.isFinite(value))
            const row = {
                id, name: String(name || ''), type, readOnly,
                value: this.isSwitches ? !!value : value,
                draft: value === null || value === undefined ? '' : String(value),
                preview: this.previewValue(value)
            }
            row.searchText = this.searchTextFor(row)
            return row
        },

        searchTextFor (item) {
            return (item.id + ' ' + item.name + ' ' + item.type + ' ' + item.preview +
                (this.isSwitches ? item.value ? ' true on' : ' false off' : '')).toLowerCase()
        },

        async initializeVariables () {
            const request = {}
            this._dataRequest = request
            this.loading = true
            this.errorMessage = ''
            this.statusMessage = ''
            this.invalidId = null
            try {
                const sourceNames = (this.isSwitches ? $dataSystem.switches : $dataSystem.variables).slice()
                let names = sourceNames
                const translate = this.isSwitches ? TRANSLATE_SETTINGS.isSwitchTranslateEnabled() : TRANSLATE_SETTINGS.isVariableTranslateEnabled()
                if (translate) names = await TRANSLATOR.translateBulk(sourceNames.map(name => String(name || '')))
                if (this._dataRequest !== request) return
                const store = this.store()
                const items = []
                // ID 0 is the engine sentinel, never an editable record.
                for (let id = 1; id < sourceNames.length; id++) {
                    const name = Array.isArray(names) && names[id] !== undefined ? names[id] : sourceNames[id]
                    items.push(this.rowFor(id, name, store.value(id)))
                }
                this.items = items
            } catch (error) {
                if (this._dataRequest !== request) return
                this.errorMessage = 'Could not load ' + this.kind + '. Refresh to try again.'
            } finally {
                if (this._dataRequest === request) this.loading = false
            }
        },

        updateRow (item, value) {
            const refreshed = this.rowFor(item.id, item.name, value)
            Object.keys(refreshed).forEach(key => { item[key] = refreshed[key] })
        },

        commitVariable (item) {
            if (this.isSwitches || item.readOnly || this.items.indexOf(item) === -1) return
            // Recheck the live type: events may change a variable after the list
            // was loaded. Never overwrite an object or coerce a string to number.
            let store, current
            try {
                store = this.store()
                current = store.value(item.id)
            } catch (error) {
                this.invalidId = item.id
                this.errorMessage = 'Could not read this variable. Refresh and try again.'
                this.statusMessage = ''
                return
            }
            if (typeof current !== item.type || current === null) {
                this.updateRow(item, current)
                this.invalidId = item.id
                this.errorMessage = 'This variable changed in the game. Review its current value before editing.'
                this.statusMessage = ''
                return
            }
            let value = item.draft
            if (item.type === 'number') {
                value = Number(item.draft)
                if (String(item.draft).trim() === '' || !Number.isFinite(value)) {
                    this.invalidId = item.id
                    this.errorMessage = 'Enter a finite number for ' + (item.name || 'variable #' + item.id) + '.'
                    this.statusMessage = ''
                    return
                }
            }
            try {
                if (value === current) {
                    this.updateRow(item, current)
                    this.invalidId = null
                    this.errorMessage = ''
                    this.statusMessage = 'Value unchanged.'
                    return
                }
                store.setValue(item.id, value)
                this.updateRow(item, store.value(item.id))
                this.invalidId = null
                this.errorMessage = ''
                this.statusMessage = (item.name || 'Variable #' + item.id) + ' updated.'
            } catch (error) {
                this.invalidId = item.id
                this.errorMessage = 'Could not update this variable. Refresh and try again.'
                this.statusMessage = ''
            }
        },

        toggleSwitch (item) {
            if (!this.isSwitches || this.items.indexOf(item) === -1) return
            try {
                const store = this.store()
                const value = !store.value(item.id)
                store.setValue(item.id, value)
                this.updateRow(item, store.value(item.id))
                this.errorMessage = ''
                this.statusMessage = (item.name || 'Switch #' + item.id) + ' turned ' + (item.value ? 'on.' : 'off.')
            } catch (error) {
                this.errorMessage = 'Could not update this switch. Refresh and try again.'
                this.statusMessage = ''
            }
        }
    }
}
