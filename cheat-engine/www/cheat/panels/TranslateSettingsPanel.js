import { TRANSLATE_SETTINGS, TRANSLATOR, REALTIME_TRANSLATOR, TRANSLATION_PROVIDERS, SUPPORTED_LANGUAGES } from '../js/TranslateHelper.js'

export default {
    name: 'TranslateSettingsPanel',
    template: `
<div class="cheat-settings-page">
    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Translation</h3><p>Translate game data names and real-time screen text using your preferred service.</p></div>
        <div class="cheat-settings-controls">
            <label class="cheat-toggle"><input type="checkbox" v-model="enabled" @change="onChangeEnabled"><span class="cheat-control-copy"><strong>Enable translation</strong><span>Apply translations when loading supported lists.</span></span></label>
            <div class="cheat-connection-row"><span class="cheat-connection-state" role="status">{{connectionMessage}}</span><button type="button" class="cheat-button" :disabled="checking" @click="testConnection">{{checking ? 'Checking…' : 'Test connection'}}</button></div>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Language</h3><p>Source and target languages for translation.</p></div>
        <div class="cheat-settings-controls">
            <label class="cheat-settings-field"><span>From</span><select class="cheat-number-input" v-model="sourceLang" @change="onChangeSourceLang"><option v-for="lang in languages" :key="lang.code" :value="lang.code">{{lang.name}} ({{lang.code}})</option></select></label>
            <label class="cheat-settings-field"><span>To</span><select class="cheat-number-input" v-model="targetLang" @change="onChangeTargetLang"><option v-for="lang in languages" :key="lang.code" :value="lang.code">{{lang.name}} ({{lang.code}})</option></select></label>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Translation Service</h3><p>Choose a translation provider. Cloud services require API keys. Local services run on your machine.</p>
            <a v-if="selectedProvider?.helpUrl" :href="selectedProvider.helpUrl" target="_blank" rel="noopener noreferrer">Setup guide</a>
        </div>
        <div class="cheat-settings-controls">
            <label class="cheat-settings-field"><span>Provider</span><select class="cheat-number-input" v-model="provider" @change="onChangeProvider"><option v-for="provider in groupedProviders" :key="provider.id" :value="provider.id">{{provider.name}} <span v-if="provider.category === 'cloud'">☁</span><span v-if="provider.category === 'free'">🌐</span><span v-if="provider.category === 'local'">🖥</span></option></select></label>

            <template v-if="providerRequiresKey">
                <div class="cheat-settings-fields cheat-service-fields">
                    <label class="cheat-settings-field"><span>{{keyLabel}}</span><input class="cheat-number-input" type="password" v-model="apiKey" @change="saveApiKey" autocomplete="off" placeholder="Enter your API key"></label>
                    <template v-if="extraParamsFields.length">
                        <label v-for="field in extraParamsFields" :key="field.key" class="cheat-settings-field"><span>{{field.label}}</span><input class="cheat-number-input" v-model="extraParams[field.key]" @change="saveExtraParams" placeholder="{{field.placeholder}}"></label>
                    </template>
                </div>
            </template>

            <template v-else-if="provider === 'custom'">
                <div class="cheat-settings-fields cheat-service-fields">
                    <label class="cheat-settings-field"><span>Method</span><select class="cheat-number-input" v-model="customConfig.method" @change="saveCustom('method')"><option value="get">GET</option><option value="post">POST</option></select></label>
                    <label class="cheat-settings-field"><span>Service URL</span><input class="cheat-number-input" v-model="customConfig.urlPattern" spellcheck="false" @change="saveCustom('url')"><small>Use <code>\${TEXT}</code> where the text belongs in a GET URL.</small></label>
                </div>
                <label v-if="customConfig.method === 'post'" class="cheat-settings-field"><span>Request body</span><textarea class="cheat-number-input" rows="3" v-model="customConfig.body" spellcheck="false" @change="saveCustom('body')"></textarea><small>Use <code>\${TEXT}</code> where the text belongs in the request.</small></label>
                <label class="cheat-settings-field"><span>Headers (JSON)</span><textarea class="cheat-number-input" rows="4" v-model="customHeadersJson" @change="saveCustomHeaders"><small>Optional. Use <code>\${API_KEY}</code> for API key placeholder.</small></label></label>
            </template>

            <template v-else>
                <div class="cheat-control-help">No API key required for this service.</div>
            </template>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>What to translate</h3><p>Choose the lists that use translated names.</p></div>
        <div class="cheat-settings-controls cheat-settings-checks">
            <label class="cheat-filter-check" v-for="target in targetOptions" :key="target.key"><input type="checkbox" v-model="targets[target.key]" @change="onChangeTargets"><span>{{target.label}}</span></label>
        </div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Batch size</h3><p>Lower this if your service struggles with large lists.</p></div>
        <div class="cheat-settings-controls"><label class="cheat-settings-field"><span>Names per request</span><input class="cheat-number-input" type="number" min="1" max="2000" step="1" v-model="bulkTranslateChunkSize" @change="saveBatchSize"><small>Recommended: {{recommendedSize}} for this service.</small></label></div>
    </section>

    <section class="cheat-settings-section">
        <div class="cheat-settings-copy"><h3>Real-time Screen Translation</h3><p>Translate dialogue, menus, and UI text as they appear on screen.</p></div>
        <div class="cheat-settings-controls">
            <label class="cheat-toggle"><input type="checkbox" v-model="realtimeEnabled" @change="onChangeRealtimeEnabled"><span class="cheat-control-copy"><strong>Enable real-time translation</strong><span>Show translations for text appearing in game windows.</span></span></label>

            <template v-if="realtimeEnabled">
                <div class="cheat-settings-fields" style="margin-top: 12px;">
                    <label class="cheat-settings-field"><span>Position</span><select class="cheat-number-input" v-model="realtimeSettings.position" @change="saveRealtimeSettings"><option value="bottom">Bottom center</option><option value="top">Top center</option><option value="overlay">Bottom overlay</option></select></label>
                    <label class="cheat-settings-field"><span>Font size</span><input class="cheat-number-input" type="number" min="10" max="24" step="1" v-model.number="realtimeSettings.fontSize" @change="saveRealtimeSettings"></label>
                    <label class="cheat-settings-field"><span>Background opacity</span><input class="cheat-number-input" type="range" min="0" max="1" step="0.05" v-model.number="realtimeSettings.bgOpacity" @change="saveRealtimeSettings"></label>
                    <label class="cheat-toggle"><input type="checkbox" v-model="realtimeSettings.showOriginal" @change="saveRealtimeSettings"><span>Show original text</span></label>
                    <label class="cheat-toggle"><input type="checkbox" v-model="realtimeSettings.showTranslation" @change="saveRealtimeSettings"><span>Show translation</span></label>
                </div>

                <div class="cheat-settings-fields" style="margin-top: 8px;">
                    <label class="cheat-settings-field"><span>Hook windows</span>
                        <div class="cheat-settings-checks" style="margin-top: 4px;">
                            <label class="cheat-filter-check" v-for="window in hookableWindows" :key="window"><input type="checkbox" v-model="realtimeSettings.hookWindows" :value="window" @change="saveRealtimeSettings"><span>{{window}}</span></label>
                        </div>
                    </label>
                </div>

                <div class="cheat-connection-row" style="margin-top: 12px;">
                    <button type="button" class="cheat-button" @click="testRealtime">Test real-time translation</button>
                </div>
            </template>
        </div>
    </section>

    <div class="cheat-page-status" :class="{'is-error': !!errorMessage}" :role="errorMessage ? 'alert' : 'status'" aria-live="polite">{{errorMessage || statusMessage || 'Settings save when you change a control.'}}</div>
</div>`,

    data () {
        return {
            enabled: false,
            provider: 'ezTransWeb',
            sourceLang: 'ja',
            targetLang: 'vi',
            apiKey: '',
            extraParams: {},
            customConfig: { method: 'get', urlPattern: '', body: '' },
            customHeadersJson: '{}',
            targets: {},
            bulkTranslateChunkSize: 500,
            checking: false,
            connectionMessage: 'Connection not tested.',
            errorMessage: '',
            statusMessage: '',
            realtimeEnabled: false,
            realtimeSettings: {
                enabled: false,
                hookWindows: [],
                position: 'bottom',
                fontSize: 14,
                bgOpacity: 0.85,
                showOriginal: true,
                showTranslation: true
            },
            targetOptions: [
                { key: 'variables', label: 'Variables' },
                { key: 'switches', label: 'Switches' },
                { key: 'items', label: 'Items/Weapons/Armor' },
                { key: 'maps', label: 'Maps and saved locations' },
                { key: 'realtime', label: 'Real-time screen text' }
            ],
            hookableWindows: [
                'Window_Message', 'Window_Help', 'Window_ItemList',
                'Window_SkillList', 'Window_EquipItem', 'Window_ShopBuy',
                'Window_ShopSell', 'Window_NameInput', 'Window_ChoiceList'
            ],
            languages: SUPPORTED_LANGUAGES
        }
    },

    created () { this.initializeVariables() },
    beforeDestroy () { this._connectionRequest = null },

    computed: {
        groupedProviders () {
            const providers = TRANSLATE_SETTINGS.getAvailableProviders()
            // Sort: cloud first, then free, then local
            const categoryOrder = { cloud: 0, free: 1, local: 2 }
            return [...providers].sort((a, b) => (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99))
        },
        selectedProvider () {
            return TRANSLATION_PROVIDERS[this.provider]
        },
        providerRequiresKey () {
            return this.selectedProvider?.requiresKey === true
        },
        keyLabel () {
            return TRANSLATE_SETTINGS.getProviderKeyLabel(this.provider)
        },
        extraParamsFields () {
            if (this.provider === 'bingTranslator') {
                return [{ key: 'region', label: 'Azure Region', placeholder: 'e.g. eastus, southeastasia' }]
            }
            if (this.provider === 'papago') {
                return [
                    { key: 'clientId', label: 'Client ID', placeholder: 'Your Papago Client ID' },
                    { key: 'clientSecret', label: 'Client Secret', placeholder: 'Your Papago Client Secret' }
                ]
            }
            return []
        },
        recommendedSize () {
            const provider = TRANSLATION_PROVIDERS[this.provider]
            if (!provider) return 500
            if (provider.category === 'cloud') return 100
            if (provider.category === 'free') return 50
            return 500
        }
    },

    methods: {
        initializeVariables () {
            this.enabled = TRANSLATE_SETTINGS.isEnabled()
            this.provider = TRANSLATE_SETTINGS.getActiveProvider()
            this.sourceLang = TRANSLATE_SETTINGS.getSourceLang()
            this.targetLang = TRANSLATE_SETTINGS.getTargetLang()
            this.apiKey = TRANSLATE_SETTINGS.getApiKey(this.provider) || ''
            this.extraParams = { ...TRANSLATE_SETTINGS.getExtraParams(this.provider) }
            this.customConfig = { ...TRANSLATE_SETTINGS.getProviderConfig('custom') }
            this.customHeadersJson = JSON.stringify(TRANSLATE_SETTINGS.getProviderConfig('custom').headers || {}, null, 2)
            this.targets = { ...TRANSLATE_SETTINGS.getTargets() }
            this.bulkTranslateChunkSize = TRANSLATE_SETTINGS.getBulkTranslateChunkSize()
            this.realtimeEnabled = TRANSLATE_SETTINGS.getTargets().realtime
            this.realtimeSettings = { ...TRANSLATE_SETTINGS.getRealtimeSettings() }
        },

        save (action) {
            try { action(); this.errorMessage = ''; this.statusMessage = 'Translation settings saved.'; return true }
            catch (error) { this.errorMessage = 'Could not save settings: ' + error.message; this.statusMessage = ''; return false }
        },

        onChangeEnabled () { this.save(() => TRANSLATE_SETTINGS.setEnabled(this.enabled)) },
        onChangeProvider () {
            this.resetConnection()
            this.apiKey = TRANSLATE_SETTINGS.getApiKey(this.provider) || ''
            this.extraParams = { ...TRANSLATE_SETTINGS.getExtraParams(this.provider) }
            this.customConfig = { ...TRANSLATE_SETTINGS.getProviderConfig('custom') }
            this.customHeadersJson = JSON.stringify(TRANSLATE_SETTINGS.getProviderConfig('custom').headers || {}, null, 2)
            this.save(() => TRANSLATE_SETTINGS.setActiveProvider(this.provider))
        },
        onChangeSourceLang () { this.save(() => TRANSLATE_SETTINGS.setSourceLang(this.sourceLang)) },
        onChangeTargetLang () { this.save(() => TRANSLATE_SETTINGS.setTargetLang(this.targetLang)) },
        onChangeTargets () { this.save(() => TRANSLATE_SETTINGS.setTargets({ ...this.targets })) },

        saveApiKey () { this.save(() => TRANSLATE_SETTINGS.setApiKey(this.provider, this.apiKey)) },
        saveExtraParams () { this.save(() => TRANSLATE_SETTINGS.setExtraParams(this.provider, { ...this.extraParams })) },

        resetConnection () { this._connectionRequest = null; this.checking = false; this.connectionMessage = 'Connection not tested.' },

        saveCustom (field) {
            this.resetConnection()
            if (field === 'url') {
                try {
                    const url = new URL(this.customConfig.urlPattern)
                    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
                } catch (error) { this.errorMessage = 'Enter a complete HTTP or HTTPS service URL.'; return }
            }
            this.save(() => {
                if (field === 'method') TRANSLATE_SETTINGS.setProviderConfig('custom', { ...TRANSLATE_SETTINGS.getProviderConfig('custom'), method: this.customConfig.method })
                if (field === 'url') TRANSLATE_SETTINGS.setProviderConfig('custom', { ...TRANSLATE_SETTINGS.getProviderConfig('custom'), urlPattern: this.customConfig.urlPattern })
                if (field === 'body') TRANSLATE_SETTINGS.setProviderConfig('custom', { ...TRANSLATE_SETTINGS.getProviderConfig('custom'), body: this.customConfig.body })
            })
        },

        saveCustomHeaders () {
            try {
                const headers = JSON.parse(this.customHeadersJson)
                TRANSLATE_SETTINGS.setProviderConfig('custom', { ...TRANSLATE_SETTINGS.getProviderConfig('custom'), headers })
                this.errorMessage = ''
                this.statusMessage = 'Custom headers saved.'
            } catch (e) {
                this.errorMessage = 'Invalid JSON for headers: ' + e.message
            }
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
            this.connectionMessage = available ? 'Service connected.' : 'Service unavailable. Check your API key and service URL.'
        },

        onChangeRealtimeEnabled () {
            this.realtimeSettings.enabled = this.realtimeEnabled
            this.save(() => {
                TRANSLATE_SETTINGS.setTargets({ ...this.targets, realtime: this.realtimeEnabled })
                TRANSLATE_SETTINGS.setRealtimeSettings(this.realtimeSettings)
                REALTIME_TRANSLATOR.updateSettings()
            })
        },

        saveRealtimeSettings () {
            this.save(() => {
                TRANSLATE_SETTINGS.setRealtimeSettings({ ...this.realtimeSettings })
                REALTIME_TRANSLATOR.updateSettings()
            })
        },

        async testRealtime () {
            this.errorMessage = ''
            this.statusMessage = 'Testing real-time translation…'
            try {
                const testText = 'これはテストメッセージです。'
                const translated = await TRANSLATOR.translate(testText, {
                    sourceLang: this.sourceLang,
                    targetLang: this.targetLang
                })
                this.statusMessage = `Test result: "${translated}"`
            } catch (err) {
                this.errorMessage = 'Test failed: ' + err.message
            }
        }
    }
}