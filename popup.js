// Popup.js - v5.5 POLISHED UPGRADE
// Features: Fuzzy Search, Smart Tags, Quick Notes, Web Clips, Thumbnails, Archive, Sections

document.addEventListener('DOMContentLoaded', async () => {
    // =========== CACHED DOM ELEMENTS ===========
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const sitesGrid = $('#sites-grid');
    const branchesGrid = $('#branches-grid');
    const emptyState = $('.empty-state');
    const searchInput = $('#search-input');
    const categoryContainer = $('#category-filters');
    const addBtn = $('#add-btn');
    const modal = $('#item-modal');
    const modalClose = $('#modal-close');
    const modalCancel = $('#modal-cancel');
    const modalForm = $('#website-form');
    const categoryDatalist = $('#category-suggestions');
    const toastContainer = $('#toast-container');
    const sectionSelect = $('#section-select');

    // Stats elements
    const statTotalCount = $('#stat-total-count');
    const statCatCount = $('#stat-cat-count');
    const statTodayCount = $('#stat-today-count');
    const statSectionCount = $('#stat-section-count');
    const topSitesSection = $('#top-sites-section');
    const topSitesRow = $('#top-sites-row');

    // Confirm dialog
    const confirmOverlay = $('#confirm-overlay');
    const confirmCancel = $('#confirm-cancel');
    const confirmDelete = $('#confirm-delete');

    // Image upload elements
    const imagePreviewBox = $('#image-preview-box');
    const imagePreviewImg = $('#image-preview-img');
    const imagePlaceholderIcon = $('#image-placeholder-icon');
    const uploadImageBtn = $('#upload-image-btn');
    const removeImageBtn = $('#remove-image-btn');
    const imageFileInput = $('#image-file-input');

    // Sections elements
    const sectionsBar = $('#sections-bar');
    const sectionsScroll = sectionsBar.querySelector('.sections-scroll');
    const addSectionBtn = $('#add-section-btn');
    const sectionModal = $('#section-modal');
    const sectionForm = $('#section-form');
    const sectionModalClose = $('#section-modal-close');
    const sectionModalCancel = $('#section-modal-cancel');
    const sectionIconPicker = $('#section-icon-picker');
    const breadcrumbBar = $('#breadcrumb-bar');

    // Changelog elements
    const changelogBtn = $('#changelog-btn');
    const changelogModal = $('#changelog-modal');
    const changelogClose = $('#changelog-close');
    const changelogDismiss = $('#changelog-dismiss');

    // v5.5 Panel elements
    const clipsBtn = $('#clips-btn');
    const clipsPanel = $('#clips-panel');
    const clipsPanelClose = $('#clips-panel-close');
    const clipsList = $('#clips-list');
    const archiveViewer = $('#archive-viewer');
    const archiveViewerClose = $('#archive-viewer-close');
    const archiveContent = $('#archive-content');
    const tagsInput = $('#tags-input');
    const suggestedTags = $('#suggested-tags');
    const noteInput = $('#note-input');

    // =========== STATE ===========
    let savedSites = [];
    let sections = [];
    let currentCategory = 'all';
    let currentSection = 'all';
    let editingSiteDate = null;
    let pendingDeleteUrl = null;
    let customImageData = null;
    let visitStats = {};
    let _renderRAF = null;
    let selectedSectionIcon = '📁';
    let currentTagFilter = '';
    let allTags = new Set();

    // =========== INITIALIZATION (Parallel Loading) ===========
    if (window.initLanguage) {
        window.initLanguage();
    }

    // Load all data in parallel for maximum speed
    const startTime = performance.now();
    const [sitesData, statsData, prefData, sectionsData, changelogData] = await Promise.all([
        storageGet('capturedSites'),
        storageGet('visitStats'),
        storageGet('lastPreference'),
        storageGet('userSections'),
        storageGet('lastSeenVersion')
    ]);

    savedSites = sitesData.capturedSites || [];
    savedSites.sort((a, b) => b.date - a.date);
    visitStats = statsData.visitStats || {};
    sections = sectionsData.userSections || [];

    // Restore last preference
    if (prefData.lastPreference) {
        currentCategory = prefData.lastPreference.category || 'all';
        currentSection = prefData.lastPreference.section || 'all';
    }

    // Performance: batch initial render
    requestAnimationFrame(() => {
        renderCategories();
        renderSections();
        renderSites();
        updateStats();
        renderTopSites();
        populateSectionSelect();

        const loadTime = performance.now() - startTime;
        console.log(`[Capture v5.5] Loaded in ${loadTime.toFixed(1)}ms`);
    });

    // Show changelog for new version
    const lastSeen = changelogData.lastSeenVersion || '';
    if (lastSeen !== '5.5') {
        setTimeout(() => {
            changelogModal.classList.remove('hidden');
            storageSet({ lastSeenVersion: '5.5' });
        }, 400);
    }

    // =========== EVENT LISTENERS ===========
    addBtn.addEventListener('click', () => openModal());
    modalClose.addEventListener('click', () => closeModal());
    modalCancel.addEventListener('click', () => closeModal());

    const settingsBtn = $('#settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }

    // Changelog
    changelogBtn.addEventListener('click', () => {
        changelogModal.classList.remove('hidden');
    });
    changelogClose.addEventListener('click', () => {
        changelogModal.classList.add('hidden');
    });
    changelogDismiss.addEventListener('click', () => {
        changelogModal.classList.add('hidden');
        // Remove pulse dot after viewing
        changelogBtn.classList.remove('changelog-pulse');
    });

    // Form Submit
    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = $('#url-input').value.trim();
        const name = $('#name-input').value.trim();
        const category = $('#category-input').value.trim() || 'Uncategorized';
        const sectionId = sectionSelect.value || '';
        const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];
        const note = noteInput ? noteInput.value.trim() : '';

        if (url && name) {
            const date = editingSiteDate || Date.now();
            const siteData = { url, name, category, date, sectionId, tags, note };

            // Attach custom image if provided
            if (customImageData) {
                siteData.customIcon = customImageData;
            } else if (editingSiteDate) {
                const existing = savedSites.find(s => s.url === url);
                if (existing && existing.customIcon) {
                    siteData.customIcon = existing.customIcon;
                }
            }

            await addSite(siteData);
            closeModal();
            modalForm.reset();
            resetImageUpload();

            await loadSites();
            renderCategories();
            renderSections();
            renderSites();
            updateStats();
            populateSectionSelect();

            showToast(editingSiteDate ? 'Site updated!' : 'Site saved!', 'success');
        }
    });

    // Optimized search with fuzzy matching & debounce
    searchInput.addEventListener('input', debounce((e) => {
        scheduleRender(e.target.value);
    }, 100));

    // Confirm dialog events
    confirmCancel.addEventListener('click', () => {
        confirmOverlay.classList.remove('active');
        pendingDeleteUrl = null;
    });

    confirmDelete.addEventListener('click', async () => {
        if (pendingDeleteUrl) {
            await deleteSite(pendingDeleteUrl);
            pendingDeleteUrl = null;
            confirmOverlay.classList.remove('active');
            showToast('Site removed!', 'success');
        }
    });

    // Image Upload handlers
    uploadImageBtn.addEventListener('click', () => imageFileInput.click());
    imagePreviewBox.addEventListener('click', () => imageFileInput.click());

    imageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 128 * 1024) {
            showToast('Image too large! Max 128KB.', 'error');
            imageFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            customImageData = ev.target.result;
            imagePreviewImg.src = customImageData;
            imagePreviewImg.style.display = 'block';
            imagePlaceholderIcon.style.display = 'none';
            imagePreviewBox.classList.add('has-image');
            removeImageBtn.classList.add('visible');
        };
        reader.readAsDataURL(file);
    });

    removeImageBtn.addEventListener('click', () => {
        resetImageUpload();
        customImageData = '__REMOVE__';
    });

    // =========== SECTION EVENTS ===========
    addSectionBtn.addEventListener('click', () => {
        sectionModal.classList.remove('hidden');
        $('#section-name-input').value = '';
        selectedSectionIcon = '📁';
        sectionIconPicker.querySelectorAll('.icon-pick').forEach(b => {
            b.classList.toggle('active', b.dataset.icon === '📁');
        });
    });

    sectionModalClose.addEventListener('click', () => sectionModal.classList.add('hidden'));
    sectionModalCancel.addEventListener('click', () => sectionModal.classList.add('hidden'));

    sectionIconPicker.addEventListener('click', (e) => {
        const pick = e.target.closest('.icon-pick');
        if (!pick) return;
        sectionIconPicker.querySelectorAll('.icon-pick').forEach(b => b.classList.remove('active'));
        pick.classList.add('active');
        selectedSectionIcon = pick.dataset.icon;
    });

    sectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#section-name-input').value.trim();
        if (!name) return;

        const newSection = {
            id: 'sec_' + Date.now(),
            name,
            icon: selectedSectionIcon,
            createdAt: Date.now()
        };

        sections.push(newSection);
        await storageSet({ userSections: sections });

        sectionModal.classList.add('hidden');
        renderSections();
        updateStats();
        populateSectionSelect();
        showToast(`Section "${name}" created!`, 'success');
    });

    // Check pending item from context menu
    checkPendingItem();

    // v5.5 PANEL EVENT LISTENERS

    // Clips Panel
    if (clipsBtn) clipsBtn.addEventListener('click', () => openClipsPanel());
    if (clipsPanelClose) clipsPanelClose.addEventListener('click', () => clipsPanel.classList.add('hidden'));

    // Archive Viewer
    if (archiveViewerClose) archiveViewerClose.addEventListener('click', () => archiveViewer.classList.add('hidden'));

    // Tags auto-suggest
    if (tagsInput) {
        tagsInput.addEventListener('focus', () => showTagSuggestions());
        tagsInput.addEventListener('input', () => showTagSuggestions());
    }

    // Save last preference on unload
    window.addEventListener('beforeunload', () => {
        saveLastPreference();
    });

    // =========== STORAGE HELPERS (Performance) ===========
    function storageGet(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => resolve(result));
        });
    }

    function storageSet(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, resolve);
        });
    }

    // =========== CORE FUNCTIONS ===========
    async function loadSites() {
        const result = await storageGet('capturedSites');
        savedSites = result.capturedSites || [];
        savedSites.sort((a, b) => b.date - a.date);
    }

    async function addSite(site) {
        const existingIndex = savedSites.findIndex(s => s.url === site.url);
        if (existingIndex > -1) {
            savedSites[existingIndex] = site;
        } else {
            savedSites.unshift(site);
        }
        return storageSet({ capturedSites: savedSites });
    }

    async function deleteSite(url) {
        savedSites = savedSites.filter(s => s.url !== url);
        await storageSet({ capturedSites: savedSites });
        await loadSites();
        renderCategories();
        renderSections();
        renderSites(searchInput.value);
        updateStats();
        renderTopSites();
        populateSectionSelect();
    }

    async function deleteSection(sectionId) {
        // Remove section and unassign sites
        sections = sections.filter(s => s.id !== sectionId);
        await storageSet({ userSections: sections });

        // Unassign sites from this section
        savedSites.forEach(site => {
            if (site.sectionId === sectionId) {
                site.sectionId = '';
            }
        });
        await storageSet({ capturedSites: savedSites });

        if (currentSection === sectionId) {
            currentSection = 'all';
        }

        renderSections();
        renderSites(searchInput.value);
        updateStats();
        populateSectionSelect();
        showToast('Section removed', 'success');
    }

    // =========== VISIT TRACKING ===========
    function trackVisit(url) {
        visitStats[url] = (visitStats[url] || 0) + 1;
        storageSet({ visitStats });
    }

    function getTopVisited(count = 5) {
        const entries = Object.entries(visitStats);
        entries.sort((a, b) => b[1] - a[1]);
        return entries.slice(0, count).filter(([_, v]) => v > 0);
    }

    // =========== LAST PREFERENCE ===========
    function saveLastPreference() {
        const pref = {
            category: currentCategory,
            section: currentSection,
            timestamp: Date.now()
        };
        chrome.storage.local.set({ lastPreference: pref });
    }

    // =========== RENDERING (Performance Optimized) ===========
    function scheduleRender(filterText) {
        if (_renderRAF) cancelAnimationFrame(_renderRAF);
        _renderRAF = requestAnimationFrame(() => renderSites(filterText));
    }

    function renderSites(filterText = '') {
        const fragment = document.createDocumentFragment();

        // Collect all tags for filtering
        allTags = new Set();
        savedSites.forEach(s => (s.tags || []).forEach(t => allTags.add(t)));

        const filtered = savedSites.filter(site => {
            let matchText = true;
            if (filterText) {
                const query = filterText.toLowerCase();
                const haystack = (site.name + ' ' + site.url + ' ' + (site.tags || []).join(' ')).toLowerCase();
                matchText = haystack.includes(query) || fuzzyMatch(query, haystack);
            }
            const matchCat = currentCategory === 'all' || site.category === currentCategory;
            const matchSection = currentSection === 'all' || (site.sectionId || '') === currentSection;
            const matchTag = !currentTagFilter || (site.tags || []).includes(currentTagFilter);
            return matchText && matchCat && matchSection && matchTag;
        });

        // Clear grids efficiently
        sitesGrid.textContent = '';
        branchesGrid.textContent = '';

        // Render branch cards when viewing "all" sections
        if (currentSection === 'all' && !filterText && sections.length > 0) {
            const branchFragment = document.createDocumentFragment();
            sections.forEach(sec => {
                const count = savedSites.filter(s => s.sectionId === sec.id).length;
                const card = createBranchCard(sec, count);
                branchFragment.appendChild(card);
            });
            branchesGrid.appendChild(branchFragment);
        }

        if (filtered.length === 0 && sections.length === 0) {
            emptyState.classList.remove('hidden');
        } else if (filtered.length === 0 && currentSection !== 'all') {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = 'No sites in this section';
            emptyState.querySelector('p').textContent = 'Add sites to this section to see them here.';
        } else {
            emptyState.classList.add('hidden');
            // Reset empty state text
            emptyState.querySelector('h3').textContent = 'No sites captured yet';
            emptyState.querySelector('p').textContent = 'Tap the + button to save your first website shortcut.';

            // Performance: limit stagger animation
            const maxStagger = Math.min(filtered.length, 10);
            for (let i = 0; i < filtered.length; i++) {
                const card = createSiteCard(filtered[i], i < maxStagger ? i : maxStagger);
                fragment.appendChild(card);
            }
            sitesGrid.appendChild(fragment);
        }

        // Update breadcrumb
        updateBreadcrumb();
    }

    function createBranchCard(section, count) {
        const el = document.createElement('div');
        el.className = 'branch-card';
        el.innerHTML = `
            <div class="branch-icon">${section.icon}</div>
            <div class="branch-name">${escapeHtml(section.name)}</div>
            <div class="branch-count">${count} site${count !== 1 ? 's' : ''}</div>
        `;
        el.addEventListener('click', () => {
            currentSection = section.id;
            saveLastPreference();
            renderSections();
            renderSites(searchInput.value);
            updateBreadcrumb();
        });
        return el;
    }

    function createSiteCard(site, index = 0) {
        const el = document.createElement('div');
        el.className = 'site-card animate-slide-up';
        el.style.animationDelay = `${Math.min(index * 0.03, 0.3)}s`;

        // Determine icon source
        let iconHtml;
        if (site.customIcon) {
            iconHtml = `<img src="${site.customIcon}" alt="icon" class="custom-icon" loading="lazy">`;
        } else {
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(site.url).hostname)}&sz=64`;
            iconHtml = `<img src="${faviconUrl}" alt="icon" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjEuNSI+PHBhdGggZD0iTTEyIDJhMTAgMTAgMCAxIDAgMCAyMCAxMCAxMCAwIDAgMCAwLTIweiIvPjxwYXRoIGQ9Ik0yIDEyaDIwIi8+PHBhdGggZD0iTTEyIDJhMTUgMTUgMCAwIDEgNCAxMCAxNSAxNSAwIDAgMS00IDEwIDE1IDE1IDAgMCAxLTQtMTAgMTUgMTUgMCAwIDEgNC0xMHoiLz48L3N2Zz4='">`;
        }

        let hostname = '';
        try {
            hostname = new URL(site.url).hostname;
        } catch (e) {
            hostname = site.url;
        }

        // Section tag
        const sectionName = site.sectionId ? (sections.find(s => s.id === site.sectionId)?.name || '') : '';
        const sectionTag = sectionName && currentSection === 'all'
            ? `<span class="site-section-tag">${escapeHtml(sectionName)}</span>`
            : '';

        // Tags HTML
        const tagsHtml = (site.tags && site.tags.length > 0)
            ? `<div class="site-tags">${site.tags.slice(0, 3).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        // Thumbnail indicator
        const thumbBadge = site.thumbnail ? '<span class="thumb-dot" title="Has thumbnail">📷</span>' : '';

        // Archive indicator
        const archiveBadge = site.archived ? '<span class="archive-dot" title="Archived">📖</span>' : '';

        // Note snippet
        const noteSnippet = site.note
            ? `<div class="site-note-snippet" title="${escapeHtml(site.note)}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg> ${escapeHtml(site.note.substring(0, 60))}${site.note.length > 60 ? '...' : ''}</div>`
            : '';

        el.innerHTML = `
            <div class="site-icon">${iconHtml}</div>
            <div class="site-info">
                <div class="site-title">${escapeHtml(site.name)} ${thumbBadge}${archiveBadge}</div>
                <div class="site-domain">
                    <span class="site-category-badge">${escapeHtml(site.category)}</span>
                    ${sectionTag}
                    <span>${hostname}</span>
                </div>
                ${tagsHtml}
                ${noteSnippet}
            </div>
            <div class="card-actions">
                <button class="action-btn-mini edit" title="Edit">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                    </svg>
                </button>
                <button class="action-btn-mini delete" title="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;

        // Click to open & track visit
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn-mini')) {
                trackVisit(site.url);
                chrome.tabs.create({ url: site.url });
            }
        });

        // Edit action
        el.querySelector('.edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(site);
        });

        // Delete action
        el.querySelector('.delete').addEventListener('click', (e) => {
            e.stopPropagation();
            pendingDeleteUrl = site.url;
            confirmOverlay.classList.add('active');
        });

        return el;
    }

    function renderCategories() {
        // Only populate datalist for form autocomplete — category chip UI removed in v5.4
        const categories = new Set(savedSites.map(s => s.category));
        categoryDatalist.textContent = '';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            categoryDatalist.appendChild(opt);
        });
        // Always show all categories in the list
        currentCategory = 'all';
    }

    // =========== SECTIONS RENDERING ===========
    function renderSections() {
        // Keep the "All Sites" button
        const allBtn = sectionsScroll.querySelector('#section-all-btn');
        sectionsScroll.textContent = '';
        sectionsScroll.appendChild(allBtn);

        allBtn.classList.toggle('active', currentSection === 'all');

        allBtn.onclick = () => {
            currentSection = 'all';
            saveLastPreference();
            renderSections();
            renderSites(searchInput.value);
        };

        const fragment = document.createDocumentFragment();
        sections.forEach(sec => {
            const count = savedSites.filter(s => s.sectionId === sec.id).length;
            const chip = document.createElement('button');
            chip.className = `section-chip ${currentSection === sec.id ? 'active' : ''}`;
            chip.innerHTML = `
                <span class="section-emoji">${sec.icon}</span>
                <span>${escapeHtml(sec.name)}</span>
                <span class="section-count">${count}</span>
                <span class="section-delete" title="Delete section">×</span>
            `;

            chip.addEventListener('click', (e) => {
                if (e.target.closest('.section-delete')) {
                    e.stopPropagation();
                    deleteSection(sec.id);
                    return;
                }
                currentSection = sec.id;
                saveLastPreference();
                renderSections();
                renderSites(searchInput.value);
            });

            fragment.appendChild(chip);
        });
        sectionsScroll.appendChild(fragment);
    }

    function updateBreadcrumb() {
        if (currentSection === 'all') {
            breadcrumbBar.classList.add('hidden');
            return;
        }

        breadcrumbBar.classList.remove('hidden');
        const section = sections.find(s => s.id === currentSection);
        if (!section) return;

        // Clear extra breadcrumbs
        const existingExtra = breadcrumbBar.querySelectorAll('.breadcrumb-extra');
        existingExtra.forEach(el => el.remove());

        // Add current section breadcrumb
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-sep breadcrumb-extra';
        sep.textContent = '›';

        const crumb = document.createElement('span');
        crumb.className = 'breadcrumb-item current breadcrumb-extra';
        crumb.innerHTML = `<span>${section.icon} ${escapeHtml(section.name)}</span>`;

        breadcrumbBar.appendChild(sep);
        breadcrumbBar.appendChild(crumb);

        // Root breadcrumb goes back to all
        const rootBtn = $('#breadcrumb-root');
        rootBtn.onclick = () => {
            currentSection = 'all';
            saveLastPreference();
            renderSections();
            renderSites(searchInput.value);
        };
    }

    function populateSectionSelect() {
        sectionSelect.textContent = '';
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'None';
        sectionSelect.appendChild(noneOpt);

        sections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id;
            opt.textContent = `${sec.icon} ${sec.name}`;
            sectionSelect.appendChild(opt);
        });
    }

    // =========== STATS ===========
    function updateStats() {
        const totalSites = savedSites.length;
        const totalCategories = new Set(savedSites.map(s => s.category)).size;
        const totalSections = sections.length;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = savedSites.filter(s => s.date >= todayStart.getTime()).length;

        animateCounter(statTotalCount, totalSites);
        animateCounter(statCatCount, totalCategories);
        animateCounter(statTodayCount, todayCount);
        animateCounter(statSectionCount, totalSections);
    }

    function animateCounter(el, target) {
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        if (current === target) return;

        const diff = target - current;
        const steps = Math.min(Math.abs(diff), 12);
        const stepSize = diff / steps;
        let step = 0;

        function tick() {
            step++;
            const val = step === steps ? target : Math.round(current + stepSize * step);
            el.textContent = val;
            if (step < steps) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // =========== TOP VISITED SITES ===========
    function renderTopSites() {
        const topVisited = getTopVisited(5);
        topSitesRow.textContent = '';

        if (topVisited.length === 0) {
            topSitesSection.classList.add('hidden');
            return;
        }

        topSitesSection.classList.remove('hidden');
        const fragment = document.createDocumentFragment();

        topVisited.forEach(([url, count]) => {
            const site = savedSites.find(s => s.url === url);
            if (!site) return;

            const chip = document.createElement('div');
            chip.className = 'top-site-chip';

            let iconSrc;
            if (site.customIcon) {
                iconSrc = site.customIcon;
            } else {
                try {
                    iconSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=32`;
                } catch (e) {
                    iconSrc = '';
                }
            }

            chip.innerHTML = `
                ${iconSrc ? `<img src="${iconSrc}" alt="" loading="lazy">` : ''}
                <span>${escapeHtml(site.name.substring(0, 10))}</span>
                <span class="visit-count">${count}</span>
            `;

            chip.addEventListener('click', () => {
                trackVisit(url);
                chrome.tabs.create({ url });
            });

            fragment.appendChild(chip);
        });

        topSitesRow.appendChild(fragment);
    }

    // =========== MODAL ===========
    function openModal(siteToEdit = null) {
        modal.classList.remove('hidden');
        const modalTitle = $('#modal-title');
        resetImageUpload();
        customImageData = null;

        if (siteToEdit) {
            editingSiteDate = siteToEdit.date;
            modalTitle.textContent = 'Edit Website';
            $('#url-input').value = siteToEdit.url;
            $('#url-input').readOnly = true;
            $('#name-input').value = siteToEdit.name;
            $('#category-input').value = siteToEdit.category;
            sectionSelect.value = siteToEdit.sectionId || '';
            if (tagsInput) tagsInput.value = (siteToEdit.tags || []).join(', ');
            if (noteInput) noteInput.value = siteToEdit.note || '';

            if (siteToEdit.customIcon) {
                imagePreviewImg.src = siteToEdit.customIcon;
                imagePreviewImg.style.display = 'block';
                imagePlaceholderIcon.style.display = 'none';
                imagePreviewBox.classList.add('has-image');
                removeImageBtn.classList.add('visible');
            }
        } else {
            editingSiteDate = null;
            modalTitle.textContent = 'Add Website';
            $('#url-input').readOnly = false;
            modalForm.reset();

            // Pre-select current section if viewing one
            if (currentSection !== 'all') {
                sectionSelect.value = currentSection;
            }

            // Auto-fill active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome://')) {
                    $('#url-input').value = tabs[0].url;
                    $('#name-input').value = tabs[0].title;
                }
            });
        }
    }

    function closeModal() {
        modal.classList.add('hidden');
        resetImageUpload();
        customImageData = null;
    }

    function resetImageUpload() {
        imagePreviewImg.src = '';
        imagePreviewImg.style.display = 'none';
        imagePlaceholderIcon.style.display = 'block';
        imagePreviewBox.classList.remove('has-image');
        removeImageBtn.classList.remove('visible');
        imageFileInput.value = '';
    }

    // =========== TOAST NOTIFICATIONS ===========
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSvg = type === 'success'
            ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

        toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 2200);
    }

    // =========== PENDING ITEM CHECK ===========
    function checkPendingItem() {
        chrome.storage.local.get(['pendingSite'], (res) => {
            if (res.pendingSite) {
                openModal();
                setTimeout(() => {
                    $('#url-input').value = res.pendingSite.url;
                    $('#name-input').value = res.pendingSite.title;
                    chrome.storage.local.remove('pendingSite');
                }, 80);
            }
        });
    }

    // =========== UTILITIES ===========
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // =========== v5.4 FUZZY SEARCH ===========
    function fuzzyMatch(query, text) {
        if (!query || query.length < 2) return false;
        // Bigram matching
        const queryBigrams = getBigrams(query);
        const textBigrams = getBigrams(text);
        if (queryBigrams.length === 0) return false;
        let matches = 0;
        for (const bg of queryBigrams) {
            if (textBigrams.includes(bg)) matches++;
        }
        const score = matches / queryBigrams.length;
        if (score >= 0.5) return true;
        // Sequential char match
        let qi = 0;
        for (let i = 0; i < text.length && qi < query.length; i++) {
            if (text[i] === query[qi]) qi++;
        }
        return qi === query.length;
    }

    function getBigrams(str) {
        const bigrams = [];
        for (let i = 0; i < str.length - 1; i++) {
            bigrams.push(str.substring(i, i + 2));
        }
        return bigrams;
    }

    // =========== v5.4 TAG SUGGESTIONS ===========
    function showTagSuggestions() {
        if (!suggestedTags) return;
        suggestedTags.innerHTML = '';
        const existing = new Set((tagsInput.value || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean));
        const suggestions = [...allTags].filter(t => !existing.has(t.toLowerCase())).slice(0, 8);
        if (suggestions.length === 0) return;
        suggestions.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'suggested-tag-chip';
            chip.textContent = tag;
            chip.addEventListener('click', () => {
                const current = tagsInput.value.trim();
                tagsInput.value = current ? current + ', ' + tag : tag;
                showTagSuggestions();
            });
            suggestedTags.appendChild(chip);
        });
    }

    // =========== v5.4 CLIPS PANEL ===========
    async function openClipsPanel() {
        if (!clipsPanel || !clipsList) return;
        clipsPanel.classList.remove('hidden');
        clipsList.innerHTML = '<p style="color:var(--text-secondary);font-size:0.65rem;text-align:center;padding:20px">Loading clips...</p>';
        const result = await storageGet('webClips');
        const clips = result.webClips || [];
        if (clips.length === 0) {
            clipsList.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:0.7rem"><p>✂️ No clips yet</p><p style="opacity:0.5;font-size:0.6rem">Use Ctrl+Shift+C or right-click to clip text from any page.</p></div>';
            return;
        }
        clipsList.innerHTML = '';
        clips.slice(0, 50).forEach(clip => {
            const item = document.createElement('div');
            item.className = 'clip-item';
            const date = new Date(clip.timestamp).toLocaleDateString();
            item.innerHTML = `
                <div class="clip-header">
                    <span class="clip-source">${escapeHtml((clip.title || '').substring(0, 40))}</span>
                    <span class="clip-date">${date}</span>
                </div>
                <div class="clip-content">${escapeHtml((clip.content || '').substring(0, 200))}${clip.content && clip.content.length > 200 ? '...' : ''}</div>
                <button class="clip-delete" data-id="${clip.id}">×</button>
            `;
            item.querySelector('.clip-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                const updated = clips.filter(c => c.id !== clip.id);
                await storageSet({ webClips: updated });
                item.remove();
                showToast('Clip removed', 'success');
            });
            clipsList.appendChild(item);
        });
    }



    // =========== v5.4 ARCHIVE VIEWER ===========
    async function openArchiveViewer(url) {
        if (!archiveViewer || !archiveContent) return;
        archiveViewer.classList.remove('hidden');
        archiveContent.textContent = 'Loading archive...';
        const result = await storageGet('offlineArchives');
        const archives = result.offlineArchives || [];
        const archive = archives.find(a => a.url === url);
        if (archive) {
            archiveContent.textContent = archive.content || 'No content saved.';
        } else {
            archiveContent.textContent = 'No offline archive found for this URL.';
        }
    }
});
