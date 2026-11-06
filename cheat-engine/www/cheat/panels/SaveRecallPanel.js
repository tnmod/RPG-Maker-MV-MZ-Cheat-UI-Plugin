import VirtualList from '../components/VirtualList.js'
import { KEY_VALUE_STORAGE } from '../js/KeyValueStorage.js'
import { TRANSLATE_SETTINGS, TRANSLATOR } from '../js/TranslateHelper.js'
import { currentLocation, readSavedLocations, SAVED_LOCATIONS_KEY, validPosition } from '../js/SavedLocations.js'

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
    name: 'SaveRecallPanel',
    components: { VirtualList },
    template: `
<div class="cheat-data-page cheat-travel-page">
    <form class="cheat-travel-form" @submit.prevent="onAddLocation">
        <div class="cheat-travel-context">
            <strong>Save your current position</strong>
            <span>{{currentMapName}} <span class="cheat-row-meta">({{currentX}}, {{currentY}})</span></span>
        </div>
        <label class="cheat-search" for="cheat-location-name">
            <span>Location name</span>
            <input id="cheat-location-name" ref="locationAliasField" v-model="locationAliasInput" type="text"
                placeholder="Name this location" autocomplete="off" :disabled="storageBlocked">
        </label>
        <button type="submit" class="cheat-button cheat-button--primary" :disabled="storageBlocked">Save location</button>
    </form>

    <div class="cheat-data-toolbar">
        <label class="cheat-search" for="cheat-location-search">
            <span>Search saved locations</span>
            <input id="cheat-location-search" v-model="search" type="search" placeholder="Name, map or coordinates" @input="onFilterChange">
        </label>
        <button type="button" class="cheat-button" aria-label="Refresh saved locations" @click="initializeVariables">Refresh</button>
    </div>
    <div class="cheat-filter-row">
        <span class="cheat-result-count">{{filteredTableItems.length}} of {{locations.length}} locations</span>
        <label class="cheat-sort">Sort
            <select v-model="sortBy" aria-label="Sort saved locations" @change="onFilterChange">
                <option value="recent">Newest first</option>
                <option value="name">Name</option>
                <option value="map">Map</option>
            </select>
        </label>
    </div>

    <p v-if="errorMessage || statusMessage" class="cheat-list-status" :class="{'cheat-inline-error': errorMessage}"
        :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage}}</p>
    <virtual-list ref="list" :items="filteredTableItems" :item-height="72" label="Saved locations"
        :empty-message="search ? 'No saved locations match your search.' : 'Save a location above to return here later.'">
        <template v-slot:default="{item}">
            <div class="cheat-bookmark-row">
                <div class="cheat-row-title">
                    <strong>{{item.name || item.mapName}}</strong>
                    <span class="cheat-row-meta">{{item.mapName}} · {{item.coord.x}}, {{item.coord.y}}</span>
                </div>
                <div class="cheat-row-actions">
                    <button type="button" class="cheat-button" :aria-label="'Teleport to ' + (item.name || item.mapName)"
                        :disabled="!item.available" @click="teleportLocation(item.mapId, item.coord.x, item.coord.y)">Travel</button>
                    <button type="button" class="cheat-button cheat-button--quiet" :aria-label="'Delete location ' + (item.name || item.mapName)"
                        :disabled="storageBlocked" @click="removeLocation(item)">Delete</button>
                </div>
            </div>
        </template>
    </virtual-list>
</div>`,

    data () {
        return {
            locationAliasInput: '', search: '', sortBy: 'recent', locations: [],
            currentMapName: '', currentX: 0, currentY: 0,
            storageBlocked: false, errorMessage: '', statusMessage: ''
        }
    },

    mounted () { this.initializeVariables() },
    beforeDestroy () { this._loadRequest = null },

    computed: {
        tableItems () {
            return this.locations.map((location, index) => ({
                id: this.locationId(location),
                _location: location,
                sourceIndex: index,
                name: location.name || '',
                mapName: $dataMapInfos[location.mapId] ? $dataMapInfos[location.mapId].name : 'Missing map #' + location.mapId,
                available: !!$dataMapInfos[location.mapId],
                mapId: location.mapId,
                coord: { x: location.x, y: location.y }
            }))
        },

        filteredTableItems () {
            const query = this.search.trim().toLowerCase()
            const rows = this.tableItems.filter(item => !query ||
                [item.name, item.mapName, item.mapId, item.coord.x + ', ' + item.coord.y].join(' ').toLowerCase().includes(query))
            return rows.sort((a, b) => this.sortBy === 'name' ? a.name.localeCompare(b.name) :
                this.sortBy === 'map' ? a.mapName.localeCompare(b.mapName) || a.name.localeCompare(b.name) : b.sourceIndex - a.sourceIndex)
        }
    },

    methods: {
        locationId (location) {
            if (!this._locationIds) {
                this._locationIds = new WeakMap()
                this._nextLocationId = 1
            }
            if (!this._locationIds.has(location)) this._locationIds.set(location, this._nextLocationId++)
            return this._locationIds.get(location)
        },

        onFilterChange () {
            if (this.$refs.list) this.$refs.list.resetScroll()
        },

        async initializeVariables () {
            const request = {}
            this._loadRequest = request
            this.statusMessage = ''
            this.loadLocations()
            this.currentX = $gamePlayer.x
            this.currentY = $gamePlayer.y
            try {
                const name = await this.getMapFullPath($gameMap.mapId())
                if (this._loadRequest === request) this.currentMapName = name
            } catch (error) {
                if (this._loadRequest === request) this.currentMapName = 'Map #' + $gameMap.mapId()
            }
        },

        async getMapFullPath (id) {
            const path = ancestorIds(id, $dataMapInfos)
            if (!path.length) return 'Missing map #' + id
            const name = path.map(mapId => $dataMapInfos[mapId].name).join(' / ')
            return TRANSLATE_SETTINGS.isMapTranslateEnabled() ? await TRANSLATOR.translate(name) : name
        },

        getMapAncestors (id, path) { path.push(...ancestorIds(id, $dataMapInfos)) },

        saveLocations (locations = this.locations) {
            if (this.storageBlocked) return false
            try {
                KEY_VALUE_STORAGE.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(locations))
                this.locations = locations
                this.errorMessage = ''
                this.$emit('saved-locations-change', locations.length)
                return true
            } catch (error) {
                this.errorMessage = 'Locations could not be saved. Check storage access and try again.'
                return false
            }
        },

        loadLocations () {
            try {
                this.locations = readSavedLocations(KEY_VALUE_STORAGE)
                this.storageBlocked = false
                this.errorMessage = ''
                this.$emit('saved-locations-change', this.locations.length)
                return true
            } catch (error) {
                this.storageBlocked = true
                this.errorMessage = 'Saved locations could not be read. Fix their stored data, then select Refresh. Existing data was kept.'
                return false
            }
        },

        onLocationAliasKeyDown (event) {
            if (event.code === 'Enter' || event.key === 'Enter') {
                event.preventDefault()
                this.onAddLocation()
            }
        },

        onAddLocation () {
            if (this.addLocation(this.locationAliasInput)) {
                this.locationAliasInput = ''
                if (this.$refs.locationAliasField) this.$refs.locationAliasField.focus()
            }
        },

        addLocation (name) {
            if (this.storageBlocked) return false
            const location = currentLocation(name)
            if (!location) {
                this.errorMessage = 'The current position is not available. Return to the map and try again.'
                return false
            }
            if (!this.saveLocations(this.locations.concat(location))) return false
            this.statusMessage = 'Location saved.'
            this.onFilterChange()
            return true
        },

        removeLocation (item) {
            const index = this.locations.indexOf(item && item._location)
            if (index < 0 || this.storageBlocked) return false
            const locations = this.locations.slice()
            locations.splice(index, 1)
            if (!this.saveLocations(locations)) return false
            this.statusMessage = 'Location deleted.'
            return true
        },

        teleportLocation (mapId, x, y) {
            if (!validPosition(mapId, x, y) || !$dataMapInfos[mapId]) {
                this.errorMessage = 'This destination is unavailable. Choose another saved location.'
                return false
            }
            try {
                $gamePlayer.reserveTransfer(mapId, x, y, $gamePlayer.direction(), 0)
                if (typeof $gamePlayer.setPosition === 'function') $gamePlayer.setPosition(x, y)
                this.errorMessage = ''
                this.statusMessage = 'Travel requested.'
                return true
            } catch (error) {
                this.errorMessage = 'Could not travel to this location. Return to the map and try again.'
                return false
            }
        }
    }
}
