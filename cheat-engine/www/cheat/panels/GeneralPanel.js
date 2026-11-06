import { GeneralCheat, GameSpeedCheat, SpeedCheat, SceneCheat } from '../js/CheatHelper.js'

export default {
    name: 'GeneralPanel',

    template: `
<div :class="section === 'all' ? 'cheat-general' : 'cheat-general-group'">
    <div v-if="section === 'all'" class="cheat-panel-toolbar">
        <button type="button" class="cheat-button cheat-button--quiet" @click="initializeVariables">Refresh values</button>
        <span class="cheat-inline-status" role="status" aria-live="polite">{{statusMessage}}</span>
    </div>

    <section v-if="section === 'all' || section === 'gold'" class="cheat-control-section" aria-label="Gold amount">
        <div class="cheat-control-heading">
            <h3 v-if="section === 'all'" id="cheat-gold-heading">Gold</h3>
            <span class="cheat-current-value">Current <strong>{{formattedGold}}</strong></span>
        </div>
        <form class="cheat-gold-form" @submit.prevent="onGoldChange">
            <label for="cheat-gold-amount">Set amount</label>
            <div class="cheat-input-row">
                <input id="cheat-gold-amount" class="cheat-number-input" type="text" inputmode="numeric"
                    v-model="goldDraft" :aria-invalid="goldError ? 'true' : 'false'"
                    :aria-describedby="goldError ? 'cheat-gold-error' : 'cheat-gold-help'"
                    autocomplete="off" @input="goldError = ''; statusMessage = ''" @keydown.stop @keyup.stop>
                <button type="submit" class="cheat-button cheat-button--primary">Apply</button>
            </div>
            <p v-if="goldError" id="cheat-gold-error" class="cheat-inline-error" role="alert">{{goldError}}</p>
            <p v-else id="cheat-gold-help" class="cheat-control-help">Enter the total gold you want to carry.</p>
            <p v-if="section !== 'all' && statusMessage" class="cheat-inline-status" role="status" aria-live="polite">{{statusMessage}}</p>
        </form>
    </section>

    <section v-if="section === 'all' || section === 'movement'" class="cheat-control-section" aria-labelledby="cheat-movement-heading">
        <div class="cheat-control-heading">
            <h3 id="cheat-movement-heading">Movement</h3>
            <output for="cheat-move-speed" class="cheat-value-badge">{{speed.toFixed(1)}}</output>
        </div>
        <label for="cheat-move-speed" class="cheat-field-label">Move speed</label>
        <div class="cheat-range-row">
            <span aria-hidden="true">{{minSpeed}}</span>
            <input id="cheat-move-speed" type="range" v-model.number="speed" :min="minSpeed" :max="maxSpeed" :step="stepSpeed" @change="onSpeedChange" @keydown.stop @keyup.stop>
            <span aria-hidden="true">{{maxSpeed}}</span>
        </div>
        <label class="cheat-toggle">
            <input type="checkbox" v-model="fixSpeed" @change="onSpeedChange">
            <span class="cheat-toggle__track" aria-hidden="true"></span>
            <span class="cheat-control-copy"><strong>Lock move speed</strong><span>Keep this speed when the game changes it.</span></span>
        </label>
        <label class="cheat-toggle">
            <input type="checkbox" v-model="noClip" @change="onNoClipChange">
            <span class="cheat-toggle__track" aria-hidden="true"></span>
            <span class="cheat-control-copy"><strong>Walk through walls</strong><span>Pass through obstacles on the map.</span></span>
        </label>
    </section>

    <section v-if="section === 'all' || section === 'movement'" class="cheat-control-section" aria-labelledby="cheat-game-speed-heading">
        <div class="cheat-control-heading">
            <h3 id="cheat-game-speed-heading">Game speed</h3>
            <div class="cheat-control-heading__actions">
                <output for="cheat-game-speed" class="cheat-value-badge">{{gameSpeed.toFixed(1)}}×</output>
                <button type="button" class="cheat-button cheat-button--quiet" @click="setGameSpeed(1)">Reset</button>
            </div>
        </div>
        <label for="cheat-game-speed" class="cheat-field-label">Speed multiplier</label>
        <div class="cheat-range-row">
            <span aria-hidden="true">0.1×</span>
            <input id="cheat-game-speed" type="range" v-model.number="gameSpeed" :min="minGameSpeed" :max="maxGameSpeed" :step="stepGameSpeed" @change="onGameSpeedChange" @keydown.stop @keyup.stop>
            <span aria-hidden="true">10×</span>
        </div>
        <fieldset class="cheat-scene-fieldset">
            <legend>Apply speed to</legend>
            <div class="cheat-segmented">
                <label :class="{'is-active': gameSpeedScope === 'all'}">
                    <input type="radio" name="cheat-speed-scope" value="all" v-model="gameSpeedScope" @change="onGameSpeedChange">
                    <span>All scenes</span>
                </label>
                <label :class="{'is-active': gameSpeedScope === 'battle'}">
                    <input type="radio" name="cheat-speed-scope" value="battle" v-model="gameSpeedScope" @change="onGameSpeedChange">
                    <span>Battles only</span>
                </label>
            </div>
        </fieldset>
    </section>

    <section v-if="section === 'all' || section === 'session'" class="cheat-control-section cheat-control-section--last" aria-label="Save and session actions">
        <div v-if="section === 'all'" class="cheat-control-heading"><h3 id="cheat-quick-actions-heading">Quick actions</h3></div>
        <div class="cheat-quick-actions">
            <button type="button" class="cheat-button" @click="toggleSaveScene">Open save</button>
            <button type="button" class="cheat-button" @click="toggleLoadScene">Open load</button>
            <button type="button" class="cheat-button" @click="gotoTitle">Return to title</button>
        </div>
    </section>
</div>`,

    props: {
        section: { type: String, default: 'all' },
        canEditGold: { type: Function, default: null }
    },

    data () {
        return {
            noClip: false,
            gold: 0,
            goldDraft: '0',
            goldError: '',
            statusMessage: '',
            speed: 4,
            fixSpeed: false,
            minSpeed: 1,
            maxSpeed: 10,
            stepSpeed: 0.5,
            gameSpeed: 1,
            minGameSpeed: 0.1,
            maxGameSpeed: 10,
            stepGameSpeed: 0.1,
            gameSpeedScope: 'all'
        }
    },

    computed: {
        formattedGold () {
            return Number(this.gold).toLocaleString()
        }
    },

    created () {
        this.initializeVariables()
    },

    methods: {
        initializeVariables () {
            if (this.section === 'all' || this.section === 'gold') this.refreshGold()
            if (this.section === 'gold') return
            this.noClip = !!$gamePlayer._through
            this.speed = Number($gamePlayer.moveSpeed())
            this.fixSpeed = SpeedCheat.isFixed()
            this.gameSpeed = Number(GameSpeedCheat.getRate())
            this.gameSpeedScope = GameSpeedCheat.getSceneOption() === GameSpeedCheat.sceneOptions().battle ? 'battle' : 'all'
        },

        onNoClipChange () {
            GeneralCheat.toggleNoClip()
            this.noClip = !!$gamePlayer._through
        },

        onSpeedChange () {
            SpeedCheat.setSpeed(this.speed, this.fixSpeed)
            SpeedCheat.__writeSettings(this.speed, this.fixSpeed)
        },

        refreshGold () {
            this.gold = typeof $gameParty.gold === 'function' ? $gameParty.gold() : $gameParty._gold
            this.goldDraft = String(this.gold)
            this.goldError = ''
        },

        onGoldChange () {
            if (this.canEditGold && !this.canEditGold()) return
            const draft = String(this.goldDraft).trim()
            const amount = Number(draft)
            if (!/^\d+$/.test(draft) || !Number.isSafeInteger(amount)) {
                this.goldError = 'Enter a whole number of zero or more.'
                this.statusMessage = ''
                return
            }

            const maxGold = typeof $gameParty.maxGold === 'function' ? $gameParty.maxGold() : Number.MAX_SAFE_INTEGER
            if (amount > maxGold) {
                this.goldError = 'This game allows up to ' + Number(maxGold).toLocaleString() + ' gold.'
                this.statusMessage = ''
                return
            }

            const currentGold = typeof $gameParty.gold === 'function' ? $gameParty.gold() : $gameParty._gold
            const difference = amount - currentGold
            if (difference < 0) $gameParty.loseGold(-difference)
            else if (difference > 0) $gameParty.gainGold(difference)

            this.refreshGold()
            this.statusMessage = 'Gold updated to ' + this.formattedGold + '.'
        },

        gotoTitle () {
            SceneCheat.gotoTitle()
        },

        toggleSaveScene () {
            SceneCheat.toggleSaveScene()
        },

        toggleLoadScene () {
            SceneCheat.toggleLoadScene()
        },

        onGameSpeedChange () {
            const sceneOption = GameSpeedCheat.sceneOptions()[this.gameSpeedScope]
            GameSpeedCheat.setGameSpeed(this.gameSpeed, sceneOption)
            GameSpeedCheat.__writeSettings(this.gameSpeed, sceneOption)
        },

        setGameSpeed (amount) {
            this.gameSpeed = amount
            this.onGameSpeedChange()
        }
    }
}
