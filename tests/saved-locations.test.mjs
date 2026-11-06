import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { currentLocation, readSavedLocations, SAVED_LOCATIONS_KEY, validPosition } from '../cheat-engine/www/cheat/js/SavedLocations.js'

const source = readFileSync(new URL('../cheat-engine/www/cheat/panels/SaveRecallPanel.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')

function fixture (locations = []) {
    const stored = new Map()
    const writes = []
    const storage = {
        getItem: key => stored.get(key),
        setItem (key, value) { stored.set(key, value); writes.push([key, value]) }
    }
    const maps = [null, { name: 'Town', parentId: 0 }, { name: 'Forest', parentId: 0 }]
    const calls = []
    const player = {
        x: 12, y: 8, direction: () => 4,
        reserveTransfer (...args) { calls.push(['transfer', ...args]) },
        setPosition (...args) { calls.push(['position', ...args]) }
    }
    const gameMap = { mapId: () => 2 }
    const definition = new Function('VirtualList', 'KEY_VALUE_STORAGE', 'TRANSLATE_SETTINGS', 'TRANSLATOR', '$dataMapInfos', '$gameMap', '$gamePlayer',
        'currentLocation', 'readSavedLocations', 'SAVED_LOCATIONS_KEY', 'validPosition', source)(
        {}, storage, { isMapTranslateEnabled: () => false }, {}, maps, gameMap, player,
        name => currentLocation(name, gameMap, player, maps), readSavedLocations, SAVED_LOCATIONS_KEY, validPosition)
    const vm = definition.data()
    for (const [name, method] of Object.entries(definition.methods)) vm[name] = method.bind(vm)
    Object.defineProperty(vm, 'tableItems', { get: () => definition.computed.tableItems.call(vm) })
    Object.defineProperty(vm, 'filteredTableItems', { get: () => definition.computed.filteredTableItems.call(vm) })
    vm.locations = locations
    vm.$emit = () => {}
    vm.$refs = { locationAliasField: { focus () { calls.push(['focus']) } } }
    return { vm, stored, writes, calls, definition, storage }
}

function location (name, mapId = 1, x = 2, y = 3) {
    return { name, mapId, x, y }
}

test('deletion follows source location after sorting and filtering display rows', () => {
    const first = location('Zulu')
    const target = location('Alpha', 2, 7, 9)
    const last = location('Gamma')
    const { vm, writes } = fixture([first, target, last])
    const sorted = vm.tableItems.slice().sort((a, b) => a.name.localeCompare(b.name))
    const filtered = sorted.filter(row => row.name === 'Alpha')
    assert.equal(filtered[0]._location, target)
    vm.removeLocation(filtered[0])
    assert.deepEqual(vm.locations, [first, last])
    assert.equal(writes.length, 1)
    assert.deepEqual(JSON.parse(writes[0][1]), [first, last])
})

test('duplicate names and coordinates still remove the selected source object only', () => {
    const first = location('Camp')
    const second = location('Camp')
    const { vm } = fixture([first, second])
    vm.removeLocation(vm.tableItems[1])
    assert.equal(vm.locations.length, 1)
    assert.equal(vm.locations[0], first)
})

test('stale or invalid display rows cannot delete a different or final location', () => {
    const { vm, writes } = fixture([location('First'), location('Last')])
    const stale = vm.tableItems[0]
    vm.removeLocation(stale)
    const before = vm.locations.slice()
    for (const invalid of [stale, undefined, null, 0, {}, { _location: location('Last') }]) {
        vm.removeLocation(invalid)
        assert.deepEqual(vm.locations, before)
    }
    assert.equal(writes.length, 1)
})

test('old stored bookmarks load, append and persist without transient table fields', () => {
    const old = location('Old bookmark', 1, 4, 5)
    const { vm, stored } = fixture()
    stored.set('cheat.locations', JSON.stringify([old]))
    vm.loadLocations()
    assert.deepEqual(vm.locations, [old])
    vm.addLocation('New bookmark')
    assert.deepEqual(vm.locations[1], location('New bookmark', 2, 12, 8))
    // Computing presentation rows must not change the legacy JSON format.
    assert.equal(vm.tableItems[0]._location, vm.locations[0])
    vm.saveLocations()
    const persisted = JSON.parse(stored.get('cheat.locations'))
    assert.deepEqual(persisted, [old, location('New bookmark', 2, 12, 8)])
    assert.equal(Object.hasOwn(persisted[0], '_location'), false)
})

test('adding from the alias field clears it and recalls the displayed destination coordinates', () => {
    const { vm, calls } = fixture()
    vm.locationAliasInput = 'Forest entrance'
    vm.onAddLocation()
    assert.equal(vm.locationAliasInput, '')
    assert.deepEqual(calls, [['focus']])
    const row = vm.tableItems[0]
    vm.teleportLocation(row.mapId, row.coord.x, row.coord.y)
    assert.deepEqual(calls.slice(1), [['transfer', 2, 12, 8, 4, 0], ['position', 12, 8]])
})

test('filtering names, maps and coordinates keeps stable identities without rewriting data', () => {
    const { vm, writes } = fixture([location('Camp', 1, 2, 3), location('Forest gate', 2, 20, 30)])
    const id = vm.tableItems[1].id
    vm.search = '20, 30'
    assert.equal(vm.filteredTableItems.length, 1)
    assert.equal(vm.filteredTableItems[0].id, id)
    vm.search = 'FOREST'
    assert.equal(vm.filteredTableItems[0].id, id)
    assert.equal(writes.length, 0)
})

test('corrupt saved JSON blocks mutations without overwriting stored bytes', () => {
    const existing = location('Kept in memory')
    const { vm, stored, writes } = fixture([existing])
    stored.set('cheat.locations', '{invalid json')
    assert.equal(vm.loadLocations(), false)
    assert.equal(vm.storageBlocked, true)
    assert.deepEqual(vm.locations, [existing])
    assert.equal(vm.addLocation('Must not overwrite'), false)
    assert.equal(vm.removeLocation(vm.tableItems[0]), false)
    assert.equal(vm.saveLocations(), false)
    assert.equal(stored.get('cheat.locations'), '{invalid json')
    assert.equal(writes.length, 0)
    stored.set('cheat.locations', JSON.stringify([existing]))
    assert.equal(vm.loadLocations(), true)
    assert.equal(vm.storageBlocked, false)
})

test('malformed bookmark shape is rejected instead of silently deleting records', () => {
    const { vm, stored, writes } = fixture()
    stored.set('cheat.locations', JSON.stringify([{ name: 'Bad position', mapId: 1, x: -1, y: 2 }]))
    assert.equal(vm.loadLocations(), false)
    assert.equal(vm.storageBlocked, true)
    assert.equal(writes.length, 0)
})

test('failed writes do not mutate or delete the currently visible bookmarks', () => {
    const existing = location('Kept')
    const { vm, storage } = fixture([existing])
    storage.setItem = () => { throw new Error('read only') }
    assert.equal(vm.addLocation('Unstored'), false)
    assert.deepEqual(vm.locations, [existing])
    assert.equal(vm.removeLocation(vm.tableItems[0]), false)
    assert.deepEqual(vm.locations, [existing])
    assert.match(vm.errorMessage, /could not be saved/)
})

