// ============================================================================
// drawingRender.js — turn saved stroke data into pixels.
// Strokes are stored in the DB as: [{ color, pts: [[x,y], ...], w? }, ...]
// in a fixed 320×230 coordinate space (the drawing canvas size).
// ============================================================================

export const BASE_W = 320;
export const BASE_H = 230;

const CREAM = "#FAF4EA";
const INK = "#4E4036";
const INK_SOFT = "#7A6C5D";
const BLUE = "#466089";
const ROSE = "#D98BAB";

export function drawStrokes(ctx, strokes, scale = 1) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const st of strokes || []) {
    if (!st.pts?.length) continue;
    ctx.strokeStyle = st.color;
    ctx.lineWidth = (st.w || 3.4) * scale;
    ctx.beginPath();
    st.pts.forEach((p, i) =>
      i ? ctx.lineTo(p[0] * scale, p[1] * scale) : ctx.moveTo(p[0] * scale, p[1] * scale));
    ctx.stroke();
  }
}

// Render one partner's strokes into a given <canvas> at a target width (crisp on retina).
export function paintCanvas(canvas, strokes, width) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const height = Math.round((width * BASE_H) / BASE_W);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);
  drawStrokes(ctx, strokes, width / BASE_W);
  return { width, height };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Compose a side-by-side "his | hers" keepsake PNG → returns a data URL.
export function makeKeepsakePNG({ him, her, prompt }) {
  const pad = 28, gap = 20, panelW = 360, panelH = 260, topH = 70, botH = 50;
  const W = pad * 2 + panelW * 2 + gap, H = topH + panelH + botH;
  const cv = document.createElement("canvas");
  const dpr = 2; cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);

  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center"; ctx.fillStyle = INK;
  ctx.font = "600 26px Georgia, serif"; ctx.fillText(prompt || "", W / 2, 44);

  [{ s: him, c: BLUE, label: "🌊 his" }, { s: her, c: ROSE, label: "🌸 hers" }].forEach((p, i) => {
    const x = pad + i * (panelW + gap), y = topH;
    ctx.fillStyle = "#fffdf8"; roundRect(ctx, x, y, panelW, panelH, 18); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = p.c; roundRect(ctx, x, y, panelW, panelH, 18); ctx.stroke();
    ctx.save(); roundRect(ctx, x, y, panelW, panelH, 18); ctx.clip();
    ctx.translate(x, y); drawStrokes(ctx, p.s, panelW / BASE_W); ctx.restore();
    ctx.fillStyle = p.c; ctx.font = "italic 18px Georgia, serif";
    ctx.fillText(p.label, x + panelW / 2, y + panelH + 28);
  });

  ctx.fillStyle = INK_SOFT; ctx.font = "14px Georgia, serif";
  ctx.fillText("♡ Heartstrings", W / 2, H - 14);
  return cv.toDataURL("image/png");
}

export function downloadKeepsake(drawing) {
  const url = makeKeepsakePNG({
    him: drawing.strokes_him, her: drawing.strokes_her, prompt: drawing.prompt,
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = `heartstrings-${(drawing.prompt || "memory").replace(/\W+/g, "-")}.png`;
  a.click();
}
