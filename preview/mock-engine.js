// Minimal desktop engine fixture for reviewing the real UI without a game.
// This is intentionally not a replacement for MV/MZ integration testing.
window.Utils = {
    RPGMAKER_NAME: new URLSearchParams(location.search).get('engine') === 'MV' ? 'MV' : 'MZ',
    isNwjs: () => false
}
window.previewEvents = { keys: 0, clicks: 0, wheel: 0 }
window.Input = {
    clear () {},
    _onKeyDown () { previewEvents.keys++ },
    _onKeyUp () {}
}
window.TouchInput = {
    clear () {},
    _onMouseDown () { previewEvents.clicks++ },
    _onMouseMove () {}, _onMouseUp () {},
    _onWheel () { previewEvents.wheel++ },
    _onTouchStart () {}, _onTouchMove () {}, _onTouchEnd () {}
}
// Bind before Cheat UI, just as the engine does during normal startup.
document.addEventListener('keydown', Input._onKeyDown.bind(Input))
document.addEventListener('keyup', Input._onKeyUp.bind(Input))
document.addEventListener('mousedown', TouchInput._onMouseDown.bind(TouchInput))
document.addEventListener('wheel', TouchInput._onWheel.bind(TouchInput))

for (const name of ['Scene_Map', 'Scene_Battle', 'Scene_Title', 'Scene_Boot',
    'Scene_Save', 'Scene_Load', 'Spriteset_Base', 'Window_Base', 'Window_Message', 'Window_ScrollText', 'Window_BattleLog']) {
    window[name] = class {}
    window[name].prototype.update = function () {}
}
Window_Message.prototype.updateShowFast = function () {}
Window_Message.prototype.updateInput = function () { return false }
Window_ScrollText.prototype.scrollSpeed = function () { return 1 }
Window_BattleLog.prototype.messageSpeed = function () { return 16 }
window.SceneManager = {
    _scene: new Scene_Map(),
    updateScene () {}, updateInputData () {}, changeScene () {},
    goto (scene) { this._scene = new scene() },
    push (scene) { this.goto(scene) }, pop () { this.goto(Scene_Map) }
}
window.$gamePlayer = {
    _through: false, _moveSpeed: 4, x: 8, y: 6,
    moveSpeed () { return this._moveSpeed },
    setMoveSpeed (value) { this._moveSpeed = value },
    canEncounter () { return true },
    reserveTransfer (mapId, x, y, direction) { this._reservedTransfer = { mapId, x, y, direction } },
    setPosition (x, y) { this.x = x; this.y = y }, direction () { return 2 }
}
window.Game_Actor = class {}
const actor = Object.assign(new Game_Actor(), {
    _actorId: 1, _name: 'Aria', level: 18, _expValue: 2400, _paramPlus: Array(8).fill(0),
    hp: 420, mhp: 560, mp: 80, mmp: 120, tp: 20,
    name () { return this._name }, actorId () { return this._actorId }, currentExp () { return this._expValue },
    param (index) { return [560, 120, 48, 32, 40, 28, 36, 24][index] + this._paramPlus[index] },
    addParam (index, amount) { this._paramPlus[index] += amount },
    changeLevel (level) { this.level = level; this._expValue = level * 100 },
    changeExp (exp) { this._expValue = exp; this.level = Math.max(1, Math.min(99, Math.floor(exp / 100))) },
    maxLevel () { return 99 }, paramMin (index) { return index === 1 ? 0 : 1 }, paramMax () { return 999999 },
    setHp (value) { this.hp = value }, setMp (value) { this.mp = value },
    maxTp () { return 100 }, setTp (value) { this.tp = value },
    gainHp (value) { this.setHp(this.hp + value) },
    gainMp (value) { this.setMp(this.mp + value) },
    gainTp (value) { this.setTp(this.tp + value) },
    paySkillCost () {},
    recoverAll () { this.hp = this.mhp; this.mp = this.mmp },
    isDead () { return this.hp === 0 }
})
Object.defineProperties(actor, {
    mhp: { get () { return this.param(0) }, configurable: true },
    mmp: { get () { return this.param(1) }, configurable: true }
})
window.previewParty = [actor]
window.$gameParty = {
    _gold: 12500, _items: { 1: 8, 2: 3 }, _weapons: {}, _armors: {},
    gold () { return this._gold }, maxGold () { return 99999999 },
    gainGold (amount) { this._gold = Math.min(this.maxGold(), this._gold + amount) },
    loseGold (amount) { this._gold = Math.max(0, this._gold - amount) },
    members () { return previewParty },
    inBattle () { return SceneManager._scene instanceof Scene_Battle && BattleManager._phase !== 'battleEnd' },
    performEscape () {},
    itemContainer (item) { return $dataWeapons[item.id] === item ? this._weapons : $dataArmors[item.id] === item ? this._armors : this._items },
    numItems (item) { return this.itemContainer(item)[item.id] || 0 },
    gainItem (item, amount) { this.itemContainer(item)[item.id] = Math.max(0, Math.min(99, this.numItems(item) + Number(amount))) }
}
window.previewEnemies = []
window.$gameTroop = { members: () => previewEnemies }
window.BattleManager = {
    _phase: 'input',
    processVictory () { this._phase = 'battleEnd' },
    processDefeat () { this._phase = 'battleEnd' },
    processEscape () { this._phase = 'battleEnd' },
    processAbort () { this._phase = 'battleEnd' }
}
window.previewStartBattle = function () {
    SceneManager._scene = new Scene_Battle()
    BattleManager._phase = 'input'
    previewEnemies = [{
        hp: 80, mhp: 100, mp: 12, mmp: 30, tp: 15,
        name () { return 'Slime' }, maxTp () { return 100 },
        setHp (value) { this.hp = value }, setMp (value) { this.mp = value }, setTp (value) { this.tp = value },
        deathStateId () { return 1 }, addNewState () { this.hp = 0 }
    }]
}
window.$dataItems = [null,
    { id: 1, name: 'Healing potion', iconIndex: 64, description: 'Restore 100 HP.' },
    { id: 2, name: 'Ether', iconIndex: 65, description: 'Restore 30 MP.' },
    { id: 3, name: 'Antidote', iconIndex: 66, description: 'Cure poison.' },
    { id: 6, name: 'Revive herb', iconIndex: 67, description: 'Revive a fallen ally.' },
    { id: 7, name: 'Smoke bomb', iconIndex: 68, description: 'Escape from battle.' },
    { id: 8, name: 'Tonic', iconIndex: 69, description: 'Restore stamina.' },
    { id: 9, name: 'Sealed note', iconIndex: 0, description: 'An item without an icon.' }
]
window.$dataWeapons = [null, { id: 4, name: 'Iron sword', iconIndex: 96, description: 'A dependable blade.', params: [0, 0, 12, 0, 0, 0, 0, 0] }]
window.$dataArmors = [null, { id: 5, name: 'Traveler cloak', iconIndex: 128, description: 'A warm cloak.', params: [0, 0, 0, 8, 0, 0, 0, 0] }]
for (const key of ['$dataItems', '$dataWeapons', '$dataArmors']) {
    const indexed = [null]
    for (const item of window[key]) if (item) indexed[item.id] = item
    window[key] = indexed
}
window.$dataSystem = {
    variables: ['', 'Quest progress', 'Reputation', 'Dungeon depth', ''],
    switches: ['', 'Gate unlocked', 'Arena registered', 'Quest completed'],
    terms: { params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'Magic attack', 'Magic defense', 'Agility', 'Luck'] }
}
function values (initial) {
    return { _data: initial, value (id) { return this._data[id] || 0 }, setValue (id, value) { this._data[id] = value } }
}
window.$gameVariables = values([0, 3, 45, 2, 0])
window.$gameSwitches = values([false, true, false, true])
window.$gameMap = { mapId: () => 1, width: () => 30, height: () => 20, displayName: () => 'Quiet meadow' }
window.$dataMapInfos = [null, { id: 1, name: 'Quiet meadow', parentId: 0 }, { id: 2, name: 'Town square', parentId: 0 }]
window.$gameSystem = { isSaveEnabled: () => true }
window.DataManager = { maxSavefiles: () => 20 }
window.SoundManager = { playSave () {}, playLoad () {}, playEscape () {} }

// Original pixel shapes for the preview only. Real games supply their own sheet
// through ImageManager, including encrypted or modded IconSet assets.
const iconSheet = document.createElement('canvas')
iconSheet.width = 16 * 32
iconSheet.height = 9 * 32
const iconContext = iconSheet.getContext('2d')
function pixelIcon (index, rows, colors) {
    const left = (index % 16) * 32
    const top = Math.floor(index / 16) * 32
    rows.forEach((row, y) => [...row].forEach((pixel, x) => {
        if (!colors[pixel]) return
        iconContext.fillStyle = colors[pixel]
        iconContext.fillRect(left + x * 2, top + y * 2, 2, 2)
    }))
}
const bottle = [
    '     ooooo      ', '     occco      ', '      ooo       ', '      oho       ',
    '     ohhho      ', '    ohhhhho     ', '   ohhhhhhoo    ', '   ohlllllbo    ',
    '   ohlllllbo    ', '   ohlllllbo    ', '   ohlllllbo    ', '   ohlllllbo    ',
    '    obbbbbo     ', '     ooooo      '
]
;['#ea7d84', '#7ebaf4', '#95d2a4', '#d1aaed', '#d6b481', '#f4c775'].forEach((liquid, offset) => {
    pixelIcon(64 + offset, bottle, { o: '#172238', c: '#d6ad73', h: '#ecf5ff', b: '#90a4bc', l: liquid })
})
pixelIcon(96, [
    '            oo  ', '           ohho ', '          ohho  ', '         ohho   ',
    '        ohho    ', '       ohho     ', '      ohho      ', '   o ohho       ',
    '   obhho        ', '    obo         ', '   ocobo        ', '  oco obo       ',
    ' oco   o        ', ' oo             '
], { o: '#172238', h: '#dbeaf7', b: '#eac684', c: '#ae8a63' })
pixelIcon(128, [
    '     oooooo     ', '    obbbbhho    ', '   obbbbhhhho   ', '   obbbbhhhho   ',
    '    oobbhoo     ', '   obbbbbhho    ', '  obbbbbbhhho   ', '  obbbbbbhhho   ',
    ' obbbbbbbhhhho  ', ' obbbbbbbhhhho  ', 'obbbbbbbbhhhhho ', 'obbbbbbbbhhhhho ',
    ' ooooooooooooo  '
], { o: '#172238', b: '#8e9dd5', h: '#c3d2f6' })
Window_Base._iconWidth = Window_Base._iconHeight = 32
window.ImageManager = {
    loadSystem (name) {
        if (name !== 'IconSet') throw new Error('Preview only provides IconSet')
        return { _canvas: iconSheet, isReady: () => true, isError: () => false,
            addLoadListener (callback) { callback(this) } }
    }
}
if (Utils.RPGMAKER_NAME === 'MZ') {
    ImageManager.iconWidth = ImageManager.iconHeight = 32
}

// A realistic-sized catalog makes continuous scrolling visible in the preview.
// ?records=10000 is the stress fixture; ?records=0 retains the small sample set.
const previewParams = new URLSearchParams(location.search)
const requestedRecords = previewParams.has('records') ? Number(previewParams.get('records')) : 240
const previewRecordCount = Math.max(0, Math.min(20000, Number.isFinite(requestedRecords) ? Math.floor(requestedRecords) : 240))
for (let ordinal = 8; ordinal <= previewRecordCount; ordinal++) {
    const id = ordinal + 2
    $dataItems[id] = { id, name: 'Alchemy reagent ' + String(id).padStart(5, '0'), iconIndex: 64 + (id % 6),
        description: 'A crafting material from region ' + (id % 12 + 1) + '. Used in potions and equipment.' }
}
for (let id = 2; id <= previewRecordCount; id++) {
    if (id > 4) {
        $dataSystem.variables[id] = 'Quest marker ' + String(id).padStart(5, '0')
        $gameVariables._data[id] = id * 3
    }
    if (id > 3) {
        $dataSystem.switches[id] = 'World flag ' + String(id).padStart(5, '0')
        $gameSwitches._data[id] = id % 2 === 0
    }
    if (id > 2) $dataMapInfos[id] = { id, name: 'Region checkpoint ' + String(id).padStart(5, '0'), parentId: id % 3 === 0 ? 1 : 0 }
    $dataWeapons[id + 100] = { id: id + 100, name: 'Tempered blade ' + String(id).padStart(5, '0'), iconIndex: 96, description: 'A balanced weapon forged for field expeditions.' }
    $dataArmors[id + 100] = { id: id + 100, name: 'Expedition cloak ' + String(id).padStart(5, '0'), iconIndex: 128, description: 'Protective travel gear reinforced for long journeys.' }
}
const hiddenVariableId = 4
document.getElementById('preview-quest').addEventListener('click', () => {
    const experience = $gameVariables.value(hiddenVariableId) + 30
    $gameVariables.setValue(hiddenVariableId, experience)
    $gameSwitches.setValue(2, !$gameSwitches.value(2))
    $gameParty.gainItem($dataItems[1], 1)
    document.getElementById('preview-feedback').textContent = 'Reward earned. Total quest EXP: ' + experience + '.'
})
// RPG Maker adds String.contains; the preview mirrors that engine extension.
if (!String.prototype.contains) String.prototype.contains = String.prototype.includes
