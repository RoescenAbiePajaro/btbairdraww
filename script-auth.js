// script-auth.js
// ═══════════════════════════════════════════════════════
// AUTHENTICATION & USER MANAGEMENT
// ═══════════════════════════════════════════════════════

// Global auth state
let currentUser = null;
let authToken = null;

// Check authentication on page load
window.addEventListener('load', async () => {
  const token = localStorage.getItem('airdraw_token');
  const userStr = localStorage.getItem('airdraw_user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      authToken = token;
      currentUser = user;
      
      // Update UI with user info
      updateUserInfo();
      
      // Load user's gallery
      await loadUserGallery();
      
      showToast(`Welcome back, ${user.fullName}!`);
    } catch (error) {
      console.error('Error parsing user data:', error);
      logout();
    }
  } else {
    // Redirect to login if not authenticated
    window.location.href = 'index.html';
  }
});

// Update UI with user information
function updateUserInfo() {
  if (currentUser) {
    // Update gallery title to show user's name
    const galleryTitle = document.querySelector('.gallery-title');
    if (galleryTitle) {
      galleryTitle.textContent = `${currentUser.fullName}'s Gallery`;
    }
    
    // Add logout button
    const galleryControls = document.querySelector('.gallery-controls');
    if (galleryControls && !document.getElementById('logoutBtn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'logout-btn';
      logoutBtn.textContent = '🚪 Logout';
      logoutBtn.style.cssText = 'background:rgba(255,45,120,0.2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-family:"Space Mono",monospace;font-size:.7rem;cursor:pointer;transition:all .15s;margin-left:8px;';
      logoutBtn.addEventListener('click', logout);
      galleryControls.appendChild(logoutBtn);
    }
  }
}

// Logout function
function logout() {
  localStorage.removeItem('airdraw_token');
  localStorage.removeItem('airdraw_user');
  currentUser = null;
  authToken = null;
  window.location.href = 'index.html';
}

// API helper with authentication
async function authenticatedFetch(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    
    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid, redirect to login
      logout();
      return;
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    showToast('Network error. Please try again.');
    throw error;
  }
}

// Load user's gallery from server
async function loadUserGallery() {
  try {
    const response = await authenticatedFetch('http://localhost:5000/api/gallery');
    
    if (response.ok) {
      const galleryData = await response.json();
      // Convert server data to client format
      state.gallery = galleryData.map(item => ({
        dataURL: item.dataURL,
        timestamp: item.timestamp,
        id: parseInt(item.id),
        drawingData: item.drawingData,
        textItemsData: item.textItemsData || [],
        shapeItemsData: item.shapeItemsData || []
      }));
      
      renderGallery();
    } else {
      console.error('Failed to load gallery');
      showToast('Failed to load gallery');
    }
  } catch (error) {
    console.error('Error loading gallery:', error);
    showToast('Error loading gallery');
  }
}

// Save artwork to user's gallery
async function saveArtworkToServer(artworkData) {
  try {
    const response = await authenticatedFetch('http://localhost:5000/api/gallery', {
      method: 'POST',
      body: JSON.stringify(artworkData)
    });
    
    if (response.ok) {
      const savedArtwork = await response.json();
      showToast('Artwork saved to your gallery! 🎨');
      return savedArtwork;
    } else {
      const error = await response.json();
      showToast('Failed to save: ' + error.error);
      throw new Error(error.error);
    }
  } catch (error) {
    console.error('Error saving artwork:', error);
    throw error;
  }
}

// Delete artwork from user's gallery
async function deleteArtworkFromServer(artworkId) {
  try {
    const response = await authenticatedFetch(`http://localhost:5000/api/gallery/${artworkId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('Artwork deleted');
      return true;
    } else {
      const error = await response.json();
      showToast('Failed to delete: ' + error.error);
      throw new Error(error.error);
    }
  } catch (error) {
    console.error('Error deleting artwork:', error);
    throw error;
  }
}

// Make functions globally available
window.currentUser = currentUser;
window.authToken = authToken;
window.logout = logout;
window.loadUserGallery = loadUserGallery;
window.saveArtworkToServer = saveArtworkToServer;
window.deleteArtworkFromServer = deleteArtworkFromServer;
window.authenticatedFetch = authenticatedFetch;
