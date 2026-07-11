// Background Service Worker — v5.4 ADVANCED UPGRADE
// Features: Global hotkeys, thumbnail capture, broken link checker, context menu, alarms

// =========== INSTALLATION & CONTEXT MENU ===========

chrome.runtime.onInstalled.addListener((details) => {
    // Context menu items
    chrome.contextMenus.create({
        id: "capture-website",
        title: "⚡ Quick Capture this Website",
        contexts: ["page"]
    });

    chrome.contextMenus.create({
        id: "capture-with-archive",
        title: "📑 Capture + Archive (Offline Copy)",
        contexts: ["page"]
    });

    chrome.contextMenus.create({
        id: "clip-selection",
        title: "✂️ Clip Selected Text",
        contexts: ["selection"]
    });

    // Set up broken link checker alarm (every 6 hours)
    chrome.alarms.create('broken-link-check', {
        delayInMinutes: 1, // First check after 1 minute
        periodInMinutes: 360 // Then every 6 hours
    });

    // Show welcome/whatsnew on update
    if (details.reason === 'update') {
        chrome.storage.local.set({ lastSeenVersion: '' }); // Reset to show changelog
    }
});

// =========== CONTEXT MENU HANDLER ===========

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

    switch (info.menuItemId) {
        case "capture-website":
            await quickCaptureSite(tab);
            break;

        case "capture-with-archive":
            await captureWithArchive(tab);
            break;

        case "clip-selection":
            if (info.selectionText) {
                await clipSelection(info.selectionText, tab);
            }
            break;
    }
});

// =========== GLOBAL HOTKEY HANDLER ===========

chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

    switch (command) {
        case 'quick-save':
            await quickCaptureSite(tab);
            // Show visual feedback via content script
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'activateClipper'
                });
            } catch (e) { /* Content script not loaded */ }
            break;

        case 'activate-clipper':
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'activateClipper'
                });
            } catch (e) {
                // Inject content script if not loaded
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content_script.js']
                });
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, { action: 'activateClipper' });
                    } catch (e2) { /* ignore */ }
                }, 300);
            }
            break;
    }
});

// =========== QUICK CAPTURE ===========

async function quickCaptureSite(tab) {
    let thumbnail = null;

    // Capture thumbnail
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'jpeg',
            quality: 40
        });
        // Resize thumbnail to save storage (done via offscreen canvas or just store smaller quality)
        thumbnail = dataUrl;
    } catch (e) {
        console.warn('[Capture v5.4] Thumbnail capture failed:', e.message);
    }

    // Get page meta from content script
    let pageMeta = { title: tab.title, description: '', keywords: '' };
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMeta' });
        if (response && response.success) {
            pageMeta = response.meta;
        }
    } catch (e) { /* Content script not available */ }

    // Auto-categorize (simple keyword matching in background)
    const category = autoCategorizeFast(pageMeta.title, pageMeta.description, tab.url);

    // Auto-suggest tags
    const tags = autoTagFast(pageMeta.title, pageMeta.description, tab.url);

    const site = {
        url: tab.url,
        name: pageMeta.title || tab.title,
        category: category,
        tags: tags,
        date: Date.now(),
        sectionId: '',
        thumbnail: thumbnail,
        description: pageMeta.description || ''
    };

    // Save to storage
    const result = await chrome.storage.local.get(['capturedSites']);
    const sites = result.capturedSites || [];

    // Check for duplicate
    const existingIdx = sites.findIndex(s => s.url === tab.url);
    if (existingIdx > -1) {
        sites[existingIdx] = { ...sites[existingIdx], ...site, date: sites[existingIdx].date };
    } else {
        sites.unshift(site);
    }

    await chrome.storage.local.set({ capturedSites: sites });
    console.log(`[Capture v5.4] Quick-captured: ${site.name}`);
}

// =========== CAPTURE WITH OFFLINE ARCHIVE ===========

async function captureWithArchive(tab) {
    // First do the regular capture
    await quickCaptureSite(tab);

    // Then extract and archive page content
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageContent' });
        if (response && response.success) {
            const archive = {
                url: tab.url,
                title: response.title,
                content: response.content,
                archivedAt: Date.now(),
                length: response.content.length
            };

            const archiveResult = await chrome.storage.local.get(['offlineArchives']);
            const archives = archiveResult.offlineArchives || [];

            // Replace existing archive for same URL
            const existingIdx = archives.findIndex(a => a.url === tab.url);
            if (existingIdx > -1) {
                archives[existingIdx] = archive;
            } else {
                archives.unshift(archive);
            }

            // Keep max 100 archives
            if (archives.length > 100) archives.length = 100;

            await chrome.storage.local.set({ offlineArchives: archives });
            console.log(`[Capture v5.4] Archived: ${archive.title} (${archive.length} chars)`);
        }
    } catch (e) {
        console.warn('[Capture v5.4] Archive extraction failed:', e.message);
    }
}

// =========== CLIP SELECTION (Context Menu) ===========

async function clipSelection(text, tab) {
    const clip = {
        type: 'text',
        content: text,
        url: tab.url,
        title: tab.title,
        timestamp: Date.now(),
        id: 'clip_' + Date.now()
    };

    const result = await chrome.storage.local.get(['webClips']);
    const clips = result.webClips || [];
    clips.unshift(clip);
    if (clips.length > 200) clips.length = 200;
    await chrome.storage.local.set({ webClips: clips });
    console.log('[Capture v5.4] Text clipped via context menu');
}

// =========== BROKEN LINK CHECKER ===========

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'broken-link-check') {
        await checkBrokenLinks();
    }
});

async function checkBrokenLinks() {
    const result = await chrome.storage.local.get(['capturedSites']);
    const sites = result.capturedSites || [];

    if (sites.length === 0) return;

    const brokenLinks = [];
    const checkedAt = Date.now();

    // Check in batches of 10 to avoid overwhelming
    const batchSize = 10;
    for (let i = 0; i < Math.min(sites.length, 50); i += batchSize) {
        const batch = sites.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(site => checkSingleLink(site.url))
        );

        results.forEach((res, idx) => {
            if (res.status === 'fulfilled' && !res.value.alive) {
                brokenLinks.push({
                    url: batch[idx].url,
                    name: batch[idx].name,
                    status: res.value.status,
                    checkedAt
                });
            }
        });
    }

    // Store broken links
    await chrome.storage.local.set({
        brokenLinks: brokenLinks,
        lastLinkCheck: checkedAt
    });

    // Set badge if broken links found
    if (brokenLinks.length > 0) {
        chrome.action.setBadgeText({ text: String(brokenLinks.length) });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }

    console.log(`[Capture v5.4] Link check: ${brokenLinks.length} broken out of ${sites.length}`);
}

async function checkSingleLink(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);

        return {
            alive: response.ok || response.status === 301 || response.status === 302,
            status: response.status
        };
    } catch (e) {
        return { alive: false, status: 0 };
    }
}

// =========== FAST AUTO-CATEGORIZATION (Background) ===========

function autoCategorizeFast(title, description, url) {
    const text = `${title} ${description}`.toLowerCase();
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch (e) { }

    const categories = {
        'Development': { kw: ['github', 'code', 'developer', 'programming', 'npm', 'api', 'javascript', 'python', 'react', 'stackoverflow'], dom: ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'dev.to'] },
        'Design': { kw: ['design', 'figma', 'ui', 'ux', 'graphic', 'prototype', 'creative', 'illustration'], dom: ['figma.com', 'dribbble.com', 'behance.net', 'canva.com'] },
        'AI Tools': { kw: ['ai', 'artificial intelligence', 'machine learning', 'gpt', 'chatbot', 'openai', 'gemini', 'claude'], dom: ['openai.com', 'anthropic.com', 'huggingface.co', 'chat.openai.com', 'gemini.google.com'] },
        'News': { kw: ['news', 'breaking', 'headline', 'article'], dom: ['bbc.com', 'cnn.com', 'reuters.com', 'nytimes.com'] },
        'Education': { kw: ['learn', 'tutorial', 'course', 'education', 'study'], dom: ['coursera.org', 'udemy.com', 'khanacademy.org'] },
        'Shopping': { kw: ['shop', 'buy', 'price', 'discount', 'product'], dom: ['amazon.com', 'ebay.com', 'aliexpress.com'] },
        'Entertainment': { kw: ['game', 'movie', 'stream', 'play', 'video', 'music'], dom: ['youtube.com', 'twitch.tv', 'netflix.com', 'spotify.com'] },
        'Social': { kw: ['social', 'profile', 'follow', 'community', 'post'], dom: ['twitter.com', 'x.com', 'facebook.com', 'reddit.com', 'linkedin.com'] },
    };

    let bestCategory = 'Uncategorized';
    let bestScore = 0;

    for (const [cat, data] of Object.entries(categories)) {
        let score = 0;
        for (const kw of data.kw) {
            if (text.includes(kw)) score += 2;
        }
        for (const dom of data.dom) {
            if (hostname.includes(dom.replace('www.', ''))) score += 10;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = cat;
        }
    }

    return bestScore >= 2 ? bestCategory : 'Uncategorized';
}

function autoTagFast(title, description, url) {
    const text = `${title} ${description}`.toLowerCase();
    const tags = [];

    if (text.match(/\bfree\b|\bopen.?source\b/)) tags.push('Free');
    if (text.match(/\bpremium\b|\bpro\b|\bpaid\b/)) tags.push('Premium');
    if (text.match(/\btool\b|\butility\b|\bapp\b/)) tags.push('Tool');
    if (text.match(/\btutorial\b|\bguide\b|\bhow.?to\b/)) tags.push('Tutorial');
    if (text.match(/\btemplate\b|\bstarter\b|\bboilerplate\b/)) tags.push('Template');
    if (text.match(/\bai\b|\bmachine learning\b|\bgpt\b/)) tags.push('AI');
    if (text.match(/\bdesign\b|\bui\b|\bux\b/)) tags.push('Design');
    if (text.match(/\bapi\b|\bsdk\b|\blibrary\b/)) tags.push('API');

    return tags.slice(0, 5);
}

// =========== MESSAGE HANDLER (from popup) ===========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'checkBrokenLinks':
            checkBrokenLinks().then(() => sendResponse({ success: true }));
            return true;

        case 'captureThumbnail':
            chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 40 })
                .then(dataUrl => sendResponse({ success: true, thumbnail: dataUrl }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;

        case 'archivePage':
            (async () => {
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        await captureWithArchive(tab);
                        sendResponse({ success: true });
                    }
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
            })();
            return true;
    }
});
