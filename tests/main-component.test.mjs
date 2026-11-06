import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {Key} from '../cheat-engine/www/cheat/js/KeyCodes.js'
import {isOverlayEditableTarget} from '../cheat-engine/www/cheat/js/OverlayInput.js'

// Exercise the component's actual lifecycle/methods with engine dependencies
// injected, without importing its game-dependent panel graph or starting timers.
const componentSource = readFileSync(new URL('../cheat-engine/www/cheat/MainComponent.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '')
    .replace('export default', 'return')

function eventSurface () {
    const listeners = new Map()
    return {
        listeners,
        addEventListener (type, handler) {
            listeners.set(type, [...(listeners.get(type) || []), handler])
        },
        removeEventListener (type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter(item => item !== handler))
        },
        emit (type, event = {}) {
            for (const handler of [...(listeners.get(type) || [])]) handler(event)
        }
    }
}

function fixture () {
    const window = eventSurface()
    const document = {...eventSurface(), hidden: false}
    const overlay = {id: 'rpg-cheat-app', parentElement: null, querySelector: () => null}
    document.getElementById = () => overlay
    const calls = []
    let shortcut = Key.fromString('ctrl c')
    let restored = 0
    const shortcuts = {
        shortcutMap: {runLeaveAction: key => calls.push(['release', key.asString()])},
        runKeyLeaveEvent: (event, key) => calls.push(['leave', key.asString()]),
        runKeyEnterEvent: (event, key) => calls.push(['enter', key.asString()]),
        runKeyRepeatEvent: (event, key) => calls.push(['repeat', key.asString()]),
        getShortcut: id => { assert.equal(id, 'toggleCheatModal'); return shortcut }
    }
    const general = {toggleCheatModal () {}, openCheatModal () {}}
    const originalToggle = general.toggleCheatModal
    const originalOpen = general.openCheatModal
    const input = {clears: 0, clear () { this.clears++ }}
    const touchInput = {clears: 0, clear () { this.clears++ }}
    const dependencies = ['CheatModal', 'GLOBAL_SHORTCUT', 'GeneralCheat', 'AlertSnackbar', 'ConfirmDialog',
        'customizeRPGMakerFunctions', 'isOverlayEditableTarget', 'Key', 'Input', 'TouchInput', 'window', 'document']
    const definition = new Function(...dependencies, componentSource)(
        {}, shortcuts, general, {}, {}, () => () => restored++,
        isOverlayEditableTarget, Key, input, touchInput, window, document
    )
    const queuedTicks = []
    let launcherFocuses = 0
    let searchFocuses = 0
    const component = {
        ...definition.data(),
        $nextTick: callback => queuedTicks.push(callback),
        $refs: {
            launcher: {focus () { launcherFocuses++ }},
            console: {$el: {querySelector: () => ({focus () { searchFocuses++ }})}}
        }
    }
    for (const [name, method] of Object.entries(definition.methods)) component[name] = method.bind(component)
    definition.created.call(component)
    return {
        component, definition, window, document, overlay, calls, shortcuts, general, input, touchInput,
        originalToggle, originalOpen,
        setShortcut: value => { shortcut = Key.fromString(value) },
        flush: () => { while (queuedTicks.length) queuedTicks.shift()() },
        get restored () { return restored },
        get launcherFocuses () { return launcherFocuses },
        get searchFocuses () { return searchFocuses }
    }
}

function keyboardEvent (fields = {}) {
    return {keyCode: 0, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
        target: {tagName: 'CANVAS'}, repeat: false, ...fields}
}

test('blur releases a held shortcut and clears its key instead of leaving skip active', () => {
    const env = fixture()
    env.component.onGlobalKeyDown(keyboardEvent({keyCode: 16, shiftKey: true}))
    assert.equal(env.component.currentKey.asString(), 'shift')
    env.calls.length = 0
    env.window.emit('blur')
    assert.deepEqual(env.calls, [['release', 'shift']])
    assert.equal(env.component.currentKey.isEmpty(), true)
})

test('visibility loss releases shortcuts, while visibility restoration leaves state alone', () => {
    const env = fixture()
    env.component.currentKey = Key.fromString('ctrl c')
    env.document.emit('visibilitychange')
    assert.equal(env.component.currentKey.asString(), 'ctrl c')
    env.document.hidden = true
    env.document.emit('visibilitychange')
    assert.equal(env.component.currentKey.isEmpty(), true)
    assert.deepEqual(env.calls, [['release', 'ctrl c']])
})

test('typing/copying and IME composition in overlay release prior keys without firing cheat shortcuts', () => {
    const env = fixture()
    const field = {tagName: 'INPUT', parentElement: env.overlay}
    env.component.currentKey = Key.fromString('alt 1')
    env.component.onGlobalKeyDown(keyboardEvent({target: field, keyCode: 67, ctrlKey: true}))
    env.component.onGlobalKeyUp(keyboardEvent({target: field, keyCode: 67, ctrlKey: true}))
    env.component.onGlobalKeyDown(keyboardEvent({keyCode: 229, isComposing: true}))
    assert.equal(env.component.currentKey.isEmpty(), true)
    assert.equal(env.calls.some(([type]) => type === 'enter' || type === 'repeat'), false)
    assert.deepEqual(env.calls[0], ['release', 'alt 1'])
})

test('open and close focus search/launcher after render and clear engine input on open', () => {
    const env = fixture()
    env.component.openCheatModal('shortcut-panel')
    assert.equal(env.component.show, true)
    assert.equal(env.component.currentComponentName, 'shortcut-panel')
    assert.equal(env.input.clears, 1)
    assert.equal(env.touchInput.clears, 1)
    assert.equal(env.searchFocuses, 0)
    env.flush()
    assert.equal(env.searchFocuses, 1)
    env.component.closeCheatModal()
    assert.equal(env.component.show, false)
    env.flush()
    assert.equal(env.launcherFocuses, 1)
})

test('Escape closes the console and returns focus unless a detached widget or IME needs it', () => {
    const env = fixture()
    function escape () {
        const event = {key: 'Escape', prevented: false, stopped: false,
            preventDefault () { this.prevented = true }, stopPropagation () { this.stopped = true }}
        env.component.onOverlayEscape(event)
        return event
    }
    env.component.show = true
    env.overlay.querySelector = selector => {
        assert.match(selector, /v-dialog__content--active/)
        assert.match(selector, /menuable__content__active/)
        return {}
    }
    assert.equal(escape().prevented, false)
    assert.equal(env.component.show, true)
    env.overlay.querySelector = () => null
    env.component.onOverlayEscape({isComposing: true})
    assert.equal(env.component.show, true)
    const event = escape()
    assert.equal(event.prevented, true)
    assert.equal(event.stopped, true)
    assert.equal(env.component.show, false)
    env.flush()
    assert.equal(env.launcherFocuses, 1)
})

test('launcher text reads the current remapped toggle shortcut on each render', () => {
    const env = fixture()
    assert.equal(env.component.toggleShortcut(), 'Ctrl + C')
    env.setShortcut('alt x')
    env.component.openCheatModal()
    env.component.closeCheatModal()
    assert.equal(env.component.toggleShortcut(), 'Alt + X')
})

test('destroy releases shortcuts, unregisters lifecycle listeners and restores input/helper hooks', () => {
    const env = fixture()
    env.definition.mounted.call(env.component)
    env.component.currentKey = Key.fromString('shift')
    assert.equal(env.general.toggleCheatModal, env.component.toggleCheatModal)
    env.definition.beforeDestroy.call(env.component)
    assert.equal(env.restored, 1)
    assert.equal(env.general.toggleCheatModal, env.originalToggle)
    assert.equal(env.general.openCheatModal, env.originalOpen)
    assert.equal([...env.window.listeners.values()].flat().length, 0)
    assert.equal([...env.document.listeners.values()].flat().length, 0)
    assert.deepEqual(env.calls, [['release', 'shift']])
})

test('destroy preserves helper hooks subsequently installed by another component/plugin', () => {
    const env = fixture()
    const replacement = () => {}
    env.general.toggleCheatModal = replacement
    env.general.openCheatModal = replacement
    env.definition.beforeDestroy.call(env.component)
    assert.equal(env.general.toggleCheatModal, replacement)
    assert.equal(env.general.openCheatModal, replacement)
})
