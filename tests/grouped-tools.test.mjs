import test from 'node:test'
import assert from 'node:assert/strict'
import GroupedToolsPanel from '../cheat-engine/www/cheat/components/GroupedToolsPanel.js'

const tools = [
    {component: 'item-setting-panel', name: 'Items', view: {name: 'Items'}},
    {component: 'weapon-setting-panel', name: 'Weapons', view: {name: 'Weapons'}},
    {component: 'armor-setting-panel', name: 'Armor', view: {name: 'Armor'}}
]

function fixture (activeComponent = 'item-setting-panel', entries = tools) {
    const changes = []
    const focused = []
    const ticks = []
    const vm = {
        tools: entries,
        activeComponent,
        label: 'Inventory',
        $refs: {},
        $emit (event, value) { changes.push([event, value]) },
        $nextTick (callback) { ticks.push(callback) }
    }
    for (const [name, method] of Object.entries(GroupedToolsPanel.methods)) vm[name] = method.bind(vm)
    for (const [name, getter] of Object.entries(GroupedToolsPanel.computed)) {
        Object.defineProperty(vm, name, {get: () => getter.call(vm)})
    }
    vm.$refs.toolTabs = entries.map(tool => ({id: vm.tabId(tool), focus () { focused.push(tool.component) }}))
    return {vm, changes, focused, flush: () => { while (ticks.length) ticks.shift()() }}
}

function keyEvent (key, modifiers = {}) {
    return {
        key, ...modifiers, prevented: false, stopped: false,
        preventDefault () { this.prevented = true },
        stopPropagation () { this.stopped = true }
    }
}

test('active tool is driven by the current leaf prop, including external route changes', () => {
    const {vm} = fixture('weapon-setting-panel')
    assert.equal(vm.currentTool, tools[1])
    vm.activeComponent = 'armor-setting-panel'
    assert.equal(vm.currentTool, tools[2])
    vm.activeComponent = 'inventory-panel'
    assert.equal(vm.currentTool, tools[0])
})

test('tab clicks emit leaf routes without mutating the parent route', () => {
    const {vm, changes, focused, flush} = fixture()
    vm.selectTool(tools[2])
    assert.deepEqual(changes, [['change', 'armor-setting-panel']])
    assert.equal(vm.activeComponent, 'item-setting-panel')
    flush()
    assert.deepEqual(focused, [])
})

test('arrow keys wrap, select the neighboring tool and restore focus after rendering', () => {
    const env = fixture()
    for (const [key, index, expected] of [
        ['ArrowLeft', 0, 'armor-setting-panel'],
        ['ArrowRight', 2, 'item-setting-panel'],
        ['ArrowRight', 0, 'weapon-setting-panel']
    ]) {
        const event = keyEvent(key)
        env.vm.onTabKeydown(event, index)
        assert.equal(event.prevented, true)
        assert.equal(event.stopped, true)
        assert.deepEqual(env.changes.at(-1), ['change', expected])
        const before = env.focused.length
        env.flush()
        assert.equal(env.focused.length, before + 1)
        assert.equal(env.focused.at(-1), expected)
    }
})

test('Home and End select the first and last tool', () => {
    const {vm, changes, focused, flush} = fixture('weapon-setting-panel')
    vm.onTabKeydown(keyEvent('Home'), 1)
    vm.onTabKeydown(keyEvent('End'), 1)
    flush()
    assert.deepEqual(changes, [['change', 'item-setting-panel'], ['change', 'armor-setting-panel']])
    assert.deepEqual(focused, ['item-setting-panel', 'armor-setting-panel'])
})

test('unrelated and modified keys retain their native behavior', () => {
    const {vm, changes} = fixture()
    for (const event of [keyEvent('Tab'), keyEvent('Enter'), keyEvent('Escape'),
        keyEvent('ArrowRight', {ctrlKey: true}), keyEvent('Home', {altKey: true}),
        keyEvent('End', {metaKey: true})]) {
        vm.onTabKeydown(event, 0)
        assert.equal(event.prevented, false)
        assert.equal(event.stopped, false)
    }
    assert.deepEqual(changes, [])
})

test('empty groups and stale tab targets are safe', () => {
    const {vm, changes, flush} = fixture('', [])
    assert.equal(vm.currentTool, null)
    vm.onTabKeydown(keyEvent('ArrowLeft'), 0)
    vm.selectTool(null)
    vm.selectTool(tools[0])
    flush()
    assert.deepEqual(changes, [])

    const active = fixture()
    active.vm.selectTool(tools[1], true)
    active.vm.$refs.toolTabs = []
    assert.doesNotThrow(active.flush)
})

test('panel and tab IDs are stable and scoped to the group label', () => {
    const {vm} = fixture()
    assert.equal(vm.panelId, 'cheat-tool-panel-inventory')
    assert.equal(vm.tabId(tools[0]), 'cheat-tool-panel-inventory-tab-item-setting-panel')
    vm.label = 'Game data'
    assert.equal(vm.panelId, 'cheat-tool-panel-game-data')
    vm.label = ''
    assert.equal(vm.panelId, 'cheat-tool-panel-tools')
})
