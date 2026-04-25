import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dataURL: { type: String, required: true },
  timestamp: { type: String, required: true },
  id: { type: Number, required: true },
  drawingData: String,
  textItemsData: [{
    id: Number,
    text: String,
    x: Number,
    y: Number,
    color: String
  }],
  shapeItemsData: [{
    id: Number,
    type: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    color: String,
    isPlaced: Boolean
  }],
  createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique IDs per user
gallerySchema.index({ userId: 1, id: 1 }, { unique: true });

export default mongoose.model('Gallery', gallerySchema);
