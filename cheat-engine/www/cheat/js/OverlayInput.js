const OVERLAY_ID = 'rpg-cheat-app'

function asElement (target) {
    if (!target) return null
    return target.nodeType === 3 ? target.parentElement : target
}

export function isOverlayTarget (target) {
    for (let element = asElement(target); element; element = element.parentElement) {
        if (element.id === OVERLAY_ID) return true
    }
    return false
}

export function isOverlayEditableTarget (target) {
    if (!isOverlayTarget(target)) return false

    for (let element = asElement(target); element; element = element.parentElement) {
        const tag = (element.tagName || '').toLowerCase()
        if (['input', 'textarea', 'select'].indexOf(tag) !== -1 || element.isContentEditable) {
            return true
        }
        if (element.id === OVERLAY_ID) break
    }
    return false
}

function isEscape (event) {
    return event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27
}

/**
 * Keep the engine's handlers intact outside our UI. The root listeners also
 * cover engine listeners which were bound before this overlay was mounted.
 * Vuetify's detached menus/dialogs remain inside this uniquely named root.
 */
export function installOverlayInput (mainComponent, environment = {}) {
    const documentRef = environment.document || (typeof document !== 'undefined' ? document : null)
    const windowRef = environment.window || (typeof window !== 'undefined' ? window : null)
    const touchInput = environment.touchInput || (typeof TouchInput !== 'undefined' ? TouchInput : null)
    const input = environment.input || (typeof Input !== 'undefined' ? Input : null)
    const root = documentRef && documentRef.getElementById(OVERLAY_ID)
    const restorers = []
    let active = true

    function clearGameInput () {
        if (input && typeof input.clear === 'function') input.clear()
        if (touchInput && typeof touchInput.clear === 'function') touchInput.clear()
    }

    function guardHandler (owner, name) {
        if (!owner || typeof owner[name] !== 'function') return
        const original = owner[name]
        const guarded = function (event) {
            if (active && event && isOverlayTarget(event.target)) return
            return original.apply(this, arguments)
        }
        owner[name] = guarded
        restorers.push(() => {
            // Preserve a handler another plugin installed after ours.
            if (owner[name] === guarded) owner[name] = original
        })
    }

    ;['_onMouseDown', '_onMouseMove', '_onMouseUp', '_onWheel',
        '_onTouchStart', '_onTouchMove', '_onTouchEnd', '_onTouchCancel',
        '_onPointerDown', '_onPointerMove', '_onPointerUp', '_onPointerCancel']
        .forEach(name => guardHandler(touchInput, name))
    ;['_onKeyDown', '_onKeyUp'].forEach(name => guardHandler(input, name))

    function addListener (target, name, listener) {
        if (!target || typeof target.addEventListener !== 'function') return
        target.addEventListener(name, listener, false)
        restorers.push(() => target.removeEventListener(name, listener, false))
    }

    function stopGameEvent (event) {
        if (!active || !isOverlayTarget(event.target)) return

        if (event.type === 'keydown' || event.type === 'keyup' || event.type === 'keypress') {
            // Vuetify listens for Escape on document for some detached widgets.
            if (isEscape(event)) return
            if (!isOverlayEditableTarget(event.target) && mainComponent) {
                const handler = event.type === 'keydown' ? mainComponent.onGlobalKeyDown
                    : event.type === 'keyup' ? mainComponent.onGlobalKeyUp : null
                if (typeof handler === 'function') handler.call(mainComponent, event)
            }
        }

        if (event.type === 'mousedown' || event.type === 'pointerdown' ||
            event.type === 'touchstart' || event.type === 'focusin') {
            // A key or drag may have started in the game before focus entered UI.
            clearGameInput()
        }

        // Keep default input, scrolling, selection, and the target's Vue handlers.
        event.stopPropagation()
    }

    ;['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel',
        'touchstart', 'touchmove', 'touchend', 'touchcancel',
        'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
        'keydown', 'keyup', 'keypress', 'focusin']
        .forEach(name => addListener(root, name, stopGameEvent))

    function clearEscapedInput (event) {
        if (active && isEscape(event) && isOverlayTarget(event.target)) clearGameInput()
    }
    addListener(windowRef, 'keydown', clearEscapedInput)
    addListener(windowRef, 'keyup', clearEscapedInput)

    return function restoreInput () {
        if (!active) return
        active = false
        for (let i = restorers.length - 1; i >= 0; --i) restorers[i]()
    }
}
