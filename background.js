// background.js - Simple LinkedIn Profile Assistant

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

  shouldAllowRequest() {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      // Basic rate limiting - 1 minute minimum delay
      if (timeSinceLastRequest < 60000) {
          return false;
      }

      this.requestCount++;
      this.lastRequestTime = now;
      
      // Limit requests per session
      if (this.requestCount > 20) {
          return false;
      }

      return true;
  }

  getRandomUserAgent() {
      return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
}

const profileManager = new ProfileManager();

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Professional Assistant installed');
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url.includes('linkedin.com/in/')) {
      return;
  }

  const canProceed = profileManager.shouldAllowRequest();
  if (!canProceed) {
      chrome.tabs.sendMessage(tab.id, {
          action: 'showWarning',
          message: 'Please wait before extracting another profile'
      });
      return;
  }

  chrome.tabs.sendMessage(tab.id, {
      action: 'scrapeProfile',
      sessionId: profileManager.sessionId,
      userAgent: profileManager.getRandomUserAgent()
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

// Clear session data periodically
setInterval(() => {
  if (Date.now() - profileManager.lastRequestTime > 1800000) { // 30 minutes
      profileManager.requestCount = 0;
      profileManager.sessionId = profileManager.generateSessionId();
  }
}, 300000); // Check every 5 minutes
