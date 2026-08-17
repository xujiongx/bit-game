/**
 * 微信小游戏音效
 * 优先 wx.createWebAudioContext；失败则静默（不阻断玩法）
 */
let audioCtx = null;
let unlocked = false;

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
    // 极短静音唤醒，满足部分机型「需用户手势」限制
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
}

export function beep(soundOn, f, d = 0.045, type = 'sine', g = 0.018) {
  if (!soundOn) return;
  try {
    unlockAudio();
    const audio = getAudio();
    if (!audio) return;
    if (typeof audio.resume === 'function') audio.resume();
    const o = audio.createOscillator();
    const a = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, audio.currentTime);
    a.gain.setValueAtTime(g, audio.currentTime);
    a.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d);
    o.connect(a);
    a.connect(audio.destination);
    o.start(audio.currentTime);
    o.stop(audio.currentTime + d + 0.02);
  } catch (e) {
    // ignore
  }
}

export function resumeAudio(soundOn) {
  if (!soundOn) return;
  unlockAudio();
}
