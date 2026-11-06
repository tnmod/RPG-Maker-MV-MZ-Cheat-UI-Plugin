import { GeneralCheat, BattleCheat } from '../js/CheatHelper.js'

function actorId (actor) {
    return typeof actor.actorId === 'function' ? actor.actorId() : actor._actorId
}

export default {
    name: 'PartySettingGroup',
    template: `
<div class="cheat-party-group">
    <div class="cheat-party-selector cheat-control-heading">
        <label for="cheat-party-actor" class="cheat-field-label">Character</label>
        <select id="cheat-party-actor" class="cheat-number-input" v-model.number="selectedActorId"
            :disabled="!actors.length" @change="onActorChange">
            <option v-for="actor in actors" :key="actor.id" :value="actor.id">{{actor.name}}</option>
        </select>
        <button type="button" class="cheat-button cheat-button--quiet" @click="initializeVariables">Refresh party</button>
    </div>

    <p v-if="!actors.length" class="cheat-control-help" role="status">There are no characters in the current party.</p>
    <template v-else>
        <h4 class="cheat-party-subheading">Health &amp; energy</h4>
        <div class="cheat-party-fields cheat-party-fields--resources">
            <div v-for="field in resourceFields" :key="field.key" class="cheat-party-field">
                <label :for="'cheat-party-' + field.key" class="cheat-field-label">{{field.label}}</label>
                <input :id="'cheat-party-' + field.key" class="cheat-number-input" type="number" min="0" step="1"
                    :max="limits[field.key]" v-model="draft[field.key]"
                    :aria-invalid="invalidField === field.key ? 'true' : 'false'"
                    :aria-describedby="errorMessage ? 'cheat-party-error' : null"
                    @change="onFieldChange(field.key)" @keydown.stop @keyup.stop>
                <span class="cheat-control-help">Maximum {{limits[field.key]}}</span>
            </div>
        </div>

        <h4 class="cheat-party-subheading">Level &amp; experience</h4>
        <div class="cheat-party-fields cheat-party-fields--progress">
            <div class="cheat-party-field">
                <label for="cheat-party-level" class="cheat-field-label">Level</label>
                <input id="cheat-party-level" class="cheat-number-input" type="number" min="1" :max="limits.level" step="1"
                    v-model="draft.level" :aria-invalid="invalidField === 'level' ? 'true' : 'false'"
                    :aria-describedby="errorMessage ? 'cheat-party-error' : null"
                    @change="onFieldChange('level')" @keydown.stop @keyup.stop>
            </div>
            <div class="cheat-party-field">
                <label for="cheat-party-exp" class="cheat-field-label">EXP</label>
                <input id="cheat-party-exp" class="cheat-number-input" type="number" min="0" step="1"
                    v-model="draft.exp" :aria-invalid="invalidField === 'exp' ? 'true' : 'false'"
                    :aria-describedby="errorMessage ? 'cheat-party-error' : null"
                    @change="onFieldChange('exp')" @keydown.stop @keyup.stop>
            </div>
        </div>

        <label class="cheat-toggle">
            <input type="checkbox" v-model="godMode" @change="onGodModeChange">
            <span class="cheat-control-copy"><strong>God mode</strong><span>Keep this character's health and energy full.</span></span>
        </label>

        <h4 class="cheat-party-subheading">Attributes</h4>
        <div class="cheat-party-fields cheat-party-fields--attributes">
            <div v-for="(value, index) in draft.params" :key="index" class="cheat-party-field">
                <label :for="'cheat-party-param-' + index" class="cheat-field-label">{{paramNames[index] || 'Attribute ' + (index + 1)}}</label>
                <input :id="'cheat-party-param-' + index" class="cheat-number-input" type="number" step="1"
                    :min="paramLimits[index].min" :max="paramLimits[index].max" v-model="draft.params[index]"
                    :aria-invalid="invalidField === 'param-' + index ? 'true' : 'false'"
                    :aria-describedby="errorMessage ? 'cheat-party-error' : null"
                    @change="onFieldChange('param', index)" @keydown.stop @keyup.stop>
            </div>
        </div>

        <h4 class="cheat-party-subheading">Whole party</h4>
        <div class="cheat-quick-actions">
            <button type="button" class="cheat-button" @click="onPartyAction('recover')">Recover party</button>
            <button type="button" class="cheat-button" @click="onPartyAction('tp')">Fill party TP</button>
            <button type="button" class="cheat-button" @click="onPartyAction('one')">Party HP to 1</button>
            <button type="button" class="cheat-button" @click="onPartyAction('zero')">Party HP to 0</button>
        </div>
    </template>
    <p v-if="errorMessage" id="cheat-party-error" class="cheat-inline-error" role="alert">{{errorMessage}}</p>
    <p class="cheat-inline-status" role="status" aria-live="polite">{{statusMessage}}</p>
</div>`,

    data () {
        return {
            actors: [],
            selectedActorId: null,
            resourceFields: [{ key: 'hp', label: 'HP' }, { key: 'mp', label: 'MP' }, { key: 'tp', label: 'TP' }],
            draft: { hp: 0, mp: 0, tp: 0, level: 1, exp: 0, params: [] },
            limits: { hp: 0, mp: 0, tp: 100, level: 99 },
            paramNames: [],
            paramLimits: [],
            godMode: false,
            invalidField: '',
            errorMessage: '',
            statusMessage: ''
        }
    },

    created () { this.initializeVariables() },

    methods: {
        currentActor () {
            return $gameParty.members().find(actor => actorId(actor) === this.selectedActorId)
        },

        initializeVariables () {
            const members = $gameParty.members()
            this.actors = members.map(actor => ({
                id: actorId(actor),
                name: typeof actor.name === 'function' ? actor.name() : actor._name
            }))
            if (!members.some(actor => actorId(actor) === this.selectedActorId)) {
                this.selectedActorId = this.actors.length ? this.actors[0].id : null
            }
            this.readActor()
        },

        readActor () {
            const actor = this.currentActor()
            this.errorMessage = ''
            this.invalidField = ''
            if (!actor) return
            const count = actor._paramPlus ? actor._paramPlus.length : 8
            this.paramNames = $dataSystem.terms.params.slice()
            this.paramLimits = Array.from({ length: count }, (_, index) => ({
                min: typeof actor.paramMin === 'function' ? actor.paramMin(index) : 0,
                max: typeof actor.paramMax === 'function' ? actor.paramMax(index) : Number.MAX_SAFE_INTEGER
            }))
            this.limits = {
                hp: actor.mhp, mp: actor.mmp,
                tp: typeof actor.maxTp === 'function' ? actor.maxTp() : 100,
                level: typeof actor.maxLevel === 'function' ? actor.maxLevel() : 99
            }
            this.draft = {
                hp: actor.hp, mp: actor.mp, tp: actor.tp, level: actor.level,
                exp: actor.currentExp(),
                params: Array.from({ length: count }, (_, index) => actor.param(index))
            }
            this.godMode = GeneralCheat.isGodMode(actor)
        },

        onActorChange () {
            this.statusMessage = ''
            this.readActor()
        },

        validInteger (value, min, max, label, field) {
            const number = Number(value)
            if (!/^-?\d+$/.test(String(value).trim()) || !Number.isSafeInteger(number) || number < min || number > max) {
                this.invalidField = field
                this.errorMessage = label + ' must be a whole number between ' + min.toLocaleString() + ' and ' + max.toLocaleString() + '.'
                this.statusMessage = ''
                return null
            }
            return number
        },

        onFieldChange (field, index) {
            const actor = this.currentActor()
            if (!actor) return
            const isParam = field === 'param'
            const label = isParam ? this.paramNames[index] || 'Attribute' : field === 'level' ? 'Level' : field.toUpperCase()
            const min = isParam ? this.paramLimits[index].min : field === 'level' ? 1 : 0
            const max = isParam ? this.paramLimits[index].max : field === 'exp' ? Number.MAX_SAFE_INTEGER : this.limits[field]
            const value = this.validInteger(isParam ? this.draft.params[index] : this.draft[field], min, max, label, isParam ? 'param-' + index : field)
            if (value === null) return
            try {
                if (isParam) actor.addParam(index, value - actor.param(index))
                else if (field === 'level') actor.changeLevel(value, false)
                else if (field === 'exp') actor.changeExp(value, false)
                else actor[{ hp: 'setHp', mp: 'setMp', tp: 'setTp' }[field]](value)
                this.readActor()
                this.statusMessage = label + ' updated.'
            } catch (error) {
                this.errorMessage = 'Could not update ' + label + ': ' + error.message
                this.statusMessage = ''
            }
        },

        onGodModeChange () {
            const actor = this.currentActor()
            if (!actor) return
            try {
                if (this.godMode !== GeneralCheat.isGodMode(actor)) GeneralCheat.toggleGodMode(actor)
                this.readActor()
                this.statusMessage = 'God mode ' + (this.godMode ? 'enabled.' : 'disabled.')
            } catch (error) {
                this.godMode = GeneralCheat.isGodMode(actor)
                this.errorMessage = 'Could not change God mode: ' + error.message
                this.statusMessage = ''
            }
        },

        onPartyAction (action) {
            const actions = {
                recover: () => BattleCheat.recoverAllParty(),
                tp: () => BattleCheat.fillTpAllParty(),
                one: () => BattleCheat.changeAllPartyHealth(1),
                zero: () => BattleCheat.changeAllPartyHealth(0)
            }
            if (!actions[action]) return
            try {
                actions[action]()
                this.initializeVariables()
                this.statusMessage = 'Party updated.'
            } catch (error) {
                this.errorMessage = 'Could not update the party: ' + error.message
                this.statusMessage = ''
            }
        }
    }
}
