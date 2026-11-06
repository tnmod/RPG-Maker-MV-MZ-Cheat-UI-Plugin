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
    'Scene_Save', 'Scene_Load', 'Spriteset_Base', 'Window_Message', 'Window_ScrollText', 'Window_BattleLog']) {
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
    reserveTransfer () {}, direction () { return 2 }
}
const actor = {
    _actorId: 1, _name: 'Aria', level: 18, _paramPlus: Array(8).fill(0),
    hp: 420, mhp: 560, mp: 80, mmp: 120, tp: 20,
    name () { return this._name }, currentExp () { return 2400 },
    param (index) { return [560, 120, 48, 32, 40, 28, 36, 24][index] + this._paramPlus[index] },
    addParam (index, amount) { this._paramPlus[index] += amount },
    changeLevel (level) { this.level = level }, changeExp () {},
    setHp (value) { this.hp = value }, setMp (value) { this.mp = value },
    maxTp () { return 100 }, setTp (value) { this.tp = value },
    recoverAll () { this.hp = this.mhp; this.mp = this.mmp },
    isDead () { return this.hp === 0 }
}
window.$gameParty = {
    _gold: 12500, _items: { 1: 8, 2: 3 },
    gold () { return this._gold }, maxGold () { return 99999999 },
    gainGold (amount) { this._gold = Math.min(this.maxGold(), this._gold + amount) },
    loseGold (amount) { this._gold = Math.max(0, this._gold - amount) },
    members () { return [actor] }, inBattle () { return false },
    numItems (item) { return this._items[item.id] || 0 },
    gainItem (item, amount) { this._items[item.id] = Math.max(0, Math.min(99, this.numItems(item) + Number(amount))) }
}
window.$gameTroop = { members: () => [] }
window.$dataItems = [null,
    { id: 1, name: 'Healing potion', description: 'Restore 100 HP.' },
    { id: 2, name: 'Ether', description: 'Restore 30 MP.' },
    { id: 3, name: 'Antidote', description: 'Cure poison.' }
]
window.$dataWeapons = [null, { id: 4, name: 'Iron sword', description: 'A dependable blade.', params: [0, 0, 12, 0, 0, 0, 0, 0] }]
window.$dataArmors = [null, { id: 5, name: 'Traveler cloak', description: 'A warm cloak.', params: [0, 0, 0, 8, 0, 0, 0, 0] }]
window.$dataSystem = {
    variables: ['', 'Quest progress', 'Reputation', 'Dungeon depth', 'Arena wins'],
    switches: ['', 'Gate unlocked', 'Arena registered', 'Quest completed'],
    terms: { params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'Magic attack', 'Magic defense', 'Agility', 'Luck'] }
}
function values (initial) {
    return { _data: initial, value (id) { return this._data[id] || 0 }, setValue (id, value) { this._data[id] = value } }
}
window.$gameVariables = values([0, 3, 45, 2, 6])
window.$gameSwitches = values([false, true, false, true])
window.$gameMap = { mapId: () => 1, width: () => 30, height: () => 20, displayName: () => 'Quiet meadow' }
window.$dataMapInfos = [null, { id: 1, name: 'Quiet meadow', parentId: 0 }, { id: 2, name: 'Town square', parentId: 0 }]
window.$gameSystem = { isSaveEnabled: () => true }
window.DataManager = { maxSavefiles: () => 20 }
window.SoundManager = { playSave () {}, playLoad () {} }
// RPG Maker adds String.contains; the preview mirrors that engine extension.
if (!String.prototype.contains) String.prototype.contains = String.prototype.includes
