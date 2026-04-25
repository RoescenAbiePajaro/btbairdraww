// script-main.js
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const state = {
  mode: 'draw',         // 'draw' | 'text' | 'shape' | 'eraser'
  color: '#111111',
  brushSize: 8,
  eraseRadius: 40,
  isDrawing: false,
  lastX: null, lastY: null,
  gesture: 'none',      // 'draw' | 'erase' | 'peace' | 'none'
  gestureHistory: [],
  prevGesture: 'none',
  handsDetected: 0,
  gallery: [],          // {dataURL, timestamp}[]
  selectedGalleryItems: new Set(), // IDs of selected items
  textItems: [],        // {id, text, x, y, color, el}[]
  selectedText: null,
  textColor: '#ffffff',
  textDragActive: false,
  textDragId: null,
  textDragOffX: 0, textDragOffY: 0,
  editingText: null,    // Currently editing text item
  shapeItems: [],       // {id, type, x, y, width, height, color, el, isPlaced}[]
  selectedShape: null,
  currentShape: 'square', // 'square' | 'rectangle' | 'triangle'
  shapeDragActive: false,
  shapeDragId: null,
  shapeDragOffX: 0, shapeDragOffY: 0,
  shapeStartX: null, shapeStartY: null,
};

// DOM refs
const splash        = document.getElementById('splash');
const mainScreen    = document.getElementById('main');
const galleryScreen = document.getElementById('gallery');
const startBtn      = document.getElementById('startBtn');
const videoEl       = document.getElementById('videoEl');
const drawCanvas    = document.getElementById('drawCanvas');
const handCanvas    = document.getElementById('handCanvas');
const templateCanvas= document.getElementById('templateCanvas');
const dCtx          = drawCanvas.getContext('2d');
const hCtx          = handCanvas.getContext('2d');
const tCtx          = templateCanvas.getContext('2d');
const cursorDot     = document.getElementById('cursorDot');
const eraserRing    = document.getElementById('eraserRing');
const eraseFlash    = document.getElementById('eraseFlash');
const gestureHint   = document.getElementById('gestureHint');
const gestureLabel  = document.getElementById('gestureLabel');
const handStatus    = document.getElementById('handStatus');
const modeLabel     = document.getElementById('modeLabel');
const sizeDisplay   = document.getElementById('sizeDisplay');
const toast         = document.getElementById('toast');
const saveFlash     = document.getElementById('saveFlash');
const loading       = document.getElementById('loading');
const loadingText   = document.getElementById('loadingText');
const galleryGrid   = document.getElementById('galleryGrid');
const textControls  = document.getElementById('textControls');
const textInput     = document.getElementById('textInput');
const textLayer     = document.getElementById('textLayer');
const brushInfo     = document.getElementById('brushInfo');
const doneEditingBtn = document.getElementById('doneEditingBtn');
const shapeControls = document.getElementById('shapeControls');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const exportBtn = document.getElementById('exportBtn');
const exportModal = document.getElementById('exportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');

const colorMap = { black:'#111111', pink:'#ff2d78', yellow:'#ffe94a', blue:'#2d8bff', green:'#2dff9a' };

// Template image for export
let templateImg = new Image();
templateImg.src = 'Beyond The Brush Template.png';

// ═══════════════════════════════════════════════════════
// RESIZE
// ═══════════════════════════════════════════════════════
function resizeCanvases() {
  const w = window.innerWidth, h = window.innerHeight;
  [drawCanvas, handCanvas, templateCanvas].forEach(c => { c.width=w; c.height=h; });
  drawTemplate();
}
window.addEventListener('resize', resizeCanvases);

// ═══════════════════════════════════════════════════════
// TEMPLATE CANVAS (beyondthebrush.png aesthetic)
// ═══════════════════════════════════════════════════════
function drawTemplate() {
  const w = templateCanvas.width, h = templateCanvas.height;
  tCtx.clearRect(0,0,w,h);

  // Subtle decorative frame
  tCtx.strokeStyle = 'rgba(255,45,120,0.6)';
  tCtx.lineWidth = 2;
  tCtx.strokeRect(20, 20, w-40, h-40);

  tCtx.strokeStyle = 'rgba(255,45,120,0.2)';
  tCtx.lineWidth = 1;
  tCtx.strokeRect(26, 26, w-52, h-52);

  // Corner ornaments
  const corners = [[30,30], [w-30,30], [30,h-30], [w-30,h-30]];
  corners.forEach(([cx,cy]) => {
    tCtx.fillStyle = 'rgba(255,45,120,0.7)';
    tCtx.beginPath();
    tCtx.arc(cx, cy, 4, 0, Math.PI*2);
    tCtx.fill();
  });

  // Brand watermark text (center)
  tCtx.save();
  tCtx.font = 'italic 700 48px Georgia, serif';
  tCtx.fillStyle = 'rgba(255,255,255,0.06)';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText('beyond the brush', w/2, h/2);
  tCtx.restore();

  // Corner label
  tCtx.save();
  tCtx.font = '500 11px monospace';
  tCtx.fillStyle = 'rgba(255,45,120,0.5)';
  tCtx.textAlign = 'left';
  tCtx.fillText('AIRDRAW · BEYOND THE BRUSH', 36, h-36);
  tCtx.restore();
}

// ═══════════════════════════════════════════════════════
// GESTURE DETECTION
// ═══════════════════════════════════════════════════════
function detectGesture(landmarks) {
  // Finger tips: thumb=4, index=8, middle=12, ring=16, pinky=20
  // MCP knuckles: index=5, middle=9, ring=13, pinky=17
  const tip = (i) => landmarks[i];
  const mcp = (i) => landmarks[i];

  const fingerExtended = (tipIdx, mcpIdx) => {
    return tip(tipIdx).y < mcp(mcpIdx).y - 0.03;
  };

  const indexExt  = fingerExtended(8,5);
  const middleExt = fingerExtended(12,9);
  const ringExt   = fingerExtended(16,13);
  const pinkyExt  = fingerExtended(20,17);
  const thumbExt  = landmarks[4].x < landmarks[3].x - 0.02 || landmarks[4].x > landmarks[3].x + 0.02;

  // High five = all 4 fingers + thumb extended
  if (indexExt && middleExt && ringExt && pinkyExt) return 'erase';
  // Peace sign = index and middle extended, ring and pinky closed
  if (indexExt && middleExt && !ringExt && !pinkyExt) return 'peace';
  // Draw = only index extended
  if (indexExt && !middleExt && !ringExt && !pinkyExt) return 'draw';
  return 'none';
}

// Smooth gesture with small history buffer
function smoothGesture(g) {
  state.gestureHistory.push(g);
  if (state.gestureHistory.length > 5) state.gestureHistory.shift();
  const counts = {};
  state.gestureHistory.forEach(x => counts[x] = (counts[x]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}

// ═══════════════════════════════════════════════════════
// DRAWING LOGIC
// ═══════════════════════════════════════════════════════

// Erase at a given point — always uses destination-out
function eraseAt(x, y) {
  const r = state.eraseRadius;
  dCtx.save();
  dCtx.globalCompositeOperation = 'destination-out';
  dCtx.beginPath();
  dCtx.arc(x, y, r, 0, Math.PI * 2);
  dCtx.fillStyle = 'rgba(0,0,0,1)';
  dCtx.fill();
  dCtx.restore();

  // Also check if we're erasing over any placed shapes and remove them
  state.shapeItems = state.shapeItems.filter(item => {
    if (!item.isPlaced || !item.el) return true;
    
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const d = Math.hypot(x - cx, y - cy);
    
    // If eraser overlaps with shape, remove it
    if (d < Math.max(item.width, item.height) / 2 + r) {
      item.el.remove();
      return false;
    }
    return true;
  });
}

function draw(x, y, gesture) {
  if (state.mode === 'eraser') {
    // Eraser mode — always erase regardless of hand gesture
    eraseAt(x, y);
    state.isDrawing = false;
    return;
  }

  if (gesture === 'draw') {
    if (!state.isDrawing) {
      state.isDrawing = true;
      state.lastX = x; state.lastY = y;
      return;
    }
    dCtx.globalCompositeOperation = 'source-over';
    dCtx.strokeStyle = state.color;
    dCtx.lineWidth = state.brushSize;
    dCtx.lineCap = 'round';
    dCtx.lineJoin = 'round';
    dCtx.beginPath();
    dCtx.moveTo(state.lastX, state.lastY);
    dCtx.lineTo(x, y);
    dCtx.stroke();
    state.lastX = x; state.lastY = y;

  } else if (gesture === 'erase') {
    // High-five gesture = erase
    state.isDrawing = false;
    eraseAt(x, y);

  } else {
    state.isDrawing = false;
    state.lastX = null; state.lastY = null;
  }
}
