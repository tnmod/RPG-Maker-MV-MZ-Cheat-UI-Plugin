import GameDataEditor from '../components/GameDataEditor.js'
import ItemTableTab from './ItemTableTab.js'

const groups = [
    { id: 'variables', label: 'Variables' },
    { id: 'switches', label: 'Switches' },
    { id: 'inventory', label: 'Inventory' }
]

export default {
    name: 'RecorderPanel',
    components: { GameDataEditor, ItemTableTab },
    props: { recorder: { type: Object, required: true }, canEdit: { type: Function, required: true } },
    template: `
<div class="cheat-data-page cheat-recorder-page">
    <div v-if="recorder.active || total" class="cheat-data-toolbar cheat-recorder-controls">
        <template v-if="recorder.active">
            <span class="cheat-recorder-time">REC {{recorder.remaining}}s</span>
            <button type="button" class="cheat-button" @click="$emit('stop')">Stop</button>
        </template>
        <template v-else>
            <button type="button" class="cheat-button cheat-button--primary" @click="$emit('start')">{{recorder.results ? 'Record again' : 'Record'}}</button>
            <span v-if="recorder.results" class="cheat-result-count">{{total.toLocaleString()}} changed</span>
            <label v-if="total" class="cheat-sort">
                <select v-model="kind" aria-label="Recorded data type">
                    <option v-for="group in groups" :key="group.id" :value="group.id">{{group.label}} ({{count(group.id)}})</option>
                </select>
            </label>
        </template>
    </div>
    <p v-if="recorder.message" class="cheat-list-status" role="status">{{recorder.message}}</p>
    <template v-if="!recorder.active && total">
        <item-table-tab v-if="kind === 'inventory'" :items="recordedInventory" :as-table-data="inventoryRow"
            :searchable-attrs="['name', 'desc', 'kind']" :can-edit="canEdit"></item-table-tab>
        <game-data-editor v-else :key="kind" :kind="kind" :record-ids="recorder.results[kind]" :can-edit="canEdit"></game-data-editor>
    </template>
    <div v-else-if="recorder.active" class="cheat-list-empty">Play the game to capture changes, then press Stop.</div>
    <div v-else class="cheat-list-empty cheat-recorder-empty">
        <button type="button" class="cheat-button cheat-button--primary cheat-recorder-start" @click="$emit('start')">
            {{recorder.results ? 'Record again' : 'Record'}}
        </button>
        <p v-if="recorder.results">No changes recorded. Try again while performing the action you want to inspect.</p>
        <p v-else>Capture up to 60 seconds of changes to variables, switches and inventory.</p>
    </div>
</div>`,
    data () { return { groups, kind: 'variables' } },
    computed: {
        total () { return groups.reduce((total, group) => total + this.count(group.id), 0) },
        recordedInventory () {
            const results = this.recorder.results
            if (!results) return []
            return results.items.map(id => $dataItems[id])
                .concat(results.weapons.map(id => $dataWeapons[id]), results.armors.map(id => $dataArmors[id]))
                .filter(Boolean)
        }
    },
    watch: {
        'recorder.results': {
            immediate: true,
            handler () {
                const group = groups.find(group => this.count(group.id))
                this.kind = group ? group.id : 'variables'
            }
        }
    },
    methods: {
        count (kind) {
            const results = this.recorder.results
            if (!results) return 0
            if (kind === 'inventory') return results.items.length + results.weapons.length + results.armors.length
            return results[kind].length
        },
        inventoryRow (item) {
            const kind = $dataWeapons[item.id] === item ? 'Weapon' : $dataArmors[item.id] === item ? 'Armor' : 'Item'
            return { key: kind + ':' + item.id, kind, name: item.name, desc: item.description }
        }
    }
}
