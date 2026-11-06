import ItemTableTab from './ItemTableTab.js'

export default {
    name: 'WeaponSettingPanel',

    components: {
        ItemTableTab
    },

    template: `
<div class="cheat-data-host">
    <item-table-tab
        :items="items"
        :headers="headers"
        :as-table-data="convertToTableData"
        :searchable-attrs="['name', 'desc']">
        
    </item-table-tab>
</div>
    `,

    data () {
        return {
            items: [],

            headers: [
                {
                    text: 'Name',
                    value: 'name'
                },
                {
                    text: 'Description',
                    value: 'desc'
                }
            ]
        }
    },

    created () {
        this.initializeVariables()
    },

    methods: {
        initializeVariables () {
            this.items = $dataWeapons
        },

        convertToTableData (item) {
            return {
                name: item.name,
                desc: item.description
            }
        }
    }
}
