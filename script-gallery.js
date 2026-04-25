// script-gallery.js
// ═══════════════════════════════════════════════════════
// SAVE / GALLERY
// ═══════════════════════════════════════════════════════
document.getElementById('saveBtn').addEventListener('click', saveArtwork);
document.getElementById('clearBtn').addEventListener('click', clearCanvas);
document.getElementById('galleryBtn').addEventListener('click', () => showScreen('gallery'));
document.getElementById('backBtn').addEventListener('click', () => showScreen('main'));

// Select all checkbox
selectAllCheckbox.addEventListener('change', (e) => {
  if (e.target.checked) {
    state.gallery.forEach(item => state.selectedGalleryItems.add(item.id));
  } else {
    state.selectedGalleryItems.clear();
  }
  renderGallery();
});

// Export button
exportBtn.addEventListener('click', () => {
  exportModal.style.display = 'flex';
});

// Delete button
deleteBtn.addEventListener('click', async () => {
  const selectedItems = Array.from(state.selectedGalleryItems);
  if (selectedItems.length === 0) return;
  
  console.log('Deleting items:', selectedItems);
  
  if (confirm(`Are you sure you want to delete ${selectedItems.length} artwork${selectedItems.length > 1 ? 's' : ''}?`)) {
    showLoading('Deleting artwork...');
    
    try {
      // Delete from server one by one for better error handling
      for (const id of selectedItems) {
        const numericId = parseInt(id);
        console.log('Deleting artwork ID:', numericId, '(original:', id, ')');
        
        if (!isNaN(numericId)) {
          await deleteArtworkFromServer(numericId);
        } else {
          console.error('Invalid ID format:', id);
        }
      }
      
      // Remove from local state
      state.gallery = state.gallery.filter(item => !state.selectedGalleryItems.has(item.id));
      state.selectedGalleryItems.clear();
      
      renderGallery();
      hideLoading();
      showToast(`Deleted ${selectedItems.length} artwork${selectedItems.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error deleting artwork:', error);
      hideLoading();
      showToast('Error deleting artwork: ' + error.message);
    }
  }
});

// Cancel export
cancelExportBtn.addEventListener('click', () => {
  exportModal.style.display = 'none';
});

// Export format buttons
document.querySelectorAll('.export-format-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const format = btn.dataset.format;
    exportModal.style.display = 'none';
    const selectedItems = state.gallery.filter(item => state.selectedGalleryItems.has(item.id));
    await exportSelectedItems(selectedItems, format);
  });
});

function clearCanvas() {
  saveState();
  dCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  state.textItems.forEach(item => item.el.remove());
  state.textItems = [];
  state.shapeItems.forEach(item => { if(item.el) item.el.remove(); });
  state.shapeItems = [];
  showToast('Canvas cleared');
}

async function saveArtwork() {
  // Flash
  saveFlash.style.opacity = '1';
  setTimeout(() => saveFlash.style.opacity = '0', 200);

  const w = drawCanvas.width, h = drawCanvas.height;
  const offscreen = document.createElement('canvas');
  offscreen.width = w; offscreen.height = h;
  const ctx = offscreen.getContext('2d');

  // 1. Template image background
  ctx.drawImage(templateImg, 0, 0, w, h);

  // 2. Drawing
  ctx.drawImage(drawCanvas, 0, 0);

  // 3. Shape items
  state.shapeItems.filter(s => s.isPlaced).forEach(item => {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (item.type === 'square') {
      const size = Math.max(item.width, item.height);
      ctx.strokeRect(item.x, item.y, size, size);
    } else if (item.type === 'rectangle') {
      ctx.strokeRect(item.x, item.y, item.width, item.height);
    } else if (item.type === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(item.x + item.width / 2, item.y);
      ctx.lineTo(item.x + item.width, item.y + item.height);
      ctx.lineTo(item.x, item.y + item.height);
      ctx.closePath();
      ctx.stroke();
    } else if (item.type === 'circle') {
      const radius = Math.min(item.width, item.height) / 2;
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  // 4. Text items
  state.textItems.forEach(item => {
    ctx.font = 'bold 28px Space Mono, monospace';
    ctx.fillStyle = item.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(item.text, item.x, item.y + 28);
    ctx.shadowBlur = 0;
  });

  const dataURL = offscreen.toDataURL('image/png');
  const ts = new Date().toLocaleTimeString();
  
  // Save full state for loading back
  const drawingData = drawCanvas.toDataURL();
  const textItemsData = state.textItems.map(item => ({
    id: item.id,
    text: item.text,
    x: item.x,
    y: item.y,
    color: item.color
  }));
  const shapeItemsData = state.shapeItems.filter(s => s.isPlaced).map(item => ({
    id: item.id,
    type: item.type,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    color: item.color,
    isPlaced: item.isPlaced
  }));
  
  try {
    // Save to server
    const savedArtwork = await saveArtworkToServer({
      dataURL,
      timestamp: ts,
      drawingData,
      textItemsData,
      shapeItemsData
    });
    
    // Add to local state
    state.gallery.unshift({ 
      dataURL, 
      timestamp: ts, 
      id: savedArtwork.id,
      drawingData,
      textItemsData,
      shapeItemsData
    });
    
    renderGallery();
  } catch (error) {
    console.error('Failed to save artwork:', error);
    showToast('Failed to save artwork: ' + error.message);
  }
}

function renderGallery() {
  if (state.gallery.length === 0) {
    galleryGrid.innerHTML = '<div class="gallery-empty">No artwork saved yet.<br>Draw something and hit 💾</div>';
    exportBtn.classList.remove('visible');
    return;
  }
  galleryGrid.innerHTML = '';
  state.gallery.forEach(item => {
    // Skip items without dataURL
    if (!item.dataURL) {
      console.warn('Skipping gallery item without dataURL:', item);
      return;
    }
    
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = item.id;
    if (state.selectedGalleryItems.has(item.id)) {
      card.classList.add('selected');
    }
    // item.dataURL now contains Supabase Storage public URL or base64
    card.innerHTML = `
      <input type="checkbox" class="card-checkbox" data-id="${item.id}" ${state.selectedGalleryItems.has(item.id) ? 'checked' : ''}>
      <img class="gallery-thumb" src="${item.dataURL}" alt="Artwork" data-id="${item.id}" onerror="this.style.display='none';this.parentElement.querySelector('.error-placeholder').style.display='block';">
      <div class="error-placeholder" style="display:none;padding:20px;text-align:center;color:var(--muted);font-size:0.7rem;">Image unavailable</div>
      <div class="gallery-actions">
        <button class="load-btn" data-id="${item.id}">📂 Load</button>
        <button class="dl-btn" data-id="${item.id}" data-type="png">⬇ PNG</button>
        <button class="dl-btn pdf" data-id="${item.id}" data-type="pdf">⬇ PDF+Text</button>
        <button class="dl-btn pptx" data-id="${item.id}" data-type="pptx">⬇ PPTX</button>
      </div>
    `;
    galleryGrid.appendChild(card);
  });

  // Card checkbox handlers
  galleryGrid.querySelectorAll('.card-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const card = e.target.closest('.gallery-card');
      if (e.target.checked) {
        state.selectedGalleryItems.add(id);
        card.classList.add('selected');
      } else {
        state.selectedGalleryItems.delete(id);
        card.classList.remove('selected');
      }
      updateExportButton();
      updateSelectAllCheckbox();
    });
  });

  galleryGrid.querySelectorAll('.load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const item = state.gallery.find(g => g.id === id);
      if (item) loadArtwork(item);
    });
  });

  galleryGrid.querySelectorAll('.dl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const type = btn.dataset.type;
      const item = state.gallery.find(g => g.id === id);
      if (item) downloadItem(item, type);
    });
  });

  updateExportButton();
  updateSelectAllCheckbox();
}

function updateExportButton() {
  if (state.selectedGalleryItems.size > 0) {
    exportBtn.classList.add('visible');
    exportBtn.textContent = `📤 Export Selected (${state.selectedGalleryItems.size})`;
    deleteBtn.style.display = 'inline-block';
    deleteBtn.textContent = `🗑️ Delete Selected (${state.selectedGalleryItems.size})`;
  } else {
    exportBtn.classList.remove('visible');
    deleteBtn.style.display = 'none';
  }
}

function updateSelectAllCheckbox() {
  if (state.gallery.length === 0) {
    selectAllCheckbox.checked = false;
    return;
  }
  const allSelected = state.gallery.every(item => state.selectedGalleryItems.has(item.id));
  selectAllCheckbox.checked = allSelected && state.selectedGalleryItems.size > 0;
}

async function downloadItem(item, type) {
  showLoading(`Exporting as ${type.toUpperCase()}…`);
  try {
    if (type === 'png') {
      // If dataURL is a Supabase Storage URL, fetch the image first
      if (item.dataURL.startsWith('http')) {
        const response = await fetch(item.dataURL);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `airdraw-${item.id}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        // Fallback for base64
        const a = document.createElement('a');
        a.href = item.dataURL;
        a.download = `airdraw-${item.id}.png`;
        a.click();
      }

    } else if (type === 'pdf') {
      await createTypablePDF(item);

    } else if (type === 'pptx') {
      await exportPPTX(item);
    }
    showToast(`Downloaded as ${type.toUpperCase()}!`);
  } catch(e) {
    showToast('Export failed: ' + e.message);
    console.error(e);
  }
  hideLoading();
}

async function loadArtwork(item) {
  showLoading('Loading artwork…');

  saveState();

  // Clear current canvas and items
  dCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  state.textItems.forEach(t => t.el.remove());
  state.textItems = [];
  state.shapeItems.forEach(s => { if(s.el) s.el.remove(); });
  state.shapeItems = [];

  // Load drawing canvas
  if (item.drawingData) {
    const img = new Image();
    img.onload = () => {
      dCtx.drawImage(img, 0, 0);
    };
    img.src = item.drawingData;
  }

  // Load text items
  if (item.textItemsData && item.textItemsData.length > 0) {
    item.textItemsData.forEach(data => {
      const el = document.createElement('div');
      el.className = 'text-item';
      el.textContent = data.text;
      el.style.left = data.x + 'px';
      el.style.top = data.y + 'px';
      el.style.color = data.color;
      el.dataset.id = data.id;
      el.contentEditable = 'false';
      textLayer.appendChild(el);

      const textItem = {
        id: data.id,
        text: data.text,
        x: data.x,
        y: data.y,
        color: data.color,
        el: el
      };
      state.textItems.push(textItem);

      // Add mouse drag support
      el.addEventListener('mousedown', e => startMouseDrag(e, textItem));
      // Add double-click to edit
      el.addEventListener('dblclick', e => {
        e.preventDefault();
        e.stopPropagation();
        startEditing(textItem);
      });
    });
  }

  // Load shape items
  if (item.shapeItemsData && item.shapeItemsData.length > 0) {
    item.shapeItemsData.forEach(data => {
      const el = document.createElement('div');
      el.className = 'shape-item';
      el.style.position = 'absolute';
      el.style.left = data.x + 'px';
      el.style.top = data.y + 'px';
      el.style.width = data.width + 'px';
      el.style.height = data.height + 'px';
      el.style.border = `3px solid ${data.color}`;
      el.style.pointerEvents = 'all';
      el.style.cursor = 'grab';
      el.dataset.id = data.id;
      textLayer.appendChild(el);

      const item = {
        id: data.id,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        color: data.color,
        el: el,
        isPlaced: data.isPlaced
      };
      state.shapeItems.push(item);
      drawShapeOnElement(el, item);
    });
  }

  hideLoading();
  showScreen('main');
  showToast('Artwork loaded! Text is editable ✓');
}

async function exportPPTX(item) {
  // Build a minimal PPTX using JSZip + OOXML
  const JSZip = window.JSZip;
  const zip = new JSZip();
  let imgData;
  
  // If dataURL is a Supabase Storage URL, fetch the image
  if (item.dataURL.startsWith('http')) {
    const response = await fetch(item.dataURL);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    imgData = arrayBuffer;
  } else {
    // Fallback for base64
    imgData = item.dataURL.split(',')[1];
  }
  
  const W = 9144000, H = 5143500; // EMU for 16:9

  zip.folder('ppt/media').file('image1.png', imgData, {base64:!item.dataURL.startsWith('http')});

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Default Extension="png" ContentType="image/png"/>
</Types>`);

  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

  zip.folder('ppt/_rels').file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`);

  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst>
<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>
<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

  zip.folder('ppt/slides/_rels').file('slide1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);

  zip.folder('ppt/slides').file('slide1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
<p:pic><p:nvPicPr><p:cNvPr id="2" name="img"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic></p:spTree></p:cSld>
</p:sld>`);

  // Minimal slide master and layout
  zip.folder('ppt/slideMasters/_rels').file('slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  zip.folder('ppt/slideMasters').file('slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);

  zip.folder('ppt/slideLayouts/_rels').file('slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);
  zip.folder('ppt/slideLayouts').file('slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy:0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
</p:sldLayout>`);

  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `airdraw-${item.id}.pptx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function exportSelectedItems(items, format) {
  if (items.length === 0) {
    showToast('No items selected');
    return;
  }

  showLoading(`Exporting ${items.length} items as ${format.toUpperCase()}…`);
  
  try {
    if (format === 'zip') {
      await exportAsZip(items);
    } else if (format === 'pdf') {
      await exportAsPDFWithOCR(items);
    } else if (format === 'pptx') {
      await exportAsPPTXMultiple(items);
    }
    showToast(`Exported ${items.length} items as ${format.toUpperCase()}!`);
  } catch(e) {
    showToast('Export failed: ' + e.message);
    console.error(e);
  }
  hideLoading();
}

async function exportAsZip(items) {
  const JSZip = window.JSZip;
  const zip = new JSZip();
  
  for (const item of items) {
    // If dataURL is a Supabase Storage URL, fetch the image
    if (item.dataURL.startsWith('http')) {
      const response = await fetch(item.dataURL);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      zip.file(`airdraw-${item.id}.png`, arrayBuffer);
    } else {
      // Fallback for base64
      const imgData = item.dataURL.split(',')[1];
      zip.file(`airdraw-${item.id}.png`, imgData, {base64:true});
    }
  }
  
  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `airdraw-export-${Date.now()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function createTypablePDF(item) {
  if (!window.jspdf) {
    showToast('jsPDF library not loaded');
    throw new Error('jsPDF library not available');
  }
  
  const { jsPDF } = window.jspdf;
  
  // Create PDF
  const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:'a4' });
  const a4Width = 595.28;
  const a4Height = 841.89;
  const margin = 50;
  const contentWidth = a4Width - (margin * 2);
  
  // Extract text from stored text data
  let extractedText = '';
  let hasTextContent = false;
  
  if (item.textItemsData && item.textItemsData.length > 0) {
    hasTextContent = true;
    // Sort text items by Y position, then by X position for natural reading order
    const sortedTexts = [...item.textItemsData].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 30) { // Same line (within 30px)
        return a.x - b.x; // Sort by X position
      }
      return a.y - b.y; // Sort by Y position
    });
    
    extractedText = sortedTexts.map(textItem => textItem.text).join(' ');
  }
  
  // Add header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  const headerText = 'Beyond The Brush - AirDraw';
  const headerWidth = pdf.getTextWidth(headerText);
  pdf.text(headerText, (a4Width - headerWidth) / 2, 40);
  
  // Add line below header
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(1);
  pdf.line(margin, 55, a4Width - margin, 55);
  
  let currentY = 80;
  
  // Add extracted text if available
  if (hasTextContent && extractedText.trim().length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Extracted Text:', margin, currentY);
    currentY += 25;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    // Word wrap the text
    const lines = pdf.splitTextToSize(extractedText, contentWidth);
    
    lines.forEach((line, index) => {
      if (currentY + (index * 18) < a4Height - 150) { // Leave space for image
        pdf.text(line, margin, currentY + (index * 18));
      }
    });
    
    currentY += lines.length * 18 + 20;
  }
  
  // Add the image below text
  if (currentY < a4Height - 150) { // Ensure we have space for image
    let imageData = item.dataURL;
    
    // If dataURL is a Supabase Storage URL, fetch the image as base64
    if (item.dataURL.startsWith('http')) {
      const response = await fetch(item.dataURL);
      const blob = await response.blob();
      imageData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    
    // Load image to get dimensions
    const img = new Image();
    img.src = imageData;
    await new Promise(resolve => {
      if (img.complete) resolve();
      else img.onload = resolve;
    });
    
    // Calculate image dimensions to fit within page
    const imgWidth = contentWidth;
    const imgHeight = (imgWidth / (img.naturalWidth || 1280)) * (img.naturalHeight || 720);
    const maxHeight = a4Height - currentY - 30;
    
    let finalWidth = imgWidth;
    let finalHeight = imgHeight;
    
    if (imgHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = (maxHeight / imgHeight) * imgWidth;
    }
    
    // Center the image
    const imgX = (a4Width - finalWidth) / 2;
    
    // Add image
    pdf.addImage(imageData, 'PNG', imgX, currentY, finalWidth, finalHeight);
    
    // Add border around image
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(imgX, currentY, finalWidth, finalHeight);
  }
  
  pdf.save(`airdraw-${item.id}.pdf`);
}

async function exportAsPDFWithOCR(items) {
  // Check if required libraries are available
  if (!window.jspdf) {
    showToast('jsPDF library not loaded');
    throw new Error('jsPDF library not available');
  }
  
  const { jsPDF } = window.jspdf;
  
  // Create a single PDF for all items
  const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:'a4' });
  const a4Width = 595.28;
  const a4Height = 841.89;
  const margin = 50;
  const contentWidth = a4Width - (margin * 2);
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    showLoading(`Processing item ${i + 1}/${items.length}…`);
    
    try {
      // Extract text from stored text data
      let extractedText = '';
      let hasTextContent = false;
      
      if (item.textItemsData && item.textItemsData.length > 0) {
        hasTextContent = true;
        // Sort text items by Y position, then by X position for natural reading order
        const sortedTexts = [...item.textItemsData].sort((a, b) => {
          if (Math.abs(a.y - b.y) < 30) { // Same line (within 30px)
            return a.x - b.x; // Sort by X position
          }
          return a.y - b.y; // Sort by Y position
        });
        
        extractedText = sortedTexts.map(textItem => textItem.text).join(' ');
      }
      
      // PAGE 1: Text page (if text exists)
      if (hasTextContent && extractedText.trim().length > 0) {
        if (i > 0) pdf.addPage([a4Width, a4Height]); // Add new page for text (except first item)
        
        // Add header
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        const headerText = `Beyond The Brush - Artwork ${i + 1}`;
        const headerWidth = pdf.getTextWidth(headerText);
        pdf.text(headerText, (a4Width - headerWidth) / 2, 40);
        
        // Add line below header
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(1);
        pdf.line(margin, 55, a4Width - margin, 55);
        
        // Add extracted text section
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Extracted Text:', margin, 80);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        let currentY = 110;
        // Word wrap the text
        const lines = pdf.splitTextToSize(extractedText, contentWidth);
        
        lines.forEach((line, index) => {
          if (currentY + (index * 18) < a4Height - 50) {
            pdf.text(line, margin, currentY + (index * 18));
          }
        });
      }
      
      // PAGE 2: Image page
      pdf.addPage([a4Width, a4Height]);
      
      // Add header for image page
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      const imageHeaderText = `Beyond The Brush - Artwork ${i + 1} (Image)`;
      const imageHeaderWidth = pdf.getTextWidth(imageHeaderText);
      pdf.text(imageHeaderText, (a4Width - imageHeaderWidth) / 2, 40);
      
      // Add line below header
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(1);
      pdf.line(margin, 55, a4Width - margin, 55);
      
      // Handle image data - fetch from Supabase Storage if needed
      let imageData = item.dataURL;
      if (item.dataURL.startsWith('http')) {
        const response = await fetch(item.dataURL);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }
      
      // Load image to get dimensions
      const img = new Image();
      img.src = imageData;
      await new Promise(resolve => {
        if (img.complete) resolve();
        else img.onload = resolve;
      });
      
      // Calculate image dimensions to fit within page
      const imgWidth = contentWidth;
      const imgHeight = (imgWidth / (img.naturalWidth || 1280)) * (img.naturalHeight || 720);
      const maxHeight = a4Height - 120; // Leave space for header and margin
      
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;
      
      if (imgHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = (maxHeight / imgHeight) * imgWidth;
      }
      
      // Center the image
      const imgX = (a4Width - finalWidth) / 2;
      const imgY = 80;
      
      // Add image
      pdf.addImage(imageData, 'PNG', imgX, imgY, finalWidth, finalHeight);
      
      // Add border around image
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(imgX, imgY, finalWidth, finalHeight);
      
    } catch (e) {
      console.error('Error processing item:', e);
      showToast(`Error processing item: ${e.message}`);
      throw e;
    }
  }
  
  try {
    pdf.save(`airdraw-batch-export-${Date.now()}.pdf`);
  } catch (e) {
    console.error('Error saving PDF:', e);
    showToast('Error saving PDF');
    throw e;
  }
}

async function exportAsPPTXMultiple(items) {
  const JSZip = window.JSZip;
  const zip = new JSZip();
  const W = 9144000, H = 5143500; // EMU for 16:9
  
  // Add all images to media folder
  const mediaFolder = zip.folder('ppt/media');
  for (const [index, item] of items.entries()) {
    let imgData;
    // If dataURL is a Supabase Storage URL, fetch the image
    if (item.dataURL.startsWith('http')) {
      const response = await fetch(item.dataURL);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      imgData = arrayBuffer;
      mediaFolder.file(`image${index + 1}.png`, imgData);
    } else {
      // Fallback for base64
      imgData = item.dataURL.split(',')[1];
      mediaFolder.file(`image${index + 1}.png`, imgData, {base64:true});
    }
  }
  
  // Create slides for each item
  const slides = [];
  const slideRels = [];
  
  items.forEach((item, index) => {
    const slideNum = index + 1;
    slides.push(`<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
<p:pic><p:nvPicPr><p:cNvPr id="2" name="img${slideNum}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic></p:spTree></p:cSld>
</p:sld>`);
    
    slideRels.push(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNum}.png"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  });
  
  // Content Types
  let overrides = `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Default Extension="png" ContentType="image/png"/>`;
  
  items.forEach((item, index) => {
    overrides += `\n<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  });
  
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${overrides}
</Types>`);
  
  // Root rels
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  
  // Presentation rels
  let slideRelsList = items.map((item, index) => 
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
  ).join('\n');
  
  zip.folder('ppt/_rels').file('presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRelsList}
<Relationship Id="rId${items.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
</Relationships>`);
  
  // Presentation XML
  let slideIdList = items.map((item, index) => 
    `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`
  ).join('\n');
  
  zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${items.length + 1}"/></p:sldMasterIdLst>
<p:sldIdLst>${slideIdList}</p:sldIdLst>
<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);
  
  // Add slides and their rels
  const slidesFolder = zip.folder('ppt/slides');
  const slidesRelsFolder = zip.folder('ppt/slides/_rels');
  
  items.forEach((item, index) => {
    const slideNum = index + 1;
    slidesFolder.file(`slide${slideNum}.xml`, slides[index]);
    slidesRelsFolder.file(`slide${slideNum}.xml.rels`, slideRels[index]);
  });
  
  // Slide master and layout (minimal)
  zip.folder('ppt/slideMasters/_rels').file('slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`);
  zip.folder('ppt/slideMasters').file('slideMaster1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy:0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy:0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`);
  
  zip.folder('ppt/slideLayouts/_rels').file('slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`);
  zip.folder('ppt/slideLayouts').file('slideLayout1.xml', `<?xml version="1.0" encoding="UTF-8"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy:0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy:0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
</p:sldLayout>`);
  
  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `airdraw-multiple-${Date.now()}.pptx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ═══════════════════════════════════════════════════════
// SCREEN MANAGEMENT
// ═══════════════════════════════════════════════════════
function showScreen(name) {
  [splash, mainScreen, galleryScreen].forEach(s => s.classList.add('hidden'));
  const map = { splash, main:mainScreen, gallery:galleryScreen };
  map[name].classList.remove('hidden');
  
  // Hide/show main screen elements based on active screen
  const mainElements = [drawCanvas, handCanvas, templateCanvas, videoEl, cursorDot, eraserRing, eraseFlash, 
                        document.getElementById('toolbar'), document.getElementById('hud'), 
                        document.getElementById('topRight'), document.getElementById('gestureHint'),
                        textControls, shapeControls, doneEditingBtn, document.getElementById('brushInfo')];
  
  if (name === 'gallery') {
    // Hide all main screen elements
    mainElements.forEach(el => { if(el) el.style.display = 'none'; });
    textLayer.style.display = 'none';
    renderGallery();
  } else {
    // Show main screen elements
    mainElements.forEach(el => { if(el) el.style.display = ''; });
    textLayer.style.display = '';
  }
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════
function showHint(msg) {
  gestureHint.textContent = msg;
  gestureHint.style.opacity = '1';
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => gestureHint.style.opacity = '0', 2500);
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.style.opacity = '0', 2800);
}

function showLoading(msg='Loading…') {
  loadingText.textContent = msg;
  loading.classList.add('visible');
}
function hideLoading() { loading.classList.remove('visible'); }

// ═══════════════════════════════════════════════════════
// PWA SERVICE WORKER
// ═══════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
resizeCanvases();

startBtn.addEventListener('click', async () => {
  showScreen('main');
  await initHandTracking();
});
