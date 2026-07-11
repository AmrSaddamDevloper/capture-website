// categorizer.js — v5.4 Local NLP Auto-Categorization Engine
// Runs entirely client-side. No external API calls.

const AutoCategorizer = (() => {

    // Category keyword database with weighted terms
    const CATEGORY_KEYWORDS = {
        'Development': {
            keywords: ['programming', 'developer', 'code', 'coding', 'github', 'gitlab', 'stackoverflow', 'npm', 'api', 'sdk',
                'javascript', 'python', 'typescript', 'react', 'angular', 'vue', 'node', 'rust', 'golang', 'java',
                'css', 'html', 'webpack', 'docker', 'kubernetes', 'devops', 'ci/cd', 'git', 'repository', 'commit',
                'framework', 'library', 'database', 'sql', 'mongodb', 'redis', 'backend', 'frontend', 'fullstack',
                'debug', 'compiler', 'runtime', 'algorithm', 'data structure', 'software', 'engineer'],
            domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'dev.to', 'codepen.io',
                'replit.com', 'jsfiddle.net', 'leetcode.com', 'hackerrank.com', 'codeforces.com']
        },
        'Design': {
            keywords: ['design', 'ui', 'ux', 'figma', 'sketch', 'photoshop', 'illustrator', 'graphic', 'layout',
                'typography', 'color palette', 'wireframe', 'prototype', 'mockup', 'branding', 'logo', 'icon',
                'illustration', 'vector', 'pixel', 'creative', 'visual', 'aesthetic', 'interface', 'user experience',
                'responsive', 'animation', 'motion', 'gradient', 'font'],
            domains: ['figma.com', 'dribbble.com', 'behance.net', 'canva.com', 'adobe.com', 'sketch.com',
                'invisionapp.com', 'coolors.co', 'fonts.google.com', 'unsplash.com', 'pexels.com']
        },
        'AI Tools': {
            keywords: ['artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'nlp',
                'natural language', 'chatbot', 'gpt', 'llm', 'transformer', 'ai model', 'training', 'inference',
                'prompt', 'generative', 'diffusion', 'stable diffusion', 'midjourney', 'openai', 'anthropic',
                'gemini', 'claude', 'copilot', 'automation', 'ai tool', 'ai assistant', 'computer vision'],
            domains: ['openai.com', 'anthropic.com', 'huggingface.co', 'kaggle.com', 'tensorflow.org',
                'pytorch.org', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'midjourney.com',
                'replicate.com', 'perplexity.ai']
        },
        'News': {
            keywords: ['news', 'breaking', 'headline', 'article', 'press', 'media', 'journalism', 'reporter',
                'editorial', 'opinion', 'politics', 'world', 'economy', 'latest', 'update', 'coverage',
                'investigation', 'report', 'current events', 'bulletin'],
            domains: ['bbc.com', 'cnn.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com',
                'aljazeera.com', 'apnews.com', 'news.google.com', 'foxnews.com', 'bloomberg.com']
        },
        'Education': {
            keywords: ['learn', 'tutorial', 'course', 'education', 'study', 'lesson', 'lecture', 'university',
                'college', 'school', 'academic', 'research', 'textbook', 'student', 'teacher', 'professor',
                'curriculum', 'certification', 'degree', 'scholarship', 'mooc', 'e-learning', 'training',
                'quiz', 'exam', 'homework', 'knowledge'],
            domains: ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'udacity.com',
                'w3schools.com', 'freecodecamp.org', 'codecademy.com', 'skillshare.com', 'pluralsight.com',
                'brilliant.org', 'duolingo.com']
        },
        'Shopping': {
            keywords: ['shop', 'buy', 'price', 'discount', 'sale', 'deal', 'coupon', 'product', 'order',
                'cart', 'checkout', 'delivery', 'shipping', 'store', 'marketplace', 'retail', 'ecommerce',
                'amazon', 'offer', 'wishlist', 'compare', 'review'],
            domains: ['amazon.com', 'ebay.com', 'aliexpress.com', 'walmart.com', 'etsy.com', 'shopify.com',
                'bestbuy.com', 'target.com', 'newegg.com', 'wayfair.com']
        },
        'Entertainment': {
            keywords: ['game', 'gaming', 'play', 'stream', 'movie', 'film', 'tv', 'show', 'series', 'anime',
                'manga', 'comic', 'entertainment', 'fun', 'video', 'trailer', 'review', 'rating',
                'twitch', 'esports', 'meme', 'humor', 'podcast'],
            domains: ['youtube.com', 'twitch.tv', 'netflix.com', 'imdb.com', 'rottentomatoes.com',
                'steam.com', 'steampowered.com', 'epicgames.com', 'itch.io', 'crunchyroll.com',
                'spotify.com', 'soundcloud.com']
        },
        'Social': {
            keywords: ['social', 'community', 'profile', 'follow', 'share', 'post', 'feed', 'friend',
                'message', 'chat', 'network', 'connect', 'forum', 'discussion', 'group', 'thread',
                'comment', 'like', 'subscribe'],
            domains: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'reddit.com',
                'discord.com', 'tiktok.com', 'pinterest.com', 'mastodon.social', 'threads.net']
        },
        'Finance': {
            keywords: ['finance', 'money', 'bank', 'invest', 'stock', 'crypto', 'bitcoin', 'trading',
                'market', 'portfolio', 'dividend', 'budget', 'tax', 'loan', 'mortgage', 'insurance',
                'wallet', 'payment', 'forex', 'etf', 'savings', 'interest rate'],
            domains: ['finance.yahoo.com', 'coinbase.com', 'binance.com', 'robinhood.com', 'paypal.com',
                'stripe.com', 'wise.com', 'revolut.com', 'tradingview.com', 'morningstar.com']
        },
        'Health': {
            keywords: ['health', 'medical', 'doctor', 'medicine', 'fitness', 'exercise', 'workout',
                'nutrition', 'diet', 'wellness', 'mental health', 'therapy', 'symptom', 'disease',
                'hospital', 'pharmacy', 'vaccine', 'supplement', 'yoga', 'meditation'],
            domains: ['webmd.com', 'mayoclinic.org', 'healthline.com', 'nih.gov', 'who.int',
                'myfitnesspal.com', 'fitbit.com', 'headspace.com', 'calm.com']
        },
        'Science': {
            keywords: ['science', 'research', 'experiment', 'hypothesis', 'physics', 'chemistry', 'biology',
                'astronomy', 'space', 'nasa', 'quantum', 'particle', 'genome', 'molecule', 'lab',
                'scientific', 'journal', 'paper', 'publication', 'peer review', 'discovery'],
            domains: ['nature.com', 'sciencedirect.com', 'arxiv.org', 'nasa.gov', 'scientificamerican.com',
                'scholar.google.com', 'researchgate.net', 'pubmed.ncbi.nlm.nih.gov']
        },
        'Travel': {
            keywords: ['travel', 'flight', 'hotel', 'booking', 'trip', 'vacation', 'tourism', 'destination',
                'airport', 'airline', 'passport', 'visa', 'cruise', 'resort', 'adventure', 'backpack',
                'itinerary', 'explore', 'guide', 'attraction'],
            domains: ['booking.com', 'airbnb.com', 'tripadvisor.com', 'expedia.com', 'skyscanner.com',
                'kayak.com', 'google.com/travel', 'hotels.com', 'lonelyplanet.com']
        }
    };

    /**
     * Clean and normalize text for analysis
     */
    function cleanText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract key phrases from text
     */
    function extractKeyPhrases(text) {
        const cleaned = cleanText(text);
        const words = cleaned.split(' ').filter(w => w.length > 2);

        // Single words
        const singles = words;

        // Bigrams (2-word phrases)
        const bigrams = [];
        for (let i = 0; i < words.length - 1; i++) {
            bigrams.push(words[i] + ' ' + words[i + 1]);
        }

        return { singles, bigrams };
    }

    /**
     * Score a text against a category
     */
    function scoreCategory(phrases, categoryData) {
        let score = 0;
        const { singles, bigrams } = phrases;

        // Check single keywords
        for (const keyword of categoryData.keywords) {
            if (keyword.includes(' ')) {
                // Multi-word keyword → check in bigrams
                if (bigrams.some(b => b.includes(keyword))) {
                    score += 3; // Higher weight for phrase match
                }
            } else {
                // Single word
                const count = singles.filter(w => w === keyword || w.includes(keyword)).length;
                score += count * 1.5;
            }
        }

        return score;
    }

    /**
     * Check if a URL matches known domains for a category
     */
    function matchDomain(url, categoryData) {
        try {
            const hostname = new URL(url).hostname.replace('www.', '');
            return categoryData.domains.some(d => hostname.includes(d.replace('www.', '')));
        } catch {
            return false;
        }
    }

    /**
     * Categorize a page based on title, description, and URL
     * @param {string} title - Page title
     * @param {string} description - Meta description
     * @param {string} url - Page URL
     * @returns {{ category: string, confidence: number, alternatives: string[] }}
     */
    function categorize(title, description, url) {
        const combinedText = `${title} ${description}`;
        const phrases = extractKeyPhrases(combinedText);

        const scores = {};

        for (const [category, data] of Object.entries(CATEGORY_KEYWORDS)) {
            let score = scoreCategory(phrases, data);

            // Domain match gives a big boost
            if (matchDomain(url, data)) {
                score += 10;
            }

            scores[category] = score;
        }

        // Sort by score descending
        const sorted = Object.entries(scores)
            .filter(([_, s]) => s > 0)
            .sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            return { category: 'Uncategorized', confidence: 0, alternatives: [] };
        }

        const topScore = sorted[0][1];
        const confidence = Math.min(topScore / 15, 1); // Normalize to 0-1

        return {
            category: sorted[0][0],
            confidence: Math.round(confidence * 100),
            alternatives: sorted.slice(1, 4).map(([cat]) => cat)
        };
    }

    /**
     * Suggest tags for a page based on content analysis
     * @param {string} title
     * @param {string} description
     * @param {string} url
     * @returns {string[]} suggested tags
     */
    function suggestTags(title, description, url) {
        const tags = new Set();
        const combinedText = cleanText(`${title} ${description}`);

        for (const [category, data] of Object.entries(CATEGORY_KEYWORDS)) {
            let matchCount = 0;
            for (const keyword of data.keywords) {
                if (combinedText.includes(keyword)) {
                    matchCount++;
                }
            }
            if (matchCount >= 2 || matchDomain(url, data)) {
                tags.add(category);
            }
        }

        // Add "Free" tag if detected
        if (combinedText.match(/\bfree\b|\bopen.?source\b|\bno.?cost\b/)) {
            tags.add('Free');
        }

        // Add "Paid" / "Premium" tag
        if (combinedText.match(/\bpremium\b|\bpro\b|\bpaid\b|\bsubscription\b/)) {
            tags.add('Premium');
        }

        return [...tags].slice(0, 5);
    }

    return { categorize, suggestTags, extractKeyPhrases };
})();

// Export for use in popup.js and background.js
if (typeof window !== 'undefined') {
    window.AutoCategorizer = AutoCategorizer;
}
