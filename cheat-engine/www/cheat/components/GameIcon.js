// Use the engine bitmap, rather than loading IconSet.png directly. ImageManager
// resolves encrypted assets and any image overrides installed by the game.
export function iconDimensions (imageManager, windowBase) {
    const dimension = (modern, legacy) => {
        for (const value of [modern, legacy, 32]) {
            if (Number.isInteger(value) && value > 0) return value
        }
    }
    return {
        width: dimension(imageManager && imageManager.iconWidth, windowBase && windowBase._iconWidth),
        height: dimension(imageManager && imageManager.iconHeight, windowBase && windowBase._iconHeight)
    }
}

export function drawGameIcon (canvas, bitmap, iconIndex, dimensions) {
    if (!canvas || !bitmap || !Number.isInteger(iconIndex) || iconIndex <= 0) return false
    const { width, height } = dimensions
    const source = bitmap._canvas || bitmap._image || bitmap.canvas
    if (!source) return false

    // Standard MV/MZ IconSet sheets have sixteen columns.
    const x = (iconIndex % 16) * width
    const y = Math.floor(iconIndex / 16) * height
    if (x + width > source.width || y + height > source.height) return false
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return false
    context.imageSmoothingEnabled = false
    context.clearRect(0, 0, width, height)
    context.drawImage(source, x, y, width, height, 0, 0, width, height)
    return true
}

export default {
    name: 'GameIcon',
    template: `
<span class="cheat-game-icon" :class="{'cheat-game-icon--empty': !loaded}" aria-hidden="true">
    <canvas ref="canvas" v-show="loaded" width="32" height="32"></canvas>
    <span v-if="!loaded" class="cheat-game-icon__placeholder">◇</span>
</span>`,

    props: { iconIndex: { type: Number, default: 0 } },
    data () { return { loaded: false } },

    watch: { iconIndex () { this.renderIcon() } },
    mounted () { this.renderIcon() },
    beforeDestroy () { this._iconRequest = null },

    methods: {
        renderIcon () {
            this.loaded = false
            const request = {}
            this._iconRequest = request
            const index = this.iconIndex
            if (!Number.isInteger(index) || index <= 0 || !this.$refs.canvas ||
                typeof ImageManager === 'undefined' || typeof ImageManager.loadSystem !== 'function') return

            try {
                const bitmap = ImageManager.loadSystem('IconSet')
                if (!bitmap || (typeof bitmap.isError === 'function' && bitmap.isError())) return
                const dimensions = iconDimensions(ImageManager, typeof Window_Base === 'undefined' ? null : Window_Base)
                const paint = () => {
                    // A table row can change or disappear before the sheet loads.
                    if (this._iconRequest !== request) return
                    try {
                        this.loaded = drawGameIcon(this.$refs.canvas, bitmap, index, dimensions)
                    } catch (error) {
                        // A missing/custom icon must never hide the item name.
                        this.loaded = false
                    }
                }
                if (typeof bitmap.isReady === 'function' && bitmap.isReady()) paint()
                else if (typeof bitmap.addLoadListener === 'function') bitmap.addLoadListener(paint)
            } catch (error) {
                this.loaded = false
            }
        }
    }
}
