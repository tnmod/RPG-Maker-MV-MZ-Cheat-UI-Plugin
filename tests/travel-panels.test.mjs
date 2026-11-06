import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../cheat-engine/www/cheat/panels/TeleportPanel.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')

function fixture (options = {}) {
    const maps = options.maps || [null, { id: 1, name: 'Town', parentId: 0 }, { id: 2, name: 'North gate', parentId: 1 }]
    const calls = []
    const player = { direction: () => 2,
        reserveTransfer (...args) { calls.push(['transfer', ...args]) },
        setPosition (...args) { calls.push(['position', ...args]) } }
    const translator = { translateBulk: options.translateBulk || (async names => names) }
    const definition = new Function('VirtualList', 'TRANSLATE_SETTINGS', 'TRANSLATOR', '$dataMapInfos', '$gamePlayer', source)(
        {}, { isMapTranslateEnabled: () => !!options.translationEnabled }, translator, maps, player)
    const vm = definition.data()
    for (const [name, method] of Object.entries(definition.methods)) vm[name] = method.bind(vm)
    Object.defineProperty(vm, 'filteredMaps', { get: () => definition.computed.filteredMaps.call(vm) })
    vm.$refs = { list: { resetScroll () { calls.push(['reset']) } } }
    return { vm, maps, calls, definition, player }
}

test('map names, paths and IDs are searchable without pagination', async () => {
    const { vm } = fixture()
    await vm.initializeVariables()
    assert.equal(vm.maps.length, 2)
    assert.equal(vm.loading, false)
    assert.equal(vm.maps[1].fullPathJoin, 'Town / North gate')
    vm.search = 'NORTH'
    assert.deepEqual(vm.filteredMaps.map(map => map.id), [2])
    vm.search = 'Town'
    assert.equal(vm.filteredMaps.length, 2)
    vm.search = '2'
    assert.deepEqual(vm.filteredMaps.map(map => map.id), [2])
})

test('map ancestry tolerates missing parents, cycles and absent IDs', async () => {
    const maps = [null, { id: 1, name: 'A', parentId: 2 }, { id: 2, name: 'B', parentId: 1 },
        { name: 'Orphan', parentId: 999 }, { id: 4, name: 'Root' }]
    const { vm } = fixture({ maps })
    await vm.initializeVariables()
    assert.equal(vm.maps.length, 4)
    assert.equal(vm.maps[0].fullPathJoin, 'B / A')
    assert.equal(vm.maps[2].fullPathJoin, 'Orphan')
    assert.equal(vm.maps[2].id, 3)
    assert.equal(vm.maps[3].fullPathJoin, 'Root')
    const path = []
    vm.getMapAncestors(999, path)
    assert.deepEqual(path, [])
})

test('invalid coordinates and absent destinations never request a transfer', () => {
    const { vm, calls } = fixture()
    for (const value of ['', '-1', '1.5', '1e2', 'NaN', Infinity, 9007199254740992]) {
        assert.equal(vm.teleportLocation(1, value, '0'), false)
        assert.equal(vm.invalidCoordinate, 'x')
    }
    assert.equal(vm.teleportLocation(1, '0', '-2'), false)
    assert.equal(vm.invalidCoordinate, 'y')
    assert.equal(vm.teleportLocation(999, '0', '0'), false)
    assert.equal(calls.length, 0)
})

test('valid travel uses requested integer coordinates and optional immediate positioning', () => {
    const { vm, calls, player } = fixture()
    assert.equal(vm.teleportLocation(2, '12', '08'), true)
    assert.deepEqual(calls, [['transfer', 2, 12, 8, 2, 0], ['position', 12, 8]])
    delete player.setPosition
    assert.equal(vm.teleportLocation(1, '0', '0'), true)
    assert.deepEqual(calls[2], ['transfer', 1, 0, 0, 2, 0])
})

test('a late translation response cannot overwrite a more recent refresh', async () => {
    const pending = []
    const { vm, maps } = fixture({ translationEnabled: true,
        translateBulk: names => new Promise(resolve => pending.push({ names, resolve })) })
    const first = vm.initializeVariables()
    maps[1].name = 'New town'
    const second = vm.initializeVariables()
    pending[1].resolve(pending[1].names.map(name => name.toUpperCase()))
    await second
    assert.equal(vm.maps[0].name, 'NEW TOWN')
    pending[0].resolve(pending[0].names)
    await first
    assert.equal(vm.maps[0].name, 'NEW TOWN')
})

test('destroyed pages ignore pending translation and errors retain original map names', async () => {
    let finish
    const { vm, definition } = fixture({ translationEnabled: true,
        translateBulk: () => new Promise(resolve => { finish = resolve }) })
    const pending = vm.initializeVariables()
    definition.beforeDestroy.call(vm)
    finish(['', 'Translated', 'Gate'])
    await pending
    assert.deepEqual(vm.maps, [])

    const failure = fixture({ translationEnabled: true, translateBulk: async () => { throw new Error('offline') } })
    await failure.vm.initializeVariables()
    assert.equal(failure.vm.maps[0].name, 'Town')
    assert.match(failure.vm.errorMessage, /original names/)
    assert.equal(failure.vm.loading, false)
})
