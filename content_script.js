// content_script.js — v5.4 Web Clipper + Page Text Extraction + Reader Mode
// Injected into web pages for capturing selections, extracting content, and archiving

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__captureWebsiteInjected) return;
    window.__captureWebsiteInjected = true;

    // =========== WEB CLIPPER: Selection Capture ===========

    let clipperToolbar = null;
    let isClipperActive = false;

    /**
     * Create the floating clipper toolbar
     */
    function createClipperToolbar() {
        if (clipperToolbar) return;

        clipperToolbar = document.createElement('div');
        clipperToolbar.id = 'capture-clipper-toolbar';
        clipperToolbar.innerHTML = `
            <button id="capture-clip-text" title="Clip selected text">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                <span>Clip Text</span>
            </button>
            <button id="capture-clip-image" title="Clip selected image">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>Clip Image</span>
            </button>
            <button id="capture-clip-close" title="Close clipper">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        document.body.appendChild(clipperToolbar);

        // Event listeners
        document.getElementById('capture-clip-text').addEventListener('click', clipSelectedText);
        document.getElementById('capture-clip-image').addEventListener('click', clipSelectedImage);
        document.getElementById('capture-clip-close').addEventListener('click', hideClipperToolbar);
    }

    /**
     * Show clipper toolbar near selection
     */
    function showClipperToolbar() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        createClipperToolbar();
        clipperToolbar.style.display = 'flex';
        clipperToolbar.style.top = `${window.scrollY + rect.top - 50}px`;
        clipperToolbar.style.left = `${window.scrollX + rect.left + rect.width / 2 - 100}px`;
        isClipperActive = true;
    }

    function hideClipperToolbar() {
        if (clipperToolbar) {
            clipperToolbar.style.display = 'none';
        }
        isClipperActive = false;
        // Set cooldown so it doesn't re-show immediately from the same mouseup
        clipperCooldown = true;
        setTimeout(() => { clipperCooldown = false; }, 400);
    }

    // Cooldown flag to prevent toolbar re-appearing after close
    let clipperCooldown = false;
    // Whether clipper is enabled in settings (default: disabled)
    let clipperEnabledSetting = false;

    // Load clipper setting from storage
    chrome.storage.local.get(['clipperEnabled'], (result) => {
        clipperEnabledSetting = result.clipperEnabled === true;
    });

    // Listen for setting changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.clipperEnabled) {
            clipperEnabledSetting = changes.clipperEnabled.newValue === true;
            if (!clipperEnabledSetting) hideClipperToolbar();
        }
    });

    // Listen for text selection events (show toolbar on mouse up after selection)
    document.addEventListener('mouseup', (e) => {
        // Don't show if disabled in settings or on cooldown
        if (!clipperEnabledSetting || clipperCooldown) return;
        // Don't process clicks inside the toolbar itself
        if (e.target.closest && e.target.closest('#capture-clipper-toolbar')) return;

        setTimeout(() => {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim().length > 5) {
                showClipperToolbar();
            } else if (isClipperActive) {
                hideClipperToolbar();
            }
        }, 150);
    });

    /**
     * Clip selected text
     */
    function clipSelectedText() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        const clip = {
            type: 'text',
            content: text,
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            id: 'clip_' + Date.now()
        };

        saveClip(clip);
        showClipNotification('Text clipped! ✂️');
        hideClipperToolbar();
    }

    /**
     * Clip image (right-click context or nearest image to selection)
     */
    function clipSelectedImage() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            showClipNotification('Select an image first', 'error');
            return;
        }

        // Find images within or near selection
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === 3 ? container.parentElement : container;

        const img = element.querySelector('img') || element.closest('img');
        if (img && img.src) {
            const clip = {
                type: 'image',
                content: img.src,
                alt: img.alt || '',
                url: window.location.href,
                title: document.title,
                timestamp: Date.now(),
                id: 'clip_' + Date.now()
            };
            saveClip(clip);
            showClipNotification('Image clipped! 🖼️');
        } else {
            // Fallback: clip text anyway
            clipSelectedText();
        }

        hideClipperToolbar();
    }

    /**
     * Save clip to storage
     */
    function saveClip(clip) {
        chrome.storage.local.get(['webClips'], (result) => {
            const clips = result.webClips || [];
            clips.unshift(clip);
            // Keep max 200 clips
            if (clips.length > 200) clips.length = 200;
            chrome.storage.local.set({ webClips: clips });
        });
    }

    /**
     * Show a notification toast on the page
     */
    function showClipNotification(message, type = 'success') {
        const existing = document.getElementById('capture-clip-notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.id = 'capture-clip-notification';
        notification.className = type === 'error' ? 'capture-notif-error' : 'capture-notif-success';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    /**
     * Extract the main readable content of the page
     * Strips navigation, menus, scripts, styles, footers, ads, etc.
     */
    function extractReadableContent() {
        // Clone the document to avoid modifying the original
        const clone = document.cloneNode(true);

        // Remove unwanted elements
        const removeSelectors = [
            'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
            'nav', 'header', 'footer', 'aside',
            '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
            '.navbar', '.nav-bar', '.navigation', '.menu', '.sidebar',
            '.footer', '.header', '.advertisement', '.ad', '.ads',
            '.cookie-notice', '.cookie-banner', '.cookie-consent',
            '.popup', '.modal', '.overlay',
            '.social-share', '.share-buttons', '.comments',
            '#comments', '#sidebar', '#footer', '#header',
            '[class*="cookie"]', '[class*="popup"]', '[class*="banner"]',
            '[class*="advertisement"]', '[id*="cookie"]', '[id*="popup"]'
        ];

        removeSelectors.forEach(sel => {
            try {
                clone.querySelectorAll(sel).forEach(el => el.remove());
            } catch (e) { /* skip invalid selectors */ }
        });

        // Try to find the main content area
        const contentSelectors = [
            'article', 'main', '[role="main"]',
            '.article', '.post', '.content', '.entry',
            '#content', '#main', '#article', '#post',
            '.post-content', '.article-content', '.entry-content',
            '.story-body', '.article-body'
        ];

        let mainContent = null;
        for (const sel of contentSelectors) {
            mainContent = clone.querySelector(sel);
            if (mainContent && mainContent.textContent.trim().length > 200) break;
            mainContent = null;
        }

        // Fallback to body
        if (!mainContent) {
            mainContent = clone.body || clone;
        }

        // Extract text with some structure
        const textContent = extractStructuredText(mainContent);
        return textContent;
    }

    /**
     * Extract text while preserving some structure (headings, paragraphs, lists)
     */
    function extractStructuredText(element) {
        const lines = [];
        const title = document.title || '';

        if (title) {
            lines.push(`# ${title}\n`);
        }

        lines.push(`Source: ${window.location.href}`);
        lines.push(`Archived: ${new Date().toLocaleDateString()}\n`);
        lines.push('---\n');

        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null
        );

        let currentNode;
        const seenText = new Set();

        while (currentNode = walker.nextNode()) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
                const text = currentNode.textContent.trim();
                if (text.length > 2 && !seenText.has(text)) {
                    seenText.add(text);
                    const parent = currentNode.parentElement;
                    const tag = parent ? parent.tagName.toLowerCase() : '';

                    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
                        const level = parseInt(tag[1]);
                        lines.push(`\n${'#'.repeat(level)} ${text}\n`);
                    } else if (tag === 'li') {
                        lines.push(`  • ${text}`);
                    } else if (tag === 'p' || tag === 'div') {
                        if (text.length > 20) {
                            lines.push(`\n${text}\n`);
                        }
                    } else if (tag === 'a') {
                        const href = parent.getAttribute('href');
                        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                            // Don't add inline links as separate lines
                        }
                    } else if (text.length > 20) {
                        lines.push(text);
                    }
                }
            }
        }

        // Clean up excessive blank lines
        const result = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        return result;
    }

    // =========== MESSAGE HANDLER ===========

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'extractPageContent':
                try {
                    const content = extractReadableContent();
                    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
                    sendResponse({
                        success: true,
                        content: content,
                        title: document.title,
                        url: window.location.href,
                        description: metaDesc,
                        length: content.length
                    });
                } catch (err) {
                    sendResponse({ success: false, error: err.message });
                }
                break;

            case 'getPageMeta':
                try {
                    const meta = {
                        title: document.title,
                        description: document.querySelector('meta[name="description"]')?.content || '',
                        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                        url: window.location.href,
                        favicon: document.querySelector('link[rel="icon"]')?.href ||
                            document.querySelector('link[rel="shortcut icon"]')?.href || ''
                    };
                    sendResponse({ success: true, meta });
                } catch (err) {
                    sendResponse({ success: false, error: err.message });
                }
                break;

            case 'activateClipper':
                showClipNotification('Web Clipper activated! Select text or images to clip. ✂️');
                sendResponse({ success: true });
                break;

            case 'captureFullText':
                try {
                    const fullText = document.body.innerText || '';
                    sendResponse({ success: true, text: fullText.substring(0, 50000) });
                } catch (err) {
                    sendResponse({ success: false, error: err.message });
                }
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
        return true; // Keep message channel open for async response
    });

    // =========== INJECT CLIPPER STYLES ===========

    const style = document.createElement('style');
    style.textContent = `
        #capture-clipper-toolbar {
            position: absolute;
            z-index: 2147483647;
            display: none;
            gap: 4px;
            padding: 6px 8px;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            animation: capture-toolbar-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes capture-toolbar-in {
            from { opacity: 0; transform: translateY(8px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        #capture-clipper-toolbar button {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 5px 10px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            font-family: inherit;
            white-space: nowrap;
        }

        #capture-clipper-toolbar button:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.4);
            color: #93c5fd;
            transform: translateY(-1px);
        }

        #capture-clipper-toolbar button svg {
            flex-shrink: 0;
        }

        #capture-clip-close {
            padding: 5px !important;
        }

        #capture-clip-close:hover {
            background: rgba(239, 68, 68, 0.2) !important;
            border-color: rgba(239, 68, 68, 0.4) !important;
            color: #fca5a5 !important;
        }

        #capture-clip-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2147483647;
            padding: 10px 18px;
            border-radius: 10px;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
            transition: all 0.3s ease;
            animation: capture-notif-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .capture-notif-success {
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #86efac;
        }

        .capture-notif-error {
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96));
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }

        @keyframes capture-notif-in {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);

})();
