import express from 'express';
import jwt from 'jsonwebtoken';
import Gallery from '../models/Gallery.js';

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
    const gallery = await Gallery.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(gallery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save artwork to gallery
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { dataURL, timestamp, id, drawingData, textItemsData, shapeItemsData } = req.body;
    
    // Get the next ID for this user
    const lastGallery = await Gallery.findOne({ userId: req.user.id }).sort({ id: -1 });
    const nextId = lastGallery ? lastGallery.id + 1 : 1;
    
    const galleryItem = new Gallery({
      userId: req.user.id,
      dataURL,
      timestamp,
      id: nextId,
      drawingData,
      textItemsData,
      shapeItemsData
    });
    
    await galleryItem.save();
    res.status(201).json(galleryItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete artwork from gallery
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('Delete request - User ID:', req.user.id, 'Artwork ID:', req.params.id);
    
    const result = await Gallery.findOneAndDelete({ 
      userId: req.user.id, 
      id: parseInt(req.params.id) 
    });
    
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
