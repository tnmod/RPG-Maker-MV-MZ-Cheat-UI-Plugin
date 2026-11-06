(function () {
    'use strict'

    // The loader can be reached more than once by plugin managers. Keep one UI.
    if (window.__rpgCheatUiBootstrap) return

    const state = { status: 'waiting' }
    window.__rpgCheatUiBootstrap = state

    const source = document.currentScript && document.currentScript.src
    const base = source ? new URL('../', source).href : 'cheat/'
    const asset = path => base + path

    function validateNwjsVersion () {
        const versions = typeof process === 'object' && process.versions
        const version = versions && (versions.nw || versions['node-webkit'])
        if (!version) return true

        const actual = version.split('.').map(part => parseInt(part, 10) || 0)
        const minimum = [0, 26, 4]
        for (let i = 0; i < minimum.length; i++) {
            if ((actual[i] || 0) > minimum[i]) return true
            if ((actual[i] || 0) < minimum[i]) {
                console.warn('[Cheat UI] NW.js ' + version +
                    ' is unsupported. Version 0.26.4 or newer is required; the game will continue without Cheat UI.')
                return false
            }
        }
        return true
    }

    function addStyle (path) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = asset(path)
        link.onerror = () => console.error('[Cheat UI] Could not load stylesheet: ' + link.href)
        document.head.appendChild(link)
    }

    function addScript (path, type) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script')
            script.type = type || 'text/javascript'
            script.src = asset(path)
            script.async = false
            script.onload = resolve
            script.onerror = () => reject(new Error('Could not load ' + script.src))
            document.body.appendChild(script)
        })
    }

    function engineReady () {
        return document.body && typeof Utils !== 'undefined' &&
            typeof TouchInput !== 'undefined' && typeof Input !== 'undefined' &&
            typeof SceneManager !== 'undefined' && typeof Window_Message !== 'undefined'
    }

    function applyCheat () {
        state.status = 'loading'

        // Append nodes rather than reparsing the game's existing head.
        addStyle('libs/vuetify.min.css')
        addStyle('libs/mdi/materialdesignicons.min.css')
        addStyle('css/main.css?v=workspace-8')

        const appDiv = document.createElement('div')
        appDiv.id = 'rpg-cheat-app'
        appDiv.innerHTML = '<v-app dark><v-main><main-component></main-component></v-main></v-app>'
        document.body.appendChild(appDiv)

        // Classic scripts expose the bundled UMD libraries before Vue mounts.
        // No CDN request is needed, including for styles and icon fonts.
        state.ready = addScript('libs/vue.js')
            .then(() => addScript('libs/vuetify.js'))
            .then(() => addScript('libs/axios.min.js'))
            .then(() => addScript('init/setup.js', 'module'))
            .then(() => { state.status = 'ready' })
            .catch(error => {
                state.status = 'failed'
                if (appDiv.parentNode) appDiv.parentNode.removeChild(appDiv)
                console.error('[Cheat UI] Could not start. Check that the complete cheat folder was copied.', error)
            })
    }

    if (!validateNwjsVersion()) {
        state.status = 'unsupported'
        return
    }

    // Some MZ launchers load this file before the engine scripts.
    const startedAt = Date.now()
    function waitForEngine () {
        if (engineReady()) {
            applyCheat()
        } else if (Date.now() - startedAt < 120000) {
            window.setTimeout(waitForEngine, 100)
        } else {
            state.status = 'failed'
            console.error('[Cheat UI] RPG Maker did not become ready within two minutes.')
        }
    }
    waitForEngine()
})()
