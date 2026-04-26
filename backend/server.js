import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import galleryRoutes from './routes/gallery.js';
import supabaseService from './services/supabaseService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from parent directory
app.use(express.static('../'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gallery', galleryRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Connect to MongoDB and initialize Supabase
async function initializeServer() {
  try {
    // Connect to MongoDB for authentication
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for authentication');
    
    // Initialize Supabase service for gallery storage
    console.log('Initializing Supabase service for gallery...');
    await supabaseService.ensureBucket();
    console.log('Supabase service initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Using MongoDB for auth, Supabase for gallery storage');
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initializeServer();
