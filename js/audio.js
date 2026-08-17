/**
 * 微信小游戏音效 + 背景音乐
 * SFX / BGM 优先 WebAudio（GainNode 可平滑淡出）；BGM 失败则回退 InnerAudioContext
 */
let audioCtx = null;
let unlocked = false;

let bgmBuffer = null;
let bgmSource = null;
let bgmGain = null;
let bgmInner = null;
let bgmMode = ''; // 'web' | 'inner'
let bgmPlaying = false;
let bgmLoading = false;
let bgmFadeTimer = null;
let bgmPendingStart = false;

/** 音效整体增益倍率（相对原先约 0.015–0.035） */
const SFX_BOOST = 5.2;
const BGM_SRC = 'mp3/bg.mp3';
const BGM_VOLUME = 0.16;
const BGM_FADE_MS = 1100;

function getAudio() {
  if (audioCtx) return audioCtx;
  try {
    if (typeof wx.createWebAudioContext === 'function') {
      audioCtx = wx.createWebAudioContext();
    }
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}

export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const audio = getAudio();
    if (!audio) return;
    if (typeof audio.resume === 'function') {
      audio.resume();
    }
    const o = audio.createOscillator();
    const g = audio.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.01);
  } catch (e) {
    // ignore
  }
  // 预加载 BGM，避免开局卡顿
  preloadBgmBuffer();
}

export function beep(soundOn, f, d = 0.045, type = 'sine', g = 0.05) {
  if (!soundOn) return;
  try {
    unlockAudio();
    const audio = getAudio();
    if (!audio) return;
    if (typeof audio.resume === 'function') audio.resume();
    const o = audio.createOscillator();
    const a = audio.createGain();
    const level = Math.min(0.35, g * SFX_BOOST);
    o.type = type;
    o.frequency.setValueAtTime(f, audio.currentTime);
    a.gain.setValueAtTime(level, audio.currentTime);
    a.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
    o.connect(a);
    a.connect(audio.destination);
    o.start(audio.currentTime);
    o.stop(audio.currentTime + d + 0.02);
  } catch (e) {
    // ignore
  }
}

/** 点错 / 未命中（对局继续时）：短促下行双音 */
export function missBeep(soundOn) {
  if (!soundOn) return;
  try {
    unlockAudio();
    const audio = getAudio();
    if (!audio) return;
    if (typeof audio.resume === 'function') audio.resume();
    const now = audio.currentTime;
    const playTone = (freq, start, dur, type, gain) => {
      const o = audio.createOscillator();
      const a = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, now + start);
      a.gain.setValueAtTime(gain, now + start);
      a.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(a);
      a.connect(audio.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.02);
    };
    playTone(320, 0, 0.09, 'square', 0.14);
    playTone(180, 0.08, 0.14, 'sawtooth', 0.11);
  } catch (e) {
    // ignore
  }
}

/** 本局结束提示音：柔和、慢起慢收，叠在 BGM 淡出之上 */
export function endBeep(soundOn) {
  if (!soundOn) return;
  try {
    unlockAudio();
    const audio = getAudio();
    if (!audio) return;
    if (typeof audio.resume === 'function') audio.resume();
    const now = audio.currentTime;
    const playSoft = (freq, start, dur, peak) => {
      const o = audio.createOscillator();
      const a = audio.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + start);
      o.frequency.linearRampToValueAtTime(freq * 0.78, now + start + dur);
      a.gain.setValueAtTime(0.0001, now + start);
      a.gain.linearRampToValueAtTime(peak, now + start + 0.08);
      a.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(a);
      a.connect(audio.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.05);
    };
    // 略延迟，让 BGM 先开始淡，避免「先硬切再淡出」的听感
    playSoft(196, 0.18, 0.45, 0.1);
    playSoft(147, 0.32, 0.55, 0.075);
  } catch (e) {
    // ignore
  }
}

function clearBgmFade() {
  if (bgmFadeTimer != null) {
    clearInterval(bgmFadeTimer);
    clearTimeout(bgmFadeTimer);
    bgmFadeTimer = null;
  }
}

function preloadBgmBuffer() {
  if (bgmBuffer || bgmLoading) return;
  const audio = getAudio();
  if (!audio || typeof wx.getFileSystemManager !== 'function') return;
  bgmLoading = true;
  try {
    wx.getFileSystemManager().readFile({
      filePath: BGM_SRC,
      success(res) {
        const data = res.data;
        let settled = false;
        const ok = (buf) => {
          if (settled) return;
          settled = true;
          bgmLoading = false;
          bgmBuffer = buf;
          if (bgmPendingStart) {
            bgmPendingStart = false;
            startBgm(true);
          }
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          bgmLoading = false;
          bgmBuffer = null;
          if (bgmPendingStart) {
            bgmPendingStart = false;
            startInnerBgm();
          }
        };
        try {
          const ret = audio.decodeAudioData(
            data,
            (buf) => ok(buf),
            () => fail()
          );
          if (ret && typeof ret.then === 'function') {
            ret.then(ok).catch(fail);
          }
        } catch (e) {
          fail();
        }
      },
      fail() {
        bgmLoading = false;
        bgmBuffer = null;
        if (bgmPendingStart) {
          bgmPendingStart = false;
          startInnerBgm();
        }
      },
    });
  } catch (e) {
    bgmLoading = false;
  }
}

function stopWebNodes(hard) {
  const audio = getAudio();
  const now = audio ? audio.currentTime : 0;
  if (bgmSource) {
    try {
      if (hard && bgmGain) {
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(0.0001, now);
      }
      bgmSource.stop(hard ? now : now + 0.02);
    } catch (e) {
      // ignore
    }
    bgmSource = null;
  }
  if (bgmGain) {
    try {
      bgmGain.disconnect();
    } catch (e) {
      // ignore
    }
    bgmGain = null;
  }
}

function ensureInner() {
  if (bgmInner) return bgmInner;
  try {
    if (typeof wx.createInnerAudioContext !== 'function') return null;
    bgmInner = wx.createInnerAudioContext();
    bgmInner.src = BGM_SRC;
    bgmInner.loop = true;
    bgmInner.volume = BGM_VOLUME;
    bgmInner.obeyMuteSwitch = true;
    bgmInner.onError(() => {
      if (bgmMode === 'inner') bgmPlaying = false;
    });
  } catch (e) {
    bgmInner = null;
  }
  return bgmInner;
}

function startWebBgm() {
  const audio = getAudio();
  if (!audio || !bgmBuffer) return false;
  if (typeof audio.resume === 'function') audio.resume();
  stopWebNodes(true);
  try {
    bgmGain = audio.createGain();
    bgmGain.gain.value = BGM_VOLUME;
    bgmGain.connect(audio.destination);
    bgmSource = audio.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;
    bgmSource.connect(bgmGain);
    bgmSource.start(0);
    bgmMode = 'web';
    bgmPlaying = true;
    return true;
  } catch (e) {
    stopWebNodes(true);
    return false;
  }
}

function startInnerBgm() {
  try {
    stopWebNodes(true);
    const a = ensureInner();
    if (!a) return;
    a.volume = BGM_VOLUME;
    try {
      a.stop();
    } catch (e) {
      // ignore
    }
    try {
      a.seek(0);
    } catch (e) {
      // ignore
    }
    a.play();
    bgmMode = 'inner';
    bgmPlaying = true;
  } catch (e) {
    bgmPlaying = false;
  }
}

/** 仅在对局中调用 */
export function startBgm(soundOn) {
  if (!soundOn) {
    stopBgm();
    return;
  }
  clearBgmFade();
  unlockAudio();

  if (bgmPlaying && bgmMode === 'web' && bgmSource && bgmGain) {
    try {
      const audio = getAudio();
      const now = audio.currentTime;
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(BGM_VOLUME, now);
    } catch (e) {
      // ignore
    }
    return;
  }
  if (bgmPlaying && bgmMode === 'inner' && bgmInner) {
    try {
      bgmInner.volume = BGM_VOLUME;
      bgmInner.play();
    } catch (e) {
      // ignore
    }
    return;
  }

  if (bgmBuffer) {
    if (!startWebBgm()) startInnerBgm();
    return;
  }
  if (bgmLoading) {
    bgmPendingStart = true;
    return;
  }
  bgmPendingStart = true;
  preloadBgmBuffer();
  // 同步失败时直接走 Inner，避免等不到 decode
  if (!bgmLoading && !bgmBuffer) {
    bgmPendingStart = false;
    startInnerBgm();
  }
}

export function pauseBgm() {
  clearBgmFade();
  if (!bgmPlaying) return;
  if (bgmMode === 'web') {
    // WebAudio BufferSource 无法真正 pause，用音量哑音代替
    try {
      const audio = getAudio();
      if (bgmGain && audio) {
        const now = audio.currentTime;
        bgmGain.gain.cancelScheduledValues(now);
        bgmGain.gain.setValueAtTime(0.0001, now);
      }
    } catch (e) {
      // ignore
    }
    return;
  }
  if (bgmInner) {
    try {
      bgmInner.pause();
    } catch (e) {
      // ignore
    }
  }
}

export function stopBgm() {
  clearBgmFade();
  bgmPendingStart = false;
  bgmPlaying = false;
  stopWebNodes(true);
  if (bgmInner) {
    try {
      bgmInner.stop();
      bgmInner.volume = BGM_VOLUME;
    } catch (e) {
      // ignore
    }
  }
  bgmMode = '';
}

function fadeOutWeb(ms) {
  const audio = getAudio();
  if (!audio || !bgmGain || !bgmSource) {
    stopBgm();
    return;
  }
  const now = audio.currentTime;
  const dur = Math.max(0.35, ms / 1000);
  let cur = BGM_VOLUME;
  try {
    cur = Math.max(0.0001, bgmGain.gain.value);
  } catch (e) {
    // ignore
  }
  try {
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(cur, now);
    // 线性缓出：一开始就往下走，不会先「卡住再猛掉」
    bgmGain.gain.linearRampToValueAtTime(0.0001, now + dur);
  } catch (e) {
    stopBgm();
    return;
  }
  bgmPlaying = false;
  const src = bgmSource;
  const gainNode = bgmGain;
  bgmSource = null;
  try {
    src.stop(now + dur + 0.08);
  } catch (e) {
    // ignore
  }
  bgmFadeTimer = setTimeout(() => {
    try {
      gainNode.disconnect();
    } catch (e) {
      // ignore
    }
    if (bgmGain === gainNode) bgmGain = null;
    bgmFadeTimer = null;
    bgmMode = '';
  }, ms + 120);
}

function fadeOutInner(ms) {
  if (!bgmInner) {
    stopBgm();
    return;
  }
  clearBgmFade();
  bgmPlaying = false;
  let startVol = BGM_VOLUME;
  try {
    startVol = typeof bgmInner.volume === 'number' ? bgmInner.volume : BGM_VOLUME;
  } catch (e) {
    // ignore
  }
  const steps = 28;
  const stepMs = Math.max(20, ms / steps);
  let i = 0;
  bgmFadeTimer = setInterval(() => {
    i += 1;
    const t = Math.min(1, i / steps);
    // ease-out：持续下滑，避免末段悬崖式下跌
    const keep = (1 - t) * (1 - t);
    try {
      bgmInner.volume = Math.max(0, startVol * keep);
    } catch (e) {
      // ignore
    }
    if (i >= steps) {
      clearBgmFade();
      try {
        bgmInner.stop();
        bgmInner.volume = BGM_VOLUME;
      } catch (e) {
        // ignore
      }
      bgmMode = '';
    }
  }, stepMs);
}

/** 结束对局：平滑淡出背景音（WebAudio GainNode 优先） */
export function fadeOutBgm(ms = BGM_FADE_MS) {
  if (!bgmPlaying) {
    // 已在淡出或已停，不要再 hard stop 打断
    return;
  }
  clearBgmFade();
  if (bgmMode === 'web' && bgmGain && bgmSource) {
    fadeOutWeb(ms);
    return;
  }
  if (bgmMode === 'inner' && bgmInner) {
    fadeOutInner(ms);
    return;
  }
  stopBgm();
}

export function resumeAudio(soundOn) {
  if (!soundOn) return;
  unlockAudio();
  try {
    const audio = getAudio();
    if (audio && typeof audio.resume === 'function') audio.resume();
  } catch (e) {
    // ignore
  }
}

/** 声音开关：关闭时停 BGM；开启时不自动播，由对局逻辑决定 */
export function setSoundEnabled(soundOn) {
  if (!soundOn) stopBgm();
  else resumeAudio(true);
}
