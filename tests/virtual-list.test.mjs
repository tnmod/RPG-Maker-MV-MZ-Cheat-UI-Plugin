import test from 'node:test'
import assert from 'node:assert/strict'
import VirtualList, {virtualRange} from '../cheat-engine/www/cheat/components/VirtualList.js'
import ItemTableTab from '../cheat-engine/www/cheat/panels/ItemTableTab.js'

function environment () {
    const previous = {window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver}
    const frames = new Map()
    const listeners = new Map()
    let serial = 0
    const observers = []
    globalThis.window = {
        requestAnimationFrame (fn) { const id = serial++; frames.set(id, fn); return id },
        cancelAnimationFrame (id) { frames.delete(id) },
        addEventListener (type, fn) { listeners.set(type, fn) },
        removeEventListener (type, fn) { if (listeners.get(type) === fn) listeners.delete(type) }
    }
    globalThis.document = {activeElement: null}
    globalThis.ResizeObserver = class {
        constructor (fn) { this.callback = fn; this.disconnected = false; observers.push(this) }
        observe (target) { this.target = target }
        disconnect () { this.disconnected = true }
    }
    return {
        frames, listeners, observers,
        flush () { const ready = [...frames.values()]; frames.clear(); ready.forEach(fn => fn()) },
        restore () {
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete globalThis[key]
                else globalThis[key] = value
            }
        }
    }
}

function listFixture (count = 10000) {
    const ticks = []
    const viewport = {clientHeight: 320, scrollTop: 0, contains: () => false}
    const vm = {...VirtualList.data(), items: Array.from({length: count}, (_, id) => ({id})),
        itemHeight: 64, overscan: 5, itemKey: 'id', $refs: {viewport}, $nextTick: fn => ticks.push(fn)}
    for (const [name, fn] of Object.entries(VirtualList.methods)) vm[name] = fn.bind(vm)
    for (const [name, fn] of Object.entries(VirtualList.computed)) Object.defineProperty(vm, name, {get: () => fn.call(vm)})
    return {vm, viewport, flushTicks: () => { while (ticks.length) ticks.shift()() }}
}

test('large lists expose only the visible rows plus overscan at every scroll position', () => {
    for (const top of [0, 64, 1264, 320000, 639999]) {
        const range = virtualRange(10000, 64, 320, top, 5)
        assert.ok(range.start >= 0)
        assert.ok(range.end <= 10000)
        assert.ok(range.end - range.start <= 16)
        assert.equal(range.totalHeight, 640000)
    }
    assert.equal(virtualRange(10000, 64, 320, 639999, 5).end, 10000)
})

test('empty lists, invalid sizes and scrolling past the end produce safe ranges', () => {
    assert.deepEqual(virtualRange(0, 64, 320, 2000), {start: 0, end: 0, scrollTop: 0, totalHeight: 0})
    assert.equal(virtualRange(4, 64, 320, 99999).scrollTop, 0)
    assert.equal(virtualRange(100, 64, 320, -100).scrollTop, 0)
    assert.equal(virtualRange(100, 0, 320, 0).totalHeight, 6400)
    assert.deepEqual(virtualRange(100, 64, 0, 1000), {start: 0, end: 0, scrollTop: 1000, totalHeight: 6400})
})

test('scrolling is throttled to one animation frame and keeps real row indices and keys', () => {
    const env = environment()
    try {
        const {vm, viewport} = listFixture()
        VirtualList.mounted.call(vm)
        viewport.scrollTop = 6400
        vm.onScroll(); vm.onScroll(); vm.onScroll()
        assert.equal(env.frames.size, 1)
        env.flush()
        assert.equal(vm.scrollTop, 6400)
        assert.equal(vm.visibleEntries[0].index, 95)
        assert.equal(vm.visibleEntries[0].item.id, 95)
        assert.equal(vm.rowKey({id: 0}, 12), 0)
        assert.equal(vm.rowKey({}, 12), 12)
        assert.equal(vm.rowStyle(100).transform, 'translateY(6400px)')
        VirtualList.beforeDestroy.call(vm)
    } finally { env.restore() }
})

test('resize and filtering clamp scroll without jumping back to the beginning on small edits', () => {
    const env = environment()
    try {
        const {vm, viewport, flushTicks} = listFixture()
        VirtualList.mounted.call(vm)
        vm.scrollToIndex(100)
        assert.equal(vm.scrollTop, 6400)
        vm.items = vm.items.slice()
        VirtualList.watch.items.call(vm); flushTicks()
        assert.equal(vm.scrollTop, 6400)
        viewport.clientHeight = 640
        env.observers[0].callback(); env.flush()
        assert.equal(vm.viewportHeight, 640)
        vm.items = vm.items.slice(0, 2)
        VirtualList.watch.items.call(vm); flushTicks()
        assert.equal(vm.scrollTop, 0)
        assert.equal(viewport.scrollTop, 0)
        assert.equal(vm.visibleEntries.length, 2)
        VirtualList.beforeDestroy.call(vm)
    } finally { env.restore() }
})

test('a recycled editor commits on blur and keeps keyboard focus in the list', () => {
    const env = environment()
    try {
        const {vm, viewport} = listFixture()
        VirtualList.mounted.call(vm)
        let blurred = 0
        let focused = 0
        document.body = {}
        const active = {closest: () => ({getAttribute: () => '0'}), blur () { blurred++; document.activeElement = document.body }}
        document.activeElement = active
        viewport.contains = target => target === active
        viewport.focus = options => {
            assert.equal(options.preventScroll, true)
            document.activeElement = viewport
            focused++
        }
        vm.updateScroll(64)
        assert.equal(blurred, 0)
        vm.updateScroll(6400)
        assert.equal(blurred, 1)
        assert.equal(focused, 1)
        vm.resetScroll()
        assert.equal(vm.scrollTop, 0)
        VirtualList.beforeDestroy.call(vm)
    } finally { env.restore() }
})

test('native list navigation bypasses unmodified cheat bindings without blocking default scrolling', () => {
    const {vm} = listFixture()
    for (const key of ['ArrowUp', 'PageDown', 'End', ' ']) {
        let stopped = false
        vm.onViewportKey({key, stopPropagation () { stopped = true }})
        assert.equal(stopped, true)
    }
    for (const event of [{key: 'PageDown', ctrlKey: true}, {key: 'Home', shiftKey: true}, {key: 'Tab'}, {key: 'Escape'}]) {
        vm.onViewportKey({...event, stopPropagation () { assert.fail('Shortcut or focus key unexpectedly blocked') }})
    }
})

test('a temporarily zero-height viewport mounts no rows and restores the same scroll position when visible', () => {
    const env = environment()
    try {
        const {vm, viewport} = listFixture()
        VirtualList.mounted.call(vm)
        vm.scrollToIndex(100)
        viewport.clientHeight = 0
        vm.measure()
        assert.equal(vm.viewportHeight, 0)
        assert.equal(vm.visibleEntries.length, 0)
        viewport.clientHeight = 128
        vm.measure()
        assert.equal(vm.scrollTop, 6400)
        assert.ok(vm.visibleEntries.some(entry => entry.index === 100))
        VirtualList.beforeDestroy.call(vm)
    } finally { env.restore() }
})

test('destroy disconnects observers and cancels pending resize and scroll work', () => {
    const env = environment()
    try {
        const {vm} = listFixture()
        VirtualList.mounted.call(vm)
        vm.onScroll(); vm.scheduleMeasure()
        assert.equal(env.frames.size, 2)
        VirtualList.beforeDestroy.call(vm)
        assert.equal(env.frames.size, 0)
        assert.equal(env.listeners.size, 0)
        assert.equal(env.observers[0].disconnected, true)
        assert.equal(vm._listActive, false)
        env.flush()
    } finally { env.restore() }
})

test('the old Chromium resize fallback works when ResizeObserver is unavailable', () => {
    const env = environment()
    try {
        delete globalThis.ResizeObserver
        const {vm, viewport} = listFixture()
        VirtualList.mounted.call(vm)
        assert.ok(env.listeners.has('resize'))
        viewport.clientHeight = 500
        env.listeners.get('resize')(); env.flush()
        assert.equal(vm.viewportHeight, 500)
        VirtualList.beforeDestroy.call(vm)
    } finally { env.restore() }
})

function inventoryFixture () {
    const owned = new Map([[1, 8], [2, 3]])
    const writes = []
    const previous = globalThis.$gameParty
    globalThis.$gameParty = {
        numItems: item => owned.get(item.id) || 0,
        maxItems: () => 99,
        gainItem (item, delta) { writes.push([item.id, delta]); owned.set(item.id, (owned.get(item.id) || 0) + delta) }
    }
    let resets = 0
    const vm = {...ItemTableTab.data(), items: [{id: 1, name: 'Potion', description: 'Restore health'},
        {id: 2, name: 'Ether', description: 'Restore MP'}, {id: 3, name: '', description: 'Hidden reward'}],
        searchableAttrs: ['name', 'desc'], asTableData: item => ({name: item.name, desc: item.description}),
        $refs: {list: {resetScroll () { resets++ }}}, $nextTick: fn => fn()}
    for (const [name, fn] of Object.entries(ItemTableTab.methods)) vm[name] = fn.bind(vm)
    Object.defineProperty(vm, 'filteredTableItems', {get: () => ItemTableTab.computed.filteredTableItems.call(vm)})
    vm.initializeVariables()
    return {vm, owned, writes, resetCount: () => resets,
        restore () { if (previous === undefined) delete globalThis.$gameParty; else globalThis.$gameParty = previous }}
}

test('inventory searches names, descriptions and database IDs without engine String.contains', () => {
    const env = inventoryFixture()
    try {
        env.vm.search = 'RESTORE MP'
        assert.deepEqual(env.vm.filteredTableItems.map(row => row.id), [2])
        env.vm.search = '3'
        assert.deepEqual(env.vm.filteredTableItems.map(row => row.id), [3])
        env.vm.excludeNameless = true
        assert.deepEqual(env.vm.filteredTableItems, [])
        env.vm.clearFilters()
        env.vm.sortBy = 'name'
        assert.deepEqual(env.vm.filteredTableItems.map(row => row.id), [3, 2, 1])
        assert.ok(env.resetCount() >= 2)
    } finally { env.restore() }
})

test('inventory validates quantities and only-owned filtering does not remove an uncommitted editor', () => {
    const env = inventoryFixture()
    try {
        const row = env.vm.tableItems[0]
        env.vm.onlyOwnedItems = true
        row.draftAmount = '0'
        assert.ok(env.vm.filteredTableItems.includes(row))
        for (const invalid of ['-1', '1.5', '', 'NaN', '100']) {
            row.draftAmount = invalid
            env.vm.onItemChange(row)
            assert.equal(env.owned.get(1), 8)
            assert.equal(row.error, true)
        }
        assert.deepEqual(env.writes, [])
        row.draftAmount = '0'
        env.vm.onItemChange(row)
        assert.deepEqual(env.writes, [[1, -8]])
        assert.equal(row.error, false)
        assert.equal(env.vm.filteredTableItems.includes(row), false)
    } finally { env.restore() }
})
