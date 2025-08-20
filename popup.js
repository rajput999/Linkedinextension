document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const authSection = document.getElementById('authSection');
    const mainSection = document.getElementById('mainSection');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginSubmit = document.getElementById('loginSubmit');
    const registerSubmit = document.getElementById('registerSubmit');
    const extractBtn = document.getElementById('extractBtn');
    const extractText = document.getElementById('extractText');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const toast = document.getElementById('toast');
    const viewProfilesBtn = document.getElementById('viewProfilesBtn');
    const shortcutKey = document.getElementById('shortcutKey');

    // Tag elements
    const tagInput = document.getElementById('tagInput');
    const addTagBtn = document.getElementById('addTagBtn');
    const tagsContainer = document.getElementById('tagsContainer');
    const popularTagsContainer = document.getElementById('popularTagsContainer');

    // const API_BASE = 'http://localhost:8080/api';
    const API_BASE = 'https://linkedinscrap-e4dpdhcuc7fgd7fk.eastasia-01.azurewebsites.net/api';
    const PROFILES_VIEWER_URL = 'https://linkedin-data-viewer.onrender.com/';

    // Tag management
    let selectedTags = [];
    let popularTags = [];
    let authToken = null;

    // Detect system for keyboard shortcut display
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutKeyText = isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S';
    
    // Set keyboard shortcut in footer
    shortcutKey.textContent = shortcutKeyText;
    
    // Set hover tooltip for extract button
    extractBtn.title = `Extract Profile (${shortcutKeyText})`;

    // Initialize
    checkAuthStatus();

    async function checkAuthStatus() {
        try {
            const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
            const username = result.linkedin_scraper_username;
            authToken = result.linkedin_scraper_token;

            if (username && authToken) {
                showMainSection(username);
                loadPopularTags();
                checkPageStatus();
            } else {
                showAuthSection();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            showAuthSection();
        }
    }

    async function clearAuthData() {
        try {
            await chrome.storage.local.remove(['linkedin_scraper_username', 'linkedin_scraper_token']);
            authToken = null;
        } catch (error) {
            console.error('Error clearing auth data:', error);
        }
    }

    function showAuthSection() {
        authSection.classList.add('active');
        mainSection.classList.remove('active');
        updateStatus('Please sign in to continue', 'warning');
    }

    function showMainSection(username) {
        authSection.classList.remove('active');
        mainSection.classList.add('active');
        userName.textContent = username;
        userAvatar.textContent = username.charAt(0).toUpperCase();
        selectedTags = []; // Reset tags for new session
        updateTagsDisplay();
        sendTokenToContentScript(authToken, username);
    }

    async function sendTokenToContentScript(token, username) {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (tab && tab.url && tab.url.includes('linkedin.com/in/')) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'setAuthData',
                    token: token,
                    username: username
                });
            }
        } catch (error) {
            console.warn('Error sending auth data:', error);
        }
    }

    // Load popular tags from server with auth error handling
    async function loadPopularTags() {
        if (!authToken) return;
        
        try {
            const response = await fetch(`${API_BASE}/tags`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Auth failed, redirect to login
                await clearAuthData();
                showAuthSection();
                showToast('Session expired. Please login again.', 'warning');
                return;
            }

            if (response.ok) {
                const tags = await response.json();
                popularTags = tags.slice(0, 10); // Show top 10
                updatePopularTagsDisplay();
            }
        } catch (error) {
            console.warn('Failed to load tags:', error);
        }
    }

    // Update popular tags display
    function updatePopularTagsDisplay() {
        popularTagsContainer.innerHTML = '';
        if (popularTags.length === 0) {
            popularTagsContainer.innerHTML = 'No tags yet';
            return;
        }

        popularTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'popular-tag';
            tagElement.style.backgroundColor = tag.color + '20';
            tagElement.style.borderColor = tag.color;
            tagElement.style.position = 'relative';
            tagElement.style.paddingRight = '25px';

            const tagText = document.createElement('span');
            tagText.textContent = tag.name;
            tagText.style.cursor = 'pointer';
            tagText.addEventListener('click', () => {
                addTag(tag.name, tag.color);
            });

            const deleteBtn = document.createElement('span');
            deleteBtn.innerHTML = '×';
            deleteBtn.style.cssText = `
                position: absolute;
                right: 5px;
                top: 50%;
                transform: translateY(-50%);
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                color: ${tag.color};
                opacity: 0.7;
                transition: opacity 0.2s;
            `;

            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.opacity = '1';
            });

            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.opacity = '0.7';
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deletePopularTag(tag._id);
            });

            tagElement.appendChild(tagText);
            tagElement.appendChild(deleteBtn);
            popularTagsContainer.appendChild(tagElement);
        });
    }

    // Delete popular tag from database
    async function deletePopularTag(tagId) {
        if (!authToken) return;
        
        try {
            const response = await fetch(`${API_BASE}/tags/${tagId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Auth failed, redirect to login
                await clearAuthData();
                showAuthSection();
                showToast('Session expired. Please login again.', 'warning');
                return;
            }

            if (response.ok) {
                showToast('Tag deleted successfully', 'success');
                loadPopularTags(); // Refresh the popular tags
            } else {
                showToast('Failed to delete tag', 'error');
            }
        } catch (error) {
            console.warn('Failed to delete tag:', error);
            showToast('Failed to delete tag', 'error');
        }
    }

    // Add tag function
    function addTag(tagName, tagColor = '#0a66c2') {
        const trimmedTag = tagName.trim();
        if (!trimmedTag || trimmedTag.length > 50) {
            showToast('Tag must be 1-50 characters', 'error');
            return;
        }

        // Check if tag already exists
        if (selectedTags.some(tag => tag.name.toLowerCase() === trimmedTag.toLowerCase())) {
            showToast('Tag already added', 'warning');
            return;
        }

        if (selectedTags.length >= 10) {
            showToast('Maximum 10 tags allowed', 'warning');
            return;
        }

        selectedTags.push({
            name: trimmedTag,
            color: tagColor
        });

        updateTagsDisplay();
        tagInput.value = '';
        
        // Save to server for popular tags
        saveTagToServer(trimmedTag, tagColor);
    }

    // Save tag to server with auth error handling
    async function saveTagToServer(tagName, tagColor) {
        if (!authToken) return;
        
        try {
            const response = await fetch(`${API_BASE}/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    name: tagName,
                    color: tagColor
                })
            });

            if (response.status === 401 || response.status === 403) {
                // Auth failed, redirect to login
                await clearAuthData();
                showAuthSection();
                showToast('Session expired. Please login again.', 'warning');
                return;
            }
        } catch (error) {
            console.warn('Failed to save tag:', error);
        }
    }

    // Remove tag function
    function removeTag(index) {
        selectedTags.splice(index, 1);
        updateTagsDisplay();
    }

    // Update tags display
    function updateTagsDisplay() {
        tagsContainer.innerHTML = '';
        if (selectedTags.length === 0) {
            tagsContainer.innerHTML = '';
            return;
        }

        selectedTags.forEach((tag, index) => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag selected';
            tagElement.style.backgroundColor = tag.color;
            tagElement.innerHTML = `
                ${tag.name}
                <span class="remove-tag">×</span>
            `;

            tagElement.querySelector('.remove-tag').addEventListener('click', (e) => {
                e.stopPropagation();
                removeTag(index);
            });

            tagsContainer.appendChild(tagElement);
        });
    }

    // Tag input events
    addTagBtn.addEventListener('click', () => {
        const tagName = tagInput.value.trim();
        if (tagName) {
            addTag(tagName);
        }
    });

    tagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const tagName = tagInput.value.trim();
            if (tagName) {
                addTag(tagName);
            }
        }
    });

    tagInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value.length > 50) {
            e.target.value = value.substring(0, 50);
            showToast('Tag limited to 50 characters', 'warning');
        }
    });

    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    registerTab.addEventListener('click', () => switchTab('register'));

    function switchTab(tab) {
        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.classList.add('active');
            loginForm.classList.remove('active');
        }
    }

    // Login
    loginSubmit.addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            showToast('Please fill all fields', 'error');
            return;
        }

        setButtonLoading(loginSubmit, true);
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();
            if (response.ok) {
                // Store both username and token in chrome.storage.local
                await chrome.storage.local.set({
                    'linkedin_scraper_username': data.username,
                    'linkedin_scraper_token': data.token
                });
                
                authToken = data.token;
                showMainSection(data.username);
                showToast('Welcome back!', 'success');
                loadPopularTags();
                checkPageStatus();
            } else {
                showToast(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            showToast('Connection error', 'error');
        } finally {
            setButtonLoading(loginSubmit, false);
        }
    });

    // Register
    registerSubmit.addEventListener('click', async () => {
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;

        if (!username || !password) {
            showToast('Please fill all fields', 'error');
            return;
        }

        if (username.length < 3 || password.length < 6) {
            showToast('Username: 3+ chars, Password: 6+ chars', 'error');
            return;
        }

        setButtonLoading(registerSubmit, true);
        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();
            if (response.ok) {
                // Auto login after registration
                const loginResponse = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username,
                        password
                    })
                });

                const loginData = await loginResponse.json();
                if (loginResponse.ok) {
                    // Store both username and token in chrome.storage.local
                    await chrome.storage.local.set({
                        'linkedin_scraper_username': loginData.username,
                        'linkedin_scraper_token': loginData.token
                    });
                    
                    authToken = loginData.token;
                    showMainSection(loginData.username);
                    showToast('Account created successfully!', 'success');
                    loadPopularTags();
                    checkPageStatus();
                }
            } else {
                showToast(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            showToast('Connection error', 'error');
        } finally {
            setButtonLoading(registerSubmit, false);
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await clearAuthData();
        selectedTags = [];
        showAuthSection();
        showToast('Signed out successfully', 'success');
    });

    // Extract profile with tags and token
    extractBtn.addEventListener('click', async () => {
        try {
            const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
            const username = result.linkedin_scraper_username;
            const token = result.linkedin_scraper_token;
    
            if (!username || !token) {
                showToast('Please sign in first', 'error');
                return;
            }
    
            setButtonLoading(extractBtn, true, 'Extracting...');
            updateStatus('Starting extraction...', 'warning');
    
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            chrome.tabs.sendMessage(tab.id, {
                action: 'scrapeProfile',
                sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2),
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                username: username,
                token: token,
                tags: selectedTags,
                immediate: true // Enable immediate processing
            });
    
            showToast('Extraction started...', 'success');
            
            // Reset button state immediately
            setTimeout(() => {
                setButtonLoading(extractBtn, false);
                updateStatus('Ready to extract', 'success');
            }, 1000);
            
            setTimeout(() => window.close(), 1200);
        } catch (error) {
            console.error('Error:', error);
            setButtonLoading(extractBtn, false);
            updateStatus('Error occurred', 'error');
            showToast('Failed to start extraction', 'error');
        }
    });

    // View saved profiles
    viewProfilesBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: PROFILES_VIEWER_URL
        });
        showToast('Opening profile viewer...', 'success');
        setTimeout(() => window.close(), 500);
    });

    async function checkPageStatus() {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            if (!tab || !tab.url || !tab.url.includes('linkedin.com/in/')) {
                updateStatus('Navigate to LinkedIn profile', 'warning');
                extractBtn.disabled = true;
                return;
            }

            updateStatus('Checking page...', 'warning');
            chrome.tabs.sendMessage(tab.id, {action: 'checkLoaded'}, (response) => {
                if (chrome.runtime.lastError || !response) {
                    injectContentScript(tab.id);
                } else {
                    updateStatus('Ready to extract', 'success');
                    extractBtn.disabled = false;
                }
            });
        } catch (error) {
            updateStatus('Page error', 'error');
            extractBtn.disabled = true;
        }
    }

    function injectContentScript(tabId) {
        chrome.scripting.executeScript({
            target: {tabId},
            files: ['content.js']
        }, async () => {
            if (chrome.runtime.lastError) {
                updateStatus('Extension error', 'error');
                extractBtn.disabled = true;
            } else {
                updateStatus('Ready to extract', 'success');
                extractBtn.disabled = false;
                
                try {
                    const result = await chrome.storage.local.get(['linkedin_scraper_username', 'linkedin_scraper_token']);
                    const username = result.linkedin_scraper_username;
                    const token = result.linkedin_scraper_token;
                    
                    if (username && token) {
                        setTimeout(() => sendTokenToContentScript(token, username), 1000);
                    }
                } catch (error) {
                    console.error('Error getting auth data:', error);
                }
            }
        });
    }

    function setButtonLoading(button, loading, text = null) {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            if (text && button === extractBtn) {
                extractText.textContent = text;
            }
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (button === extractBtn) {
                extractText.textContent = '🚀 Extract Profile';
            }
        }
    }

    function updateStatus(text, type) {
        statusText.textContent = text;
        statusIndicator.className = `status-indicator ${type}`;
    }

    function showToast(text, type) {
        toast.textContent = text;
        toast.className = `toast ${type} show`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Listen for redirect to login messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'redirectToLogin') {
            clearAuthData();
            selectedTags = [];
            showAuthSection();
            showToast('Session expired. Please login again.', 'warning');
        }
    });

    // Enter key support
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (loginForm.classList.contains('active') && !loginSubmit.disabled) {
                loginSubmit.click();
            } else if (registerForm.classList.contains('active') && !registerSubmit.disabled) {
                registerSubmit.click();
            }
        }
    });
});