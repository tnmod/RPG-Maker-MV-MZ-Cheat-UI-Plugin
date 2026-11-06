import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../cheat-engine/www/cheat/panels/PartySettingGroup.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')

function actor (id) {
    return {
        _actorId: id, _name: 'Actor ' + id, _paramPlus: Array(8).fill(0),
        hp: 50, mp: 20, tp: 10, mhp: 100, mmp: 40, level: 5, exp: 200,
        name () { return this._name }, maxTp () { return 100 }, maxLevel () { return 120 },
        currentExp () { return this.exp },
        param (index) { return 10 + this._paramPlus[index] },
        paramMin () { return 0 }, paramMax () { return 999 },
        addParam (index, amount) { this._paramPlus[index] += amount },
        setHp (n) { this.hp = n }, setMp (n) { this.mp = n }, setTp (n) { this.tp = n },
        changeLevel (n) { this.level = n; this.exp = n * 100 },
        changeExp (n) { this.exp = n; this.level = Math.floor(n / 100) }
    }
}

function fixture (members = [actor(1), actor(2)]) {
    const party = { members: () => members }
    const god = new Set()
    const general = {
        isGodMode: target => god.has(target),
        toggleGodMode: target => god.has(target) ? god.delete(target) : god.add(target)
    }
    const battle = {
        recoverAllParty: () => members.forEach(a => { a.setHp(a.mhp); a.setMp(a.mmp); a.setTp(a.maxTp()) }),
        fillTpAllParty: () => members.forEach(a => a.setTp(a.maxTp())),
        changeAllPartyHealth: n => members.forEach(a => a.setHp(n))
    }
    const system = { terms: { params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'Magic attack', 'Magic defense', 'Agility', 'Luck'] } }
    const definition = new Function('GeneralCheat', 'BattleCheat', '$gameParty', '$dataSystem', source)(general, battle, party, system)
    const vm = definition.data()
    for (const [name, method] of Object.entries(definition.methods)) vm[name] = method.bind(vm)
    definition.created.call(vm)
    return { vm, members, god }
}

test('party refresh preserves selected actor by ID and selects another when removed', () => {
    const { vm, members } = fixture()
    assert.equal(vm.selectedActorId, 1)
    vm.selectedActorId = 2
    vm.onActorChange()
    members.reverse()
    vm.initializeVariables()
    assert.equal(vm.selectedActorId, 2)
    members.splice(0, 1)
    vm.initializeVariables()
    assert.equal(vm.selectedActorId, 1)
})

test('empty party is handled without trying to access a character', () => {
    const { vm } = fixture([])
    assert.deepEqual(vm.actors, [])
    assert.equal(vm.selectedActorId, null)
    assert.doesNotThrow(() => vm.onFieldChange('hp'))
    assert.doesNotThrow(() => vm.onGodModeChange())
})

test('resource fields reject invalid and out of bounds drafts without mutating actor', () => {
    const { vm, members } = fixture()
    for (const invalid of ['', '-1', '1.5', '1e2', '101', 'NaN']) {
        vm.draft.hp = invalid
        vm.onFieldChange('hp')
        assert.equal(members[0].hp, 50)
        assert.equal(vm.invalidField, 'hp')
        assert.match(vm.errorMessage, /HP must be a whole number/)
    }
    vm.draft.hp = '0'
    vm.onFieldChange('hp')
    assert.equal(members[0].hp, 0)
    assert.equal(vm.errorMessage, '')
    vm.draft.mp = '40'
    vm.onFieldChange('mp')
    assert.equal(members[0].mp, 40)
})

test('progress uses engine limits and re-reads linked level and EXP after change', () => {
    const { vm, members } = fixture()
    vm.draft.level = '121'
    vm.onFieldChange('level')
    assert.equal(members[0].level, 5)
    vm.draft.level = '110'
    vm.onFieldChange('level')
    assert.equal(vm.draft.level, 110)
    assert.equal(vm.draft.exp, 11000)
    vm.draft.exp = '900'
    vm.onFieldChange('exp')
    assert.equal(vm.draft.level, 9)
    assert.equal(vm.draft.exp, 900)
})

test('attributes apply a delta to the selected actor and respect engine bounds', () => {
    const { vm, members } = fixture()
    vm.selectedActorId = 2
    vm.onActorChange()
    vm.draft.params[2] = '65'
    vm.onFieldChange('param', 2)
    assert.equal(members[1].param(2), 65)
    assert.equal(members[0].param(2), 10)
    vm.draft.params[2] = '1000'
    vm.onFieldChange('param', 2)
    assert.equal(members[1].param(2), 65)
    assert.equal(vm.invalidField, 'param-2')
})

test('whole party recovery/TP/HP actions refresh the visible character fields', () => {
    const { vm, members } = fixture()
    vm.onPartyAction('one')
    assert.ok(members.every(a => a.hp === 1))
    assert.equal(vm.draft.hp, 1)
    vm.onPartyAction('zero')
    assert.ok(members.every(a => a.hp === 0))
    vm.onPartyAction('recover')
    assert.ok(members.every(a => a.hp === 100 && a.mp === 40 && a.tp === 100))
    assert.equal(vm.draft.hp, 100)
    members.forEach(a => { a.tp = 0 })
    vm.onPartyAction('tp')
    assert.ok(members.every(a => a.tp === 100))
    assert.equal(vm.draft.tp, 100)
})

test('God mode toggles the selected character, without affecting other actors', () => {
    const { vm, members, god } = fixture()
    vm.selectedActorId = 2
    vm.onActorChange()
    vm.godMode = true
    vm.onGodModeChange()
    assert.ok(god.has(members[1]))
    assert.ok(!god.has(members[0]))
    assert.equal(vm.godMode, true)
    vm.godMode = false
    vm.onGodModeChange()
    assert.equal(god.size, 0)
})
