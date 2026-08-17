/**
 * 微信小游戏 Canvas / 屏幕适配
 * 逻辑坐标 = CSS 像素（与 touch.clientX/Y、windowWidth 一致）
 */
const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

export const SCREEN_WIDTH = sys.windowWidth || sys.screenWidth;
export const SCREEN_HEIGHT = sys.windowHeight || sys.screenHeight;
export const PIXEL_RATIO = Math.min(sys.pixelRatio || 2, 3);

// 顶部：状态栏 / 安全区 / 胶囊按钮三者取最大，避免遮挡
let menuBottom = 0;
try {
  const menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
  if (menu && menu.bottom) menuBottom = menu.bottom + 6;
} catch (e) {
  // ignore
}

const safeTop = (sys.safeArea && sys.safeArea.top) || 0;
const statusBar = sys.statusBarHeight || 20;
export const SAFE_TOP = Math.max(safeTop, statusBar, menuBottom, 24);

// 底部安全区高度（Home Indicator 等）
const safeBottomY = (sys.safeArea && sys.safeArea.bottom) || SCREEN_HEIGHT;
export const SAFE_BOTTOM = Math.max(0, SCREEN_HEIGHT - safeBottomY);

export const canvas = wx.createCanvas();
export const ctx = canvas.getContext('2d');

canvas.width = Math.floor(SCREEN_WIDTH * PIXEL_RATIO);
canvas.height = Math.floor(SCREEN_HEIGHT * PIXEL_RATIO);
ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);

// 文字更清晰
if (ctx.imageSmoothingEnabled !== undefined) {
  ctx.imageSmoothingEnabled = true;
}

if (typeof GameGlobal !== 'undefined') {
  GameGlobal.canvas = canvas;
}

/** 触点 → 逻辑坐标（全屏主 Canvas 下 clientX/Y 已是逻辑像素） */
export function touchPoint(touch) {
  if (!touch) return { x: 0, y: 0 };
  const x = touch.clientX != null ? touch.clientX : touch.x;
  const y = touch.clientY != null ? touch.clientY : touch.y;
  return {
    x: Number(x) || 0,
    y: Number(y) || 0,
  };
}
