import {KeyValueStorage} from './KeyValueStorage.js'

export const LAUNCHER_POSITIONS = {
    'top-left': { label: 'Top Left', top: '16px', left: '16px', right: 'auto', bottom: 'auto' },
    'top-right': { label: 'Top Right', top: '16px', right: '16px', left: 'auto', bottom: 'auto' },
    'bottom-left': { label: 'Bottom Left', bottom: '16px', left: '16px', top: 'auto', right: 'auto' },
    'bottom-right': { label: 'Bottom Right', bottom: '16px', right: '16px', top: 'auto', left: 'auto' }
}

export const DEFAULT_LAUNCHER_SETTINGS = {
    position: 'top-right',
    compactMode: false,        // Show only icon, no text
    fadeWhenHidden: true,      // Fade launcher when cheat is closed
    fadeOpacity: 0.3,          // Opacity when faded (0-1)
    showShortcut: true,        // Show keyboard shortcut hint
    autoHide: false            // Auto-hide launcher completely (show on hover)
}


class LauncherSettings {
    constructor () {
        this.kvStorage = new KeyValueStorage('./www/cheat-settings/launcher.json')
        this.__readSettings()
    }

    __readSettings () {
        const json = this.kvStorage.getItem('data')

        if (!json) {
            this.data = { ...DEFAULT_LAUNCHER_SETTINGS }
            return
        }

        try {
            const saved = JSON.parse(json)
            this.data = { ...DEFAULT_LAUNCHER_SETTINGS, ...saved }
        } catch (e) {
            console.error('[LauncherSettings] Failed to parse settings, using defaults:', e)
            this.data = { ...DEFAULT_LAUNCHER_SETTINGS }
        }
    }

    __writeSettings () {
        this.kvStorage.setItem('data', JSON.stringify(this.data))
    }

    getPosition () {
        return this.data.position || 'top-right'
    }

    setPosition (position) {
        if (LAUNCHER_POSITIONS[position]) {
            this.data.position = position
            this.__writeSettings()
        }
    }

    getPositionStyle () {
        const pos = LAUNCHER_POSITIONS[this.getPosition()] || LAUNCHER_POSITIONS['top-right']
        return {
            top: pos.top,
            right: pos.right,
            bottom: pos.bottom,
            left: pos.left
        }
    }

    isCompactMode () {
        return this.data.compactMode === true
    }

    setCompactMode (enabled) {
        this.data.compactMode = !!enabled
        this.__writeSettings()
    }

    isFadeWhenHidden () {
        return this.data.fadeWhenHidden !== false
    }

    setFadeWhenHidden (enabled) {
        this.data.fadeWhenHidden = !!enabled
        this.__writeSettings()
    }

    getFadeOpacity () {
        return this.data.fadeOpacity ?? 0.3
    }

    setFadeOpacity (opacity) {
        this.data.fadeOpacity = Math.max(0, Math.min(1, Number(opacity) || 0.3))
        this.__writeSettings()
    }

    isShowShortcut () {
        return this.data.showShortcut !== false
    }

    setShowShortcut (enabled) {
        this.data.showShortcut = !!enabled
        this.__writeSettings()
    }

    isAutoHide () {
        return this.data.autoHide === true
    }

    setAutoHide (enabled) {
        this.data.autoHide = !!enabled
        this.__writeSettings()
    }

    getAllSettings () {
        return { ...this.data }
    }
}


export const LAUNCHER_SETTINGS = new LauncherSettings()