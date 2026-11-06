export function recordingContext () {
    return { variables: $gameVariables, switches: $gameSwitches, party: $gameParty,
        items: $dataItems, weapons: $dataWeapons, armors: $dataArmors }
}

export function sameRecordingGame (context) {
    return !!context && context.variables === $gameVariables && context.switches === $gameSwitches &&
        context.party === $gameParty && context.items === $dataItems && context.weapons === $dataWeapons &&
        context.armors === $dataArmors
}

export function createRecording (context, deadline) {
    const changes = { variables: new Set(), switches: new Set(), items: new Set(), weapons: new Set(), armors: new Set() }
    const restore = []
    let active = true

    function stop () {
        active = false
        while (restore.length) restore.pop()()
    }

    function observe (target, method, identify, readValue) {
        const original = target[method]
        if (typeof original !== 'function') throw new Error('Missing game method: ' + method)
        const descriptor = Object.getOwnPropertyDescriptor(target, method)
        function observed (first) {
            if (!active || this !== target || performance.now() >= deadline) return original.apply(this, arguments)
            let kind, id, before
            try {
                kind = identify(first)
                if (kind) {
                    id = typeof first === 'number' ? first : first.id
                    if (changes[kind].has(id)) kind = null
                    else before = readValue(first)
                }
            } catch (error) {
                kind = null
            }
            const result = original.apply(this, arguments)
            if (kind) {
                try {
                    if (!Object.is(before, readValue(first))) changes[kind].add(id)
                } catch (error) {
                    // Recorder observation must not interfere with the game method.
                }
            }
            return result
        }

        // Keep temporary wrappers out of the game's serialized data.
        Object.defineProperty(target, method, { configurable: true, writable: true, value: observed })
        restore.push(() => {
            const current = Object.getOwnPropertyDescriptor(target, method)
            if (!current || current.value !== observed || !current.configurable) return
            if (descriptor) Object.defineProperty(target, method, descriptor)
            else delete target[method]
        })
    }

    try {
        for (const kind of ['variables', 'switches']) {
            const store = context[kind]
            observe(store, 'setValue', id => Number.isSafeInteger(id) && id > 0 ? kind : null, id => store.value(id))
        }
        observe(context.party, 'gainItem', item => {
            if (!item || !Number.isSafeInteger(item.id) || item.id <= 0) return null
            for (const kind of ['items', 'weapons', 'armors']) {
                if (context[kind] && context[kind][item.id] === item) return kind
            }
            return null
        }, item => context.party.numItems(item))
    } catch (error) {
        stop()
        throw error
    }

    return {
        context,
        stop () {
            stop()
            const results = {}
            for (const kind of Object.keys(changes)) results[kind] = Array.from(changes[kind])
            return results
        }
    }
}
