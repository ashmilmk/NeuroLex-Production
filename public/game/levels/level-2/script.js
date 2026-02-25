/* script.js
   All client-side logic for the Drawing Accuracy Assessment Tool.
   - Handles navigation between steps
   - Implements drawing with mouse + touch (pointer events)
   - Provides pen/eraser/clear functionality
   - Generates reference image from text and compares pixel data
   - Calculates accuracy percentage and shows feedback
*/

/* ---------------------------
   Utility & DOM references
   --------------------------- */
const el = id => document.getElementById(id);

const step1 = el('step1');
const step2 = el('step2');
const step3 = el('step3');

const promptInput = el('promptInput');
const startBtn = el('startBtn');

const displayPrompt = el('displayPrompt');
const drawingCanvas = el('drawingCanvas');
const guideCanvas = el('guideCanvas');

const penBtn = el('penBtn');
const eraserBtn = el('eraserBtn');
const clearBtn = el('clearBtn');
const submitBtn = el('submitBtn');
const backToStart = el('backToStart');

const sizeRange = el('sizeRange');
const colorPicker = el('colorPicker');

const resultPrompt = el('resultPrompt');
const childPreview = el('childPreview');
const accuracyValue = el('accuracyValue');
const accuracyFeedback = el('accuracyFeedback');
const refPreview = el('refPreview');

const retryBtn = el('retryBtn');
const downloadBtn = el('downloadBtn');
const viewProgressBtn = el('viewProgressBtn');
const goHomeBtn = el('goHomeBtn');

/* ---------------------------
   App state
   --------------------------- */
let tool = 'pen';
let color = '#000000';
let size = 6;
let drawing = false;
let lastPoint = null;
let drawingStartTime = null;

/* Use fixed logical canvas size for consistent comparison */
const CANVAS_W = 900;
const CANVAS_H = 360;

/* Setup canvases with DPR scaling for crisp strokes */
function setupCanvasScaling(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = CANVAS_W * dpr;
  canvas.height = CANVAS_H * dpr;
  canvas.style.width = CANVAS_W + 'px';
  canvas.style.height = CANVAS_H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}

const drawCtx = setupCanvasScaling(drawingCanvas);
const guideCtx = setupCanvasScaling(guideCanvas);

/* Initialize drawing canvas (transparent background) */
function initDrawingCanvas() {
  // Clear to transparent
  drawCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // White background is not drawn so that text underneath is visible
}

/* Draw guide text on guideCanvas (disabled visually by default;
   kept for reference if you want to display a faint guide). */
function drawGuideText(text) {
  guideCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  guideCtx.save();
  guideCtx.fillStyle = 'rgba(0,0,0,0.08)';
  const fontSize = Math.min(80, CANVAS_H * 0.28);
  guideCtx.font = `bold ${fontSize}px "Comic Sans MS", sans-serif`;
  guideCtx.textAlign = 'center';
  guideCtx.textBaseline = 'middle';
  guideCtx.fillText(text, CANVAS_W / 2, CANVAS_H / 2);
  guideCtx.restore();
}

/* ---------------------------
   Navigation
   --------------------------- */
function showStep(stepEl) {
  [step1, step2, step3].forEach(s => s.classList.add('hidden'));
  stepEl.classList.remove('hidden');
}

startBtn.addEventListener('click', () => {
  const text = promptInput.value.trim();
  if (!text) {
    alert('Please enter a sentence or word for the child to draw.');
    promptInput.focus();
    return;
  }
  // Set up UI for drawing step
  displayPrompt.textContent = text;
  resultPrompt.textContent = text;
  // Reset canvases and state
  initDrawingCanvas();
  drawGuideText(text);
  // Ensure the drawing canvas overlays the prompt visually
  drawingStartTime = Date.now();
  showStep(step2);
});

backToStart.addEventListener('click', () => {
  showStep(step1);
});

/* ---------------------------
   Tools: pen / eraser / clear
   --------------------------- */
penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));
clearBtn.addEventListener('click', () => {
  if (!confirm('Clear the entire drawing?')) return;
  drawCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
});

sizeRange.addEventListener('input', (e) => {
  size = Number(e.target.value);
});
colorPicker.addEventListener('input', (e) => {
  color = e.target.value;
});

/* Toggle tool */
function setTool(t) {
  tool = t;
  penBtn.classList.toggle('active', t === 'pen');
  eraserBtn.classList.toggle('active', t === 'eraser');
}

/* Use pointer events for unified mouse/touch */
drawingCanvas.addEventListener('pointerdown', (e) => {
  drawingCanvas.setPointerCapture(e.pointerId);
  drawing = true;
  lastPoint = getCanvasPoint(e);
  drawStroke(lastPoint, lastPoint, true);
});
drawingCanvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getCanvasPoint(e);
  drawStroke(lastPoint, p, false);
  lastPoint = p;
});
window.addEventListener('pointerup', (e) => {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
});

/* Translate pointer event to canvas coordinates (CSS pixels) */
function getCanvasPoint(e) {
  const rect = drawingCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
  return { x, y };
}

/* Draw a stroke segment from p1 to p2 */
function drawStroke(p1, p2, isStart) {
  drawCtx.save();
  if (tool === 'eraser') {
    // Eraser: use destination-out for transparent erasing
    drawCtx.globalCompositeOperation = 'destination-out';
    drawCtx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    drawCtx.globalCompositeOperation = 'source-over';
    drawCtx.strokeStyle = color;
  }
  drawCtx.lineWidth = size;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';

  drawCtx.beginPath();
  if (isStart) {
    drawCtx.moveTo(p1.x, p1.y);
    drawCtx.lineTo(p2.x + 0.001, p2.y + 0.001); // tiny line for click events
  } else {
    drawCtx.moveTo(p1.x, p1.y);
    drawCtx.lineTo(p2.x, p2.y);
  }
  drawCtx.stroke();
  drawCtx.closePath();
  drawCtx.restore();
}

/* ---------------------------
   Submit and compare images
   --------------------------- */
submitBtn.addEventListener('click', () => {
  // Generate image from drawing canvas
  const childDataURL = drawingCanvas.toDataURL('image/png');

  // Create a reference canvas with the same dimensions and draw the prompt text
  const refCanvas = document.createElement('canvas');
  refCanvas.width = CANVAS_W;
  refCanvas.height = CANVAS_H;
  const refCtx = refCanvas.getContext('2d');

  // White background for reference to make text solid
  refCtx.fillStyle = '#ffffff';
  refCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Text styling similar to what a child should replicate
  refCtx.fillStyle = '#000000';
  const fontSize = Math.min(120, CANVAS_H * 0.28);
  refCtx.font = `bold ${fontSize}px "Comic Sans MS", sans-serif`;
  refCtx.textAlign = 'center';
  refCtx.textBaseline = 'middle';

  // Draw multi-line text if it's long
  const text = displayPrompt.textContent || '';
  wrapText(refCtx, text, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W - 40, fontSize * 1.15);

  // Compute similarity
  const childImg = new Image();
  childImg.onload = () => {
    // Create an offscreen canvas to composite a white background + child's drawing
    const compCanvas = document.createElement('canvas');
    compCanvas.width = CANVAS_W;
    compCanvas.height = CANVAS_H;
    const compCtx = compCanvas.getContext('2d');

    // White background so both images share same base
    compCtx.fillStyle = '#ffffff';
    compCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    compCtx.drawImage(childImg, 0, 0, CANVAS_W, CANVAS_H);

    // Now retrieve image data
    const childData = compCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const refData = refCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    const score = compareBinaryOverlap(childData, refData);
    showResult(childDataURL, refCanvas.toDataURL('image/png'), score);
  };
  childImg.src = childDataURL;
});

/* Wrap text function for reference canvas */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + (line ? ' ' : '') + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n];
    } else {
      line = testLine;
    }
  }
  lines.push(line);
  // center block vertically
  const blockHeight = lines.length * lineHeight;
  let startY = y - blockHeight / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }
}

/* Compare child drawing vs reference by binary overlap:
   - Convert both images to binary masks (ink vs background) using alpha/brightness threshold
   - Count pixels where ref is ink (referenceCount)
   - Count pixels where both child and ref are ink (matchCount)
   - Count union for IoU if needed
   - Final accuracy: primarily matchCount/referenceCount, with smoothing if union differs
*/
function compareBinaryOverlap(childImageData, refImageData) {
  const width = childImageData.width;
  const height = childImageData.height;
  const totalPixels = width * height;

  let refCount = 0;
  let matchCount = 0;
  let unionCount = 0;
  let childCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    // Determine 'ink' presence: use alpha or darkness
    const refR = refImageData.data[idx];
    const refG = refImageData.data[idx + 1];
    const refB = refImageData.data[idx + 2];
    const refA = refImageData.data[idx + 3];

    const childR = childImageData.data[idx];
    const childG = childImageData.data[idx + 1];
    const childB = childImageData.data[idx + 2];
    const childA = childImageData.data[idx + 3];

    // For reference: text is black on white background, so detect dark pixels
    const refLum = (0.299 * refR + 0.587 * refG + 0.114 * refB);
    const isRefInk = refA > 50 && refLum < 200;

    // For child: detect non-white or non-transparent pixels (stroke)
    const childLum = (0.299 * childR + 0.587 * childG + 0.114 * childB);
    const isChildInk = childA > 50 && childLum < 250;

    if (isRefInk) refCount++;
    if (isChildInk) childCount++;

    if (isRefInk || isChildInk) unionCount++;
    if (isRefInk && isChildInk) matchCount++;
  }

  // Avoid divide-by-zero
  if (refCount === 0) return 0;

  // Primary ratio: how much of reference was covered by child's strokes
  const coverage = matchCount / refCount;

  // Secondary ratio: intersection over union (penalizes extra unrelated strokes)
  const iou = unionCount === 0 ? 0 : matchCount / unionCount;

  // Combine metrics: weighted average (70% coverage, 30% IoU)
  const finalScore = Math.max(0, Math.min(1, coverage * 0.7 + iou * 0.3));

  return Math.round(finalScore * 100);
}

/* Show results in Step 3 */
function showResult(childDataURL, refDataURL, score) {
  childPreview.src = childDataURL;
  // Optionally show reference preview in hidden canvas for download
  const refImg = new Image();
  refImg.onload = () => {
    // Draw reference into visible offscreen canvas (hidden by style)
    refPreview.width = CANVAS_W;
    refPreview.height = CANVAS_H;
    const ctx = refPreview.getContext('2d');
    ctx.drawImage(refImg, 0, 0, CANVAS_W, CANVAS_H);
  };
  refImg.src = refDataURL;

  accuracyValue.textContent = `${score}%`;
  accuracyFeedback.textContent = getFeedback(score);

  // Save the result to localStorage and database
  saveDrawingResult(score);

  showStep(step3);
}

/* Merge drawing result into the Level 1 assessment entry */
function saveDrawingResult(score) {
  const drawingTime = Date.now() - (drawingStartTime || Date.now());

  // Assess dysgraphia based on drawing accuracy
  const drawingDisorder = score < 60 ? {
    name: 'Dysgraphia (Drawing)',
    description: 'Drawing/writing accuracy needs improvement',
    percentage: score,
    severity: score < 40 ? 'High' : 'Moderate',
    icon: '✏️'
  } : null;

  // --- Merge into Level 1 localStorage entry ---
  const pendingId = localStorage.getItem('pendingLevel1ResultId');
  const gameResults = JSON.parse(localStorage.getItem('gameResults') || '[]');

  let mergedResult = null;

  if (pendingId) {
    // Find the Level 1 entry by its ID
    const idx = gameResults.findIndex(r => String(r.id) === pendingId);
    if (idx !== -1) {
      mergedResult = gameResults[idx];
      // Add drawing accuracy to talent scores
      mergedResult.talentScores.drawingAccuracy = score;
      // Add drawing time to total time
      mergedResult.totalTime = (mergedResult.totalTime || 0) + drawingTime;
      // Increment challenges completed
      mergedResult.challengesCompleted = (mergedResult.challengesCompleted || 0) + 1;
      // Add dysgraphia drawing disorder if applicable
      if (drawingDisorder) {
        if (!mergedResult.disorders) mergedResult.disorders = [];
        mergedResult.disorders.push(drawingDisorder);
      }
      // Update the localStorage entry in-place
      gameResults[idx] = mergedResult;
      localStorage.setItem('gameResults', JSON.stringify(gameResults));
      console.log('Drawing result merged into Level 1 entry:', mergedResult);
    }
  }

  // If no Level 1 entry found, save as a standalone entry (fallback)
  if (!mergedResult) {
    const playerName = localStorage.getItem('userName') || 'Student';
    mergedResult = {
      id: Date.now(),
      date: new Date().toISOString(),
      playerName: playerName,
      ageGroup: 'drawing',
      score: score,
      totalPossible: 100,
      percentage: score,
      talentScores: { drawingAccuracy: score },
      disorders: drawingDisorder ? [drawingDisorder] : [],
      challengesCompleted: 1,
      totalTime: drawingTime
    };
    gameResults.push(mergedResult);
    if (gameResults.length > 50) {
      gameResults.splice(0, gameResults.length - 50);
    }
    localStorage.setItem('gameResults', JSON.stringify(gameResults));
    console.log('Drawing result saved as standalone (no Level 1 found):', mergedResult);
  }

  // Clean up pending references
  localStorage.removeItem('pendingLevel1ResultId');

  // --- Update database: delete old Level 1 entry and save merged version ---
  const token = localStorage.getItem('token') || localStorage.getItem('studentToken');
  const pendingDbId = localStorage.getItem('pendingLevel1DbId');
  const isConsultantSession = localStorage.getItem('pendingConsultantSession') === 'true';
  const consultantStudentId = localStorage.getItem('pendingConsultantStudentId') || '';

  // Clean up all pending flags
  localStorage.removeItem('pendingLevel1DbId');
  localStorage.removeItem('pendingConsultantSession');
  localStorage.removeItem('pendingConsultantStudentId');

  // Choose endpoints based on session type
  const deleteEndpoint = isConsultantSession
    ? `/api/progress/assessment-result/${pendingDbId}`
    : `/api/progress/game-result/${pendingDbId}`;
  const saveEndpoint = isConsultantSession
    ? '/api/progress/assessment-result'
    : '/api/progress/game-result';

  if (token) {
    // If we have a DB ID from Level 1, delete it first then save the merged version
    const deletePromise = pendingDbId
      ? fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(err => console.warn('Could not delete old DB entry:', err))
      : Promise.resolve();

    deletePromise.then(() => {
      fetch(saveEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          playerName: mergedResult.playerName,
          ageGroup: mergedResult.ageGroup,
          score: mergedResult.score,
          totalPossible: mergedResult.totalPossible,
          percentage: mergedResult.percentage,
          challengesCompleted: mergedResult.challengesCompleted,
          totalTime: mergedResult.totalTime,
          talentScores: mergedResult.talentScores,
          disorders: mergedResult.disorders,
          studentId: isConsultantSession
            ? consultantStudentId
            : (localStorage.getItem('studentId') || '')
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            console.log('Merged result saved to database:', data.gameResult || data.assessmentResult);
          } else {
            console.warn('Failed to save merged result:', data.message);
          }
        })
        .catch(err => console.warn('Could not save to database:', err));
    });
  }
}

/* Map score to feedback */
function getFeedback(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  return 'Needs Practice';
}

/* Retry button resets to step1 with cleared input */
retryBtn.addEventListener('click', () => {
  promptInput.value = '';
  showStep(step1);
});

/* Download combined result image */
downloadBtn.addEventListener('click', () => {
  // Create a combined canvas with prompt, drawing and score
  const outW = 1000;
  const outH = 600;
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  // Prompt area
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 28px "Comic Sans MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(resultPrompt.textContent, outW / 2, 50);

  // Child drawing
  const childImg = new Image();
  childImg.onload = () => {
    ctx.drawImage(childImg, 50, 80, outW - 100, 360);

    // Accuracy footer
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 36px "Comic Sans MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${accuracyValue.textContent} - ${accuracyFeedback.textContent}`, outW / 2, outH - 40);

    // Trigger download
    const link = document.createElement('a');
    link.download = 'drawing_accuracy_result.png';
    link.href = out.toDataURL('image/png');
    link.click();
  };
  childImg.src = childPreview.src;
  childImg.src = childPreview.src;
});

/* Navigation Buttons */
if (viewProgressBtn) {
  viewProgressBtn.addEventListener('click', () => {
    // Navigate to progress page - relative path from levels/level-2/
    window.location.href = '../../../progress.html';
  });
}

if (goHomeBtn) {
  goHomeBtn.addEventListener('click', () => {
    // Navigate to home dashboard
    window.location.href = '../../../consultant-dashboard.html';
  });
}

/* Initialize UI defaults */
(function init() {
  setTool('pen');
  initDrawingCanvas();
  drawGuideText('Sample'); // not visible by default
  showStep(step1);
})();