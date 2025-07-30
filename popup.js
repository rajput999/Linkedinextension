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

    const API_BASE = 'https://linkedinscrap-e4dpdhcuc7fgd7fk.eastasia-01.azurewebsites.net/api';
    const PROFILES_VIEWER_URL = 'https://linkedin-data-viewer.onrender.com/';

    // Initialize
    checkAuthStatus();

    function checkAuthStatus() {
        const username = localStorage.getItem('linkedin_scraper_username');
        if (username) {
            showMainSection(username);
            checkPageStatus();
        } else {
            showAuthSection();
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
        sendUsernameToContentScript(username);
    }

    async function sendUsernameToContentScript(username) {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (tab && tab.url && tab.url.includes('linkedin.com/in/')) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'setUsername',
                    username: username
                });
            }
        } catch (error) {
            console.warn('Error sending username:', error);
        }
    }

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
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password})
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('linkedin_scraper_username', data.username);
                showMainSection(data.username);
                showToast('Welcome back!', 'success');
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
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password})
            });

            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('linkedin_scraper_username', data.username);
                showMainSection(data.username);
                showToast('Account created successfully!', 'success');
                checkPageStatus();
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
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('linkedin_scraper_username');
        showAuthSection();
        showToast('Signed out successfully', 'success');
    });

    // Extract profile
    extractBtn.addEventListener('click', async () => {
        const username = localStorage.getItem('linkedin_scraper_username');
        if (!username) {
            showToast('Please sign in first', 'error');
            return;
        }

        setButtonLoading(extractBtn, true, 'Extracting...');
        updateStatus('Processing profile...', 'warning');
        
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            chrome.tabs.sendMessage(tab.id, {
                action: 'scrapeProfile',
                sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2),
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                username: username
            });
            
            showToast('Extraction started...', 'success');
            setTimeout(() => window.close(), 800);
        } catch (error) {
            console.error('Error:', error);
            setButtonLoading(extractBtn, false);
            updateStatus('Error occurred', 'error');
            showToast('Failed to start extraction', 'error');
        }
    });

    // View saved profiles
    viewProfilesBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: PROFILES_VIEWER_URL });
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
        }, () => {
            if (chrome.runtime.lastError) {
                updateStatus('Extension error', 'error');
                extractBtn.disabled = true;
            } else {
                updateStatus('Ready to extract', 'success');
                extractBtn.disabled = false;
                const username = localStorage.getItem('linkedin_scraper_username');
                if (username) {
                    setTimeout(() => sendUsernameToContentScript(username), 1000);
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
                extractText.textContent = 'Extract Profile';
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
        
        // Hide after 1 second as requested
        setTimeout(() => {
            toast.classList.remove('show');
        }, 1000);
    }

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