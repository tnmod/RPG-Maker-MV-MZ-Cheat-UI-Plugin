import CheatModal from './CheatModal.js'
import { GLOBAL_SHORTCUT } from './js/GlobalShortcut.js'
import { GeneralCheat } from './js/CheatHelper.js'
import AlertSnackbar from './components/AlertSnackbar.js'
import ConfirmDialog from './components/ConfirmDialog.js'
import { customizeRPGMakerFunctions } from './init/customize_functions.js'
import { isOverlayEditableTarget } from './js/OverlayInput.js'
import { Key } from './js/KeyCodes.js'
import { createRecording, recordingContext, sameRecordingGame } from './js/GameDataRecorder.js'
import { REALTIME_TRANSLATOR, TRANSLATE_SETTINGS } from './js/TranslateHelper.js'
import { LAUNCHER_SETTINGS, LAUNCHER_POSITIONS } from './js/LauncherSettings.js'

const recordingSeconds = 60

export default {
    name: 'MainComponent',
    components: { CheatModal, AlertSnackbar, ConfirmDialog },
    template: `
<div class="cheat-workspace" @keydown.esc.capture="onOverlayEscape" @focusin="resetPressedKeys">
    <div v-if="!show && recorder.active" class="cheat-launcher cheat-recorder-indicator" :style="launcherPositionStyle" aria-label="Recording game data">
        <span class="cheat-recorder-time">REC {{recorder.remaining}}s</span>
        <button type="button" class="cheat-button" @click="finishRecording(true)">Stop</button>
    </div>
    <button v-else-if="!show && recorder.resultsPending" type="button" class="cheat-launcher" :style="launcherPositionStyle" @click="openCheatModal('recorder-panel')">View results</button>

    <!-- Wrapper for auto-hide hover detection -->
    <div v-else-if="!show" class="cheat-launcher-wrapper" :class="wrapperClasses" :style="launcherPositionStyle">
        <button
            ref="launcher"
            type="button"
            class="cheat-launcher"
            :class="[launcherClasses, 'cheat-launcher--wrapped']"
            aria-label="Open cheat console"
            aria-controls="cheat-modal"
            :aria-expanded="String(show)"
            @click="openCheatModal()">
            <span class="cheat-launcher__symbol" aria-hidden="true">✦</span>
            <span v-if="!isCompactMode">Cheats</span>
            <kbd v-if="!isCompactMode && showShortcut">{{toggleShortcut()}}</kbd>
        </button>
    </div>
    <cheat-modal
        v-if="consoleMounted"
        :key="consoleSession"
        id="cheat-modal"
        ref="console"
        v-model="currentComponentName"
        :visible="show"
        :recorder="recorder"
        :can-edit-recording="canEditRecording"
        @start-recording="startRecording"
        @stop-recording="finishRecording(true)"
        @close="closeCheatModal">
    </cheat-modal>
    <alert-snackbar></alert-snackbar>
    <confirm-dialog></confirm-dialog>
</div>`,

    data () {
        return {
            currentKey: Key.createEmpty(),
            show: false,
            consoleMounted: false,
            consoleSession: 0,
            currentComponentName: 'general-panel',
            recorder: { active: false, remaining: 0, results: null, resultsPending: false, message: '' }
        }
    },

    created () {
        this._previousToggle = GeneralCheat.toggleCheatModal
        this._previousOpen = GeneralCheat.openCheatModal
        GeneralCheat.toggleCheatModal = this.toggleCheatModal
        GeneralCheat.openCheatModal = this.openCheatModal

        window.addEventListener('keydown', this.onGlobalKeyDown)
        window.addEventListener('keyup', this.onGlobalKeyUp)
        window.addEventListener('blur', this.resetPressedKeys)
        document.addEventListener('visibilitychange', this.onVisibilityChange)
    },

    mounted () {
        this._restoreGameInput = customizeRPGMakerFunctions(this)
    },

    watch: {
        currentComponentName (route) {
            if (route === 'recorder-panel' && (this._recording || this._recordingContext)) this.canEditRecording()
        }
    },

    computed: {
        launcherPositionStyle () {
            return LAUNCHER_SETTINGS.getPositionStyle()
        },
        isCompactMode () {
            return LAUNCHER_SETTINGS.isCompactMode()
        },
        showShortcut () {
            return LAUNCHER_SETTINGS.isShowShortcut()
        },
        isFadeWhenHidden () {
            return LAUNCHER_SETTINGS.isFadeWhenHidden()
        },
        fadeOpacity () {
            return LAUNCHER_SETTINGS.getFadeOpacity()
        },
        isAutoHide () {
            return LAUNCHER_SETTINGS.isAutoHide()
        },
        wrapperClasses () {
            return {
                'cheat-launcher-wrapper--auto-hide': this.isAutoHide && !this.show
            }
        },
        launcherClasses () {
            return {
                'cheat-launcher--compact': this.isCompactMode,
                'cheat-launcher--faded': this.isFadeWhenHidden && !this.show
            }
        }
    },

    data () {
        return {
            currentKey: Key.createEmpty(),
            show: false,
            consoleMounted: false,
            consoleSession: 0,
            currentComponentName: 'general-panel',
            recorder: { active: false, remaining: 0, results: null, resultsPending: false, message: '' }
        }
    },

    methods: {
        startRecording () {
            if (this.recorder.active) return
            this.clearRecording()
            this.recorder.message = ''
            try {
                this._recordingDeadline = performance.now() + recordingSeconds * 1000
                this._recording = createRecording(recordingContext(), this._recordingDeadline)
            } catch (error) {
                this.recorder.message = 'Could not start recording. Return to the game and try again.'
                return
            }
            this.recorder.remaining = recordingSeconds
            this.recorder.active = true
            this._recordingTimer = setInterval(this.updateRecording, 200)
            this.closeCheatModal()
        },

        updateRecording () {
            if (!this._recording) return
            if (!this.canEditRecording()) return
            this.recorder.remaining = Math.max(0, Math.ceil((this._recordingDeadline - performance.now()) / 1000))
            if (this.recorder.remaining === 0) this.finishRecording(false)
        },

        finishRecording (openResults) {
            if (!this._recording || !this.canEditRecording()) return
            clearInterval(this._recordingTimer)
            this._recordingContext = this._recording.context
            this.recorder.results = this._recording.stop()
            this._recording = null
            this.recorder.active = false
            this.recorder.resultsPending = !openResults
            if (openResults) this.openCheatModal('recorder-panel')
        },

        clearRecording () {
            clearInterval(this._recordingTimer)
            if (this._recording) this._recording.stop()
            this._recording = null
            this._recordingContext = null
            this.recorder.active = false
            this.recorder.results = null
            this.recorder.resultsPending = false
        },

        canEditRecording () {
            const context = this._recording ? this._recording.context : this._recordingContext
            if (!context) return false
            const onTitle = typeof Scene_Title !== 'undefined' && SceneManager._scene instanceof Scene_Title
            if (!onTitle && sameRecordingGame(context)) return true
            this.clearRecording()
            this.recorder.message = 'The game session changed. Start a new recording to inspect it.'
            return false
        },

        toggleShortcut () {
            return GLOBAL_SHORTCUT.getShortcut('toggleCheatModal').asDisplayString()
        },

        resetPressedKeys () {
            GLOBAL_SHORTCUT.shortcutMap.runLeaveAction(Key.fromKey(this.currentKey))
            this.currentKey = Key.createEmpty()
        },

        onVisibilityChange () {
            if (document.hidden) this.resetPressedKeys()
        },

        onGlobalKeyDown (e) {
            if (e.isComposing || isOverlayEditableTarget(e.target)) {
                this.resetPressedKeys()
                return
            }
            if (e.repeat) {
                GLOBAL_SHORTCUT.runKeyRepeatEvent(e, Key.fromKey(this.currentKey))
            } else {
                GLOBAL_SHORTCUT.runKeyLeaveEvent(e, Key.fromKey(this.currentKey))
                this.currentKey.add(e.keyCode)
                this.currentKey.adjustCombiningKey(e)
                GLOBAL_SHORTCUT.runKeyEnterEvent(e, Key.fromKey(this.currentKey))
            }
        },

        onGlobalKeyUp (e) {
            if (e.isComposing || isOverlayEditableTarget(e.target)) {
                this.resetPressedKeys()
                return
            }
            GLOBAL_SHORTCUT.runKeyLeaveEvent(e, Key.fromKey(this.currentKey))
            this.currentKey.remove(e.keyCode)
            this.currentKey.adjustCombiningKey(e)
            GLOBAL_SHORTCUT.runKeyEnterEvent(e, Key.fromKey(this.currentKey))
        },

        onOverlayEscape (e) {
            const root = document.getElementById('rpg-cheat-app')
            if (!this.show || e.isComposing || (root && root.querySelector(
                '.v-dialog__content--active, .v-menu__content.menuable__content__active'
            ))) return
            e.preventDefault()
            e.stopPropagation()
            this.closeCheatModal()
        },

        openCheatModal (componentName = null) {
            if (this._recordingContext || this._recording) this.canEditRecording()
            if (componentName) this.currentComponentName = componentName
            if (this.currentComponentName === 'recorder-panel') this.recorder.resultsPending = false
            const opening = !this.show
            if (opening) {
                const party = typeof $gameParty === 'undefined' ? null : $gameParty
                if (this.consoleMounted && party !== this._consoleParty) this.consoleSession++
                this._consoleParty = party
                this.consoleMounted = true

                // Initialize real-time translator when game is ready
                if (TRANSLATE_SETTINGS.isRealtimeEnabled() && typeof SceneManager !== 'undefined') {
                    REALTIME_TRANSLATOR.initialize()
                }
            }
            this.show = true
            if (opening) {
                if (typeof Input !== 'undefined') Input.clear()
                if (typeof TouchInput !== 'undefined') TouchInput.clear()
                this.$nextTick(() => {
                    const console = this.$refs.console
                    if (console) {
                        const search = console.$el.querySelector('input[type="search"]')
                        if (search) search.focus({preventScroll: true})
                    }
                })
            }
        },

        closeCheatModal () {
            this._consoleParty = typeof $gameParty === 'undefined' ? null : $gameParty
            this.show = false
            this.resetPressedKeys()
            this.$nextTick(() => {
                if (this.$refs.launcher) this.$refs.launcher.focus()
            })
        },

        toggleCheatModal (componentName = null) {
            if (this.show && (!componentName || componentName === this.currentComponentName)) {
                this.closeCheatModal()
            } else {
                this.openCheatModal(componentName)
            }
        },

        beforeDestroy () {
            this.clearRecording()
            this.resetPressedKeys()
            window.removeEventListener('keydown', this.onGlobalKeyDown)
            window.removeEventListener('keyup', this.onGlobalKeyUp)
            window.removeEventListener('blur', this.resetPressedKeys)
            document.removeEventListener('visibilitychange', this.onVisibilityChange)
            if (this._restoreGameInput) this._restoreGameInput()
            REALTIME_TRANSLATOR.destroy()
            if (GeneralCheat.toggleCheatModal === this.toggleCheatModal) {
                GeneralCheat.toggleCheatModal = this._previousToggle
            }
            if (GeneralCheat.openCheatModal === this.openCheatModal) {
                GeneralCheat.openCheatModal = this._previousOpen
            }
        }
    }
}
