// settings.js - v5.5 POLISHED UPGRADE
// Handles tab navigation, themes, stats, broken links, and localization (i18n)

document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Navigation ---
    const tabs = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // --- Theme Handling ---
    const themeCards = document.querySelectorAll('.theme-card');

    function updateThemeUI(theme) {
        themeCards.forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-theme-id') === theme);
        });
    }

    // Initialize Theme UI from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['theme'], (res) => {
            updateThemeUI(res.theme || 'default');
        });
    }

    themeCards.forEach(card => {
        card.addEventListener('click', () => {
            const theme = card.getAttribute('data-theme-id');
            if (typeof ThemeManager !== 'undefined') {
                ThemeManager.setTheme(theme);
            }
            updateThemeUI(theme);
        });
    });

    // --- Language Handling ---
    const langOptions = document.querySelectorAll('.lang-option');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['language'], (res) => {
            const lang = res.language || (typeof detectLanguage === 'function' ? detectLanguage() : 'en');
            updateLangUI(lang);
            if (typeof applyTranslations === 'function') {
                applyTranslations(lang);
            }
        });
    } else {
        if (typeof applyTranslations === 'function') {
            applyTranslations('en');
        }
        updateLangUI('en');
    }

    function updateLangUI(lang) {
        langOptions.forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-lang') === lang);
        });
    }

    langOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const lang = opt.getAttribute('data-lang');
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ language: lang });
            }
            updateLangUI(lang);
            if (typeof applyTranslations === 'function') {
                applyTranslations(lang);
            }
        });
    });

    // --- Statistics Loading ---
    loadStatistics();

    async function loadStatistics() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

        chrome.storage.local.get(['capturedSites', 'visitStats'], (result) => {
            const sites = result.capturedSites || [];
            const visitStats = result.visitStats || {};

            const totalSites = sites.length;
            const totalCategories = new Set(sites.map(s => s.category)).size;
            const totalVisits = Object.values(visitStats).reduce((sum, v) => sum + v, 0);

            const statTotal = document.getElementById('setting-stat-total');
            const statCats = document.getElementById('setting-stat-cats');
            const statVisits = document.getElementById('setting-stat-visits');

            if (statTotal) animateCountTo(statTotal, totalSites);
            if (statCats) animateCountTo(statCats, totalCategories);
            if (statVisits) animateCountTo(statVisits, totalVisits);
        });
    }

    function animateCountTo(el, target) {
        if (target === 0) {
            el.textContent = '0';
            return;
        }
        const duration = 600;
        const steps = 20;
        const stepTime = duration / steps;
        let current = 0;
        const stepSize = target / steps;

        const interval = setInterval(() => {
            current += stepSize;
            if (current >= target) {
                el.textContent = target;
                clearInterval(interval);
            } else {
                el.textContent = Math.round(current);
            }
        }, stepTime);
    }

    // --- Form Handling ---
    const supportForm = document.getElementById('support-form');
    if (supportForm) {
        supportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = document.getElementById('support-success');
            msg.classList.remove('hidden');
            supportForm.reset();
            setTimeout(() => {
                msg.classList.add('hidden');
            }, 3000);
        });
    }

    // --- Web Clipper Toggle ---
    const clipperToggle = document.getElementById('setting-clipper-enabled');
    if (clipperToggle && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Load saved state
        chrome.storage.local.get(['clipperEnabled'], (res) => {
            clipperToggle.checked = res.clipperEnabled === true;
        });
        // Save on change
        clipperToggle.addEventListener('change', () => {
            chrome.storage.local.set({ clipperEnabled: clipperToggle.checked });
        });
    }

    // =========== v5.4 BROKEN LINKS ===========
    const runLinkCheckBtn = document.getElementById('run-link-check');
    const lastLinkCheckEl = document.getElementById('last-link-check');
    const brokenLinksListEl = document.getElementById('broken-links-list');

    // Load existing broken links data
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['brokenLinks', 'lastLinkCheck'], (res) => {
            if (res.lastLinkCheck && lastLinkCheckEl) {
                lastLinkCheckEl.textContent = new Date(res.lastLinkCheck).toLocaleString();
            }
            if (res.brokenLinks && res.brokenLinks.length > 0 && brokenLinksListEl) {
                renderBrokenLinks(res.brokenLinks);
            }
        });
    }

    if (runLinkCheckBtn) {
        runLinkCheckBtn.addEventListener('click', () => {
            runLinkCheckBtn.textContent = '⏳ Checking...';
            runLinkCheckBtn.disabled = true;
            chrome.runtime.sendMessage({ action: 'checkBrokenLinks' }, () => {
                setTimeout(() => {
                    chrome.storage.local.get(['brokenLinks', 'lastLinkCheck'], (res) => {
                        if (lastLinkCheckEl && res.lastLinkCheck) {
                            lastLinkCheckEl.textContent = new Date(res.lastLinkCheck).toLocaleString();
                        }
                        if (brokenLinksListEl) {
                            renderBrokenLinks(res.brokenLinks || []);
                        }
                        runLinkCheckBtn.textContent = 'Run Check Now';
                        runLinkCheckBtn.disabled = false;
                    });
                }, 2000);
            });
        });
    }

    function renderBrokenLinks(links) {
        if (!brokenLinksListEl) return;
        if (links.length === 0) {
            brokenLinksListEl.innerHTML = '<p>No broken links detected. ✅</p>';
            return;
        }
        brokenLinksListEl.innerHTML = links.map(link => `
            <div style="padding:8px 10px;border:1px solid rgba(239,68,68,0.15);border-radius:8px;margin-bottom:6px;background:rgba(239,68,68,0.04)">
                <strong style="font-size:0.75rem;color:var(--text-primary)">${escapeHtml(link.name)}</strong>
                <div style="font-size:0.65rem;opacity:0.6;margin-top:2px">${escapeHtml(link.url)}</div>
                <span style="font-size:0.6rem;color:#ef4444">Status: ${link.status || 'Unreachable'}</span>
            </div>
        `).join('');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

