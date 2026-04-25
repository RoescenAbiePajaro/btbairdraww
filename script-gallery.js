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
  
  state.gallery.unshift({ 
    dataURL, 
    timestamp: ts, 
    id: Date.now(),
    drawingData,
    textItemsData,
    shapeItemsData
  });
  renderGallery();
  showToast('Saved to gallery! 🎨');
}

function renderGallery() {
  if (state.gallery.length === 0) {
    galleryGrid.innerHTML = '<div class="gallery-empty">No artwork saved yet.<br>Draw something and hit 💾</div>';
    exportBtn.classList.remove('visible');
    return;
  }
  galleryGrid.innerHTML = '';
  state.gallery.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = item.id;
    if (state.selectedGalleryItems.has(item.id)) {
      card.classList.add('selected');
    }
    card.innerHTML = `
      <input type="checkbox" class="card-checkbox" data-id="${item.id}" ${state.selectedGalleryItems.has(item.id) ? 'checked' : ''}>
      <img class="gallery-thumb" src="${item.dataURL}" alt="Artwork" data-id="${item.id}">
      <div class="gallery-actions">
        <button class="load-btn" data-id="${item.id}">📂 Load</button>
        <button class="dl-btn" data-id="${item.id}" data-type="png">⬇ PNG</button>
        <button class="dl-btn pdf" data-id="${item.id}" data-type="pdf">⬇ PDF</button>
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
  } else {
    exportBtn.classList.remove('visible');
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
      const a = document.createElement('a');
      a.href = item.dataURL;
      a.download = `airdraw-${item.id}.png`;
      a.click();

    } else if (type === 'pdf') {
      const { jsPDF } = window.jspdf;
      const img = new Image();
      img.src = item.dataURL;
      await new Promise(r => img.onload = r);
      const pw = img.naturalWidth || 1280;
      const ph = img.naturalHeight || 720;
      const pdf = new jsPDF({ orientation:'landscape', unit:'px', format:[pw,ph] });
      pdf.addImage(item.dataURL, 'PNG', 0, 0, pw, ph);
      pdf.save(`airdraw-${item.id}.pdf`);

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
      textLayer.appendChild(el);
      
      state.textItems.push({
        id: data.id,
        text: data.text,
        x: data.x,
        y: data.y,
        color: data.color,
        el: el
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
  const imgData = item.dataURL.split(',')[1];
  const W = 9144000, H = 5143500; // EMU for 16:9

  zip.folder('ppt/media').file('image1.png', imgData, {base64:true});

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
    const imgData = item.dataURL.split(',')[1];
    zip.file(`airdraw-${item.id}.png`, imgData, {base64:true});
  }
  
  const blob = await zip.generateAsync({type:'blob'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `airdraw-export-${Date.now()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function exportAsPDFWithOCR(items) {
  // Check if required libraries are available
  if (!window.jspdf) {
    showToast('jsPDF library not loaded');
    throw new Error('jsPDF library not available');
  }
  
  if (!window.Tesseract) {
    showToast('Tesseract.js library not loaded');
    throw new Error('Tesseract.js library not available');
  }
  
  const { jsPDF } = window.jspdf;
  
  // Create a single PDF for all items
  const pdf = new jsPDF({ orientation:'portrait', unit:'px', format:'a4' });
  const a4Width = 595.28;
  const a4Height = 841.89;
  
  for (const item of items) {
    showLoading(`Processing OCR for item ${items.indexOf(item) + 1}/${items.length}…`);
    
    try {
      // Create canvas for OCR
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = item.dataURL;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      const ctx = canvas.getContext('2d');
      
      // Draw the image (text is already composited in the saved image)
      ctx.drawImage(img, 0, 0);
      
      // Perform OCR using Tesseract.js
      let ocrText = '';
      try {
        const result = await Tesseract.recognize(canvas, 'eng', {
          logger: m => {}
        });
        ocrText = result.data.text.trim();
        console.log('OCR Result:', ocrText);
      } catch (e) {
        console.warn('OCR failed:', e);
        ocrText = '';
      }
      
      // Add text page if text exists (separate A4 page)
      if (ocrText && ocrText.length > 0) {
        pdf.setPage(pdf.internal.getNumberOfPages());
        
        // Add header
        pdf.setFontSize(24);
        pdf.setFont('helvetica', 'bold');
        const headerText = 'Beyond The Brush';
        const headerWidth = pdf.getTextWidth(headerText);
        pdf.text(headerText, (a4Width - headerWidth) / 2, 50);
        
        // Add line below header
        pdf.setDrawColor(180, 180, 180);
        pdf.setLineWidth(1);
        pdf.line(50, 60, a4Width - 50, 60);
        
        // Add detected text
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        
        const textY = 90;
        const maxWidth = a4Width - 100;
        const lines = pdf.splitTextToSize(ocrText, maxWidth);
        
        lines.forEach((line, index) => {
          if (textY + (index * 20) < a4Height - 50) {
            pdf.text(line, 50, textY + (index * 20));
          }
        });
        
        // Add new page for image with custom dimensions
        pdf.addPage([canvas.width, canvas.height]);
      } else {
        // No text, just add image page
        pdf.addPage([canvas.width, canvas.height]);
      }
      
      // Add image at full resolution
      pdf.addImage(item.dataURL, 'PNG', 0, 0, canvas.width, canvas.height);
      
      // Add new A4 page for next item (if any)
      if (items.indexOf(item) < items.length - 1) {
        pdf.addPage([a4Width, a4Height]);
      }
    } catch (e) {
      console.error('Error processing item:', e);
      showToast(`Error processing item: ${e.message}`);
      throw e;
    }
  }
  
  try {
    pdf.save(`airdraw-ocr-export-${Date.now()}.pdf`);
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
  items.forEach((item, index) => {
    const imgData = item.dataURL.split(',')[1];
    mediaFolder.file(`image${index + 1}.png`, imgData, {base64:true});
  });
  
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
  if (name === 'gallery') renderGallery();
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
