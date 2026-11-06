export const SAVED_LOCATIONS_KEY = 'cheat.locations'

export function validPosition (mapId, x, y) {
    return Number.isSafeInteger(mapId) && mapId > 0 && Number.isSafeInteger(x) && x >= 0 &&
        Number.isSafeInteger(y) && y >= 0
}

export function readSavedLocations (storage) {
    const stored = storage.getItem(SAVED_LOCATIONS_KEY)
    const locations = stored ? JSON.parse(stored) : []
    if (!Array.isArray(locations) || locations.some(location => !location ||
        !validPosition(location.mapId, location.x, location.y) ||
        (location.name !== undefined && typeof location.name !== 'string'))) throw new Error('Invalid saved locations')
    return locations
}

export function currentLocation (name = '', gameMap = $gameMap, player = $gamePlayer, maps = $dataMapInfos) {
    if (!gameMap || !player || !maps) return null
    const mapId = gameMap.mapId()
    const { x, y } = player
    const map = maps[mapId]
    if (!map || !validPosition(mapId, x, y)) return null
    return { name: String(name || '').trim() || map.name || 'Map #' + mapId, mapId, x, y }
}
