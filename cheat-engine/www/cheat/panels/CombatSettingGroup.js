import { BattleCheat } from '../js/CheatHelper.js'

export default {
    name: 'CombatSettingGroup',

    template: `
<div class="cheat-combat-group">
    <div class="cheat-combat-section">
        <label class="cheat-toggle">
            <input type="checkbox" v-model="disableRandomEncounter" @change="onEncounterToggle">
            <span class="cheat-control-copy"><strong>Disable random encounters</strong><span>Explore without random battles.</span></span>
        </label>
        <div class="cheat-quick-actions">
            <button type="button" class="cheat-button" :disabled="battleActive || disableRandomEncounter" @click="triggerEncounter">Trigger encounter</button>
        </div>
        <p class="cheat-control-help">{{disableRandomEncounter ? 'Enable random encounters to trigger one.' : 'Trigger an encounter on your next map update.'}}</p>
    </div>

    <section class="cheat-combat-section" aria-labelledby="cheat-battle-outcome-heading">
        <h4 id="cheat-battle-outcome-heading">Battle outcome</h4>
        <div class="cheat-quick-actions">
            <button type="button" class="cheat-button" :disabled="!battleActive" @click="runBattleOutcome('victory')">Force victory</button>
            <button type="button" class="cheat-button" :disabled="!battleActive" @click="runBattleOutcome('defeat')">Force defeat</button>
            <button type="button" class="cheat-button" :disabled="!battleActive" @click="runBattleOutcome('escape')">Force escape</button>
            <button type="button" class="cheat-button" :disabled="!battleActive" @click="runBattleOutcome('abort')">Abort battle</button>
        </div>
        <p v-if="!battleActive" class="cheat-control-help">Available during an active battle.</p>
    </section>

    <section class="cheat-combat-section" aria-labelledby="cheat-enemies-heading">
        <div class="cheat-control-heading">
            <h4 id="cheat-enemies-heading">Enemies</h4>
            <button type="button" class="cheat-button cheat-button--quiet" @click="initializeVariables">Refresh enemies</button>
        </div>
        <div class="cheat-quick-actions">
            <button type="button" class="cheat-button" :disabled="!battleActive || !enemies.length" @click="runEnemyAction('changeAllEnemyHealth', 0)">Set all enemy HP to 0</button>
            <button type="button" class="cheat-button" :disabled="!battleActive || !enemies.length" @click="runEnemyAction('changeAllEnemyHealth', 1)">Set all enemy HP to 1</button>
            <button type="button" class="cheat-button" :disabled="!battleActive || !enemies.length" @click="runEnemyAction('recoverAllEnemy')">Recover enemies</button>
            <button type="button" class="cheat-button" :disabled="!battleActive || !enemies.length" @click="runEnemyAction('fillTpAllEnemy')">Fill enemy TP</button>
        </div>
        <p v-if="!enemies.length" class="cheat-control-help">Enemy health controls appear when a battle begins.</p>
        <div v-for="enemy in enemies" :key="enemy.index" class="cheat-combat-enemy">
            <h4>{{enemy.name}}</h4>
            <div class="cheat-field-grid">
                <label v-for="field in healthFields" :key="field.key" class="cheat-field">
                    <span>{{field.label}} <small>/ {{enemy[field.maximum]}}</small></span>
                    <input class="cheat-number-input" type="number" min="0" :max="enemy[field.maximum]" step="1"
                        :aria-label="enemy.name + ' ' + field.label" :disabled="!battleActive"
                        v-model="enemy[field.key]" @change="onEnemyHealthChange(enemy, field)" @keydown.stop @keyup.stop>
                </label>
            </div>
        </div>
    </section>
    <p v-if="errorMessage" class="cheat-inline-error" role="alert">{{errorMessage}}</p>
    <p class="cheat-inline-status" role="status" aria-live="polite">{{statusMessage}}</p>
</div>`,

    data () {
        return {
            battleActive: false,
            disableRandomEncounter: false,
            enemies: [],
            errorMessage: '',
            statusMessage: '',
            healthFields: [
                { key: 'hp', label: 'HP', maximum: 'maxHp', setter: 'setHp' },
                { key: 'mp', label: 'MP', maximum: 'maxMp', setter: 'setMp' },
                { key: 'tp', label: 'TP', maximum: 'maxTp', setter: 'setTp' }
            ]
        }
    },

    created () { this.initializeVariables() },
    mounted () { this._battleTimer = setInterval(this.refreshBattleState, 500) },
    beforeDestroy () { clearInterval(this._battleTimer) },

    methods: {
        isActiveBattle () {
            try {
                if (typeof $gameParty === 'undefined' || !$gameParty ||
                    typeof $gameParty.inBattle !== 'function' || !$gameParty.inBattle()) return false
                return !!BattleCheat.canExecuteBattleEndProcess()
            } catch (error) {
                return false
            }
        },

        currentEnemies () {
            if (!this.isActiveBattle() || typeof $gameTroop === 'undefined' || !$gameTroop ||
                typeof $gameTroop.members !== 'function') return []
            return $gameTroop.members().filter(Boolean)
        },

        initializeVariables () {
            this.battleActive = this.isActiveBattle()
            this.disableRandomEncounter = BattleCheat.isDisableRandomEncounter()
            this.enemies = this.currentEnemies().map((member, index) => ({
                _member: member,
                index,
                name: typeof member.name === 'function' ? member.name() : 'Enemy ' + (index + 1),
                hp: member.hp,
                maxHp: member.mhp,
                mp: member.mp,
                maxMp: member.mmp,
                tp: member.tp,
                maxTp: typeof member.maxTp === 'function' ? member.maxTp() : 100
            }))
        },

        refreshBattleState () {
            const members = this.currentEnemies()
            const changed = members.length !== this.enemies.length ||
                members.some((member, index) => member !== this.enemies[index]._member)
            this.battleActive = this.isActiveBattle()
            if (changed) this.initializeVariables()
        },

        onEncounterToggle () {
            try {
                // Refreshing the checkbox must not accidentally toggle the game.
                if (this.disableRandomEncounter !== BattleCheat.isDisableRandomEncounter()) {
                    BattleCheat.toggleDisableRandomEncounter()
                }
                this.disableRandomEncounter = BattleCheat.isDisableRandomEncounter()
                this.errorMessage = ''
                this.statusMessage = this.disableRandomEncounter ? 'Random encounters disabled.' : 'Random encounters enabled.'
            } catch (error) {
                this.errorMessage = 'Could not change random encounters. Refresh and try again.'
                this.statusMessage = ''
            }
        },

        triggerEncounter () {
            if (this.isActiveBattle() || BattleCheat.isDisableRandomEncounter()) return
            try {
                BattleCheat.encounterBattle()
                this.errorMessage = ''
                this.statusMessage = 'Encounter requested for the next map update.'
            } catch (error) {
                this.errorMessage = 'Could not trigger an encounter. Return to the map and try again.'
                this.statusMessage = ''
            }
        },

        runBattleOutcome (outcome) {
            const labels = { victory: 'Victory', defeat: 'Defeat', escape: 'Escape', abort: 'Battle abort' }
            if (!Object.prototype.hasOwnProperty.call(labels, outcome)) return
            if (!this.isActiveBattle()) {
                this.initializeVariables()
                return
            }
            try {
                const completed = BattleCheat[outcome]()
                this.errorMessage = ''
                // Legacy abort() succeeds without returning a value.
                this.statusMessage = completed === false ? 'The battle is already ending.' : labels[outcome] + ' requested.'
                this.initializeVariables()
            } catch (error) {
                this.errorMessage = 'Could not change the battle outcome. Refresh and try again.'
                this.statusMessage = ''
                this.initializeVariables()
            }
        },

        runEnemyAction (action, value) {
            const labels = {
                changeAllEnemyHealth: 'Enemy HP updated.',
                recoverAllEnemy: 'Enemies recovered.',
                fillTpAllEnemy: 'Enemy TP filled.'
            }
            if (!Object.prototype.hasOwnProperty.call(labels, action) || !this.isActiveBattle()) return
            try {
                BattleCheat[action](value)
                this.errorMessage = ''
                this.statusMessage = labels[action]
                this.initializeVariables()
            } catch (error) {
                this.errorMessage = 'Could not update enemies. Refresh and try again.'
                this.statusMessage = ''
            }
        },

        onEnemyHealthChange (enemy, field) {
            if (!this.isActiveBattle() || this.currentEnemies().indexOf(enemy._member) === -1) {
                this.initializeVariables()
                return
            }
            const draft = String(enemy[field.key]).trim()
            const value = Number(draft)
            const maximum = Number(enemy[field.maximum])
            if (!/^\d+$/.test(draft) || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
                this.errorMessage = field.label + ' must be a whole number between 0 and ' + maximum + '.'
                this.statusMessage = ''
                return
            }
            try {
                enemy._member[field.setter](value)
                enemy[field.key] = enemy._member[field.key]
                this.errorMessage = ''
                this.statusMessage = enemy.name + ' ' + field.label + ' updated.'
            } catch (error) {
                this.errorMessage = 'Could not update enemy ' + field.label + '. Refresh and try again.'
                this.statusMessage = ''
            }
        }
    }
}
