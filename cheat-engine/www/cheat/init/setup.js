import MainComponent from '../MainComponent.js'

// Libraries are loaded in order by import.js before this module runs.
new Vue({
    vuetify: new Vuetify({
        theme: {
            dark: true,
            themes: {
                dark: {
                    primary: '#eac684',
                    secondary: '#aebbd0',
                    accent: '#eac684',
                    error: '#ffb4ab',
                    success: '#9cceb4'
                }
            }
        }
    }),
    components: { MainComponent }
}).$mount('#rpg-cheat-app')
