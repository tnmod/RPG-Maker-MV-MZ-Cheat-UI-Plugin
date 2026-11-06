/*:
 * @target MZ
 * @plugindesc Starts Cheat UI after the game enters its first scene.
 */
(function () {
    'use strict'

    const script = document.currentScript
    if (!script || !script.src) return
    const entry = new URL('../cheat/init/import.js', script.src).href
    const deadline = Date.now() + 300000
    const timer = window.setInterval(function () {
        if (Date.now() >= deadline) {
            window.clearInterval(timer)
            return
        }
        if (document.readyState !== 'complete' || typeof SceneManager === 'undefined' || !SceneManager._scene) return
        window.clearInterval(timer)
        const loader = document.createElement('script')
        loader.src = entry
        document.body.appendChild(loader)
    }, 100)
})()
