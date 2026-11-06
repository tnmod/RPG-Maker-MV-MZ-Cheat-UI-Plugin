import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../cheat-engine/www/cheat/components/GameDataEditor.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')

function fixture ({ kind = 'variables', names = ['', 'Quest progress', 'Code', '', 'Flag'],
    values = { 1: 3, 2: '0012', 3: 9, 4: true }, translate = false, translator = {} } = {}) {
    const data = new Map(Object.entries(values).map(([id, value]) => [Number(id), value]))
    const writes = []
    const store = {
        value: id => data.has(id) ? data.get(id) : kind === 'switches' ? false : 0,
        setValue (id, value) { writes.push([id, value]); data.set(id, typeof value === 'number' ? Math.floor(value) : value) }
    }
    const settings = { isVariableTranslateEnabled: () => translate, isSwitchTranslateEnabled: () => translate }
    const system = { variables: names, switches: names }
    const timers = new Map()
    const canceled = []
    let timerId = 0
    const definition = new Function('VirtualList', 'TRANSLATE_SETTINGS', 'TRANSLATOR', '$dataSystem', '$gameVariables', '$gameSwitches',
        'setTimeout', 'clearTimeout', source)({}, settings, translator, system, store, store,
        fn => { const id = ++timerId; timers.set(id, fn); return id },
        id => { canceled.push(id); timers.delete(id) })
    const vm = { ...definition.data(), kind, canEdit: () => true }
    for (const [name, method] of Object.entries(definition.methods)) vm[name] = method.bind(vm)
    for (const [name, getter] of Object.entries(definition.computed)) Object.defineProperty(vm, name, { get: () => getter.call(vm) })
    return { vm, definition, data, writes, system, timers, canceled }
}

test('records start at ID 1, keep stable IDs, and unsupported values stay read-only', async () => {
    const { vm } = fixture({
        names: ['', 'Number', 'Text', 'Object', 'Boolean', 'Array', 'Null', 'Invalid number'],
        values: { 1: 3, 2: '0012', 3: { foo: 2 }, 4: true, 5: [1, 2], 6: null, 7: NaN }
    })
    await vm.initializeVariables()
    assert.deepEqual(vm.items.map(item => item.id), [1, 2, 3, 4, 5, 6, 7])
    assert.deepEqual(vm.items.map(item => item.readOnly), [false, false, true, true, true, true, true])
    assert.equal(vm.items[2].preview, 'Object')
    assert.equal(vm.items[4].preview, 'Array (2)')
    assert.equal(vm.loading, false)
})

test('search matches ID, name and current value and Hide unnamed excludes only blank names', async () => {
    const { vm } = fixture()
    await vm.initializeVariables()
    vm.query = 'QUEST'
    assert.deepEqual(vm.filteredItems.map(item => item.id), [1])
    vm.query = '0012'
    assert.deepEqual(vm.filteredItems.map(item => item.id), [2])
    vm.query = '#2'
    assert.deepEqual(vm.filteredItems.map(item => item.id), [2])
    vm.query = '2'
    assert.deepEqual(vm.filteredItems.map(item => item.id), [2])
    vm.query = ''
    vm.hideUnnamed = true
    assert.deepEqual(vm.filteredItems.map(item => item.id), [1, 2, 4])
})

test('numeric variables reject blank/nonfinite drafts and reread the actual engine value after commit', async () => {
    const { vm, writes, data } = fixture()
    await vm.initializeVariables()
    const item = vm.items[0]
    for (const draft of ['', '  ', 'Infinity', 'NaN', 'not a number']) {
        item.draft = draft
        vm.commitVariable(item)
        assert.equal(writes.length, 0)
        assert.equal(data.get(1), 3)
        assert.equal(vm.invalidId, 1)
    }
    item.draft = '45.9'
    vm.commitVariable(item)
    assert.equal(data.get(1), 45)
    assert.equal(item.value, 45)
    assert.equal(item.draft, '45')
    assert.equal(vm.errorMessage, '')
})

test('string variables retain their type and unsupported/stale rows never overwrite game data', async () => {
    const { vm, writes, data } = fixture()
    await vm.initializeVariables()
    const text = vm.items[1]
    text.draft = '0055'
    vm.commitVariable(text)
    assert.equal(data.get(2), '0055')
    assert.equal(typeof data.get(2), 'string')
    vm.commitVariable(vm.items[3])
    assert.equal(writes.length, 1)
    data.set(1, { changed: true })
    vm.items[0].draft = '99'
    vm.commitVariable(vm.items[0])
    assert.deepEqual(data.get(1), { changed: true })
    assert.equal(vm.items[0].readOnly, true)
    assert.match(vm.errorMessage, /changed in the game/)
    vm.commitVariable({ id: 99, draft: '80', type: 'number' })
    assert.equal(writes.length, 1)
})

test('switch buttons toggle the live game state, refresh values and update value search', async () => {
    const { vm, data, writes } = fixture({ kind: 'switches', names: ['', 'Gate unlocked', 'Arena registered'], values: { 1: true, 2: false } })
    await vm.initializeVariables()
    vm.query = 'off'
    assert.deepEqual(vm.filteredItems.map(item => item.id), [2])
    // An event changes the switch after list load. Toggle its live value.
    data.set(2, true)
    vm.toggleSwitch(vm.items[1])
    assert.deepEqual(writes, [[2, false]])
    assert.equal(vm.items[1].value, false)
    vm.toggleSwitch(vm.items[1])
    assert.equal(vm.items[1].value, true)
    assert.equal(vm.filteredItems.length, 0)
})

test('out-of-order translated refreshes cannot replace the latest names or leave loading stuck', async () => {
    const pending = []
    const translator = { translateBulk: () => new Promise(resolve => pending.push(resolve)) }
    const { vm, system } = fixture({ translate: true, translator })
    const first = vm.initializeVariables()
    system.variables = ['', 'Latest name']
    const second = vm.initializeVariables()
    pending[1](['', 'Translated latest'])
    await second
    pending[0](['', 'Obsolete translated name', 'Code', '', 'Flag'])
    await first
    assert.deepEqual(vm.items.map(item => item.name), ['Translated latest'])
    assert.equal(vm.loading, false)
})

test('destroyed editors ignore pending translation and cancel debounced searches', async () => {
    let resolveTranslation
    const translator = { translateBulk: () => new Promise(resolve => { resolveTranslation = resolve }) }
    const { vm, definition, timers, canceled } = fixture({ translate: true, translator })
    definition.watch.search.call(vm, 'old')
    const firstTimer = vm._searchTimer
    definition.watch.search.call(vm, 'latest')
    assert.ok(canceled.includes(firstTimer))
    assert.equal(timers.size, 1)
    timers.get(vm._searchTimer)()
    assert.equal(vm.query, 'latest')
    const pending = vm.initializeVariables()
    definition.beforeDestroy.call(vm)
    resolveTranslation(['', 'Too late'])
    await pending
    assert.equal(vm.items.length, 0)
    assert.equal(timers.size, 0)
})

test('load and update failures surface a footer error without discarding working rows', async () => {
    const { vm } = fixture({ translate: true, translator: { translateBulk: async () => { throw new Error('offline') } } })
    await vm.initializeVariables()
    assert.match(vm.errorMessage, /Could not load variables/)
    assert.equal(vm.loading, false)
    const switches = fixture({ kind: 'switches' })
    await switches.vm.initializeVariables()
    switches.vm.store = () => ({ value: () => false, setValue: () => { throw new Error('plugin refused') } })
    switches.vm.toggleSwitch(switches.vm.items[0])
    assert.match(switches.vm.errorMessage, /Could not update this switch/)
})
