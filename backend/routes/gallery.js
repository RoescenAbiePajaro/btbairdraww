import express from 'express';
import jwt from 'jsonwebtoken';
import supabaseService from '../services/supabaseService.js';

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Get user's gallery
router.get('/', authenticateToken, async (req, res) => {
  try {
    const gallery = await supabaseService.getUserGallery(req.user.id);
    res.json(gallery);
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save artwork to gallery
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { dataURL, timestamp, drawingData, textItemsData, shapeItemsData } = req.body;
    
    const galleryItem = await supabaseService.saveToGallery(
      req.user.id,
      dataURL,
      timestamp,
      drawingData,
      textItemsData,
      shapeItemsData
    );
    
    res.status(201).json(galleryItem);
  } catch (error) {
    console.error('Error saving to gallery:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete artwork from gallery
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Delete request - User ID:', req.user.id, 'Artwork ID:', req.params.id);
    
    const result = await supabaseService.deleteFromGallery(req.user.id, req.params.id);
    
    console.log('Delete result:', result);
    
    if (!result) {
      console.log('Artwork not found for user:', req.user.id, 'id:', req.params.id);
      return res.status(404).json({ error: 'Artwork not found' });
    }
    
    res.json({ message: 'Artwork deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
