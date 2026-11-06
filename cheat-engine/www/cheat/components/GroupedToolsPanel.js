export default {
    name: 'GroupedToolsPanel',

    props: {
        tools: { type: Array, default: () => [] },
        activeComponent: { type: String, default: '' },
        label: { type: String, default: 'Tool group' }
    },

    template: `
<div class="cheat-grouped-tools">
    <div v-if="tools.length" class="cheat-tool-tabs" role="tablist" :aria-label="label + ' tools'">
        <button v-for="(tool, index) in tools" :key="tool.component" ref="toolTabs"
            type="button" role="tab" class="cheat-tool-tab"
            :class="{'is-active': currentTool.component === tool.component}"
            :id="tabId(tool)" :aria-controls="panelId"
            :aria-selected="String(currentTool.component === tool.component)"
            :tabindex="currentTool.component === tool.component ? 0 : -1"
            @click="selectTool(tool)" @keydown="onTabKeydown($event, index)">
            {{tool.name}}
        </button>
    </div>
    <div v-if="currentTool" :id="panelId" class="cheat-tool-panel"
        role="tabpanel" :aria-labelledby="tabId(currentTool)">
        <component :is="currentTool.view" :key="currentTool.component"
            @saved-locations-change="$emit('saved-locations-change', $event)"></component>
    </div>
    <p v-else class="cheat-control-help" role="status">No tools are available in this group.</p>
</div>`,

    computed: {
        currentTool () {
            return this.tools.find(tool => tool.component === this.activeComponent) || this.tools[0] || null
        },

        panelId () {
            const slug = this.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tools'
            return 'cheat-tool-panel-' + slug
        }
    },

    methods: {
        tabId (tool) {
            return this.panelId + '-tab-' + tool.component
        },

        selectTool (tool, moveFocus = false) {
            if (!tool || !this.tools.some(item => item.component === tool.component)) return
            this.$emit('change', tool.component)
            if (moveFocus) {
                this.$nextTick(() => {
                    const tabs = this.$refs.toolTabs || []
                    const target = tabs.find(tab => tab.id === this.tabId(tool))
                    if (target) target.focus()
                })
            }
        },

        onTabKeydown (event, index) {
            const count = this.tools.length
            if (!count || event.ctrlKey || event.altKey || event.metaKey) return
            let next
            switch (event.key) {
                case 'ArrowLeft':
                case 'Left': next = (index - 1 + count) % count; break
                case 'ArrowRight':
                case 'Right': next = (index + 1) % count; break
                case 'Home': next = 0; break
                case 'End': next = count - 1; break
                default: return
            }
            event.preventDefault()
            event.stopPropagation()
            this.selectTool(this.tools[next], true)
        }
    }
}
