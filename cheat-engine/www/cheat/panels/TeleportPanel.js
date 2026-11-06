import VirtualList from '../components/VirtualList.js'
import { TRANSLATE_SETTINGS, TRANSLATOR } from '../js/TranslateHelper.js'
import { KEY_VALUE_STORAGE } from '../js/KeyValueStorage.js'
import { currentLocation, readSavedLocations, SAVED_LOCATIONS_KEY } from '../js/SavedLocations.js'

function ancestorIds (id, maps) {
    const path = []
    const seen = new Set()
    while (Number.isInteger(id) && id > 0 && maps[id] && !seen.has(id)) {
        seen.add(id)
        path.unshift(id)
        id = maps[id].parentId
    }
    return path
}

export default {
    name: 'TeleportPanel',
    components: { VirtualList },
    template: `
<div class="cheat-data-page cheat-travel-page">
    <form class="cheat-travel-form cheat-coordinate-fields" @submit.prevent>
        <div class="cheat-travel-context"><strong>Destination coordinates</strong><span>Choose a map below to travel.</span></div>
        <label class="cheat-coordinate-field" for="cheat-map-x">X
            <input id="cheat-map-x" class="cheat-number-input" v-model="inputX" type="number" min="0" step="1"
                :aria-invalid="invalidCoordinate === 'x' ? 'true' : 'false'" @input="clearCoordinateError">
        </label>
        <label class="cheat-coordinate-field" for="cheat-map-y">Y
            <input id="cheat-map-y" class="cheat-number-input" v-model="inputY" type="number" min="0" step="1"
                :aria-invalid="invalidCoordinate === 'y' ? 'true' : 'false'" @input="clearCoordinateError">
        </label>
    </form>
    <div class="cheat-data-toolbar">
        <label class="cheat-search" for="cheat-map-search">
            <span>Search maps</span>
            <input id="cheat-map-search" v-model="search" type="search" placeholder="Map name, path or ID" @input="onFilterChange">
        </label>
        <button type="button" class="cheat-button" @click="initializeVariables" :disabled="loading">Refresh</button>
    </div>
    <div class="cheat-filter-row cheat-map-filters">
        <span class="cheat-result-count">{{filteredMaps.length}} of {{maps.length}} maps</span>
        <label class="cheat-toggle"><input type="checkbox" v-model="showPaths">Show map paths</label>
        <button type="button" class="cheat-button" title="Save your current position" @click="saveCurrentLocation">Save location</button>
    </div>
    <p v-if="errorMessage || statusMessage" class="cheat-list-status" :class="{'cheat-inline-error': errorMessage}"
        :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage}}</p>
    <virtual-list ref="list" :items="filteredMaps" :item-height="72" label="Maps"
        :empty-message="loading ? 'Loading maps…' : search ? 'No maps match your search.' : 'No maps are available.'">
        <template v-slot:default="{item}">
            <div class="cheat-map-row">
                <div class="cheat-row-title">
                    <strong>{{item.name || 'Unnamed map'}}</strong>
                    <span class="cheat-row-meta"><span>#{{item.id}}</span><span v-if="showPaths && item.fullPathJoin"> · {{item.fullPathJoin}}</span></span>
                </div>
                <div class="cheat-row-actions">
                    <button type="button" class="cheat-button" :aria-label="'Teleport to ' + (item.name || 'map ' + item.id)"
                        @click="teleportLocation(item.id, inputX, inputY)">Travel</button>
                </div>
            </div>
        </template>
    </virtual-list>
</div>`,

    data () {
        return { inputX: '0', inputY: '0', search: '', showPaths: true, maps: [],
            loading: false, invalidCoordinate: '', errorMessage: '', statusMessage: '' }
    },

    created () { this.initializeVariables() },
    beforeDestroy () { this._loadRequest = null },

    computed: {
        filteredMaps () {
            const query = this.search.trim().toLowerCase()
            return this.maps.filter(map => !query || (map.id + ' ' + map.name + ' ' + map.fullPathJoin).toLowerCase().includes(query))
        }
    },

    methods: {
        saveCurrentLocation () {
            this.errorMessage = ''
            this.statusMessage = ''
            const location = currentLocation()
            if (!location) {
                this.errorMessage = 'The current position is not available. Return to the map and try again.'
                return
            }

            let locations
            try {
                locations = readSavedLocations(KEY_VALUE_STORAGE)
            } catch (error) {
                this.errorMessage = 'Saved locations could not be read. Existing data was kept.'
                return
            }

            try {
                KEY_VALUE_STORAGE.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations.concat(location)))
            } catch (error) {
                this.errorMessage = 'Location could not be saved. Check storage access and try again.'
                return
            }

            this.statusMessage = 'Saved ' + location.name + ' (' + location.x + ', ' + location.y + ').'
            this.$emit('saved-locations-change', locations.length + 1)
        },

        onFilterChange () {
            if (this.$refs.list) this.$refs.list.resetScroll()
        },

        clearCoordinateError () {
            if (this.invalidCoordinate) {
                this.invalidCoordinate = ''
                this.errorMessage = ''
            }
        },

        async initializeVariables () {
            const request = {}
            this._loadRequest = request
            this.loading = true
            this.errorMessage = ''
            const snapshot = Array.isArray($dataMapInfos) ? $dataMapInfos.slice() : []
            let names = snapshot.map(map => map ? String(map.name || '') : '')
            try {
                names = await this.getMapNames(snapshot)
            } catch (error) {
                if (this._loadRequest === request) this.errorMessage = 'Map names could not be translated. Showing original names.'
            }
            if (this._loadRequest !== request) return
            this.maps = snapshot.map((map, index) => {
                if (!map || index <= 0) return null
                const id = Number.isInteger(map.id) && map.id > 0 ? map.id : index
                if (!snapshot[id]) return null
                const fullPath = ancestorIds(id, snapshot).map(mapId => names[mapId] || snapshot[mapId].name || 'Map #' + mapId)
                return { id, name: names[id] || map.name || '', fullPath, fullPathJoin: fullPath.join(' / ') }
            }).filter(Boolean)
            this.loading = false
            this.onFilterChange()
        },

        async getMapNames (maps) {
            const names = maps.map(map => map ? String(map.name || '') : '')
            if (!TRANSLATE_SETTINGS.isMapTranslateEnabled()) return names
            const translated = await TRANSLATOR.translateBulk(names)
            return names.map((name, index) => Array.isArray(translated) && typeof translated[index] === 'string' ? translated[index] : name)
        },

        getMapAncestors (id, path) { path.push(...ancestorIds(id, $dataMapInfos)) },

        coordinate (value, name) {
            const text = String(value).trim()
            const number = Number(text)
            if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 0) {
                this.invalidCoordinate = name.toLowerCase()
                this.errorMessage = name + ' must be a whole number of zero or more.'
                return null
            }
            return number
        },

        teleportLocation (mapId, x, y) {
            this.errorMessage = ''
            this.invalidCoordinate = ''
            const coordX = this.coordinate(x, 'X')
            if (coordX === null) return false
            const coordY = this.coordinate(y, 'Y')
            if (coordY === null) return false
            if (!Number.isInteger(mapId) || mapId <= 0 || !$dataMapInfos[mapId]) {
                this.errorMessage = 'This map is no longer available. Select Refresh and choose another map.'
                return false
            }
            try {
                $gamePlayer.reserveTransfer(mapId, coordX, coordY, $gamePlayer.direction(), 0)
                if (typeof $gamePlayer.setPosition === 'function') $gamePlayer.setPosition(coordX, coordY)
                this.statusMessage = 'Travel requested to ' + ($dataMapInfos[mapId].name || 'map ' + mapId) + '.'
                return true
            } catch (error) {
                this.errorMessage = 'Could not travel to this map. Return to the map and try again.'
                return false
            }
        }
    }
}
