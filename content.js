// content.js - Enhanced LinkedIn Profile Extractor with Immediate Processing

// const API_BASE = 'http://localhost:8080/api';
const API_BASE = 'https://linkedinscrap-e4dpdhcuc7fgd7fk.eastasia-01.azurewebsites.net/api';

class LinkedInExtractor {
    constructor(sessionId, userAgent) {
        this.sessionId = sessionId;
        this.userAgent = userAgent;
        this.profileData = {
            name: '',
            bio: '',
            email: '',
            phone: '',
            location: '',
            connections: '',
            followers: '',
            profileUrl: this.cleanUrl(window.location.href),
            extractedAt: new Date().toISOString(),
            sessionId: sessionId,
            tags: []
        };
        this.isExtracting = false;
        this.authToken = null;
        this.username = null;
    }

    cleanUrl(url) {
        return url.split('?')[0].split('#')[0];
    }

    // Set authentication data
    setAuthData(token, username) {
        this.authToken = token;
        this.username = username;
        console.log('Authentication data set for user:', username);
    }

    // Get stored auth data from chrome.storage.local
    async getStoredAuthData() {
        try {
            const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
            const username = result.linkedin_scraper_username;
            const token = result.linkedin_scraper_token;
            
            if (username && token) {
                this.username = username;
                this.authToken = token;
                return { username, token };
            }
            return null;
        } catch (error) {
            console.error('Error getting stored auth data:', error);
            return null;
        }
    }

    // Enhanced name extraction with updated selectors
    extractName() {
        const nameSelectors = [
            'h1.eFGpnXgOFylCyykhgWZRmjcbJNaxvTgoP',
            'h1.text-heading-xlarge.inline.t-24.v-align-middle.break-words',
            'h1[class*="text-heading-xlarge"]',
            '.pv-text-details__left-panel h1',
            'h1[data-anonymize="person-name"]',
            '.ph5.pb5 h1',
            'h1.inline.t-24.v-align-middle.break-words',
            '.pv-top-card .pv-text-details__left-panel h1'
        ];

        for (const selector of nameSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    const name = element.textContent.trim();
                    if (name.length > 2 && name.length < 100 && /^[a-zA-Z\s\-\.']+$/u.test(name)) {
                        return name;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return '';
    }

    // Enhanced bio extraction
    extractBio() {
        const bioSelectors = [
            '.text-body-medium.break-words[data-generated-suggestion-target]',
            'div[data-generated-suggestion-target].text-body-medium.break-words',
            '.pv-text-details__left-panel .text-body-medium.break-words',
            '.text-body-medium.break-words',
            '.pv-top-card .pv-text-details__left-panel .text-body-medium',
            '.ph5.pb5 .text-body-medium.break-words'
        ];

        for (const selector of bioSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element?.textContent?.trim()) {
                    const bio = element.textContent.trim();
                    if (bio.length > 5 && bio.length < 500 && !bio.toLowerCase().includes('connection') && !bio.toLowerCase().includes('follower')) {
                        return bio;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return '';
    }

    // Enhanced location extraction
    extractLocation() {
        const locationSelectors = [
            '.text-body-small.inline.t-black--light.break-words',
            '.pnTkzgXAlMotFipcGVkRIXqfcaRSEQegog .text-body-small',
            '.ph5.pb5 .mt2 .text-body-small',
            '.pv-text-details__left-panel .text-body-small.inline',
            'span.text-body-small.inline.t-black--light.break-words'
        ];

        for (const selector of locationSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.textContent?.trim() || '';
                    if (text && 
                        text.length < 100 && 
                        text.length > 2 && 
                        !text.toLowerCase().includes('contact info') && 
                        !text.toLowerCase().includes('connection') && 
                        !text.toLowerCase().includes('follower') && 
                        !element.querySelector('a') &&
                        (text.includes(',') || /\b(India|USA|UK|Canada|Australia|Germany|France|Singapore|Dubai)\b/i.test(text))) {
                        return text;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return '';
    }

    // Enhanced connections and followers extraction
    extractConnections() {
        try {
            const data = { connections: '', followers: '' };
            const elements = document.querySelectorAll('.text-body-small');

            for (const element of elements) {
                const text = element.textContent?.trim() || '';
                
                if (text.includes('follower')) {
                    const boldElement = element.querySelector('.t-bold');
                    if (boldElement) {
                        data.followers = boldElement.textContent.trim();
                    } else {
                        const match = text.match(/(\d+[\+,]*)\s*follower/i);
                        if (match) data.followers = match[1];
                    }
                }

                if (text.includes('connection')) {
                    const boldElement = element.querySelector('.t-bold');
                    if (boldElement) {
                        data.connections = boldElement.textContent.trim();
                    } else {
                        const match = text.match(/(\d+[\+]*)\s*connection/i);
                        if (match) data.connections = match[1];
                    }
                }
            }

            if (!data.connections || !data.followers) {
                const listElements = document.querySelectorAll('ul.cdUgVZzyeTNofnjxoybGXmfMAttsledBaE li, ul li');
                for (const li of listElements) {
                    const text = li.textContent?.trim() || '';
                    
                    if (text.includes('follower') && !data.followers) {
                        const match = text.match(/(\d+[\+,]*)\s*follower/i);
                        if (match) data.followers = match[1];
                    }

                    if (text.includes('connection') && !data.connections) {
                        const match = text.match(/(\d+[\+]*)\s*connection/i);
                        if (match) data.connections = match[1];
                    }
                }
            }

            return {
                connections: data.connections,
                followers: data.followers
            };
        } catch (error) {
            console.warn('Connection/follower extraction failed:', error);
            return { connections: '', followers: '' };
        }
    }

    // Enhanced contact information extraction
    async extractContactInfo() {
        try {
            const contactSelectors = [
                'a#top-card-text-details-contact-info',
                'a[href*="contact-info"]',
                'a[data-control-name="contact_see_more"]',
                '.pv-s-profile-actions a[href*="contact-info"]',
                'button[aria-label*="contact"]',
                'a.link-without-visited-state[href*="contact-info"]'
            ];

            let contactButton = null;
            for (const selector of contactSelectors) {
                contactButton = document.querySelector(selector);
                if (contactButton) break;
            }

            if (!contactButton) {
                console.log('Contact button not found');
                return;
            }

            contactButton.click();
            const modal = await this.waitForElement('.artdeco-modal, .pv-profile-section, [role="dialog"]', 5000); // Reduced timeout
            
            if (!modal) {
                console.log('Modal not found');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 800)); // Reduced wait time

            // Extract email
            const emailSelectors = [
                'a[href^="mailto:"]',
                '.pv-contact-info__contact-type a[href^="mailto:"]',
                '[data-test-contact-type="email"] a',
                '.ci-email a'
            ];

            for (const selector of emailSelectors) {
                const emailElements = document.querySelectorAll(selector);
                if (emailElements.length > 0) {
                    this.profileData.email = emailElements[0].href.replace('mailto:', '').trim();
                    break;
                }
            }

            // Extract phone
            const phoneSelectors = [
                'a[href^="tel:"]',
                '.pv-contact-info__contact-type a[href^="tel:"]',
                '[data-test-contact-type="phone"] a',
                '.ci-phone a'
            ];

            for (const selector of phoneSelectors) {
                const phoneElements = document.querySelectorAll(selector);
                if (phoneElements.length > 0) {
                    this.profileData.phone = phoneElements[0].href.replace('tel:', '').trim();
                    break;
                }
            }

            // Text-based extraction if direct selectors don't work
            if (!this.profileData.email || !this.profileData.phone) {
                const contactSection = modal.querySelector('.pv-contact-info, .artdeco-modal__content') || modal;
                const textContent = contactSection.textContent || '';

                if (!this.profileData.email) {
                    const emailMatch = textContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    if (emailMatch) this.profileData.email = emailMatch[1];
                }

                if (!this.profileData.phone) {
                    const phoneMatch = textContent.match(/(\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9})/);
                    if (phoneMatch && phoneMatch[1].replace(/\D/g, '').length >= 7) {
                        this.profileData.phone = phoneMatch[1];
                    }
                }
            }

            // Close modal quickly
            const closeSelectors = [
                '.artdeco-modal__dismiss',
                '[data-test-modal-close-btn]',
                '.artdeco-modal__header button',
                '[aria-label*="Dismiss"]',
                '[aria-label*="Close"]'
            ];

            let closeButton = null;
            for (const selector of closeSelectors) {
                closeButton = document.querySelector(selector);
                if (closeButton) break;
            }

            if (closeButton) {
                closeButton.click();
            } else {
                // Fallback: try escape key or backdrop click
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                const backdrop = document.querySelector('.artdeco-modal__backdrop');
                if (backdrop) backdrop.click();
            }

            await new Promise(resolve => setTimeout(resolve, 300)); // Reduced wait time
        } catch (error) {
            console.warn('Contact extraction failed:', error);
        }
    }

    // Wait for element with enhanced logic
    waitForElement(selector, timeout = 5000) {
        return new Promise((resolve) => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const element = document.querySelector(selector);
                if (element) {
                    obs.disconnect();
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    // Enhanced notification system
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#0A66C2'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            max-width: 280px;
            transform: translateX(100%);
            transition: transform 0.2s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 200);
        }, duration);
    }

    // Enhanced data display with tags
    showExtractedData(data) {
        const dataDisplay = document.createElement('div');
        dataDisplay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #0A66C2;
            border-radius: 12px;
            padding: 20px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            max-width: 400px;
            max-height: 500px;
            overflow-y: auto;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Extracted Profile Data';
        title.style.cssText = 'margin: 0 0 15px 0; color: #0A66C2; border-bottom: 1px solid #eee; padding-bottom: 10px;';
        dataDisplay.appendChild(title);

        const fields = [
            { label: 'Name', value: data.name },
            { label: 'Bio', value: data.bio },
            { label: 'Email', value: data.email },
            { label: 'Phone', value: data.phone },
            { label: 'Location', value: data.location },
            { label: 'Connections', value: data.connections },
            { label: 'Followers', value: data.followers },
            { label: 'Profile URL', value: data.profileUrl }
        ];

        fields.forEach(field => {
            if (field.value) {
                const fieldDiv = document.createElement('div');
                fieldDiv.style.cssText = 'margin-bottom: 10px;';
                
                const label = document.createElement('strong');
                label.textContent = field.label + ': ';
                label.style.color = '#333';
                
                const value = document.createElement('span');
                value.textContent = field.value;
                value.style.color = '#666';
                
                fieldDiv.appendChild(label);
                fieldDiv.appendChild(value);
                dataDisplay.appendChild(fieldDiv);
            }
        });

        // Display tags if any
        if (data.tags && data.tags.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;';
            
            const tagsLabel = document.createElement('strong');
            tagsLabel.textContent = 'Tags: ';
            tagsLabel.style.color = '#333';
            tagsDiv.appendChild(tagsLabel);

            const tagsContainer = document.createElement('div');
            tagsContainer.style.cssText = 'margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;';
            
            data.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.textContent = tag.name;
                tagSpan.style.cssText = `
                    background: ${tag.color}20;
                    color: ${tag.color};
                    border: 1px solid ${tag.color};
                    padding: 3px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                `;
                tagsContainer.appendChild(tagSpan);
            });
            
            tagsDiv.appendChild(tagsContainer);
            dataDisplay.appendChild(tagsDiv);
        }

        document.body.appendChild(dataDisplay);

        setTimeout(() => {
            if (dataDisplay.parentNode) {
                dataDisplay.remove();
            }
        }, 4000);
    }

    // Skip duplicate check for immediate processing
    async checkDuplicate(username, token) {
        // Return false to skip duplicate check for immediate processing
        return false;
    }

    // Main extraction method with immediate processing
    async extractProfile(tags = [], providedToken = null, providedUsername = null, immediate = false) {
        // Don't check if already extracting for immediate mode
        if (this.isExtracting && !immediate) {
            this.showNotification('Extraction already in progress', 'warning');
            return null;
        }

        // Set auth data from parameters or get from storage
        if (providedToken && providedUsername) {
            this.setAuthData(providedToken, providedUsername);
        } else {
            const authData = await this.getStoredAuthData();
            if (!authData) {
                this.showNotification('Please login first. Click the extension icon to set up credentials.', 'error', 6000);
                return null;
            }
        }

        console.log('Authentication check - Username:', this.username);
        console.log('Authentication check - Token:', this.authToken ? 'Present' : 'Missing');

        if (!this.username || !this.authToken) {
            this.showNotification('Please login first. Click the extension icon to set up credentials.', 'error', 6000);
            return null;
        }

        this.isExtracting = true;
        
        try {
            this.showNotification(`Extracting profile for ${this.username}...`, 'info');
            
            // Reduced wait times for immediate processing
            await this.waitForElement('h1', 2000);
            await new Promise(resolve => setTimeout(resolve, 500));

            // Extract basic data
            this.profileData.name = this.extractName();
            this.profileData.bio = this.extractBio();
            this.profileData.location = this.extractLocation();

            // Extract connections and followers
            const connectionsData = this.extractConnections();
            this.profileData.connections = connectionsData.connections;
            this.profileData.followers = connectionsData.followers;

            // Add tags to profile data
            this.profileData.tags = tags || [];

            // Extract contact info with reduced wait time
            this.showNotification('Getting contact info...', 'info');
            await this.extractContactInfo();

            // Validate extracted data
            if (!this.profileData.name && !this.profileData.email && !this.profileData.bio) {
                throw new Error('Insufficient profile data extracted');
            }

            // Skip duplicate check for immediate processing and send directly to server
            this.showNotification('Saving to database...', 'info');
            
            // Send to server asynchronously without waiting
            this.sendToServerAsync(this.username, this.authToken);
            
            // Show success immediately
            this.showNotification('Profile extraction completed!', 'success');
            this.showExtractedData(this.profileData);
            
            return { success: true, message: 'Profile extracted successfully', data: this.profileData };
        } catch (error) {
            console.error('Profile extraction failed:', error);
            this.showNotification(`Failed to process profile: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isExtracting = false;
        }
    }

    // Asynchronous server communication
    async sendToServerAsync(username, token) {
        // Send to server in background without blocking UI
        setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE}/profiles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': this.userAgent,
                        'X-Session-ID': this.sessionId,
                        'X-Request-Time': Date.now().toString()
                    },
                    body: JSON.stringify({
                        username: username,
                        tags: this.profileData.tags,
                        ...this.profileData
                    })
                });

                if (response.status === 401 || response.status === 403) {
                    chrome.runtime.sendMessage({ action: 'redirectToLogin' });
                    return;
                }

                if (response.ok) {
                    console.log('Profile saved to server successfully');
                    this.showNotification('✓ Saved to database', 'success', 2000);
                } else {
                    console.warn('Failed to save profile to server:', response.status);
                    this.showNotification('⚠ Database save failed', 'warning', 2000);
                }
            } catch (error) {
                console.error('Server communication error:', error);
                this.showNotification('⚠ Database connection error', 'warning', 2000);
            }
        }, 100); // Small delay to not block UI
    }

    // Original server communication method (for backwards compatibility)
    async sendToServer(username, token) {
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const response = await fetch(`${API_BASE}/profiles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'User-Agent': this.userAgent,
                        'X-Session-ID': this.sessionId,
                        'X-Request-Time': Date.now().toString()
                    },
                    body: JSON.stringify({
                        username: username,
                        tags: this.profileData.tags,
                        ...this.profileData
                    })
                });

                if (response.status === 401 || response.status === 403) {
                    chrome.runtime.sendMessage({ action: 'redirectToLogin' });
                    throw new Error('Authentication failed. Please login again.');
                }

                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                const result = await response.json();
                return result;
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    throw new Error(`Failed to save profile after ${maxRetries} attempts: ${error.message}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
    }
}

// Initialize
let extractor;
let extractionInProgress = false;

// Enhanced message listener for immediate processing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeProfile') {
        // Skip extraction in progress check for immediate mode
        if (extractionInProgress && !request.immediate) {
            sendResponse({ success: false, message: 'Extraction in progress' });
            return;
        }

        const username = request.username;
        const token = request.token;

        if (!username || !token) {
            sendResponse({ success: false, message: 'Please login first' });
            return;
        }

        extractionInProgress = true;
        extractor = new LinkedInExtractor(request.sessionId, request.userAgent);
        
        const tags = request.tags || [];
        const immediate = request.immediate || false;
        
        extractor.extractProfile(tags, token, username, immediate)
            .then(result => {
                sendResponse({
                    success: true,
                    data: extractor.profileData,
                    serverResponse: result
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    message: error.message
                });
            })
            .finally(() => {
                extractionInProgress = false;
            });

        return true; // Keep message channel open
    }

    if (request.action === 'showWarning') {
        const tempExtractor = new LinkedInExtractor('temp', '');
        tempExtractor.showNotification(request.message, 'warning');
        sendResponse({ success: true });
    }

    if (request.action === 'checkLoaded') {
        sendResponse({ loaded: true });
    }

    if (request.action === 'setAuthData') {
        if (request.username && request.token) {
            chrome.storage.local.set({
                'linkedin_scraper_username': request.username,
                'linkedin_scraper_token': request.token
            }).then(() => {
                sendResponse({ success: true });
            }).catch(() => {
                sendResponse({ success: false, message: 'Failed to store auth data' });
            });
        } else {
            sendResponse({ success: false, message: 'Invalid auth data' });
        }
        return true;
    }
});

// Initialize on load
if (typeof window !== 'undefined') {
    window.linkedinScraperLoaded = true;
    console.log('LinkedIn Assistant Enhanced with Immediate Processing loaded');
}
