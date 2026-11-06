import GeneralPanel from './GeneralPanel.js'
import PartySettingGroup from './PartySettingGroup.js'
import CombatSettingGroup from './CombatSettingGroup.js'

export default {
    name: 'PlayPanel',
    components: { GeneralPanel, PartySettingGroup, CombatSettingGroup },
    template: `
<div class="cheat-play">
    <div class="cheat-panel-toolbar">
        <span class="cheat-control-help">Open a group to adjust its settings.</span>
        <button type="button" class="cheat-button cheat-button--quiet" @click="refreshGroups">Refresh values</button>
    </div>
    <details v-for="group in groups" :key="group.id" class="cheat-play-group"
        :data-play-group="group.id" :open="openGroups[group.id]" @toggle="onToggle(group.id, $event)">
        <summary class="cheat-play-group__summary">
            <span class="cheat-play-group__title">{{group.name}}</span>
            <span class="cheat-play-group__description">{{group.description}}</span>
            <span class="cheat-play-group__chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="cheat-play-group__body">
            <component :is="group.component" ref="groupPanels" :section="group.section || 'all'"></component>
        </div>
    </details>
</div>`,

    data () {
        return {
            openGroups: { gold: true, party: false, movement: false, combat: false, session: false },
            groups: [
                { id: 'gold', name: 'Gold', description: 'Set the gold you carry.', component: 'general-panel', section: 'gold' },
                { id: 'party', name: 'Party', description: 'Health, levels and character attributes.', component: 'party-setting-group' },
                { id: 'movement', name: 'Movement & speed', description: 'Walk through walls, move speed and game speed.', component: 'general-panel', section: 'movement' },
                { id: 'combat', name: 'Combat', description: 'Encounters, battle outcomes and enemy health.', component: 'combat-setting-group' },
                { id: 'session', name: 'Save & session', description: 'Open save, load or return to the title.', component: 'general-panel', section: 'session' }
            ]
        }
    },

    methods: {
        onToggle (id, event) {
            this.openGroups[id] = event.target.open
        },

        refreshGroups () {
            for (const panel of this.$refs.groupPanels || []) {
                if (typeof panel.initializeVariables === 'function') panel.initializeVariables()
            }
        }
    }
}
