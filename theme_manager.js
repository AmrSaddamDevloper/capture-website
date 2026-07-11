// theme_manager.js

(function () {
    const ThemeManager = {
        init: function () {
            // Apply immediately to prevent flash
            this.loadTheme();

            // Listen for changes
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener((changes, namespace) => {
                    if (namespace === 'sync' && changes.theme) {
                        this.applyTheme(changes.theme.newValue);
                    }
                });
            }
        },

        loadTheme: function () {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.get(['theme'], (result) => {
                    const theme = result.theme || 'default';
                    this.applyTheme(theme);
                });
            } else {
                // Fallback for non-extension context (testing)
                this.applyTheme('default');
            }
        },

        applyTheme: function (theme) {
            document.documentElement.setAttribute('data-theme', theme);
        },

        setTheme: function (theme) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ theme: theme });
            }
            this.applyTheme(theme);
        }
    };

    // Expose globally
    window.ThemeManager = ThemeManager;

    // Run init
    ThemeManager.init();
})();
