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
    
    // Attach logout button event listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
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
    const response = await authenticatedFetch('https://btbairdraww.onrender.com/api/gallery');
    
    if (response.ok) {
      const galleryData = await response.json();
      console.log('Raw gallery data from server:', galleryData);
      
      // Convert server data to client format
      state.gallery = galleryData.map(item => ({
        dataURL: item.dataURL || item.dataurl, // Handle both cases
        timestamp: item.timestamp,
        id: parseInt(item.id),
        drawingData: item.drawingData || item.drawingdata, // Handle both cases
        textItemsData: item.textItemsData || item.textitemsdata || [],
        shapeItemsData: item.shapeItemsData || item.shapeitemsdata || []
      }));
      
      console.log('Gallery loaded from server:', state.gallery.length, 'items');
      console.log('Processed gallery items:', state.gallery);
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
    const response = await authenticatedFetch('https://btbairdraww.onrender.com/api/gallery', {
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
    const response = await authenticatedFetch(`https://btbairdraww.onrender.com/api/gallery/${artworkId}`, {
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
