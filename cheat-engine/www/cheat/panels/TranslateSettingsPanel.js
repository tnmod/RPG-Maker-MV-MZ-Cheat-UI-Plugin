import { TRANSLATE_SETTINGS, TRANSLATOR, DEFAULT_END_POINTS, RECOMMEND_CHUNK_SIZE } from '../js/TranslateHelper.js'

export default {
    name: 'TranslateSettingsPanel',
    template: `
<div class="cheat-settings-page">
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Translation</h3><p>Translate names in the game-data and travel tools using your translation service.</p></div>
        <div class="cheat-settings-controls">
            <label class="cheat-toggle"><input type="checkbox" v-model="enabled" @change="onChangeEnabled"><span class="cheat-control-copy"><strong>Enable translation</strong><span>Apply translations when loading a supported list.</span></span></label>
            <div class="cheat-connection-row"><span class="cheat-connection-state" role="status">{{connectionMessage}}</span><button type="button" class="cheat-button" :disabled="checking" @click="testConnection">{{checking ? 'Checking…' : 'Test connection'}}</button></div>
        </div>
    </section>
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Translation service</h3><p>Start the service before using translation.</p><a v-if="selectedDefault && selectedDefault.helpUrl" :href="selectedDefault.helpUrl" target="_blank" rel="noopener noreferrer">Service setup guide</a></div>
        <div class="cheat-settings-controls">
            <label class="cheat-settings-field"><span>Service</span><select class="cheat-number-input" v-model="endPointSelection" @change="onChangeEndPoint"><option v-for="endpoint in endpoints" :key="endpoint.id" :value="endpoint.id">{{endpoint.name}}</option><option value="custom">Custom service</option></select></label>
            <template v-if="endPointSelection === 'custom'">
                <div class="cheat-settings-fields cheat-service-fields">
                    <label class="cheat-settings-field"><span>Method</span><select class="cheat-number-input" v-model="customEndPointData.method" @change="saveCustom('method')"><option value="get">GET</option><option value="post">POST</option></select></label>
                    <label class="cheat-settings-field"><span>Service URL</span><input class="cheat-number-input" v-model="customEndPointData.urlPattern" spellcheck="false" @change="saveCustom('url')"><small>Use <code>$&#123;TEXT&#125;</code> where the text belongs in a GET URL.</small></label>
                </div>
                <label v-if="customEndPointData.method === 'post'" class="cheat-settings-field"><span>Request body</span><textarea class="cheat-number-input" rows="3" v-model="customEndPointData.body" spellcheck="false" @change="saveCustom('body')"></textarea><small>Use <code>$&#123;TEXT&#125;</code> where the text belongs in the request.</small></label>
            </template>
        </div>
    </section>
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>What to translate</h3><p>Choose the lists that use translated names.</p></div>
        <div class="cheat-settings-controls cheat-settings-checks">
            <label class="cheat-filter-check" v-for="target in targetOptions" :key="target.key"><input type="checkbox" v-model="targets[target.key]" @change="onChangeTargetsValue"><span>{{target.label}}</span></label>
        </div>
    </section>
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Batch size</h3><p>Lower this if your service struggles with large lists.</p></div>
        <div class="cheat-settings-controls"><label class="cheat-settings-field"><span>Names per request</span><input class="cheat-number-input" type="number" min="1" max="2000" step="1" v-model="bulkTranslateChunkSize" @change="saveBatchSize"><small>{{recommendedSize ? 'Recommended for this service: ' + recommendedSize : 'Between 1 and 2,000 names.'}}</small></label></div>
    </section>
    <div class="cheat-page-status" :class="{'is-error': !!errorMessage}" :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage || 'Settings save when you change a control.'}}</div>
</div>`,

    data () {
        return { enabled: false, endPointSelection: 'ezTransWeb', customEndPointData: { method: 'get', urlPattern: '', body: '' },
            targets: {}, bulkTranslateChunkSize: 500, checking: false, connectionMessage: 'Connection not tested.',
            errorMessage: '', statusMessage: '', targetOptions: [
                { key: 'variables', label: 'Variables' }, { key: 'switches', label: 'Switches' }, { key: 'maps', label: 'Maps and saved locations' }
            ] }
    },
    created () { this.initializeVariables() },
    beforeDestroy () { this._connectionRequest = null },
    computed: {
        endpoints () { return Object.values(DEFAULT_END_POINTS) },
        selectedDefault () { return DEFAULT_END_POINTS[this.endPointSelection] },
        recommendedSize () { return RECOMMEND_CHUNK_SIZE[this.endPointSelection] }
    },
    methods: {
        initializeVariables () {
            this.enabled = !!TRANSLATE_SETTINGS.isEnabled()
            this.endPointSelection = TRANSLATE_SETTINGS.getEndPointSelection()
            this.customEndPointData = Object.assign({ method: 'get', urlPattern: '', body: '' }, TRANSLATE_SETTINGS.getCustomEndPointData())
            this.targets = Object.assign({}, TRANSLATE_SETTINGS.getTargets())
            this.bulkTranslateChunkSize = TRANSLATE_SETTINGS.getBulkTranslateChunkSize()
        },
        save (action) {
            try { action(); this.errorMessage = ''; this.statusMessage = 'Translation settings saved.'; return true }
            catch (error) { this.errorMessage = 'Could not save settings: ' + error.message; this.statusMessage = ''; return false }
        },
        onChangeEnabled () { this.save(() => TRANSLATE_SETTINGS.setEnabled(this.enabled)) },
        onChangeTargetsValue () { this.save(() => TRANSLATE_SETTINGS.setTargets(Object.assign({}, this.targets))) },
        resetConnection () { this._connectionRequest = null; this.checking = false; this.connectionMessage = 'Connection not tested.' },
        onChangeEndPoint () { this.resetConnection(); this.save(() => TRANSLATE_SETTINGS.setEndPointSelection(this.endPointSelection)) },
        saveCustom (field) {
            this.resetConnection()
            if (field === 'url') {
                try {
                    const url = new URL(this.customEndPointData.urlPattern)
                    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
                } catch (error) { this.errorMessage = 'Enter a complete HTTP or HTTPS service URL.'; return }
            }
            this.save(() => {
                if (field === 'method') TRANSLATE_SETTINGS.setCustomEndPointMethod(this.customEndPointData.method)
                if (field === 'url') TRANSLATE_SETTINGS.setCustomEndPointUrlPattern(this.customEndPointData.urlPattern)
                if (field === 'body') TRANSLATE_SETTINGS.setCustomEndPointBody(this.customEndPointData.body)
            })
        },
        saveBatchSize () {
            const value = Number(this.bulkTranslateChunkSize)
            if (!Number.isInteger(value) || value < 1 || value > 2000) { this.errorMessage = 'Batch size must be a whole number between 1 and 2,000.'; return }
            this.save(() => TRANSLATE_SETTINGS.setBulkTranslateChunkSize(value))
        },
        async testConnection () {
            const request = {}
            this._connectionRequest = request
            this.checking = true
            this.connectionMessage = 'Checking translation service…'
            const available = await TRANSLATOR.isAvailable()
            if (this._connectionRequest !== request) return
            this.checking = false
            this.connectionMessage = available ? 'Service connected.' : 'Service unavailable. Start the service and check its URL.'
        }
    }
}
