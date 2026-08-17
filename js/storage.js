/**
 * 本地存储封装（兼容微信小游戏）
 */
export function getItem(key, fallback = '') {
  try {
    const v = wx.getStorageSync(key);
    return v === '' || v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function setItem(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    // ignore
  }
}

export function getNumber(key, fallback = 0) {
  const v = getItem(key, fallback);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getJSON(key, fallback) {
  try {
    const raw = wx.getStorageSync(key);
    if (raw === '' || raw === undefined || raw === null) return fallback;
    if (typeof raw === 'object') return raw;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function setJSON(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {
    // ignore
  }
}
