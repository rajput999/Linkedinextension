// background.js - Simple LinkedIn Profile Assistant with Immediate Extraction

class ProfileManager {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
    }

    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Removed rate limiting - always allow requests
    shouldAllowRequest() {
        this.requestCount++;
        this.lastRequestTime = Date.now();
        return true; // Always allow immediate extraction
    }

    getRandomUserAgent() {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
}

const profileManager = new ProfileManager();

chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedIn Professional Assistant installed');
});

// Handle keyboard shortcut - immediate extraction
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'extract-profile') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url || !tab.url.includes('linkedin.com/in/')) {
            // Show notification that user needs to be on LinkedIn profile
            chrome.tabs.sendMessage(tab.id, {
                action: 'showWarning',
                message: 'Please navigate to a LinkedIn profile page'
            }).catch(() => {
                // If content script not injected, inject it first
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'showWarning',
                            message: 'Please navigate to a LinkedIn profile page'
                        });
                    }, 1000);
                });
            });
            return;
        }

        // Get stored credentials
        const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
        const username = result.linkedin_scraper_username;
        const token = result.linkedin_scraper_token;

        if (!username || !token) {
            chrome.tabs.sendMessage(tab.id, {
                action: 'showWarning',
                message: 'Please login first using the extension popup'
            }).catch(() => {
                // If content script not injected, inject it first
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'showWarning',
                            message: 'Please login first using the extension popup'
                        });
                    }, 1000);
                });
            });
            return;
        }

        // Start immediate extraction without rate limiting
        chrome.tabs.sendMessage(tab.id, {
            action: 'scrapeProfile',
            sessionId: profileManager.sessionId,
            userAgent: profileManager.getRandomUserAgent(),
            username: username,
            token: token,
            tags: [], // Empty tags for keyboard shortcut extraction
            immediate: true // Flag for immediate processing
        }).catch(() => {
            // If content script not injected, inject it first
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }, () => {
                setTimeout(() => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'scrapeProfile',
                        sessionId: profileManager.sessionId,
                        userAgent: profileManager.getRandomUserAgent(),
                        username: username,
                        token: token,
                        tags: [],
                        immediate: true
                    });
                }, 1000);
            });
        });
    }
});

// Handle extension icon click - immediate extraction
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.url.includes('linkedin.com/in/')) {
        return;
    }

    // Get stored credentials for icon click
    const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
    const username = result.linkedin_scraper_username;
    const token = result.linkedin_scraper_token;

    if (!username || !token) {
        chrome.tabs.sendMessage(tab.id, {
            action: 'showWarning',
            message: 'Please login first using the extension popup'
        });
        return;
    }

    // Start immediate extraction
    chrome.tabs.sendMessage(tab.id, {
        action: 'scrapeProfile',
        sessionId: profileManager.sessionId,
        userAgent: profileManager.getRandomUserAgent(),
        username: username,
        token: token,
        tags: [],
        immediate: true
    });
});

// Handle redirect to login message from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'redirectToLogin') {
        // Clear stored auth data when session expires
        chrome.storage.local.remove(['linkedin_scraper_username', 'linkedin_scraper_token']);
        // The popup.js will handle the UI redirect when it receives this message
        sendResponse({ success: true });
    }
});

// Clear session data periodically (reduced interval for better performance)
setInterval(() => {
    if (Date.now() - profileManager.lastRequestTime > 1800000) { // 30 minutes
        profileManager.requestCount = 0;
        profileManager.sessionId = profileManager.generateSessionId();
    }
}, 300000); // Check every 5 minutes
