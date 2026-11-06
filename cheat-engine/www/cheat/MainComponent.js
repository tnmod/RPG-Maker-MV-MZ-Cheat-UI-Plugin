import CheatModal from './CheatModal.js'
import { GLOBAL_SHORTCUT } from './js/GlobalShortcut.js'
import { GeneralCheat } from './js/CheatHelper.js'
import AlertSnackbar from './components/AlertSnackbar.js'
import ConfirmDialog from './components/ConfirmDialog.js'
import { customizeRPGMakerFunctions } from './init/customize_functions.js'
import { isOverlayEditableTarget } from './js/OverlayInput.js'
import { Key } from './js/KeyCodes.js'

export default {
    name: 'MainComponent',
    components: { CheatModal, AlertSnackbar, ConfirmDialog },
    template: `
<div class="cheat-workspace" @keydown.esc.capture="onOverlayEscape" @focusin="resetPressedKeys">
    <button
        v-if="!show"
        ref="launcher"
        type="button"
        class="cheat-launcher"
        aria-label="Open cheat console"
        aria-controls="cheat-modal"
        :aria-expanded="String(show)"
        @click="openCheatModal()">
        <span class="cheat-launcher__symbol" aria-hidden="true">✦</span>
        <span>Cheats</span>
        <kbd>{{toggleShortcut()}}</kbd>
    </button>
    <cheat-modal
        v-if="show"
        id="cheat-modal"
        ref="console"
        v-model="currentComponentName"
        @close="closeCheatModal">
    </cheat-modal>
    <alert-snackbar></alert-snackbar>
    <confirm-dialog></confirm-dialog>
</div>`,

    data () {
        return {
            currentKey: Key.createEmpty(),
            show: false,
            currentComponentName: 'general-panel'
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

    beforeDestroy () {
        this.resetPressedKeys()
        window.removeEventListener('keydown', this.onGlobalKeyDown)
        window.removeEventListener('keyup', this.onGlobalKeyUp)
        window.removeEventListener('blur', this.resetPressedKeys)
        document.removeEventListener('visibilitychange', this.onVisibilityChange)
        if (this._restoreGameInput) this._restoreGameInput()
        if (GeneralCheat.toggleCheatModal === this.toggleCheatModal) {
            GeneralCheat.toggleCheatModal = this._previousToggle
        }
        if (GeneralCheat.openCheatModal === this.openCheatModal) {
            GeneralCheat.openCheatModal = this._previousOpen
        }
    },

    methods: {
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
            if (componentName) this.currentComponentName = componentName
            const opening = !this.show
            this.show = true
            if (opening) {
                if (typeof Input !== 'undefined') Input.clear()
                if (typeof TouchInput !== 'undefined') TouchInput.clear()
                this.$nextTick(() => {
                    const console = this.$refs.console
                    if (console) {
                        const search = console.$el.querySelector('input[type="search"]')
                        if (search) search.focus()
                    }
                })
            }
        },

        closeCheatModal () {
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
        }
    }
}
