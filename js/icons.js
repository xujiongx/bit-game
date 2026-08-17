/**
 * SVG 风格图标（Canvas 矢量绘制）
 * 微信小游戏无 DOM，用 Path 复刻 SVG；同名文件见 images/icons/
 */
const VB = 24;

function strokeIcon(ctx, size, color, lineWidth, draw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.scale(size / VB, size / VB);
  draw();
  ctx.restore();
}

function drawCoin(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 7);
    ctx.lineTo(12, 17);
    ctx.moveTo(9.5, 9.2);
    ctx.bezierCurveTo(11, 8.2, 13, 8.2, 14.5, 9.2);
    ctx.moveTo(9.5, 14.8);
    ctx.bezierCurveTo(11, 15.8, 13, 15.8, 14.5, 14.8);
    ctx.stroke();
  });
}

function drawGift(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.strokeRect(5, 11, 14, 9);
    ctx.strokeRect(4, 8, 16, 3.5);
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(12, 20);
    ctx.moveTo(12, 8);
    ctx.bezierCurveTo(9, 5, 6.5, 6.5, 7.5, 8.5);
    ctx.moveTo(12, 8);
    ctx.bezierCurveTo(15, 5, 17.5, 6.5, 16.5, 8.5);
    ctx.stroke();
  });
}

function drawSoundOn(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(8, 10);
    ctx.lineTo(12, 6);
    ctx.lineTo(12, 18);
    ctx.lineTo(8, 14);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13.5, 12, 3.2, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(13.5, 12, 5.8, -Math.PI / 3.2, Math.PI / 3.2);
    ctx.stroke();
  });
}

function drawSoundOff(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.moveTo(4, 10);
    ctx.lineTo(8, 10);
    ctx.lineTo(12, 6);
    ctx.lineTo(12, 18);
    ctx.lineTo(8, 14);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, 9);
    ctx.lineTo(20, 15);
    ctx.moveTo(20, 9);
    ctx.lineTo(16, 15);
    ctx.stroke();
  });
}

function drawDaily(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.strokeRect(5, 6, 14, 14);
    ctx.beginPath();
    ctx.moveTo(5, 10);
    ctx.lineTo(19, 10);
    ctx.moveTo(9, 4);
    ctx.lineTo(9, 7.5);
    ctx.moveTo(15, 4);
    ctx.lineTo(15, 7.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 15, 1.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawClock(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(12, 7.5);
    ctx.moveTo(12, 12);
    ctx.lineTo(16, 14);
    ctx.stroke();
  });
}

function drawTask(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.strokeRect(5, 4, 14, 16);
    ctx.beginPath();
    ctx.moveTo(8, 9);
    ctx.lineTo(10.2, 11.2);
    ctx.lineTo(14.5, 7);
    ctx.moveTo(8, 14);
    ctx.lineTo(16, 14);
    ctx.moveTo(8, 17.5);
    ctx.lineTo(14, 17.5);
    ctx.stroke();
  });
}

function drawRank(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.strokeRect(4, 12, 4.5, 7);
    ctx.strokeRect(9.75, 6, 4.5, 13);
    ctx.strokeRect(15.5, 9, 4.5, 10);
  });
}

function drawSkin(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(10, 10, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14.2, 14.2);
    ctx.lineTo(19, 19);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, 9, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11.5, 8, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 12, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPause(ctx, size, color) {
  strokeIcon(ctx, size, color, 0, () => {
    ctx.fillRect(7, 5.5, 3.2, 13);
    ctx.fillRect(13.8, 5.5, 3.2, 13);
  });
}

function drawBack(ctx, size, color) {
  strokeIcon(ctx, size, color, 2, () => {
    ctx.beginPath();
    ctx.moveTo(14, 5);
    ctx.lineTo(7, 12);
    ctx.lineTo(14, 19);
    ctx.stroke();
  });
}

function drawCheck(ctx, size, color) {
  strokeIcon(ctx, size, color, 2.2, () => {
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7.5, 12.2);
    ctx.lineTo(10.5, 15.2);
    ctx.lineTo(16.5, 9);
    ctx.stroke();
  });
}

function drawCircle(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawShare(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(18, 5, 2.4, 0, Math.PI * 2);
    ctx.arc(18, 19, 2.4, 0, Math.PI * 2);
    ctx.arc(6, 12, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.2, 10.8);
    ctx.lineTo(15.8, 6.2);
    ctx.moveTo(8.2, 13.2);
    ctx.lineTo(15.8, 17.8);
    ctx.stroke();
  });
}

function drawInfo(ctx, size, color) {
  strokeIcon(ctx, size, color, 1.8, () => {
    ctx.beginPath();
    ctx.arc(12, 12, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 10.5);
    ctx.lineTo(12, 16.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 7.6, 0.9, 0, Math.PI * 2);
    ctx.fill();
  });
}

const DRAWERS = {
  coin: drawCoin,
  gift: drawGift,
  soundOn: drawSoundOn,
  soundOff: drawSoundOff,
  daily: drawDaily,
  clock: drawClock,
  task: drawTask,
  rank: drawRank,
  skin: drawSkin,
  pause: drawPause,
  back: drawBack,
  check: drawCheck,
  circle: drawCircle,
  share: drawShare,
  info: drawInfo,
};

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 * @param {number} x 左上角
 * @param {number} y 左上角
 * @param {number} size
 * @param {string} color
 */
export function drawIcon(ctx, name, x, y, size, color) {
  const fn = DRAWERS[name];
  if (!fn) return;
  ctx.save();
  ctx.translate(x, y);
  fn(ctx, size, color);
  ctx.restore();
}

export function drawIconCenter(ctx, name, cx, cy, size, color) {
  drawIcon(ctx, name, cx - size / 2, cy - size / 2, size, color);
}
