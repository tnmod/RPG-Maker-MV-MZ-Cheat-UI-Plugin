import { KeyValueStorage } from './KeyValueStorage.js'

export const END_POINT_URL_PATTERN_TEXT_SYMBOL = '${TEXT}'

export const TRANSLATION_PROVIDERS = {
    // Local/self-hosted services (existing)
    ezTransWeb: {
        id: 'ezTransWeb',
        name: 'ezTransWeb (Local)',
        category: 'local',
        helpUrl: 'https://github.com/HelloKS/ezTransWeb',
        requiresKey: false,
        defaultConfig: {
            method: 'get',
            urlPattern: `http://localhost:5000/translate?text=${END_POINT_URL_PATTERN_TEXT_SYMBOL}`,
            body: ''
        }
    },
    ezTransServer: {
        id: 'ezTransServer',
        name: 'eztrans-server (Local)',
        category: 'local',
        helpUrl: 'https://github.com/nanikit/eztrans-server',
        requiresKey: false,
        defaultConfig: {
            method: 'post',
            urlPattern: `http://localhost:8000`,
            body: END_POINT_URL_PATTERN_TEXT_SYMBOL
        }
    },
    libreTranslate: {
        id: 'libreTranslate',
        name: 'LibreTranslate (Self-hosted)',
        category: 'local',
        helpUrl: 'https://libretranslate.com/',
        requiresKey: false,
        defaultConfig: {
            method: 'post',
            urlPattern: `http://localhost:5000/translate`,
            body: JSON.stringify({
                q: END_POINT_URL_PATTERN_TEXT_SYMBOL,
                source: 'ja',
                target: 'vi',
                format: 'text'
            })
        }
    },

    // Cloud APIs (new)
    googleTranslate: {
        id: 'googleTranslate',
        name: 'Google Translate API',
        category: 'cloud',
        helpUrl: 'https://cloud.google.com/translate/docs/apis',
        requiresKey: true,
        keyLabel: 'API Key',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://translation.googleapis.com/language/translate/v2',
            body: JSON.stringify({
                q: END_POINT_URL_PATTERN_TEXT_SYMBOL,
                source: 'ja',
                target: 'vi',
                format: 'text',
                key: '${API_KEY}'
            })
        }
    },
    deepL: {
        id: 'deepL',
        name: 'DeepL API',
        category: 'cloud',
        helpUrl: 'https://www.deepl.com/docs-api',
        requiresKey: true,
        keyLabel: 'Auth Key',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://api-free.deepl.com/v2/translate',
            body: JSON.stringify({
                text: [END_POINT_URL_PATTERN_TEXT_SYMBOL],
                source_lang: 'JA',
                target_lang: 'VI'
            }),
            headers: {
                'Authorization': 'DeepL-Auth-Key ${API_KEY}',
                'Content-Type': 'application/json'
            }
        }
    },
    deepLPro: {
        id: 'deepLPro',
        name: 'DeepL API Pro',
        category: 'cloud',
        helpUrl: 'https://www.deepl.com/docs-api',
        requiresKey: true,
        keyLabel: 'Auth Key',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://api.deepl.com/v2/translate',
            body: JSON.stringify({
                text: [END_POINT_URL_PATTERN_TEXT_SYMBOL],
                source_lang: 'JA',
                target_lang: 'VI'
            }),
            headers: {
                'Authorization': 'DeepL-Auth-Key ${API_KEY}',
                'Content-Type': 'application/json'
            }
        }
    },
    bingTranslator: {
        id: 'bingTranslator',
        name: 'Microsoft Translator (Azure)',
        category: 'cloud',
        helpUrl: 'https://docs.microsoft.com/azure/cognitive-services/translator/',
        requiresKey: true,
        keyLabel: 'Subscription Key',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=ja&to=vi',
            body: JSON.stringify([{ text: END_POINT_URL_PATTERN_TEXT_SYMBOL }]),
            headers: {
                'Ocp-Apim-Subscription-Key': '${API_KEY}',
                'Ocp-Apim-Subscription-Region': '${REGION}',
                'Content-Type': 'application/json'
            }
        }
    },
    yandexTranslate: {
        id: 'yandexTranslate',
        name: 'Yandex Translate API',
        category: 'cloud',
        helpUrl: 'https://yandex.com/dev/translate/',
        requiresKey: true,
        keyLabel: 'API Key',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://translate.yandex.net/api/v1.5/tr.json/translate',
            body: JSON.stringify({
                key: '${API_KEY}',
                text: END_POINT_URL_PATTERN_TEXT_SYMBOL,
                lang: 'ja-vi',
                format: 'plain'
            })
        }
    },
    papago: {
        id: 'papago',
        name: 'Naver Papago API',
        category: 'cloud',
        helpUrl: 'https://developers.naver.com/docs/papago/papago-nmt-api-reference/',
        requiresKey: true,
        keyLabel: 'Client ID / Secret',
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://openapi.naver.com/v1/papago/n2mt',
            body: JSON.stringify({
                source: 'ja',
                target: 'vi',
                text: END_POINT_URL_PATTERN_TEXT_SYMBOL
            }),
            headers: {
                'X-Naver-Client-Id': '${CLIENT_ID}',
                'X-Naver-Client-Secret': '${CLIENT_SECRET}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    },

    // Free web-based (no API key, but may have limits)
    googleWeb: {
        id: 'googleWeb',
        name: 'Google Translate (Web - Free)',
        category: 'free',
        helpUrl: 'https://translate.google.com/',
        requiresKey: false,
        defaultConfig: {
            method: 'post',
            urlPattern: 'https://translate.googleapis.com/translate_a/single',
            body: 'client=gtx&sl=ja&tl=vi&dt=t&q=' + END_POINT_URL_PATTERN_TEXT_SYMBOL,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    }
}

export const DEFAULT_BULK_CHUNK_SIZE = {
    local: 500,
    cloud: 100,
    free: 50
}

export const SUPPORTED_LANGUAGES = [
    { code: 'vi', name: 'Vietnamese' },
    { code: 'en', name: 'English' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'th', name: 'Thai' },
    { code: 'id', name: 'Indonesian' },
    { code: 'es', name: 'Spanish' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ru', name: 'Russian' }
]


class Translator {
    constructor (settings) {
        this.settings = settings
        this._cache = new Map()
        this._pendingRequests = new Map()
    }

    _getCacheKey (text, sourceLang, targetLang) {
        return `${sourceLang}:${targetLang}:${text}`
    }

    async __translate (text, options = {}) {
        const provider = this.settings.getActiveProvider()
        const config = this.settings.getProviderConfig(provider)
        const apiKey = this.settings.getApiKey(provider)
        const extraParams = this.settings.getExtraParams(provider)

        if (!text || !text.trim()) return text

        const cacheKey = this._getCacheKey(text, options.sourceLang || 'ja', options.targetLang || 'vi')
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey)
        }

        if (this._pendingRequests.has(cacheKey)) {
            return this._pendingRequests.get(cacheKey)
        }

        const requestPromise = this._doTranslate(text, config, apiKey, extraParams, options)
        this._pendingRequests.set(cacheKey, requestPromise)

        try {
            const result = await requestPromise
            this._cache.set(cacheKey, result)
            if (this._cache.size > 1000) {
                const firstKey = this._cache.keys().next().value
                this._cache.delete(firstKey)
            }
            return result
        } finally {
            this._pendingRequests.delete(cacheKey)
        }
    }

    async _doTranslate (text, config, apiKey, extraParams, options) {
        const urlPattern = config.urlPattern
        const method = config.method || 'post'
        let body = config.body || ''
        const headers = { ...config.headers }

        // Replace placeholders
        const replacePlaceholders = (str) => {
            if (!str) return str
            return str
                .replace(/\$\{TEXT\}/g, encodeURIComponent(text))
                .replace(/\$\{API_KEY\}/g, apiKey || '')
                .replace(/\$\{CLIENT_ID\}/g, extraParams.clientId || '')
                .replace(/\$\{CLIENT_SECRET\}/g, extraParams.clientSecret || '')
                .replace(/\$\{REGION\}/g, extraParams.region || '')
        }

        const url = replacePlaceholders(urlPattern)
        body = replacePlaceholders(body)

        for (const [key, value] of Object.entries(headers)) {
            headers[key] = replacePlaceholders(value)
        }

        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            const fetchOptions = {
                method: method.toUpperCase(),
                headers,
                signal: controller.signal
            }

            if (method === 'post' && body) {
                fetchOptions.body = body
            }

            const response = await fetch(url, fetchOptions)
            clearTimeout(timeoutId)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            // Try to parse as JSON, fall back to text
            let data
            const contentType = response.headers.get('content-type') || ''
            if (contentType.includes('application/json')) {
                data = await response.json()
            } else {
                data = await response.text()
            }
            return this._parseResponse(data, config.id)
        } catch (error) {
            console.error('[TranslateHelper] Translation error:', error.message)
            throw error
        }
    }

    _parseResponse (data, providerId) {
        if (!data) return ''

        // Handle different provider response formats
        switch (providerId) {
            case 'googleTranslate':
                return data.data?.translations?.[0]?.translatedText || ''
            case 'deepL':
            case 'deepLPro':
                return data.translations?.[0]?.text || ''
            case 'bingTranslator':
                return data[0]?.translations?.[0]?.text || ''
            case 'yandexTranslate':
                return data.text?.[0] || ''
            case 'papago':
                return data.message?.result?.translatedText || ''
            case 'googleWeb':
                return data[0]?.[0]?.[0] || ''
            case 'libreTranslate':
                return data.translatedText || ''
            case 'ezTransWeb':
            case 'ezTransServer':
                return typeof data === 'string' ? data : (data.translatedText || data.result || JSON.stringify(data))
            default:
                // Try common patterns
                if (typeof data === 'string') return data
                if (data.translatedText) return data.translatedText
                if (data.translation) return data.translation
                if (data.result) return data.result
                if (data.text?.[0]) return data.text[0]
                if (data.translations?.[0]?.text) return data.translations[0].text
                if (data.translations?.[0]?.translatedText) return data.translations[0].translatedText
                return JSON.stringify(data)
        }
    }

    async translate (text, options = {}) {
        try {
            return await this.__translate(text, options)
        } catch (err) {
            console.warn('[TranslateHelper] Translation failed, returning original:', err.message)
            return text
        }
    }

    async translateBulk (texts, options = {}) {
        if (!texts?.length) return []

        const provider = this.settings.getActiveProvider()
        const chunkSize = this.settings.getBulkTranslateChunkSize()
        const results = []

        for (let i = 0; i < texts.length; i += chunkSize) {
            const chunk = texts.slice(i, i + chunkSize)
            const chunkResults = await this._translateChunk(chunk, options)
            results.push(...chunkResults)
        }

        return results
    }

    async _translateChunk (texts, options) {
        // For providers that support batch translation natively
        const provider = this.settings.getActiveProvider()
        const providerConfig = TRANSLATION_PROVIDERS[provider]

        if (providerConfig?.supportsBatch) {
            try {
                return await this.__translateBulk(texts, options)
            } catch (err) {
                console.warn('[TranslateHelper] Batch translation failed, falling back to individual:', err.message)
            }
        }

        // Fallback: translate individually
        const results = []
        for (const text of texts) {
            results.push(await this.translate(text, options))
        }
        return results
    }

    async __translateBulk (texts, options = {}) {
        // Default implementation - join with newlines and split
        const joined = texts.map(t => t.replace(/\n/g, ' ')).join('\n')
        const translated = await this.__translate(joined, options)
        return translated.split('\n').map((t, i) => t || texts[i])
    }

    clearCache () {
        this._cache.clear()
    }
}


class TranslateSettings {
    constructor () {
        this.kvStorage = new KeyValueStorage('./www/cheat-settings/translate.json')
        this.__readSettings()
    }

    __readSettings () {
        const json = this.kvStorage.getItem('data')

        if (!json) {
            this.data = this._getDefaultSettings()
            return
        }

        try {
            this.data = JSON.parse(json)
            // Migration for old settings
            this._migrateSettings()
        } catch (e) {
            console.error('[TranslateHelper] Failed to parse settings, using defaults:', e)
            this.data = this._getDefaultSettings()
        }
    }

    _getDefaultSettings () {
        return {
            enabled: false,
            provider: 'ezTransWeb',
            sourceLang: 'ja',
            targetLang: 'vi',

            // Provider configurations
            providers: {},

            // API keys and extra params (encrypted in real implementation)
            apiKeys: {},
            extraParams: {},

            // Translation targets
            targets: {
                items: false,
                variables: true,
                switches: true,
                maps: true,
                realtime: false  // New: real-time screen text translation
            },

            // Real-time translation settings
            realtime: {
                enabled: false,
                hookWindows: ['Window_Message', 'Window_Help', 'Window_ItemList', 'Window_SkillList', 'Window_EquipItem'],
                showOriginal: true,
                showTranslation: true,
                position: 'bottom', // 'bottom', 'top', 'overlay'
                fontSize: 14,
                bgOpacity: 0.85
            },

            bulkTranslateChunkSize: 500
        }
    }

    _migrateSettings () {
        // Migrate old format
        if (this.data.endPointSelection && !this.data.provider) {
            this.data.provider = this.data.endPointSelection
        }
        if (this.data.customEndPointData && !this.data.providers.custom) {
            this.data.providers.custom = this.data.customEndPointData
        }
        if (!this.data.apiKeys) this.data.apiKeys = {}
        if (!this.data.extraParams) this.data.extraParams = {}
        if (!this.data.realtime) {
            this.data.realtime = this._getDefaultSettings().realtime
        }
        if (!this.data.targets.realtime) {
            this.data.targets.realtime = false
        }
    }

    __writeSettings () {
        this.kvStorage.setItem('data', JSON.stringify(this.data))
    }

    getActiveProvider () {
        return this.data.provider || 'ezTransWeb'
    }

    setActiveProvider (providerId) {
        this.data.provider = providerId
        this.__writeSettings()
    }

    getProviderConfig (providerId = null) {
        const id = providerId || this.getActiveProvider()
        const custom = this.data.providers?.[id]
        const defaultProvider = TRANSLATION_PROVIDERS[id]

        if (custom) {
            return { ...defaultProvider?.defaultConfig, ...custom }
        }
        return defaultProvider?.defaultConfig || TRANSLATION_PROVIDERS.ezTransWeb.defaultConfig
    }

    setProviderConfig (providerId, config) {
        if (!this.data.providers) this.data.providers = {}
        this.data.providers[providerId] = config
        this.__writeSettings()
    }

    getApiKey (providerId) {
        return this.data.apiKeys?.[providerId] || ''
    }

    setApiKey (providerId, key) {
        if (!this.data.apiKeys) this.data.apiKeys = {}
        this.data.apiKeys[providerId] = key
        this.__writeSettings()
    }

    getExtraParams (providerId) {
        return this.data.extraParams?.[providerId] || {}
    }

    setExtraParams (providerId, params) {
        if (!this.data.extraParams) this.data.extraParams = {}
        this.data.extraParams[providerId] = params
        this.__writeSettings()
    }

    getBulkTranslateChunkSize () {
        return this.data.bulkTranslateChunkSize || 500
    }

    setBulkTranslateChunkSize (size) {
        this.data.bulkTranslateChunkSize = Math.max(1, Math.min(2000, Number(size) || 500))
        this.__writeSettings()
    }

    getTargets () {
        return this.data.targets || { variables: true, switches: true, items: false, maps: true, realtime: false }
    }

    setTargets (targets) {
        this.data.targets = targets
        this.__writeSettings()
    }

    isEnabled () {
        return this.data.enabled === true
    }

    setEnabled (flag) {
        this.data.enabled = !!flag
        this.__writeSettings()
    }

    getSourceLang () {
        return this.data.sourceLang || 'ja'
    }

    setSourceLang (lang) {
        this.data.sourceLang = lang
        this.__writeSettings()
    }

    getTargetLang () {
        return this.data.targetLang || 'vi'
    }

    setTargetLang (lang) {
        this.data.targetLang = lang
        this.__writeSettings()
    }

    // Real-time translation settings
    getRealtimeSettings () {
        return this.data.realtime || this._getDefaultSettings().realtime
    }

    setRealtimeSettings (settings) {
        this.data.realtime = { ...this.getRealtimeSettings(), ...settings }
        this.__writeSettings()
    }

    isRealtimeEnabled () {
        return this.isEnabled() && this.getTargets().realtime && this.getRealtimeSettings().enabled
    }

    // Check if provider requires API key
    providerRequiresKey (providerId) {
        const provider = TRANSLATION_PROVIDERS[providerId]
        return provider?.requiresKey === true
    }

    getProviderKeyLabel (providerId) {
        const provider = TRANSLATION_PROVIDERS[providerId]
        return provider?.keyLabel || 'API Key'
    }

    getAvailableProviders () {
        return Object.values(TRANSLATION_PROVIDERS)
    }

    getProvidersByCategory () {
        const categories = {}
        for (const provider of Object.values(TRANSLATION_PROVIDERS)) {
            if (!categories[provider.category]) categories[provider.category] = []
            categories[provider.category].push(provider)
        }
        return categories
    }
}


class RealtimeTranslator {
    constructor (translator, settings) {
        this.translator = translator
        this.settings = settings
        this._hooks = []
        this._overlay = null
        this._styleId = 'cheat-realtime-translate-style'
    }

    initialize () {
        if (this._hooks.length) return // Already initialized

        this._injectStyles()
        this._createOverlay()
        this._installHooks()
    }

    _injectStyles () {
        if (document.getElementById(this._styleId)) return

        const style = document.createElement('style')
        style.id = this._styleId
        style.textContent = `
            .cheat-realtime-overlay {
                position: fixed;
                z-index: 2147483647;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                color: #fff;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            }
            .cheat-realtime-overlay.bottom {
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                max-width: 90vw;
                text-align: center;
            }
            .cheat-realtime-overlay.top {
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                max-width: 90vw;
                text-align: center;
            }
            .cheat-realtime-overlay.overlay {
                bottom: 0;
                left: 0;
                right: 0;
                padding: 12px 20px;
                background: linear-gradient(180deg, transparent, rgba(0,0,0,0.9));
            }
            .cheat-realtime-line {
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin: 4px 0;
            }
            .cheat-realtime-original {
                color: rgba(255,255,255,0.7);
                font-size: 0.9em;
            }
            .cheat-realtime-translation {
                color: #eac684;
                font-weight: 500;
            }
        `
        document.head.appendChild(style)
    }

    _createOverlay () {
        this._overlay = document.createElement('div')
        this._overlay.className = 'cheat-realtime-overlay bottom'
        this._overlay.style.display = 'none'
        document.body.appendChild(this._overlay)
    }

    _installHooks () {
        const realtimeSettings = this.settings.getRealtimeSettings()
        const windowNames = realtimeSettings.hookWindows || [
            'Window_Message', 'Window_Help', 'Window_ItemList',
            'Window_SkillList', 'Window_EquipItem', 'Window_ShopBuy',
            'Window_ShopSell', 'Window_NameInput', 'Window_ChoiceList'
        ]

        for (const windowName of windowNames) {
            this._hookWindow(windowName)
        }
    }

    _hookWindow (windowName) {
        if (typeof window[windowName] === 'undefined') return

        const originalPrototype = window[windowName].prototype
        if (!originalPrototype) return

        // Hook refresh/draw methods
        const methodsToHook = ['refresh', 'update', 'drawText', 'drawTextEx', 'processCharacter']

        for (const methodName of methodsToHook) {
            if (typeof originalPrototype[methodName] === 'function') {
                const original = originalPrototype[methodName]
                const self = this

                originalPrototype[methodName] = function (...args) {
                    const result = original.apply(this, args)

                    // Try to extract text from this window
                    if (self.settings.isRealtimeEnabled()) {
                        self._extractAndTranslate(this, windowName)
                    }

                    return result
                }
            }
        }

        this._hooks.push({ windowName, methods: methodsToHook })
    }

    _extractAndTranslate (windowInstance, windowName) {
        // Extract text from various window types
        let text = ''

        if (windowName === 'Window_Message' && windowInstance._textState) {
            text = windowInstance._textState.text || ''
        } else if (windowName === 'Window_Help' && windowInstance._text) {
            text = windowInstance._text
        } else if (windowInstance._list) {
            // For list windows (items, skills, etc.)
            const index = windowInstance.index()
            if (index >= 0 && windowInstance._list[index]) {
                const item = windowInstance._list[index]
                text = item.name || item.description || ''
            }
        } else if (windowInstance._text) {
            text = windowInstance._text
        }

        if (text && text.trim()) {
            this._showTranslation(text.trim())
        }
    }

    async _showTranslation (text) {
        if (!this.settings.isRealtimeEnabled()) return

        try {
            const translated = await this.translator.translate(text, {
                sourceLang: this.settings.getSourceLang(),
                targetLang: this.settings.getTargetLang()
            })

            if (translated && translated !== text) {
                this._updateOverlay(text, translated)
            }
        } catch (err) {
            console.warn('[RealtimeTranslator] Failed:', err.message)
        }
    }

    _updateOverlay (original, translated) {
        if (!this._overlay) return

        const settings = this.settings.getRealtimeSettings()
        this._overlay.className = `cheat-realtime-overlay ${settings.position || 'bottom'}`
        this._overlay.style.fontSize = (settings.fontSize || 14) + 'px'
        this._overlay.style.background = `rgba(0,0,0,${settings.bgOpacity || 0.85})`

        let html = ''
        if (settings.showOriginal) {
            html += `<div class="cheat-realtime-original">${this._escapeHtml(original)}</div>`
        }
        if (settings.showTranslation) {
            html += `<div class="cheat-realtime-translation">${this._escapeHtml(translated)}</div>`
        }

        this._overlay.innerHTML = html
        this._overlay.style.display = 'block'

        // Auto-hide after a delay
        clearTimeout(this._hideTimer)
        this._hideTimer = setTimeout(() => {
            if (this._overlay) this._overlay.style.display = 'none'
        }, 5000)
    }

    _escapeHtml (text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }

    destroy () {
        // Restore original methods
        for (const hook of this._hooks) {
            const windowClass = window[hook.windowName]
            if (windowClass && windowClass.prototype) {
                // Note: Full restoration would require storing originals
                // For now, just clear hooks array
            }
        }
        this._hooks = []

        if (this._overlay) {
            this._overlay.remove()
            this._overlay = null
        }

        const style = document.getElementById(this._styleId)
        if (style) style.remove()

        clearTimeout(this._hideTimer)
    }

    updateSettings () {
        this.destroy()
        if (this.settings.isRealtimeEnabled()) {
            this.initialize()
        }
    }
}


export const TRANSLATE_SETTINGS = new TranslateSettings()
export const TRANSLATOR = new Translator(TRANSLATE_SETTINGS)
export const REALTIME_TRANSLATOR = new RealtimeTranslator(TRANSLATOR, TRANSLATE_SETTINGS)