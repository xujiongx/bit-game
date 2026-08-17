/**
 * 微信小游戏分享
 * 右上角菜单转发 + 游戏内主动调起转发
 */
const DEFAULT_TITLE = '差一点 — 差一点点就完美';
const INTRO_TITLE = '推荐你玩「差一点」：等待、判断、点击，越接近中心越高分';

let currentShare = {
  title: DEFAULT_TITLE,
  query: 'from=menu',
};

function safeCall(fn) {
  try {
    return fn();
  } catch (e) {
    return null;
  }
}

export function initShare() {
  safeCall(() =>
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    })
  );

  safeCall(() =>
    wx.onShareAppMessage(() => ({
      title: currentShare.title,
      query: currentShare.query,
      imageUrl: currentShare.imageUrl || '',
    }))
  );

  safeCall(() => {
    if (typeof wx.onShareTimeline === 'function') {
      wx.onShareTimeline(() => ({
        title: currentShare.title,
        query: currentShare.query,
      }));
    }
  });
}

export function setSharePayload({ title, query, imageUrl } = {}) {
  if (title) currentShare.title = title;
  if (query != null) currentShare.query = query;
  if (imageUrl != null) currentShare.imageUrl = imageUrl;
}

/** 主动调起「发送给朋友」 */
export function shareToFriend(opts = {}) {
  const payload = {
    title: opts.title || DEFAULT_TITLE,
    query: opts.query || 'from=btn',
  };
  if (opts.imageUrl) payload.imageUrl = opts.imageUrl;
  setSharePayload(payload);

  const ok = safeCall(() => {
    wx.shareAppMessage(payload);
    return true;
  });
  return !!ok;
}

export function shareIntro() {
  return shareToFriend({
    title: INTRO_TITLE,
    query: 'from=intro',
  });
}

export function shareHome() {
  return shareToFriend({
    title: DEFAULT_TITLE,
    query: 'from=home',
  });
}

export function shareScore(score, mode = 'classic') {
  const modeName = mode === 'timed' ? '限时' : mode === 'daily' ? '每日挑战' : '经典';
  return shareToFriend({
    title: `我在「差一点」${modeName}模式得了 ${score} 分，来挑战一下？`,
    query: `from=score&score=${score}&mode=${mode}`,
  });
}

export function refreshMenuShare(score, mode) {
  if (score != null && score > 0) {
    setSharePayload({
      title: `我在「差一点」得了 ${score} 分，差一点点就完美`,
      query: `from=menu&score=${score}&mode=${mode || 'classic'}`,
    });
  } else {
    setSharePayload({
      title: DEFAULT_TITLE,
      query: 'from=menu',
    });
  }
}
