import GameIcon from '../components/GameIcon.js'
import VirtualList from '../components/VirtualList.js'

export default {
    name: 'ItemTableTab',
    components: { GameIcon, VirtualList },
    props: {
        items: { type: Array, default: () => [] },
        headers: { type: Array, default: () => [] },
        asTableData: { type: Function, default: item => ({ name: item.name, desc: item.description }) },
        categories: { type: Array, default: () => [] },
        category: { type: String, default: '' },
        searchableAttrs: { type: Array, default: () => ['name', 'desc'] }
    },
    template: `
<div class="cheat-data-page cheat-inventory-page">
    <div class="cheat-data-toolbar">
        <input class="cheat-search" type="search" aria-label="Search inventory" v-model="search" placeholder="Search by name, description or ID" autocomplete="off" @input="onTableFilterChange">
        <span class="cheat-result-count" aria-live="polite">{{resultCount}}</span>
        <button type="button" class="cheat-button" @click="initializeVariables">Refresh</button>
    </div>
    <div class="cheat-filter-row cheat-inventory-filters">
        <label class="cheat-filter-check"><input type="checkbox" v-model="excludeNameless" @change="onTableFilterChange"><span>Hide nameless</span></label>
        <label class="cheat-filter-check"><input type="checkbox" v-model="onlyOwnedItems" @change="onTableFilterChange"><span>Only owned</span></label>
        <button v-if="search || excludeNameless || onlyOwnedItems" type="button" class="cheat-button cheat-button--quiet" @click="clearFilters">Clear filters</button>
        <div class="cheat-sort cheat-inventory-selects">
            <select v-if="categories.length" :value="category" aria-label="Inventory category" @change="$emit('category-change', $event.target.value)">
                <option v-for="option in categories" :key="option.component" :value="option.component">{{option.name}}</option>
            </select>
            <select v-model="sortBy" aria-label="Sort inventory" @change="onTableFilterChange"><option value="id">Database order</option><option value="name">Name A–Z</option><option value="amount">Most owned</option></select>
        </div>
    </div>
    <div class="cheat-inventory-header" aria-hidden="true"><span>Item</span><span>Description</span><span>Amount</span></div>
    <virtual-list :key="category" ref="list" :items="filteredTableItems" :item-height="64" item-key="id" label="Inventory entries" empty-message="No items match these filters.">
        <template v-slot:default="{item}">
            <div class="cheat-inventory-row">
                <div class="cheat-row-title">
                    <game-icon :icon-index="item._item.iconIndex"></game-icon>
                    <div class="cheat-row-copy">
                        <span class="cheat-row-name" :title="item.name">{{item.name || 'Unnamed item'}}</span>
                        <span class="cheat-row-meta">#{{item.id}}</span>
                        <span v-if="item.desc" class="cheat-row-description--compact" :title="item.desc">{{item.desc}}</span>
                    </div>
                </div>
                <p class="cheat-row-description" :title="item.desc || ''">{{item.desc || 'No description'}}</p>
                <input class="cheat-row-number cheat-number-input" type="number" min="0" :max="maxAmount(item)" step="1"
                    :aria-label="'Amount for ' + (item.name || 'item #' + item.id)" :aria-invalid="item.error ? 'true' : 'false'"
                    v-model="item.draftAmount" @change="onItemChange(item)" @keydown.enter.prevent="onItemChange(item)">
            </div>
        </template>
    </virtual-list>
</div>`,

    data () {
        return { search: '', excludeNameless: false, onlyOwnedItems: false, sortBy: 'id',
            tableItems: [], errorMessage: '', statusMessage: '' }
    },
    watch: {
        items: { immediate: true, handler () { this.initializeVariables() } }
    },
    computed: {
        resultCount () {
            const total = this.tableItems.length
            const count = this.filteredTableItems.length
            return count === total ? total.toLocaleString() + ' entries' : count.toLocaleString() + ' of ' + total.toLocaleString()
        },
        filteredTableItems () {
            const query = this.search.trim().toLowerCase()
            const items = this.tableItems.filter(item =>
                (!this.excludeNameless || !!item.name) && (!this.onlyOwnedItems || item.amount > 0) &&
                (!query || item._searchText.includes(query)))
            if (this.sortBy === 'name') items.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id - b.id)
            else if (this.sortBy === 'amount') items.sort((a, b) => b.amount - a.amount || a.id - b.id)
            return items
        }
    },
    methods: {
        initializeVariables () {
            this.errorMessage = ''
            this.statusMessage = ''
            this.tableItems = this.items.filter(Boolean).map(item => {
                const row = this.asTableData(item)
                row.id = item.id
                row._item = item
                row.amount = $gameParty.numItems(item)
                row.draftAmount = String(row.amount)
                row.error = false
                row._searchText = [item.id].concat(this.searchableAttrs.map(attr => row[attr] || '')).join(' ').toLowerCase()
                return row
            })
            this.$nextTick(() => { if (this.$refs.list) this.$refs.list.resetScroll() })
        },
        maxAmount (item) {
            const value = typeof $gameParty.maxItems === 'function' ? $gameParty.maxItems(item._item) : 99
            return Number.isSafeInteger(value) && value >= 0 ? value : 99
        },
        onItemChange (item) {
            const value = String(item.draftAmount).trim()
            const amount = Number(value)
            const maximum = this.maxAmount(item)
            if (!/^\d+$/.test(value) || !Number.isSafeInteger(amount) || amount < 0 || amount > maximum) {
                item.error = true
                this.errorMessage = 'Amount must be a whole number from 0 to ' + maximum.toLocaleString() + '.'
                this.statusMessage = ''
                return
            }
            try {
                const before = $gameParty.numItems(item._item)
                if (amount !== before) $gameParty.gainItem(item._item, amount - before)
                item.amount = $gameParty.numItems(item._item)
                item.draftAmount = String(item.amount)
                item.error = false
                this.errorMessage = ''
                this.statusMessage = (item.name || 'Item #' + item.id) + ': ' + item.amount.toLocaleString() + ' owned.'
            } catch (error) {
                item.error = true
                this.errorMessage = 'Could not change the amount. Refresh and try again.'
                this.statusMessage = ''
            }
        },
        onTableFilterChange () {
            this.$nextTick(() => { if (this.$refs.list) this.$refs.list.resetScroll() })
        },
        clearFilters () {
            this.search = ''
            this.excludeNameless = false
            this.onlyOwnedItems = false
            this.onTableFilterChange()
        }
    }
}
