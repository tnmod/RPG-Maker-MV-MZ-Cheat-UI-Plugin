import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../cheat-engine/www/cheat/panels/CombatSettingGroup.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')

function fixture () {
    const calls = []
    let active = false
    let enabled = false
    let enemy = member('Bat')
    const party = { inBattle: () => active }
    const troop = { members: () => [enemy] }
    const helper = {
        canExecuteBattleEndProcess: () => active,
        isDisableRandomEncounter: () => enabled,
        toggleDisableRandomEncounter () { enabled = !enabled; calls.push('toggle') },
        encounterBattle () { calls.push('encounter') },
        changeAllEnemyHealth (value) { enemy.setHp(value); calls.push(['allHp', value]) },
        recoverAllEnemy () { enemy.setHp(enemy.mhp); enemy.setMp(enemy.mmp); calls.push('recover') },
        fillTpAllEnemy () { enemy.setTp(100); calls.push('tp') }
    }
    for (const outcome of ['victory', 'defeat', 'escape', 'abort']) {
        helper[outcome] = () => { calls.push(outcome); active = false; return true }
    }
    const component = new Function('BattleCheat', '$gameParty', '$gameTroop', source)(helper, party, troop)
    const vm = component.data()
    for (const [name, method] of Object.entries(component.methods)) vm[name] = method.bind(vm)
    component.created.call(vm)
    return { vm, helper, calls, get enemy () { return enemy },
        setActive (value) { active = value; vm.refreshBattleState() },
        replaceEnemy (next) { enemy = next; vm.refreshBattleState() } }
}

function member (name) {
    return { hp: 20, mhp: 40, mp: 5, mmp: 10, tp: 0, name: () => name,
        maxTp: () => 100,
        setHp (value) { this.hp = value }, setMp (value) { this.mp = value }, setTp (value) { this.tp = value } }
}

test('map state shows no enemies and rejects battle/enemy actions', () => {
    const { vm, calls } = fixture()
    assert.equal(vm.battleActive, false)
    assert.deepEqual(vm.enemies, [])
    vm.runBattleOutcome('victory')
    vm.runEnemyAction('changeAllEnemyHealth', 0)
    assert.deepEqual(calls, [])
})

test('battle state refresh discovers enemies without replacing active drafts on every poll', () => {
    const f = fixture()
    f.setActive(true)
    assert.equal(f.vm.enemies[0].name, 'Bat')
    f.vm.enemies[0].hp = '13'
    f.vm.refreshBattleState()
    assert.equal(f.vm.enemies[0].hp, '13')
    f.replaceEnemy(member('Slime'))
    assert.equal(f.vm.enemies[0].name, 'Slime')
    assert.equal(f.vm.enemies[0].hp, 20)
})

test('encounter checkbox follows its selected value and avoids duplicate toggles', () => {
    const { vm, calls } = fixture()
    vm.disableRandomEncounter = true
    vm.onEncounterToggle()
    vm.onEncounterToggle()
    assert.deepEqual(calls, ['toggle'])
    vm.triggerEncounter()
    assert.deepEqual(calls, ['toggle'])
    vm.disableRandomEncounter = false
    vm.onEncounterToggle()
    vm.triggerEncounter()
    assert.deepEqual(calls, ['toggle', 'toggle', 'encounter'])
})

test('outcome runs once then clears enemy controls when battle ends', () => {
    const f = fixture()
    f.setActive(true)
    f.vm.runBattleOutcome('victory')
    assert.deepEqual(f.calls, ['victory'])
    assert.equal(f.vm.battleActive, false)
    assert.deepEqual(f.vm.enemies, [])
    assert.equal(f.vm.statusMessage, 'Victory requested.')
    f.vm.runBattleOutcome('victory')
    assert.deepEqual(f.calls, ['victory'])
})

test('legacy abort with no return value reports success, while explicit false reports an ending battle', () => {
    const f = fixture()
    f.setActive(true)
    f.helper.abort = () => { f.calls.push('abort') }
    f.vm.runBattleOutcome('abort')
    assert.deepEqual(f.calls, ['abort'])
    assert.equal(f.vm.statusMessage, 'Battle abort requested.')
    f.helper.victory = () => false
    f.vm.runBattleOutcome('victory')
    assert.equal(f.vm.statusMessage, 'The battle is already ending.')
})

test('all-enemy actions update game data and refreshed rows', () => {
    const f = fixture()
    f.setActive(true)
    f.vm.runEnemyAction('changeAllEnemyHealth', 1)
    assert.equal(f.enemy.hp, 1)
    assert.equal(f.vm.enemies[0].hp, 1)
    f.vm.runEnemyAction('recoverAllEnemy')
    assert.equal(f.enemy.hp, 40)
    f.vm.runEnemyAction('fillTpAllEnemy')
    assert.equal(f.vm.enemies[0].tp, 100)
})

test('per-enemy health rejects invalid and out-of-range drafts then applies valid HP/MP/TP', () => {
    const f = fixture()
    f.setActive(true)
    const [hp, mp, tp] = f.vm.healthFields
    const row = f.vm.enemies[0]
    for (const invalid of ['', '-1', '1.5', 'NaN', 'Infinity', '41']) {
        row.hp = invalid
        f.vm.onEnemyHealthChange(row, hp)
        assert.equal(f.enemy.hp, 20)
        assert.match(f.vm.errorMessage, /whole number/)
    }
    for (const [field, value] of [[hp, '12'], [mp, '7'], [tp, '100']]) {
        row[field.key] = value
        f.vm.onEnemyHealthChange(row, field)
        assert.equal(f.enemy[field.key], Number(value))
        assert.equal(f.vm.errorMessage, '')
    }
})

test('stale enemy edits and helper failures cannot crash the group', () => {
    const f = fixture()
    f.setActive(true)
    const old = f.vm.enemies[0]
    f.replaceEnemy(member('Slime'))
    old.hp = 0
    f.vm.onEnemyHealthChange(old, f.vm.healthFields[0])
    assert.equal(f.enemy.hp, 20)
    f.helper.recoverAllEnemy = () => { throw new Error('plugin failure') }
    assert.doesNotThrow(() => f.vm.runEnemyAction('recoverAllEnemy'))
    assert.match(f.vm.errorMessage, /Could not update enemies/)
})
