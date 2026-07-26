function drawBars(canvas, labels, values, color) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 640;
  const cssH = canvas.clientHeight || 200;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW;
  const H = cssH;
  const pad = { t: 16, r: 12, b: 32, l: 36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const max = Math.max(10, ...values, 1);

  ctx.clearRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(W - pad.r, y);
    ctx.stroke();
    const val = Math.round(max * (1 - i / 4));
    ctx.fillStyle = "rgba(139,155,176,0.9)";
    ctx.font = "11px DM Sans, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(val), pad.l - 6, y + 3);
  }

  const n = values.length;
  const gap = 8;
  const barW = Math.max(8, (plotW - gap * (n - 1)) / n);

  values.forEach((v, i) => {
    const x = pad.l + i * (barW + gap);
    const h = (v / max) * plotH;
    const y = pad.t + plotH - h;
    const grd = ctx.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, color);
    grd.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = grd;
    roundRect(ctx, x, y, barW, Math.max(h, v > 0 ? 2 : 0), 6);
    ctx.fill();

    ctx.fillStyle = "rgba(139,155,176,0.95)";
    ctx.font = "11px DM Sans, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW / 2, H - 10);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function renderDailyChart(canvas, dayKeys, minutes) {
  const labels = dayKeys.map((k) => {
    const [y, m, d] = k.split("-");
    const dt = new Date(+y, +m - 1, +d);
    return dt.toLocaleDateString(undefined, { weekday: "short" });
  });
  drawBars(canvas, labels, minutes, "#e85d4c");
}

export function renderWeeklyChart(canvas, weekLabels, minutes) {
  drawBars(canvas, weekLabels, minutes, "#5b8def");
}
