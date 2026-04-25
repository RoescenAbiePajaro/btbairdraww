// script=handling.js
// ═══════════════════════════════════════════════════════
// TEXT DRAG
// ═══════════════════════════════════════════════════════
function handleTextDrag(x, y, gesture) {
  if (gesture === 'erase') {
    // High five = pick up nearest text or delete if holding
    if (!state.textDragActive) {
      let closest = null, minDist = 80;
      state.textItems.forEach(item => {
        const rect = item.el.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const d = Math.hypot(x - cx, y - cy);
        if (d < minDist) { minDist = d; closest = item; }
      });
      if (closest) {
        // Check if we're already holding this text (delete after 1 second)
        if (state.textDragId === closest.id && state.textDragHoldTime) {
          const holdDuration = Date.now() - state.textDragHoldTime;
          if (holdDuration > 1000) {
            deleteText(closest);
            state.textDragActive = false;
            state.textDragId = null;
            state.textDragHoldTime = null;
            return;
          }
        } else {
          // Start dragging/holding
          state.textDragActive = true;
          state.textDragId = closest.id;
          state.textDragHoldTime = Date.now();
          const rect = closest.el.getBoundingClientRect();
          state.textDragOffX = x - rect.left;
          state.textDragOffY = y - rect.top;
          closest.el.classList.add('selected');
        }
      }
    } else {
      // Move the text
      const item = state.textItems.find(t => t.id === state.textDragId);
      if (item) {
        const nx = x - state.textDragOffX;
        const ny = y - state.textDragOffY;
        item.x = nx; item.y = ny;
        item.el.style.left = nx + 'px';
        item.el.style.top  = ny + 'px';
      }
    }
  } else {
    // Release
    if (state.textDragActive) {
      const item = state.textItems.find(t => t.id === state.textDragId);
      if (item) item.el.classList.remove('selected');
    }
    state.textDragActive = false;
    state.textDragId = null;
    state.textDragHoldTime = null;
  }
}

function deleteText(item) {
  saveState();
  item.el.remove();
  state.textItems = state.textItems.filter(t => t.id !== item.id);
  showToast('Text deleted!');
}

// ═══════════════════════════════════════════════════════
// HAND TRACKING
// ═══════════════════════════════════════════════════════
let handsModel;

async function initHandTracking() {
  showLoading('Loading hand tracking model…');
  handsModel = new Hands({locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`});
  handsModel.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  handsModel.onResults(onHandResults);

  const camera = new Camera(videoEl, {
    onFrame: async () => { await handsModel.send({image: videoEl}); },
    width: 1280, height: 720,
  });
  await camera.start();
  hideLoading();
  showToast('Hand tracking ready ✓');
}

function onHandResults(results) {
  const w = handCanvas.width, h = handCanvas.height;
  hCtx.clearRect(0, 0, w, h);

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    state.handsDetected = 0;
    handStatus.textContent = '⬤ WAITING';
    handStatus.style.color = 'var(--muted)';
    state.gesture = 'none';
    state.isDrawing = false;
    gestureLabel.textContent = '—';
    cursorDot.style.display = 'none';
    eraserRing.style.display = 'none';
    eraseFlash.style.display = 'none';
    return;
  }

  state.handsDetected = results.multiHandLandmarks.length;
  handStatus.textContent = '⬤ DETECTED';
  handStatus.style.color = 'var(--green)';

  const landmarks = results.multiHandLandmarks[0];
  // Mirror X because video is mirrored
  const mirroredLandmarks = landmarks.map(l => ({...l, x: 1 - l.x}));

  const rawGesture = detectGesture(mirroredLandmarks);
  const gesture = smoothGesture(rawGesture);
  state.gesture = gesture;

  // Index finger tip — used for drawing
  const tip = mirroredLandmarks[8];
  const px = tip.x * w;
  const py = tip.y * h;

  // Palm center — average of wrist(0) + knuckles(5,9,13,17) — used for erasing
  const palmPts = [0, 5, 9, 13, 17].map(i => mirroredLandmarks[i]);
  const palmX = (palmPts.reduce((s,p) => s + p.x, 0) / palmPts.length) * w;
  const palmY = (palmPts.reduce((s,p) => s + p.y, 0) / palmPts.length) * h;

  // Decide active point and what to show
  const isErasing = state.mode === 'eraser' || gesture === 'erase';
  const activeX = isErasing ? palmX : px;
  const activeY = isErasing ? palmY : py;
  const r = state.eraseRadius;

  // ── Cursor dot (draw mode) ──
  if (isErasing) {
    cursorDot.style.display = 'none';
    // Eraser ring
    eraserRing.style.display = 'block';
    eraserRing.style.left   = activeX + 'px';
    eraserRing.style.top    = activeY + 'px';
    eraserRing.style.width  = (r * 2) + 'px';
    eraserRing.style.height = (r * 2) + 'px';
    // Inner fill flash
    eraseFlash.style.display = 'block';
    eraseFlash.style.left   = activeX + 'px';
    eraseFlash.style.top    = activeY + 'px';
    eraseFlash.style.width  = (r * 2) + 'px';
    eraseFlash.style.height = (r * 2) + 'px';
  } else {
    eraserRing.style.display = 'none';
    eraseFlash.style.display = 'none';
    cursorDot.style.display = 'block';
    cursorDot.style.left   = px + 'px';
    cursorDot.style.top    = py + 'px';
    cursorDot.style.background = state.color;
    cursorDot.style.width  = (state.brushSize + 4) + 'px';
    cursorDot.style.height = (state.brushSize + 4) + 'px';
  }

  // Gesture label
  const gLabels = { draw:'☝ DRAWING', erase:'✋ ERASING', peace:'✌ PEACE', none:'✊ IDLE' };
  

  // Draw hand skeleton
  drawHandSkeleton(mirroredLandmarks, gesture, w, h, isErasing, palmX, palmY, r);

  // Route to mode
  if (state.mode === 'text') {
    handleTextDrag(activeX, activeY, gesture);
    state.isDrawing = false;
  } else if (state.mode === 'shape') {
    handleShapeDrag(activeX, activeY, gesture);
    state.isDrawing = false;
  } else {
    draw(activeX, activeY, gesture);
  }
}

function drawHandSkeleton(lm, gesture, w, h, isErasing, palmX, palmY, r) {
  const color = isErasing ? 'rgba(200,180,255,0.75)'
              : gesture === 'draw' ? 'rgba(147,51,234,0.75)'
              : 'rgba(128,0,128,0.5)';
  const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]];
  hCtx.strokeStyle = color;
  hCtx.lineWidth = 2;
  connections.forEach(([a,b]) => {
    hCtx.beginPath();
    hCtx.moveTo(lm[a].x*w, lm[a].y*h);
    hCtx.lineTo(lm[b].x*w, lm[b].y*h);
    hCtx.stroke();
  });
  lm.forEach((p,i) => {
    hCtx.beginPath();
    hCtx.arc(p.x*w, p.y*h, i===8?7:3, 0, Math.PI*2);
    hCtx.fillStyle = i===8 && !isErasing ? state.color : color;
    hCtx.fill();
  });

  // When erasing: draw the erase circle on the hand canvas too for extra clarity
  if (isErasing) {
    hCtx.save();
    hCtx.beginPath();
    hCtx.arc(palmX, palmY, r, 0, Math.PI*2);
    hCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    hCtx.lineWidth = 2.5;
    hCtx.setLineDash([6,4]);
    hCtx.stroke();
    hCtx.setLineDash([]);
    // Cross-hairs for precision
    hCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    hCtx.lineWidth = 1;
    hCtx.beginPath();
    hCtx.moveTo(palmX - r, palmY); hCtx.lineTo(palmX + r, palmY);
    hCtx.moveTo(palmX, palmY - r); hCtx.lineTo(palmX, palmY + r);
    hCtx.stroke();
    hCtx.restore();
  }
}

// ═══════════════════════════════════════════════════════
// TOOLBAR EVENTS
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.color = colorMap[btn.dataset.color];
  });
});

document.querySelectorAll('.tc-color').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tc-color').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.textColor = btn.dataset.color;
  });
});

document.getElementById('sizeUp').addEventListener('click', () => {
  if (state.mode === 'eraser') {
    state.eraseRadius = Math.min(100, state.eraseRadius + 8);
    sizeDisplay.textContent = state.eraseRadius;
  } else {
    state.brushSize = Math.min(40, state.brushSize + 2);
    sizeDisplay.textContent = state.brushSize;
  }
});
document.getElementById('sizeDown').addEventListener('click', () => {
  if (state.mode === 'eraser') {
    state.eraseRadius = Math.max(10, state.eraseRadius - 8);
    sizeDisplay.textContent = state.eraseRadius;
  } else {
    state.brushSize = Math.max(2, state.brushSize - 2);
    sizeDisplay.textContent = state.brushSize;
  }
});

document.getElementById('drawModeBtn').addEventListener('click', () => setMode('draw'));
document.getElementById('textModeBtn').addEventListener('click', () => setMode('text'));
document.getElementById('shapeModeBtn').addEventListener('click', () => setMode('shape'));
document.getElementById('eraserBtn').addEventListener('click', () => setMode('eraser'));

function setMode(m) {
  state.mode = m;
  modeLabel.textContent = m.toUpperCase();
  modeLabel.style.color = m === 'eraser' ? 'var(--yellow)' : 'var(--yellow)';
  document.getElementById('drawModeBtn').classList.toggle('active', m==='draw');
  document.getElementById('textModeBtn').classList.toggle('active', m==='text');
  document.getElementById('shapeModeBtn').classList.toggle('active', m==='shape');
  document.getElementById('eraserBtn').classList.toggle('active', m==='eraser');
  textControls.classList.toggle('visible', m==='text');
  shapeControls.classList.toggle('visible', m==='shape');
  // Hide eraser ring when leaving eraser mode
  if (m !== 'eraser') {
    eraserRing.style.display = 'none';
    eraseFlash.style.display = 'none';
  }
  // Cancel shape creation if leaving shape mode
  if (m !== 'shape' && state.shapeStartX !== null) {
    const item = state.shapeItems[state.shapeItems.length - 1];
    if (item && item.el && !item.isPlaced) {
      item.el.remove();
      state.shapeItems.pop();
    }
    state.shapeStartX = null;
    state.shapeStartY = null;
  }
  // Update brush info label
  const sizeLabel = document.getElementById('sizeLabel');
  if (sizeLabel) sizeLabel.textContent = m === 'eraser' ? 'ERASE' : 'SIZE';
  sizeDisplay.textContent = m === 'eraser' ? state.eraseRadius : state.brushSize;
  if (m === 'eraser') showToast('◎ Eraser mode — ✋ high-five OR move hand to erase');
  else if (m === 'text') showToast('T Text mode — ✋ high-five to drag text');
  else if (m === 'shape') showToast('◇ Shape mode — ☝ Index to start, ✌ Peace to place');
  else showToast('✏ Draw mode — ☝ index finger to draw');
}

// ═══════════════════════════════════════════════════════
// TEXT ITEMS
// ═══════════════════════════════════════════════════════
let textIdCounter = 0;

document.getElementById('addTextBtn').addEventListener('click', addText);
textInput.addEventListener('keydown', e => { if(e.key==='Enter') addText(); });

// Shape selection buttons
document.querySelectorAll('#shapeRow .tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#shapeRow .tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentShape = btn.dataset.shape;
  });
});

function addText() {
  const txt = textInput.value.trim();
  if (!txt) return;
  saveState();
  const id = ++textIdCounter;
  const x = window.innerWidth/2 - 100;
  const y = window.innerHeight/2 - 20;

  const el = document.createElement('div');
  el.className = 'text-item';
  el.textContent = txt;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  el.style.color = state.textColor;
  el.dataset.id = id;
  el.contentEditable = 'false';
  textLayer.appendChild(el);

  const item = { id, text:txt, x, y, color:state.textColor, el };
  state.textItems.push(item);

  // Mouse drag support too
  el.addEventListener('mousedown', e => startMouseDrag(e, item));
  // Double-click to edit
  el.addEventListener('dblclick', e => {
    e.preventDefault();
    e.stopPropagation();
    startEditing(item);
  });

  textInput.value = '';
  showToast('Text added! Double-click to edit, ✋ High-five to drag');
}

// Mouse drag for text
function startMouseDrag(e, item) {
  // Don't drag if editing
  if (state.editingText === item) return;
  
  e.preventDefault();
  const startX = e.clientX - item.x;
  const startY = e.clientY - item.y;
  const onMove = (ev) => {
    item.x = ev.clientX - startX;
    item.y = ev.clientY - startY;
    item.el.style.left = item.x + 'px';
    item.el.style.top  = item.y + 'px';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

// Text editing functions
function startEditing(item) {
  if (state.editingText) {
    stopEditing();
  }
  saveState();
  state.editingText = item;
  item.el.contentEditable = 'true';
  item.el.classList.add('editing');
  item.el.focus();

  // Position done button near the text
  const rect = item.el.getBoundingClientRect();
  doneEditingBtn.style.left = (rect.left + rect.width / 2 - 50) + 'px';
  doneEditingBtn.style.top = (rect.bottom + 10) + 'px';
  doneEditingBtn.classList.add('visible');

  // Live update while typing
  item.el.addEventListener('input', handleTextInput);

  showToast('Editing text - type to update live');
}

function stopEditing() {
  if (!state.editingText) return;
  
  const item = state.editingText;
  item.el.contentEditable = 'false';
  item.el.classList.remove('editing');
  item.el.removeEventListener('input', handleTextInput);
  
  // Update stored text
  item.text = item.el.textContent;
  
  state.editingText = null;
  doneEditingBtn.classList.remove('visible');
  
  showToast('Text updated!');
}

function handleTextInput(e) {
  if (state.editingText) {
    state.editingText.text = e.target.textContent;
  }
}

// Done editing button click
doneEditingBtn.addEventListener('click', stopEditing);

// Click outside to stop editing
document.addEventListener('click', (e) => {
  if (state.editingText && !state.editingText.el.contains(e.target) && e.target !== doneEditingBtn) {
    stopEditing();
  }
});

// Escape key to stop editing
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.editingText) {
    stopEditing();
  }
  // Undo/Redo keyboard shortcuts
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      redo();
    } else {
      undo();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redo();
  }
});

// ═══════════════════════════════════════════════════════
// SHAPE ITEMS
// ═══════════════════════════════════════════════════════
let shapeIdCounter = 0;

function handleShapeDrag(x, y, gesture) {
  // If peace sign detected and we have an active shape being created, place it permanently
  if (gesture === 'peace' && state.shapeStartX !== null) {
    placeShape();
    state.shapeStartX = null;
    state.shapeStartY = null;
    return;
  }

  if (gesture === 'draw') {
    // Index finger = start or resize shape
    if (state.shapeStartX === null) {
      // Start new shape
      state.shapeStartX = x;
      state.shapeStartY = y;
      createTempShape(x, y);
    } else {
      // Resize current shape
      updateTempShape(x, y);
    }
  } else if (gesture === 'erase') {
    // High five = drag existing placed shapes
    if (!state.shapeDragActive) {
      let closest = null, minDist = 80;
      state.shapeItems.filter(s => s.isPlaced && s.el).forEach(item => {
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        const d = Math.hypot(x - cx, y - cy);
        if (d < minDist) { minDist = d; closest = item; }
      });
      if (closest) {
        state.shapeDragActive = true;
        state.shapeDragId = closest.id;
        state.shapeDragOffX = x - closest.x;
        state.shapeDragOffY = y - closest.y;
        closest.el.classList.add('selected');
        // Clear the shape from canvas once when drag starts
        clearShapeFromCanvas(closest);
      }
    } else {
      // Move the shape
      const item = state.shapeItems.find(s => s.id === state.shapeDragId);
      if (item && item.el) {
        const dx = x - state.shapeDragOffX - item.x;
        const dy = y - state.shapeDragOffY - item.y;
        
        const nx = x - state.shapeDragOffX;
        const ny = y - state.shapeDragOffY;
        item.x = nx; item.y = ny;
        item.el.style.left = nx + 'px';
        item.el.style.top = ny + 'px';
        
        // Update start/end coordinates for lines
        if (item.type === 'line' && item.startX !== undefined) {
          item.startX += dx;
          item.startY += dy;
          item.endX += dx;
          item.endY += dy;
          // Redraw the element with updated coordinates
          drawShapeOnElement(item.el, item);
        }
      }
    }
  } else {
    // Release drag
    if (state.shapeDragActive) {
      const item = state.shapeItems.find(s => s.id === state.shapeDragId);
      if (item && item.el) {
        item.el.classList.remove('selected');
        // Redraw the shape on canvas at the new position when drag ends
        drawShapeOnCanvas(item);
      }
    }
    state.shapeDragActive = false;
    state.shapeDragId = null;
  }
}

function createTempShape(x, y) {
  const id = ++shapeIdCounter;
  const el = document.createElement('div');
  el.className = 'shape-item';
  el.style.position = 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = '0px';
  el.style.height = '0px';
  el.style.border = `3px solid ${state.color}`;
  el.style.pointerEvents = 'all';
  el.style.cursor = 'grab';
  el.dataset.id = id;
  textLayer.appendChild(el);

  const item = { id, type: state.currentShape, x, y, width: 0, height: 0, color: state.color, el, isPlaced: false };
  state.shapeItems.push(item);
  drawShapeOnElement(el, item);
}

function updateTempShape(x, y) {
  const item = state.shapeItems[state.shapeItems.length - 1];
  if (!item || item.isPlaced) return;

  if (item.type === 'line') {
    // For line, keep start position fixed, extend to cursor
    const width = x - state.shapeStartX;
    const height = y - state.shapeStartY;
    
    item.width = Math.abs(width);
    item.height = Math.abs(height);
    // Keep original start position
    item.x = state.shapeStartX;
    item.y = state.shapeStartY;
    
    // For negative direction, we need to adjust the element position
    const actualX = width < 0 ? x : state.shapeStartX;
    const actualY = height < 0 ? y : state.shapeStartY;
    
    item.el.style.left = actualX + 'px';
    item.el.style.top = actualY + 'px';
    item.el.style.width = item.width + 'px';
    item.el.style.height = item.height + 'px';
    
    // Store the actual start point for drawing
    item.startX = state.shapeStartX;
    item.startY = state.shapeStartY;
    item.endX = x;
    item.endY = y;
  } else {
    // For other shapes, use bounding box
    const width = Math.abs(x - state.shapeStartX);
    const height = Math.abs(y - state.shapeStartY);
    const newX = Math.min(x, state.shapeStartX);
    const newY = Math.min(y, state.shapeStartY);

    item.width = width;
    item.height = height;
    item.x = newX;
    item.y = newY;

    item.el.style.left = newX + 'px';
    item.el.style.top = newY + 'px';
    item.el.style.width = width + 'px';
    item.el.style.height = height + 'px';
  }

  drawShapeOnElement(item.el, item);
}

function placeShape() {
  const item = state.shapeItems[state.shapeItems.length - 1];
  if (!item || item.isPlaced) return;

  saveState();
  item.isPlaced = true;
  item.el.classList.add('placed');

  // Draw the shape permanently on the canvas
  drawShapeOnCanvas(item);

  // Keep the DOM element for dragging
  showToast('Shape placed! Use eraser to remove');
}

function drawShapeOnElement(el, item) {
  el.innerHTML = '';
  el.style.background = 'transparent';
  
  if (item.type === 'line') {
    // For line, use the actual start and end coordinates
    const x1 = item.startX !== undefined ? (item.startX - item.x) : 0;
    const y1 = item.startY !== undefined ? (item.startY - item.y) : 0;
    const x2 = item.endX !== undefined ? (item.endX - item.x) : item.width;
    const y2 = item.endY !== undefined ? (item.endY - item.y) : item.height;
    
    // Calculate the bounding box for the SVG
    const svgX = Math.min(x1, x2);
    const svgY = Math.min(y1, y2);
    const svgWidth = Math.abs(x2 - x1) || 1;
    const svgHeight = Math.abs(y2 - y1) || 1;
    
    el.innerHTML = `<svg width="100%" height="100%" style="position:absolute;top:0;left:0;overflow:visible">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${item.color}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
    el.style.border = 'none';
  } else if (item.type === 'square') {
    const size = Math.max(item.width, item.height);
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.innerHTML = `<svg width="100%" height="100%" style="position:absolute;top:0;left:0">
      <rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="${item.color}" stroke-width="3"/>
    </svg>`;
    el.style.border = 'none';
  } else if (item.type === 'triangle') {
    el.innerHTML = `<svg width="100%" height="100%" style="position:absolute;top:0;left:0">
      <polygon points="${item.width/2},0 ${item.width},${item.height} 0,${item.height}" fill="none" stroke="${item.color}" stroke-width="3"/>
    </svg>`;
    el.style.border = 'none';
  } else if (item.type === 'circle') {
    const radius = Math.min(item.width, item.height) / 2;
    const cx = item.width / 2;
    const cy = item.height / 2;
    el.innerHTML = `<svg width="100%" height="100%" style="position:absolute;top:0;left:0">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${item.color}" stroke-width="3"/>
    </svg>`;
    el.style.border = 'none';
  }
  // Rectangle uses default border styling
}

function drawShapeOnCanvas(item) {
  dCtx.globalCompositeOperation = 'source-over';
  dCtx.strokeStyle = item.color;
  dCtx.lineWidth = state.brushSize;
  dCtx.lineCap = 'round';
  dCtx.lineJoin = 'round';

  if (item.type === 'line') {
    dCtx.beginPath();
    dCtx.moveTo(item.startX || state.shapeStartX, item.startY || state.shapeStartY);
    dCtx.lineTo(item.endX || (item.x + item.width), item.endY || (item.y + item.height));
    dCtx.stroke();
  } else if (item.type === 'square') {
    const size = Math.max(item.width, item.height);
    dCtx.strokeRect(item.x, item.y, size, size);
  } else if (item.type === 'rectangle') {
    dCtx.strokeRect(item.x, item.y, item.width, item.height);
  } else if (item.type === 'triangle') {
    dCtx.beginPath();
    dCtx.moveTo(item.x + item.width / 2, item.y);
    dCtx.lineTo(item.x + item.width, item.y + item.height);
    dCtx.lineTo(item.x, item.y + item.height);
    dCtx.closePath();
    dCtx.stroke();
  } else if (item.type === 'circle') {
    const radius = Math.min(item.width, item.height) / 2;
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    dCtx.beginPath();
    dCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    dCtx.stroke();
  }
}

function clearShapeFromCanvas(item) {
  const padding = state.brushSize + 10;
  
  if (item.type === 'line') {
    // For lines, clear a bounding box around the entire line
    const minX = Math.min(item.startX || item.x, item.endX || (item.x + item.width));
    const minY = Math.min(item.startY || item.y, item.endY || (item.y + item.height));
    const maxX = Math.max(item.startX || item.x, item.endX || (item.x + item.width));
    const maxY = Math.max(item.startY || item.y, item.endY || (item.y + item.height));
    
    const clearX = minX - padding;
    const clearY = minY - padding;
    const clearW = (maxX - minX) + padding * 2;
    const clearH = (maxY - minY) + padding * 2;
    
    dCtx.save();
    dCtx.globalCompositeOperation = 'destination-out';
    dCtx.fillRect(clearX, clearY, clearW, clearH);
    dCtx.restore();
  } else {
    // For other shapes, use the bounding box
    const clearX = item.x - padding;
    const clearY = item.y - padding;
    const clearW = item.width + padding * 2;
    const clearH = item.height + padding * 2;
    
    dCtx.save();
    dCtx.globalCompositeOperation = 'destination-out';
    dCtx.fillRect(clearX, clearY, clearW, clearH);
    dCtx.restore();
  }
}