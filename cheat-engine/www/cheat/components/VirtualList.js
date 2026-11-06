const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'Up', 'Down', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']

export function virtualRange (count, itemHeight, viewportHeight, scrollTop, overscan = 5) {
    const size = Math.max(1, Number(itemHeight) || 64)
    const total = Math.max(0, Math.floor(Number(count) || 0))
    const height = Math.max(0, Number(viewportHeight) || 0)
    const margin = Math.max(0, Math.floor(Number(overscan) || 0))
    const top = Math.max(0, Math.min(Number(scrollTop) || 0, Math.max(0, total * size - height)))
    if (!height) return { start: 0, end: 0, scrollTop: top, totalHeight: total * size }
    const first = Math.floor(top / size)
    const visible = Math.max(1, Math.ceil(height / size))
    return {
        start: Math.max(0, first - margin),
        end: Math.min(total, first + visible + margin + 1),
        scrollTop: top,
        totalHeight: total * size
    }
}

export default {
    name: 'VirtualList',
    props: {
        items: { type: Array, default: () => [] },
        itemHeight: { type: Number, default: 64 },
        overscan: { type: Number, default: 5 },
        itemKey: { type: String, default: 'id' },
        label: { type: String, default: 'Entries' },
        emptyMessage: { type: String, default: 'No entries found.' }
    },
    template: `
<div ref="viewport" class="cheat-virtual-list" role="list" :aria-label="label" tabindex="0"
    @scroll.passive="onScroll" @keydown.self="onViewportKey" @keyup.self="onViewportKey">
    <div v-if="items.length" class="cheat-virtual-list__spacer" :style="{height: range.totalHeight + 'px', position: 'relative'}">
        <div v-for="entry in visibleEntries" :key="rowKey(entry.item, entry.index)"
            class="cheat-virtual-list__row" role="listitem" :data-virtual-index="entry.index"
            :aria-setsize="items.length" :aria-posinset="entry.index + 1" :style="rowStyle(entry.index)">
            <slot :item="entry.item" :index="entry.index"></slot>
        </div>
    </div>
    <div v-else class="cheat-list-empty" role="status">{{emptyMessage}}</div>
</div>`,

    data () { return { scrollTop: 0, viewportHeight: 0 } },
    computed: {
        range () { return virtualRange(this.items.length, this.itemHeight, this.viewportHeight, this.scrollTop, this.overscan) },
        visibleEntries () {
            return this.items.slice(this.range.start, this.range.end).map((item, index) => ({ item, index: this.range.start + index }))
        }
    },
    watch: {
        items () { this.$nextTick(this.measure) },
        itemHeight () { this.$nextTick(this.measure) }
    },
    mounted () {
        this._listActive = true
        this.measure()
        this._onWindowResize = () => this.scheduleMeasure()
        window.addEventListener('resize', this._onWindowResize)
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.scheduleMeasure())
            this._resizeObserver.observe(this.$refs.viewport)
        }
    },
    beforeDestroy () {
        this._listActive = false
        if (this._resizeObserver) this._resizeObserver.disconnect()
        if (this._onWindowResize) window.removeEventListener('resize', this._onWindowResize)
        if (this._scrollFrame !== undefined) window.cancelAnimationFrame(this._scrollFrame)
        if (this._measureFrame !== undefined) window.cancelAnimationFrame(this._measureFrame)
    },
    methods: {
        rowKey (item, index) {
            const value = item && item[this.itemKey]
            return value === undefined || value === null ? index : value
        },
        rowStyle (index) {
            return { position: 'absolute', top: '0', left: '0', right: '0',
                height: this.itemHeight + 'px', transform: 'translateY(' + index * this.itemHeight + 'px)' }
        },
        onViewportKey (event) {
            if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
            if (event.shiftKey && event.key !== ' ' && event.key !== 'Spacebar') return
            // Keep native scrolling even when the same key has a cheat binding.
            if (SCROLL_KEYS.includes(event.key)) event.stopPropagation()
        },
        commitRecycledFocus (nextRange) {
            const viewport = this.$refs.viewport
            const active = typeof document !== 'undefined' ? document.activeElement : null
            if (!viewport || !active || !viewport.contains(active) || active === viewport) return
            const row = typeof active.closest === 'function' ? active.closest('[data-virtual-index]') : null
            if (!row) return
            const index = Number(row.getAttribute('data-virtual-index'))
            if ((index < nextRange.start || index >= nextRange.end) && typeof active.blur === 'function') {
                active.blur()
                if (document.activeElement === document.body && typeof viewport.focus === 'function') {
                    viewport.focus({preventScroll: true})
                }
            }
        },
        updateScroll (top) {
            const range = virtualRange(this.items.length, this.itemHeight, this.viewportHeight, top, this.overscan)
            this.commitRecycledFocus(range)
            this.scrollTop = range.scrollTop
            const viewport = this.$refs.viewport
            if (viewport && Math.abs(viewport.scrollTop - range.scrollTop) > 1) viewport.scrollTop = range.scrollTop
        },
        onScroll () {
            if (this._scrollFrame !== undefined) return
            this._scrollFrame = window.requestAnimationFrame(() => {
                this._scrollFrame = undefined
                if (this._listActive) this.updateScroll(this.$refs.viewport.scrollTop)
            })
        },
        scheduleMeasure () {
            if (this._measureFrame !== undefined) return
            this._measureFrame = window.requestAnimationFrame(() => {
                this._measureFrame = undefined
                if (this._listActive) this.measure()
            })
        },
        measure () {
            const viewport = this.$refs.viewport
            if (!viewport || this._listActive === false) return
            this.viewportHeight = viewport.clientHeight
            this.updateScroll(viewport.scrollTop)
        },
        resetScroll () { this.scrollToIndex(0) },
        scrollToIndex (index) {
            const viewport = this.$refs.viewport
            if (!viewport) return
            const target = Math.max(0, Math.floor(Number(index) || 0)) * this.itemHeight
            viewport.scrollTop = target
            this.updateScroll(target)
        }
    }
}
