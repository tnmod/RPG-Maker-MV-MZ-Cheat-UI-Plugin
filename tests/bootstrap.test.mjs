import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../cheat-engine/www/cheat/init/import.js', import.meta.url), 'utf8')

function fixture ({ version, ready = true, failScript } = {}) {
    const scripts = []
    const timers = []
    const errors = []
    const existingHeadNode = { id: 'game-style' }
    const head = { children: [existingHeadNode], appendChild (node) { this.children.push(node) } }
    const body = {
        children: [],
        appendChild (node) {
            this.children.push(node)
            node.parentNode = this
            if (node.tagName === 'script') {
                scripts.push(node.src)
                Promise.resolve().then(() => node.src.includes(failScript || '\u0000') ? node.onerror() : node.onload())
            }
        },
        removeChild (node) { this.children.splice(this.children.indexOf(node), 1) }
    }
    const document = {
        head, body,
        currentScript: { src: 'https://game.example/cheat/init/import.js' },
        createElement: tagName => ({ tagName })
    }
    const globals = {
        document, URL,
        console: { error: (...args) => errors.push(args), warn: (...args) => errors.push(args) },
        setTimeout: callback => { timers.push(callback) }
    }
    if (ready) Object.assign(globals, { Utils: {}, TouchInput: {}, Input: {}, SceneManager: {}, Window_Message: function () {} })
    if (version) globals.process = { versions: { nw: version } }
    globals.window = globals
    const context = vm.createContext(globals)
    return { context, document, scripts, timers, errors, existingHeadNode, run: () => vm.runInContext(source, context) }
}

test('loads local assets in order, preserves the head and mounts only once', async () => {
    const f = fixture()
    f.run()
    const state = f.context.__rpgCheatUiBootstrap
    await state.ready
    assert.equal(state.status, 'ready')
    assert.equal(f.document.head.children[0], f.existingHeadNode)
    assert.deepEqual(f.scripts, [
        'https://game.example/cheat/libs/vue.js',
        'https://game.example/cheat/libs/vuetify.js',
        'https://game.example/cheat/libs/axios.min.js',
        'https://game.example/cheat/init/setup.js'
    ])
    assert.equal(f.document.body.children.filter(node => node.id === 'rpg-cheat-app').length, 1)
    assert.equal(f.document.head.children.slice(1).every(node => node.href.startsWith('https://game.example/cheat/')), true)
    f.run()
    assert.equal(f.context.__rpgCheatUiBootstrap, state)
    assert.equal(f.scripts.length, 4)
})

test('compares NW.js versions numerically', async () => {
    const current = fixture({ version: '0.100.0' })
    current.run()
    await current.context.__rpgCheatUiBootstrap.ready
    assert.equal(current.context.__rpgCheatUiBootstrap.status, 'ready')
    const old = fixture({ version: '0.26.3' })
    old.run()
    assert.equal(old.context.__rpgCheatUiBootstrap.status, 'unsupported')
    assert.equal(old.scripts.length, 0)
    assert.equal(old.document.head.children.length, 1)
    assert.equal(old.errors.length, 1)
})

test('waits for delayed engine globals before mounting', async () => {
    const f = fixture({ ready: false })
    f.run()
    assert.equal(f.scripts.length, 0)
    assert.equal(f.timers.length, 1)
    Object.assign(f.context, { Utils: {}, TouchInput: {}, Input: {}, SceneManager: {}, Window_Message: function () {} })
    f.timers.shift()()
    await f.context.__rpgCheatUiBootstrap.ready
    assert.equal(f.context.__rpgCheatUiBootstrap.status, 'ready')
})

test('reports an asset failure and removes the unmounted overlay', async () => {
    const f = fixture({ failScript: 'vuetify.js' })
    f.run()
    await f.context.__rpgCheatUiBootstrap.ready
    assert.equal(f.context.__rpgCheatUiBootstrap.status, 'failed')
    assert.equal(f.document.body.children.some(node => node.id === 'rpg-cheat-app'), false)
    assert.equal(f.scripts.length, 2)
    assert.equal(f.errors.length, 1)
})
