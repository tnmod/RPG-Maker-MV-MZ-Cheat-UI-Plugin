import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

// Evaluate the real GeneralCheat class without the unrelated module startup
// timers or file-backed settings. Fake timers make its recovery deterministic.
const source = readFileSync(new URL('../cheat-engine/www/cheat/js/CheatHelper.js', import.meta.url), 'utf8')
    .split('export class GeneralCheat {')[1]
    .split('export class GameSpeedCheat {')[0]

function fixture () {
    class Game_Actor {
        constructor (id = 1) {
            this._actorId = id
            this.mhp = 100
            this.mmp = 40
            this.hp = 25
            this.mp = 10
            this.tp = 0
            this.skillCosts = 0
        }
        gainHp (amount) { this.setHp(this.hp + amount) }
        setHp (value) { this.hp = Math.max(0, Math.min(this.mhp, value)) }
        gainMp (amount) { this.setMp(this.mp + amount) }
        setMp (value) { this.mp = Math.max(0, Math.min(this.mmp, value)) }
        gainTp (amount) { this.setTp(this.tp + amount) }
        setTp (value) { this.tp = Math.max(0, Math.min(this.maxTp(), value)) }
        maxTp () { return 100 }
        paySkillCost () { this.skillCosts++; this.gainMp(-5) }
    }
    const intervals = new Map()
    let nextId = 1
    const GeneralCheat = new Function('Game_Actor', 'setInterval', 'clearInterval',
        'class GeneralCheat {' + source + '\nreturn GeneralCheat')(
        Game_Actor,
        (callback, delay) => {
            assert.equal(delay, 1000)
            const id = nextId++
            intervals.set(id, callback)
            return id
        },
        id => intervals.delete(id)
    )
    return {GeneralCheat, Game_Actor, intervals, actor: new Game_Actor()}
}

test('God mode enables without an obsolete settings method and protects HP/MP/TP', () => {
    const {GeneralCheat: cheat, actor, intervals} = fixture()
    assert.equal(cheat.saveCheatSettings, undefined)
    assert.doesNotThrow(() => cheat.godModeOn(actor))
    assert.equal(cheat.isGodMode(actor), true)
    assert.deepEqual(cheat.getGodModeOnActorIds(), [1])
    assert.equal(intervals.size, 1)
    actor.setHp(0)
    actor.gainMp(-100)
    actor.setTp(0)
    actor.paySkillCost({})
    assert.deepEqual([actor.hp, actor.mp, actor.tp], [100, 40, 100])
    assert.equal(actor.skillCosts, 0)
})

test('the recovery interval fills each resource using the actor hooks', () => {
    const {GeneralCheat: cheat, actor, intervals} = fixture()
    cheat.godModeOn(actor)
    intervals.values().next().value()
    assert.deepEqual([actor.hp, actor.mp, actor.tp], [100, 40, 100])
})

test('disabling God mode clears recovery and restores every original method', () => {
    const {GeneralCheat: cheat, actor, intervals} = fixture()
    const names = ['gainHp', 'setHp', 'gainMp', 'setMp', 'gainTp', 'setTp', 'paySkillCost']
    const original = Object.fromEntries(names.map(name => [name, actor[name]]))
    cheat.godModeOn(actor)
    assert.doesNotThrow(() => cheat.godModeOff(actor))
    assert.equal(cheat.isGodMode(actor), false)
    assert.equal(intervals.size, 0)
    assert.equal(cheat.getGodModeData(actor).godModeInterval, null)
    for (const name of names) assert.equal(actor[name], original[name], name)
    actor.setHp(100)
    actor.gainHp(-10)
    actor.setMp(40)
    actor.paySkillCost({})
    actor.setTp(12)
    assert.deepEqual([actor.hp, actor.mp, actor.tp, actor.skillCosts], [90, 35, 12, 1])
})

test('repeated enable/disable does not create duplicate timers and can be toggled again', () => {
    const {GeneralCheat: cheat, actor, intervals} = fixture()
    const originalGainHp = actor.gainHp
    cheat.godModeOn(actor)
    const interval = [...intervals.keys()][0]
    const protectedGainHp = actor.gainHp
    cheat.godModeOn(actor)
    assert.deepEqual([...intervals.keys()], [interval])
    assert.equal(actor.gainHp, protectedGainHp)
    cheat.godModeOff(actor)
    cheat.godModeOff(actor)
    assert.equal(intervals.size, 0)
    assert.equal(actor.gainHp, originalGainHp)
    cheat.toggleGodMode(actor)
    assert.equal(intervals.size, 1)
    cheat.toggleGodMode(actor)
    assert.equal(intervals.size, 0)
    assert.equal(actor.gainHp, originalGainHp)
})

test('non-actor values are ignored without timers or mutation', () => {
    const {GeneralCheat: cheat, intervals} = fixture()
    const enemy = {hp: 30}
    cheat.godModeOn(enemy)
    cheat.godModeOff(enemy)
    assert.deepEqual(enemy, {hp: 30})
    assert.equal(intervals.size, 0)
})
