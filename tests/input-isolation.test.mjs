import test from 'node:test'
import assert from 'node:assert/strict'
import {installOverlayInput, isOverlayTarget, isOverlayEditableTarget}
    from '../cheat-engine/www/cheat/js/OverlayInput.js'

class FakeNode {
    constructor (tagName = 'DIV', parentElement = null, id = '') {
        this.nodeType = 1
        this.tagName = tagName
        this.parentElement = parentElement
        this.id = id
        this.listeners = new Map()
    }

    addEventListener (name, listener) {
        const listeners = this.listeners.get(name) || []
        listeners.push(listener)
        this.listeners.set(name, listeners)
    }

    removeEventListener (name, listener) {
        this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== listener))
    }

    dispatch (type, fields = {}) {
        const event = {
            type,
            target: this,
            defaultPrevented: false,
            propagationStopped: false,
            preventDefault () { this.defaultPrevented = true },
            stopPropagation () { this.propagationStopped = true },
            ...fields
        }
        for (let node = this; node; node = node.eventParent || node.parentElement) {
            for (const listener of [...(node.listeners.get(type) || [])]) listener(event)
            if (event.propagationStopped) break
        }
        return event
    }
}

function makeEnvironment () {
    const window = new FakeNode('WINDOW')
    const document = new FakeNode('DOCUMENT')
    document.eventParent = window
    const root = new FakeNode('DIV', document, 'rpg-cheat-app')
    const game = new FakeNode('CANVAS', document)
    const panel = new FakeNode('SECTION', root, 'cheat-modal')
    const field = new FakeNode('INPUT', panel)
    const detachedMenu = new FakeNode('DIV', root)
    const detachedButton = new FakeNode('BUTTON', detachedMenu)
    document.getElementById = id => id === root.id ? root : null
    const calls = []
    const input = {
        pressed: false,
        clears: 0,
        clear () { this.pressed = false; this.clears++ },
        _onKeyDown (event) { this.pressed = true; calls.push(['keydown', event]) },
        _onKeyUp (event) { this.pressed = false; calls.push(['keyup', event]) }
    }
    const touchInput = {clears: 0, clear () { this.clears++ }}
    for (const name of ['_onMouseDown', '_onMouseMove', '_onMouseUp', '_onWheel',
        '_onTouchStart', '_onTouchMove', '_onTouchEnd', '_onTouchCancel',
        '_onPointerDown', '_onPointerMove', '_onPointerUp', '_onPointerCancel']) {
        touchInput[name] = function (...args) { calls.push([name, this, ...args]); return 'engine-result' }
    }
    return {window, document, root, game, panel, field, detachedMenu, detachedButton, calls, input, touchInput}
}

test('recognizes editable controls and detached UI only within the unique cheat mount', () => {
    const env = makeEnvironment()
    assert.equal(isOverlayTarget(env.detachedButton), true)
    assert.equal(isOverlayEditableTarget(env.field), true)
    assert.equal(isOverlayEditableTarget(env.detachedButton), false)
    assert.equal(isOverlayEditableTarget(new FakeNode('INPUT', env.document)), false)
    const editable = new FakeNode('DIV', env.detachedMenu)
    editable.isContentEditable = true
    assert.equal(isOverlayEditableTarget({nodeType: 3, parentElement: editable}), true)
    assert.equal(isOverlayTarget(null), false)
})

test('aliases every existing engine handler while preserving outside behavior, receiver and arguments', () => {
    const env = makeEnvironment()
    const restore = installOverlayInput({}, env)
    const receiver = {}
    const event = {target: env.game, deltaX: 4, deltaY: 8}
    assert.equal(env.touchInput._onWheel.call(receiver, event, 'extra'), 'engine-result')
    assert.deepEqual(env.calls, [['_onWheel', receiver, event, 'extra']])
    env.calls.length = 0
    for (const name of Object.keys(env.touchInput).filter(name => name.startsWith('_on'))) {
        env.touchInput[name]({target: env.detachedButton})
    }
    env.input._onKeyDown({target: env.field})
    env.input._onKeyUp({target: env.field})
    assert.deepEqual(env.calls, [])
    restore()
})

test('overlay wheel scroll keeps its default action and never reaches pre-bound game listeners', () => {
    const env = makeEnvironment()
    env.document.addEventListener('wheel', env.touchInput._onWheel.bind(env.touchInput))
    const restore = installOverlayInput({}, env)
    let targetEvents = 0
    env.detachedMenu.addEventListener('wheel', () => targetEvents++)
    const event = env.detachedMenu.dispatch('wheel', {deltaY: 12})
    assert.equal(targetEvents, 1)
    assert.equal(event.defaultPrevented, false)
    assert.equal(env.calls.length, 0)
    env.game.dispatch('wheel', {deltaY: 12})
    assert.equal(env.calls.length, 1)
    restore()
})

test('mouse, pointer and touch inside detached UI do not reach pre-bound engine handlers', () => {
    const env = makeEnvironment()
    const events = {
        mousedown: '_onMouseDown', mousemove: '_onMouseMove', mouseup: '_onMouseUp',
        touchstart: '_onTouchStart', touchmove: '_onTouchMove', touchend: '_onTouchEnd',
        pointerdown: '_onPointerDown', pointerup: '_onPointerUp'
    }
    for (const [type, name] of Object.entries(events)) {
        env.document.addEventListener(type, env.touchInput[name].bind(env.touchInput))
    }
    const restore = installOverlayInput({}, env)
    for (const type of Object.keys(events)) {
        assert.equal(env.detachedButton.dispatch(type).defaultPrevented, false)
    }
    assert.equal(env.calls.length, 0)
    env.game.dispatch('mousedown')
    assert.equal(env.calls.length, 1)
    restore()
})

test('typing and copy/paste retain native and Vue events without game or cheat shortcuts', () => {
    const env = makeEnvironment()
    env.document.addEventListener('keydown', env.input._onKeyDown.bind(env.input))
    env.document.addEventListener('keyup', env.input._onKeyUp.bind(env.input))
    let shortcuts = 0
    let vueEvents = 0
    env.field.addEventListener('keydown', () => vueEvents++)
    const restore = installOverlayInput({onGlobalKeyDown () { shortcuts++ }}, env)
    for (const key of ['ArrowLeft', 'Backspace', 'c', 'v']) {
        const event = env.field.dispatch('keydown', {key, ctrlKey: key === 'c' || key === 'v'})
        assert.equal(event.defaultPrevented, false)
        env.field.dispatch('keyup', {key})
    }
    assert.equal(vueEvents, 4)
    assert.equal(shortcuts, 0)
    assert.equal(env.calls.length, 0)
    restore()
})

test('non-editable overlay targets can still use global cheat shortcuts exactly once', () => {
    const env = makeEnvironment()
    let down = 0
    let up = 0
    const component = {
        onGlobalKeyDown () { assert.equal(this, component); down++ },
        onGlobalKeyUp () { assert.equal(this, component); up++ }
    }
    env.window.addEventListener('keydown', () => { down++ })
    const restore = installOverlayInput(component, env)
    env.detachedButton.dispatch('keydown', {key: 'c', ctrlKey: true})
    env.detachedButton.dispatch('keyup', {key: 'c', ctrlKey: true})
    assert.equal(down, 1)
    assert.equal(up, 1)
    restore()
})

test('Escape reaches detached widget document handlers and clears any already-bound game input', () => {
    const env = makeEnvironment()
    env.document.addEventListener('keydown', env.input._onKeyDown.bind(env.input))
    let widgetEscapes = 0
    env.document.addEventListener('keydown', event => { if (event.key === 'Escape') widgetEscapes++ })
    const restore = installOverlayInput({}, env)
    env.detachedButton.dispatch('keydown', {key: 'Escape', keyCode: 27})
    assert.equal(widgetEscapes, 1)
    assert.equal(env.input.pressed, false)
    assert.equal(env.input.clears, 1)
    restore()
})

test('entering overlay clears a key or drag started in the game', () => {
    const env = makeEnvironment()
    const restore = installOverlayInput({}, env)
    env.input.pressed = true
    env.field.dispatch('focusin')
    assert.equal(env.input.pressed, false)
    assert.equal(env.input.clears, 1)
    assert.equal(env.touchInput.clears, 1)
    restore()
})

test('cleanup restores original handlers/listeners and does not undo a subsequent plugin wrapper', () => {
    const env = makeEnvironment()
    const originalDown = env.touchInput._onMouseDown
    const restore = installOverlayInput({}, env)
    const ourWheel = env.touchInput._onWheel
    const pluginWheel = function (...args) { return ourWheel.apply(this, args) }
    env.touchInput._onWheel = pluginWheel
    restore()
    restore()
    assert.equal(env.touchInput._onMouseDown, originalDown)
    assert.equal(env.touchInput._onWheel, pluginWheel)
    assert.equal([...env.root.listeners.values()].flat().length, 0)
    assert.equal([...env.window.listeners.values()].flat().length, 0)
    env.touchInput._onWheel({target: env.detachedButton})
    assert.equal(env.calls.length, 1)
})

test('missing DOM and optional engine handlers do not prevent initialization or cleanup', () => {
    const document = {getElementById () { return null }}
    const restore = installOverlayInput(null, {document, input: {}, touchInput: {}})
    assert.doesNotThrow(() => restore())
})
