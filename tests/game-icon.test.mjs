import test from 'node:test'
import assert from 'node:assert/strict'
import GameIcon, {iconDimensions, drawGameIcon}
    from '../cheat-engine/www/cheat/components/GameIcon.js'

const originalImageManager = Object.getOwnPropertyDescriptor(globalThis, 'ImageManager')
const originalWindowBase = Object.getOwnPropertyDescriptor(globalThis, 'Window_Base')

test.afterEach(() => {
    for (const [name, descriptor] of [['ImageManager', originalImageManager], ['Window_Base', originalWindowBase]]) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete globalThis[name]
    }
})

function canvasSpy () {
    const draws = []
    const clears = []
    const context = {
        imageSmoothingEnabled: true,
        drawImage (...args) { draws.push(args) },
        clearRect (...args) { clears.push(args) }
    }
    const canvas = { width: 32, height: 32, getContext: kind => kind === '2d' ? context : null }
    return {canvas, context, draws, clears}
}

function component (iconIndex = 17, canvas = canvasSpy().canvas) {
    const vm = {...GameIcon.data(), iconIndex, $refs: {canvas}}
    vm.renderIcon = GameIcon.methods.renderIcon.bind(vm)
    return vm
}

test('MV uses legacy icon dimensions and falls back independently to 32px', () => {
    assert.deepEqual(iconDimensions(null, null), {width: 32, height: 32})
    assert.deepEqual(iconDimensions({}, {_iconWidth: 48, _iconHeight: 24}), {width: 48, height: 24})
    assert.deepEqual(iconDimensions({}, {_iconWidth: 48, _iconHeight: -1}), {width: 48, height: 32})
})

test('MZ dimensions take priority while invalid dimensions use legacy/default values', () => {
    assert.deepEqual(iconDimensions({iconWidth: 40, iconHeight: 48}, {_iconWidth: 16, _iconHeight: 16}),
        {width: 40, height: 48})
    assert.deepEqual(iconDimensions({iconWidth: 0, iconHeight: NaN}, {_iconWidth: 24, _iconHeight: 40}),
        {width: 24, height: 40})
    assert.deepEqual(iconDimensions({iconWidth: 1.5, iconHeight: '48'}, {_iconWidth: 0, _iconHeight: Infinity}),
        {width: 32, height: 32})
})

test('the crop follows sixteen columns even when the source sheet is wider', () => {
    const spy = canvasSpy()
    const source = {width: 1024, height: 256}
    assert.equal(drawGameIcon(spy.canvas, {_canvas: source}, 17, {width: 32, height: 32}), true)
    assert.deepEqual(spy.draws, [[source, 32, 32, 32, 32, 0, 0, 32, 32]])
    assert.deepEqual(spy.clears, [[0, 0, 32, 32]])
    assert.equal(spy.context.imageSmoothingEnabled, false)
})

test('custom icon dimensions control both source crop and canvas backing dimensions', () => {
    const spy = canvasSpy()
    const image = {width: 768, height: 144}
    assert.equal(drawGameIcon(spy.canvas, {_image: image}, 31, {width: 48, height: 24}), true)
    assert.equal(spy.canvas.width, 48)
    assert.equal(spy.canvas.height, 24)
    assert.deepEqual(spy.draws, [[image, 720, 24, 48, 24, 0, 0, 48, 24]])
})

test('rendering prefers an engine canvas and then its decoded image before the public canvas getter', () => {
    for (const property of ['_canvas', '_image', 'canvas']) {
        const spy = canvasSpy()
        const source = {width: 512, height: 64}
        const bitmap = {[property]: source}
        if (property !== 'canvas') {
            Object.defineProperty(bitmap, 'canvas', {get () { throw new Error('unnecessary canvas allocation') }})
        }
        assert.equal(drawGameIcon(spy.canvas, bitmap, 1, {width: 32, height: 32}), true)
        assert.equal(spy.draws[0][0], source)
    }
})

test('no-icon and invalid indices never draw or resize the canvas', () => {
    const spy = canvasSpy()
    const bitmap = {_canvas: {width: 512, height: 64}}
    for (const index of [0, -1, NaN, Infinity, undefined, null, '1', 1.5]) {
        assert.equal(drawGameIcon(spy.canvas, bitmap, index, {width: 32, height: 32}), false)
    }
    assert.deepEqual(spy.draws, [])
    assert.deepEqual(spy.clears, [])
    assert.equal(spy.canvas.width, 32)
    assert.equal(spy.canvas.height, 32)
})

test('missing data, canvas contexts and out-of-bounds tiles leave a fallback', () => {
    const spy = canvasSpy()
    const dimensions = {width: 32, height: 32}
    assert.equal(drawGameIcon(null, {}, 1, dimensions), false)
    assert.equal(drawGameIcon(spy.canvas, null, 1, dimensions), false)
    assert.equal(drawGameIcon(spy.canvas, {}, 1, dimensions), false)
    assert.equal(drawGameIcon(spy.canvas, {_image: {width: 512, height: 32}}, 16, dimensions), false)
    assert.equal(drawGameIcon(spy.canvas, {_image: {width: 32, height: 32}}, 1, dimensions), false)
    assert.equal(drawGameIcon({getContext: () => null}, {_image: {width: 512, height: 64}}, 1, dimensions), false)
    assert.deepEqual(spy.draws, [])
})

test('a loaded encrypted/overridden engine bitmap is used without direct URLs or cache destruction', () => {
    const spy = canvasSpy()
    const source = {width: 512, height: 128}
    let destroyed = 0
    const bitmap = {
        _image: source,
        isReady: () => true,
        isError: () => false,
        destroy () { destroyed++ },
        get url () { throw new Error('must not read encrypted URLs') }
    }
    const requests = []
    globalThis.ImageManager = {iconWidth: 32, iconHeight: 32, loadSystem: name => { requests.push(name); return bitmap }}
    const vm = component(17, spy.canvas)
    vm.renderIcon()
    assert.equal(vm.loaded, true)
    assert.deepEqual(requests, ['IconSet'])
    assert.equal(spy.draws[0][0], source)
    GameIcon.beforeDestroy.call(vm)
    assert.equal(destroyed, 0)
})

test('delayed bitmap callbacks cannot paint a recycled row with its previous icon', () => {
    const spy = canvasSpy()
    const callbacks = []
    const source = {width: 512, height: 128}
    const bitmap = {_image: source, isReady: () => false, addLoadListener: callback => callbacks.push(callback)}
    globalThis.ImageManager = {loadSystem: () => bitmap}
    const vm = component(17, spy.canvas)
    vm.renderIcon()
    assert.equal(vm.loaded, false)
    vm.iconIndex = 18
    GameIcon.watch.iconIndex.call(vm)
    assert.equal(callbacks.length, 2)
    callbacks[0]()
    assert.deepEqual(spy.draws, [])
    callbacks[1]()
    assert.equal(vm.loaded, true)
    assert.deepEqual(spy.draws, [[source, 64, 32, 32, 32, 0, 0, 32, 32]])
})

test('destroyed components ignore pending load callbacks and keep the bitmap cache intact', () => {
    const spy = canvasSpy()
    let callback
    let destroyed = 0
    const bitmap = {
        _canvas: {width: 512, height: 128}, isReady: () => false,
        addLoadListener (listener) { callback = listener },
        destroy () { destroyed++ }
    }
    globalThis.ImageManager = {loadSystem: () => bitmap}
    const vm = component(17, spy.canvas)
    vm.renderIcon()
    GameIcon.beforeDestroy.call(vm)
    vm.$refs = {}
    assert.doesNotThrow(() => callback())
    assert.equal(vm.loaded, false)
    assert.deepEqual(spy.draws, [])
    assert.equal(destroyed, 0)
})

test('switching a row to no icon invalidates a pending callback without another load', () => {
    const spy = canvasSpy()
    let callback
    let loads = 0
    globalThis.ImageManager = {loadSystem () {
        loads++
        return {_canvas: {width: 512, height: 128}, isReady: () => false, addLoadListener: listener => { callback = listener }}
    }}
    const vm = component(17, spy.canvas)
    vm.renderIcon()
    vm.iconIndex = 0
    vm.renderIcon()
    callback()
    assert.equal(loads, 1)
    assert.equal(vm.loaded, false)
    assert.deepEqual(spy.draws, [])
})

test('missing ImageManager and failed bitmap loads keep fallback visible without throwing', () => {
    delete globalThis.ImageManager
    const vm = component()
    vm.loaded = true
    assert.doesNotThrow(() => vm.renderIcon())
    assert.equal(vm.loaded, false)
    for (const loadSystem of [() => null, () => { throw new Error('load failed') }, () => ({isError: () => true})]) {
        globalThis.ImageManager = {loadSystem}
        vm.loaded = true
        assert.doesNotThrow(() => vm.renderIcon())
        assert.equal(vm.loaded, false)
    }
})

test('canvas/decode failures inside a ready callback never escape into the inventory panel', () => {
    const spy = canvasSpy()
    spy.context.drawImage = () => { throw new Error('bad decoded source') }
    globalThis.ImageManager = {loadSystem: () => ({_image: {width: 512, height: 64}, isReady: () => true})}
    const vm = component(1, spy.canvas)
    assert.doesNotThrow(() => vm.renderIcon())
    assert.equal(vm.loaded, false)
})
