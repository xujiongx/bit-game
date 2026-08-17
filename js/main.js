/**
 * 差一点 V10 — 微信小游戏版
 * 对齐 HTML「差一点_V10_重构稳定版」：首页卡片导航、叠加层结算/暂停、皮肤主题
 * 保留真机适配：统一时钟、安全区、触控防抖
 */
import {
  ctx,
  SCREEN_WIDTH as W,
  SCREEN_HEIGHT as H,
  SAFE_TOP,
  SAFE_BOTTOM,
  touchPoint,
} from './render';
import { getItem, setItem, getNumber, getJSON, setJSON } from './storage';
import {
  beep,
  missBeep,
  endBeep,
  resumeAudio,
  unlockAudio,
  startBgm,
  stopBgm,
  pauseBgm,
  fadeOutBgm,
  setSoundEnabled,
} from './audio';
import { drawIcon, drawIconCenter } from './icons';
import {
  buildContext,
  recordRun,
  listDailyTasks,
  listAchieveTasks,
  dailyProgress,
  claimTask,
} from './tasks';
import {
  initShare,
  shareIntro,
  shareHome,
  shareScore,
  refreshMenuShare,
} from './share';
import {
  fetchGlobalRanks,
  submitGlobalScore,
  getNickname,
  getPlayerId,
} from './leaderboard';

const COLORS = {
  paper: '#ffffff',
  ink: '#171717',
  muted: '#999993',
  line: '#e3e3de',
  gold: '#b78920',
  red: '#c85a61',
  green: '#638d72',
};

const FONT = '"PingFang SC","Helvetica Neue","Noto Sans SC",sans-serif';

const SKINS = [
  { id: 'classic', name: '经典', color: '#171717', bg: '#f5f5f2', need: 0 },
  { id: 'blue', name: '蓝墨', color: '#315f9b', bg: '#f3f6fa', need: 300 },
  { id: 'gold', name: '鎏金', color: '#b78920', bg: '#faf8f0', need: 800 },
  { id: 'red', name: '赤焰', color: '#c85a61', bg: '#faf3f4', need: 1500 },
  { id: 'green', name: '森林', color: '#638d72', bg: '#f3f7f4', need: 2500 },
  { id: 'violet', name: '紫电', color: '#745a98', bg: '#f6f3fa', need: 4000 },
];

const SCALE = Math.min(1.12, Math.max(0.88, W / 375));
const PAD = Math.round(18 * SCALE);
const TIMED_MS = 60000; // 限时模式 1 分钟
const REVIVE_COST = 5;
const REVIVE_MAX = 3;
const RANK_LIMIT = 20;
const RANK_KEYS = {
  classic: 'v10_rank_classic',
  timed: 'v10_rank_timed',
};

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = (s / 60) | 0;
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function formatPlayAt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `今天 ${hm}`;
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYest =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isYest) return `昨天 ${hm}`;
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`;
}

function loadRanks(mode) {
  const key = RANK_KEYS[mode] || RANK_KEYS.classic;
  const list = getJSON(key, []);
  return Array.isArray(list) ? list : [];
}

function saveRankRecord(mode, record) {
  const key = RANK_KEYS[mode] || RANK_KEYS.classic;
  const list = loadRanks(mode);
  list.push(record);
  list.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.at || 0) - (a.at || 0));
  setJSON(key, list.slice(0, RANK_LIMIT));
}

function dateKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

function dailyKey() {
  return 'v10_daily_' + dateKey();
}

function font(weight, size) {
  return `${weight} ${Math.round(size * SCALE)}px ${FONT}`;
}

function roundRect(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRound(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  roundRect(x, y, w, h, r);
  ctx.fill();
}

function strokeRound(x, y, w, h, r, color, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  roundRect(x, y, w, h, r);
  ctx.stroke();
}

function hitRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export default class Main {
  constructor() {
    this.gameState = 'home'; // home | playing | paused | result | panel
    this.panel = ''; // daily | task | rank | skin | reward | intro | ''
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.round = 0;
    this.best = getNumber('v10_best', getNumber('v7_best', 0));
    this.bestCombo = getNumber('v10_bestCombo', getNumber('v7_combo', 0));
    this.coins = getNumber('v10_coins', getNumber('v7_coins', 0));
    this.skin = getItem('v10_skin', getItem('v7_skin', 'classic')) || 'classic';
    this.soundOn = getItem('v10_sound', '1') !== '0';
    this.target = null;
    this.particles = [];
    this.frenzyLeft = 0;
    this.revivesUsed = 0;
    this.mode = 'classic'; // classic | timed | daily
    this.timedLeft = 0;
    this.timedBest = getNumber('v10_timed_best', 0);
    this.rankTab = 'classic'; // classic | timed
    this.rankScope = 'local'; // local | global
    this.globalRanks = [];
    this.globalMyRank = null;
    this.globalMyScore = null;
    this.globalStatus = 'idle'; // idle | loading | ok | error
    this.globalError = '';
    this.globalFetchToken = 0;
    this.taskTab = 'daily'; // daily | achieve
    this.taskScroll = 0;
    this.taskScrollMax = 0;
    this.taskListTop = 0;
    this.dragStartY = 0;
    this.dragScrollFrom = 0;
    this.didScroll = false;
    this.runStartedAt = 0;
    this.pendingRank = false;
    this.oldBest = 0;
    this.buttons = [];
    this.shake = 0;
    this.shakeX = 0;
    this.gameTime = 0;
    this.lastWall = Date.now();
    this.spawnAt = 0;
    this.spawnPauseRemain = 0;
    this.reviveCountdown = 0;
    this.reviveAt = 0;
    this.touchLockUntil = 0;
    this.toastText = '';
    this.toastColor = COLORS.ink;
    this.toastUntil = 0;
    this.bannerText = '';
    this.bannerColor = COLORS.red;
    this.bannerUntil = 0;
    this.pressedId = ''; // 按钮按下态（全局）
    this.pressStartId = '';

    this.playTop = SAFE_TOP + Math.round(110 * SCALE);
    this.playBottom = H - SAFE_BOTTOM - Math.round(28 * SCALE);

    this.bindInput();
    this.bindLifecycle();
    initShare();
    refreshMenuShare();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  save() {
    setItem('v10_best', this.best);
    setItem('v10_bestCombo', this.bestCombo);
    setItem('v10_coins', this.coins);
    setItem('v10_timed_best', this.timedBest);
  }

  skinMeta() {
    return SKINS.find((s) => s.id === this.skin) || SKINS[0];
  }

  getBg() {
    return this.skinMeta().bg;
  }

  mainColor() {
    return this.skinMeta().color;
  }

  unlockedSkins() {
    return SKINS.filter((s) => this.best >= s.need);
  }

  taskProgress() {
    const ctx = this.taskContext();
    return dailyProgress(ctx);
  }

  taskContext() {
    return buildContext({
      best: this.best,
      bestCombo: this.bestCombo,
      timedBest: this.timedBest,
      skinsUnlocked: this.unlockedSkins().length,
    });
  }

  bindLifecycle() {
    wx.onShow(() => {
      this.lastWall = Date.now();
      if (this.soundOn) resumeAudio(true);
      if (this.soundOn && this.gameState === 'playing') startBgm(true);
    });
    wx.onHide(() => {
      pauseBgm();
      if (this.gameState === 'playing') this.pauseGame();
    });
  }

  bindInput() {
    wx.onTouchStart((e) => {
      const list = (e.touches && e.touches.length ? e.touches : e.changedTouches) || [];
      const t = list[0];
      if (!t) return;
      const { x, y } = touchPoint(t);
      this.onTouchStart(x, y);
    });
    wx.onTouchMove((e) => {
      const list = (e.touches && e.touches.length ? e.touches : e.changedTouches) || [];
      const t = list[0];
      if (!t) return;
      const { x, y } = touchPoint(t);
      this.onTouchMove(x, y);
    });
    wx.onTouchEnd((e) => {
      const list = (e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches) || [];
      const t = list[0];
      const { x, y } = t ? touchPoint(t) : { x: -1, y: -1 };
      this.onTouchEnd(x, y);
    });
    wx.onTouchCancel(() => {
      this.clearPress();
    });
  }

  findButton(x, y) {
    for (let i = 0; i < this.buttons.length; i++) {
      const b = this.buttons[i];
      if (hitRect(x, y, b)) return b;
    }
    return null;
  }

  clearPress() {
    this.pressedId = '';
    this.pressStartId = '';
  }

  tapFeedback() {
    try {
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
    } catch (e) {
      // ignore
    }
  }

  onTouchStart(x, y) {
    if (this.gameTime < this.touchLockUntil) return;
    unlockAudio();
    if (this.reviveCountdown > 0) return;

    this.didScroll = false;
    if (this.gameState === 'panel' && this.panel === 'task' && y >= this.taskListTop) {
      this.dragStartY = y;
      this.dragScrollFrom = this.taskScroll;
    } else {
      this.dragStartY = 0;
    }

    // 对局中：暂停键走反馈；点空白才判定命中
    if (this.gameState === 'playing') {
      const btn = this.findButton(x, y);
      if (btn && btn.id === 'pause') {
        this.pressedId = 'pause';
        this.pressStartId = 'pause';
        this.tapFeedback();
        return;
      }
      this.clearPress();
      this.touchLockUntil = this.gameTime + 80;
      this.hit(x, y);
      return;
    }

    const btn = this.findButton(x, y);
    if (!btn) {
      this.clearPress();
      return;
    }
    this.pressedId = btn.id;
    this.pressStartId = btn.id;
    this.tapFeedback();
  }

  onTouchMove(x, y) {
    if (
      this.gameState === 'panel' &&
      this.panel === 'task' &&
      this.dragStartY &&
      this.taskScrollMax > 0
    ) {
      const dy = this.dragStartY - y;
      if (Math.abs(dy) > 8) {
        this.didScroll = true;
        this.clearPress();
        this.taskScroll = Math.max(
          0,
          Math.min(this.taskScrollMax, this.dragScrollFrom + dy)
        );
      }
    }
    if (!this.pressStartId) return;
    const btn = this.findButton(x, y);
    this.pressedId = btn && btn.id === this.pressStartId ? this.pressStartId : '';
  }

  onTouchEnd(x, y) {
    const startId = this.pressStartId;
    const scrolled = this.didScroll;
    this.dragStartY = 0;
    this.didScroll = false;

    if (!startId) return;

    const btn = this.findButton(x, y);
    const confirm = !scrolled && this.pressedId === startId && btn && btn.id === startId;

    const clear = () => this.clearPress();
    setTimeout(clear, 90);

    if (!confirm) return;
    if (this.gameTime < this.touchLockUntil) return;
    this.touchLockUntil = this.gameTime + 140;

    if (startId === 'pause') {
      this.pauseGame();
      return;
    }
    this.handleButton(startId);
  }

  handleButton(id) {
    switch (id) {
      case 'play':
        this.startGame('classic');
        break;
      case 'play_timed':
        this.startGame('timed');
        break;
      case 'open_daily':
        this.showPanel('daily');
        break;
      case 'open_task':
        this.taskTab = 'daily';
        this.taskScroll = 0;
        this.showPanel('task');
        break;
      case 'task_tab_daily':
        this.taskTab = 'daily';
        this.taskScroll = 0;
        break;
      case 'task_tab_achieve':
        this.taskTab = 'achieve';
        this.taskScroll = 0;
        break;
      case 'open_rank':
        this.rankTab = 'classic';
        this.rankScope = 'local';
        this.showPanel('rank');
        break;
      case 'rank_scope_local':
        this.rankScope = 'local';
        break;
      case 'rank_scope_global':
        this.rankScope = 'global';
        this.loadGlobalRanks(true);
        break;
      case 'rank_tab_classic':
        this.rankTab = 'classic';
        if (this.rankScope === 'global') this.loadGlobalRanks(true);
        break;
      case 'rank_tab_timed':
        this.rankTab = 'timed';
        if (this.rankScope === 'global') this.loadGlobalRanks(true);
        break;
      case 'rank_refresh':
        if (this.rankScope === 'global') this.loadGlobalRanks(true);
        break;
      case 'open_skin':
        this.showPanel('skin');
        break;
      case 'open_reward':
        this.openReward();
        break;
      case 'open_intro':
        this.showPanel('intro');
        break;
      case 'share_home':
        if (!shareHome()) this.toast('暂时无法分享', '#999999');
        else this.toast('选择好友分享吧', COLORS.gold);
        break;
      case 'share_intro':
        if (!shareIntro()) this.toast('暂时无法分享', '#999999');
        else this.toast('把玩法分享给好友', COLORS.gold);
        break;
      case 'share_result':
        if (!shareScore(this.score, this.mode)) this.toast('暂时无法分享', '#999999');
        else this.toast('分享本局成绩', COLORS.gold);
        break;
      case 'sound':
        this.soundOn = !this.soundOn;
        setItem('v10_sound', this.soundOn ? '1' : '0');
        setSoundEnabled(this.soundOn);
        if (this.soundOn) {
          beep(true, 650, 0.05);
          if (this.gameState === 'playing') startBgm(true);
        }
        break;
      case 'daily_play':
        this.startGame('daily');
        break;
      case 'back_home':
      case 'result_home':
      case 'pause_home':
        this.commitPendingRank();
        this.showHome();
        break;
      case 'claim_reward':
        this.claimReward();
        break;
      case 'close_reward':
        this.panel = '';
        this.gameState = 'home';
        break;
      case 'revive':
        this.revive();
        break;
      case 'again':
        this.commitPendingRank();
        this.startGame(this.mode);
        break;
      case 'resume':
        this.resumeGame();
        break;
      default:
        if (id && id.indexOf('claim_daily_') === 0) {
          this.claimTaskReward('daily', id.slice('claim_daily_'.length));
          break;
        }
        if (id && id.indexOf('claim_ach_') === 0) {
          this.claimTaskReward('achieve', id.slice('claim_ach_'.length));
          break;
        }
        if (id && id.indexOf('skin_') === 0) {
          const sid = id.slice(5);
          const s = SKINS.find((x) => x.id === sid);
          if (!s || this.best < s.need) return;
          this.skin = sid;
          setItem('v10_skin', sid);
          this.toast('已切换：' + s.name);
        }
        break;
    }
  }

  claimTaskReward(type, taskId) {
    const res = claimTask(type, taskId, this.taskContext());
    if (!res.ok) {
      this.toast(res.message || '无法领取', '#999999');
      return;
    }
    this.coins += res.reward;
    this.save();
    this.toast(`领取 +${res.reward} 金币`, COLORS.gold);
    beep(this.soundOn, 880, 0.08, 'triangle', 0.025);
  }

  toast(text, color = COLORS.ink) {
    this.toastText = text;
    this.toastColor = color;
    this.toastUntil = this.gameTime + 700;
  }

  flashBanner(text, color) {
    this.bannerText = text;
    this.bannerColor = color;
    this.bannerUntil = this.gameTime + 900;
  }

  showHome() {
    stopBgm();
    this.gameState = 'home';
    this.panel = '';
    this.target = null;
    this.spawnAt = 0;
    this.reviveCountdown = 0;
    refreshMenuShare();
  }

  showPanel(name) {
    this.gameState = 'panel';
    this.panel = name;
    this.target = null;
    this.spawnAt = 0;
  }

  openReward() {
    const k = 'v10_reward_' + dateKey();
    if (getItem(k, '')) {
      this.toast('今天已经领取过了', '#999999');
      return;
    }
    this.gameState = 'panel';
    this.panel = 'reward';
  }

  claimReward() {
    const k = 'v10_reward_' + dateKey();
    if (getItem(k, '')) {
      this.panel = '';
      this.gameState = 'home';
      return;
    }
    this.coins += 20;
    setItem(k, '1');
    this.save();
    this.panel = '';
    this.gameState = 'home';
    this.toast('今日奖励 +20', COLORS.gold);
    beep(this.soundOn, 880, 0.08, 'triangle', 0.025);
  }

  resetGame() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.round = 0;
    this.target = null;
    this.particles = [];
    this.frenzyLeft = 0;
    this.revivesUsed = 0;
    this.spawnAt = 0;
    this.spawnPauseRemain = 0;
    this.reviveCountdown = 0;
    this.timedLeft = this.mode === 'timed' ? TIMED_MS : 0;
  }

  startGame(mode = 'classic') {
    resumeAudio(this.soundOn);
    this.mode = mode;
    this.pendingRank = false;
    this.resetGame();
    this.gameState = 'playing';
    this.panel = '';
    this.runStartedAt = Date.now();
    startBgm(this.soundOn);
    if (this.mode === 'timed') {
      this.flashBanner('限时 1 分钟', COLORS.gold);
      this.toast('未命中不计分', COLORS.muted);
    }
    this.spawnTarget();
  }

  spawnTarget() {
    if (this.gameState !== 'playing') return;
    this.round += 1;
    this.spawnAt = 0;
    const boss = this.mode !== 'timed' && this.round % 10 === 0;
    const margin = Math.round(56 * SCALE);
    const speedFactor =
      (this.mode === 'daily' ? 0.83 : 1) * (this.frenzyLeft > 0 ? 1.24 : 1);
    const top = this.playTop;
    const bottom = Math.max(top + 80, this.playBottom);
    const maxR = (boss ? 84 : Math.max(29, 58 - this.combo * 0.36)) * speedFactor;
    this.target = {
      x: margin + Math.random() * Math.max(10, W - margin * 2),
      y: top + Math.random() * Math.max(10, bottom - top),
      boss,
      max: maxR,
      min: boss ? 10 : 6,
      born: this.gameTime,
      life: (boss ? 1350 : Math.max(470, 920 - this.combo * 9)) / speedFactor,
      phase: Math.random() * 7,
      r: maxR,
    };
    if (boss) {
      this.flashBanner('首领回合', COLORS.red);
      beep(this.soundOn, 170, 0.13, 'sine', 0.03);
    }
  }

  startFrenzy() {
    this.frenzyLeft = 9000;
    this.flashBanner('狂热模式', COLORS.gold);
    this.toast('狂热模式 ×2', COLORS.gold);
    beep(this.soundOn, 980, 0.1, 'triangle', 0.035);
  }

  /** 限时模式：未命中 / 超时消失 → 不计分，继续 */
  missTarget(reason = '未命中') {
    if (this.gameState !== 'playing') return;
    this.combo = 0;
    this.target = null;
    this.toast(reason, '#999999');
    missBeep(this.soundOn);
    this.spawnAt = this.gameTime + 140;
  }

  hit(px, py) {
    if (this.gameState !== 'playing' || !this.target) return;
    const d = Math.hypot(px - this.target.x, py - this.target.y);
    const r = Math.max(this.target.r, 1);
    if (d > r * 1.48) {
      if (this.mode === 'timed') {
        this.missTarget('未命中');
      } else {
        // 结束局只用柔和结算音 + BGM 淡出，避免先急促 miss 再淡出
        this.endGame();
      }
      return;
    }
    const accuracy = 1 - d / r;
    const perfect = accuracy > 0.88;
    const great = accuracy > 0.58;
    let gain = Math.round(
      (this.target.boss ? 80 : perfect ? 30 : great ? 18 : 10) *
        (1 + Math.min(this.combo, 30) * 0.11)
    );
    if (this.target.boss) gain += Math.floor(this.combo * 2);
    if (this.frenzyLeft > 0) gain *= 2;
    this.score += gain;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.burst(this.target.x, this.target.y, this.target.boss);
    this.toast(
      this.target.boss ? `首领击破 +${gain}` : perfect ? `完美 +${gain}` : `命中 +${gain}`,
      this.target.boss || perfect ? COLORS.gold : COLORS.ink
    );
    beep(this.soundOn, this.target.boss ? 920 : perfect ? 780 : 560, 0.055, 'sine', 0.025);
    if (perfect) {
      beep(this.soundOn, 1180, 0.07, 'triangle', 0.015);
      this.shake = 4;
    }
    if (this.combo === 10 || this.combo === 20 || this.combo === 30 || this.combo === 40) {
      this.startFrenzy();
    }
    this.target = null;
    this.spawnAt = this.gameTime + Math.max(55, 205 - this.combo * 4);
  }

  endGame() {
    if (this.gameState !== 'playing') return;
    this.gameState = 'result';
    this.target = null;
    this.spawnAt = 0;
    fadeOutBgm();

    if (this.mode === 'timed') {
      this.oldBest = this.timedBest;
      if (this.score > this.timedBest) {
        this.timedBest = this.score;
      }
      if (this.maxCombo > this.bestCombo) this.bestCombo = this.maxCombo;
      this.save();
      this.commitRankRecord(); // 限时一局结束即记入
    } else {
      this.oldBest = this.best;
      if (this.score > this.best) this.best = this.score;
      if (this.maxCombo > this.bestCombo) this.bestCombo = this.maxCombo;
      this.save();
      if (this.mode === 'daily') {
        const oldDaily = getNumber(dailyKey(), 0);
        if (this.score > oldDaily) setItem(dailyKey(), this.score);
      }
      // 经典：仍可复活则挂起成绩，用尽次数后再入库
      if (this.revivesUsed >= REVIVE_MAX) this.commitRankRecord();
      else this.pendingRank = true;
    }
    this.shake = 7;
    endBeep(this.soundOn);
    refreshMenuShare(this.score, this.mode);
  }

  commitRankRecord() {
    const playedAt = Date.now();
    const duration = Math.max(0, playedAt - (this.runStartedAt || playedAt));
    const rankMode = this.mode === 'timed' ? 'timed' : 'classic';
    const round = Math.max(0, this.round - 1);
    saveRankRecord(rankMode, {
      score: this.score,
      combo: this.maxCombo,
      round,
      at: playedAt,
      duration,
      mode: this.mode,
    });
    this.pendingRank = false;
    // 全球榜：异步上报，不阻断结算
    submitGlobalScore({
      mode: rankMode,
      score: this.score,
      combo: this.maxCombo,
      round,
    }).catch(() => {});
    // 任务进度（以最终结算为准）
    recordRun({
      mode: this.mode,
      score: this.score,
      maxCombo: this.maxCombo,
      best: this.best,
      bestCombo: this.bestCombo,
      timedBest: this.timedBest,
      skinsUnlocked: this.unlockedSkins().length,
    });
  }

  loadGlobalRanks(force = false) {
    if (this.rankScope !== 'global' && !force) return;
    if (this.globalStatus === 'loading' && !force) return;
    const token = ++this.globalFetchToken;
    this.globalStatus = 'loading';
    this.globalError = '';
    getPlayerId();
    getNickname();
    fetchGlobalRanks(this.rankTab)
      .then((res) => {
        if (token !== this.globalFetchToken) return;
        this.globalRanks = (res && res.list) || [];
        this.globalMyRank = res ? res.myRank : null;
        this.globalMyScore = res ? res.myScore : null;
        this.globalStatus = 'ok';
      })
      .catch((err) => {
        if (token !== this.globalFetchToken) return;
        this.globalRanks = [];
        this.globalMyRank = null;
        this.globalMyScore = null;
        this.globalStatus = 'error';
        this.globalError =
          (err && err.message) || '加载失败，请检查网络或云端表是否已创建';
      });
  }

  commitPendingRank() {
    if (this.pendingRank) this.commitRankRecord();
  }

  revive() {
    if (this.mode === 'timed') return;
    if (this.gameState !== 'result') return;
    if (this.revivesUsed >= REVIVE_MAX) {
      this.toast('本局复活次数已用完', '#999999');
      return;
    }
    if (this.coins < REVIVE_COST) {
      this.toast(`金币不足，需要 ${REVIVE_COST} 金币`, COLORS.red);
      return;
    }
    this.coins -= REVIVE_COST;
    this.save();
    this.revivesUsed += 1;
    this.pendingRank = false;
    this.gameState = 'playing';
    this.target = null;
    this.reviveCountdown = 3;
    this.reviveAt = this.gameTime + 600;
    this.toast(`复活中 3 · 剩余 ${REVIVE_MAX - this.revivesUsed} 次`, COLORS.gold);
  }

  tickRevive() {
    if (this.reviveCountdown <= 0) return;
    if (this.gameTime < this.reviveAt) return;
    this.reviveCountdown -= 1;
    if (this.reviveCountdown <= 0) {
      this.gameState = 'playing';
      this.combo = Math.floor(this.combo * 0.65);
      this.target = null;
      startBgm(this.soundOn);
      this.spawnTarget();
      this.toast('继续！', COLORS.green);
      return;
    }
    this.reviveAt = this.gameTime + 600;
    this.toast(`复活中 ${this.reviveCountdown}`, COLORS.gold);
  }

  pauseGame() {
    if (this.gameState !== 'playing') return;
    this.gameState = 'paused';
    pauseBgm();
    if (this.target) this.target.pausedAge = this.gameTime - this.target.born;
    if (this.spawnAt > 0) {
      this.spawnPauseRemain = Math.max(0, this.spawnAt - this.gameTime);
      this.spawnAt = 0;
    } else {
      this.spawnPauseRemain = 0;
    }
  }

  resumeGame() {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    startBgm(this.soundOn);
    if (this.target && this.target.pausedAge != null) {
      this.target.born = this.gameTime - this.target.pausedAge;
      this.target.pausedAge = null;
    } else if (this.spawnPauseRemain > 0) {
      this.spawnAt = this.gameTime + this.spawnPauseRemain;
      this.spawnPauseRemain = 0;
    } else if (!this.target) {
      this.spawnTarget();
    }
  }

  burst(x, y, boss = false) {
    const n = boss ? 48 : 22;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * (boss ? 6 : 4);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 1 + Math.random() * 3,
        life: 1,
        boss,
      });
    }
  }

  circle(x, y, r, color, width = 3, alpha = 1) {
    if (r <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ——— UI helpers ———

  addBtn(id, x, y, w, h) {
    this.buttons.push({ id, x, y, w, h });
  }

  isPressed(id) {
    return this.pressedId === id;
  }

  /** 按下缩放，对齐 V10 :active scale(.985) */
  beginPressTransform(x, y, w, h, id) {
    if (!this.isPressed(id)) return false;
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.97, 0.97);
    ctx.translate(-cx, -cy);
    return true;
  }

  endPressTransform(pressed) {
    if (pressed) ctx.restore();
  }

  drawBtn(label, x, y, w, h, id, style) {
    const pressed = this.beginPressTransform(x, y, w, h, id);
    if (style === 'dark') {
      fillRound(x, y, w, h, 13, pressed ? '#000000' : COLORS.ink);
      ctx.fillStyle = '#fff';
    } else if (style === 'gold') {
      fillRound(x, y, w, h, 13, pressed ? '#a6791c' : COLORS.gold);
      ctx.fillStyle = '#fff';
    } else if (style === 'primary') {
      fillRound(x, y, w, h, 17, pressed ? '#000000' : COLORS.ink);
      ctx.fillStyle = '#fff';
    } else {
      fillRound(x, y, w, h, 13, pressed ? '#f0f0ec' : COLORS.paper);
      strokeRound(x, y, w, h, 13, COLORS.line);
      ctx.fillStyle = '#333333';
    }
    ctx.font = font(800, style === 'primary' ? 15 : 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    this.endPressTransform(pressed);
    this.addBtn(id, x - 2, y - 2, w + 4, h + 4);
  }

  drawHomeCard(c, cardW, cardH) {
    const pressed = this.beginPressTransform(c.x, c.y, cardW, cardH, c.id);
    const bg = c.gold ? (pressed ? '#f7f1e3' : '#fffdf7') : pressed ? '#f0f0ec' : COLORS.paper;
    const border = c.gold ? '#eadfbf' : COLORS.line;
    fillRound(c.x, c.y, cardW, cardH, 16, bg);
    strokeRound(c.x, c.y, cardW, cardH, 16, border);

    const iconSize = Math.round(18 * SCALE);
    const iconColor = c.gold ? COLORS.gold : COLORS.ink;
    drawIcon(ctx, c.icon, c.x + cardW - iconSize - 12, c.y + 12, iconSize, iconColor);

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 13);
    ctx.textAlign = 'left';
    ctx.fillText(c.title, c.x + 13, c.y + Math.round(28 * SCALE));
    ctx.fillStyle = '#aaaaaa';
    ctx.font = font(400, 10);
    ctx.fillText(c.sub, c.x + 13, c.y + Math.round(48 * SCALE));
    this.endPressTransform(pressed);
    this.addBtn(c.id, c.x, c.y, cardW, cardH);
  }

  drawHomeSmallCard(id, x, y, w, h, title, sub, iconName) {
    const pressed = this.beginPressTransform(x, y, w, h, id);
    fillRound(x, y, w, h, 13, pressed ? '#f0f0ec' : COLORS.paper);
    strokeRound(x, y, w, h, 13, COLORS.line);

    const iconSize = Math.round(18 * SCALE);
    drawIcon(ctx, iconName, x + w - iconSize - 12, y + (h - iconSize) / 2, iconSize, COLORS.ink);

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 12);
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 13, y + Math.round(24 * SCALE));
    ctx.fillStyle = '#777777';
    ctx.font = font(400, 10);
    ctx.fillText(sub, x + 13, y + Math.round(42 * SCALE));
    this.endPressTransform(pressed);
    this.addBtn(id, x, y, w, h);
  }

  // ——— Screens ———

  drawHome() {
    const top = SAFE_TOP + Math.round(10 * SCALE);
    const bottom = H - SAFE_BOTTOM - Math.round(12 * SCALE);

    // top: BEST + coins
    ctx.fillStyle = '#aaaaaa';
    ctx.font = font(500, 9);
    ctx.textAlign = 'left';
    ctx.fillText('最高分', PAD, top + Math.round(12 * SCALE));
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 24);
    ctx.fillText(String(this.best), PAD, top + Math.round(40 * SCALE));

    const coinText = String(this.coins);
    ctx.font = font(800, 12);
    const coinW = Math.max(72, ctx.measureText(coinText).width + 36);
    const coinH = Math.round(34 * SCALE);
    const coinX = W - PAD - coinW;
    const coinY = top;
    fillRound(coinX, coinY, coinW, coinH, 12, COLORS.paper);
    strokeRound(coinX, coinY, coinW, coinH, 12, COLORS.line);
    const coinIcon = Math.round(16 * SCALE);
    drawIconCenter(ctx, 'coin', coinX + 16, coinY + coinH / 2, coinIcon, COLORS.gold);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(coinText, coinX + 28, coinY + coinH / 2);
    ctx.textBaseline = 'alphabetic';

    // hero — 垂直居中偏上，底部留给卡片
    const cardsBlockH =
      Math.round(52 + 9 + 44 + 14 + 73 * 2 + 9 + 56 + 9 + 56 + 9 + 12) * SCALE;
    const heroBottom = bottom - cardsBlockH - Math.round(8 * SCALE);
    const heroCenter = Math.min(H * 0.32, (top + 50 + heroBottom) / 2);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = font(500, 9);
    ctx.textAlign = 'center';
    ctx.fillText('差一点点', W / 2, heroCenter - Math.round(52 * SCALE));

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 56);
    ctx.fillText('差一点', W / 2, heroCenter - Math.round(8 * SCALE));

    ctx.fillStyle = '#999999';
    ctx.font = font(400, 12);
    ctx.fillText('等待 · 判断 · 点击', W / 2, heroCenter + Math.round(28 * SCALE));
    ctx.fillText('越接近中心，得分越高', W / 2, heroCenter + Math.round(48 * SCALE));

    const playH = Math.round(52 * SCALE);
    const playY = heroCenter + Math.round(68 * SCALE);
    this.drawBtn('开始挑战', PAD, playY, W - PAD * 2, playH, 'play', 'primary');
    const timedH = Math.round(44 * SCALE);
    this.drawBtn(
      '限时模式 · 1 分钟',
      PAD,
      playY + playH + 9,
      W - PAD * 2,
      timedH,
      'play_timed',
      'light'
    );

    // 2x2 cards
    const daily = getNumber(dailyKey(), 0);
    const gap = 9;
    const cardW = (W - PAD * 2 - gap) / 2;
    const cardH = Math.round(73 * SCALE);
    let cy = playY + playH + 9 + timedH + Math.round(14 * SCALE);
    // 若溢出，整体上移卡片区
    const needBottom =
      cy + cardH * 2 + gap + Math.round(56 * SCALE) + gap + Math.round(56 * SCALE) + gap;
    if (needBottom > bottom) {
      cy -= needBottom - bottom;
    }

    const cards = [
      {
        id: 'open_daily',
        icon: 'daily',
        title: '每日挑战',
        sub: `今日最高 · ${daily}`,
        gold: true,
        x: PAD,
        y: cy,
      },
      {
        id: 'open_task',
        icon: 'task',
        title: '任务',
        sub: (() => {
          const p = this.taskProgress();
          return p.claimable > 0
            ? `可领取 ${p.claimable} · 每日 ${p.done}/${p.total}`
            : `每日进度 · ${p.done}/${p.total}`;
        })(),
        gold: false,
        x: PAD + cardW + gap,
        y: cy,
      },
      {
        id: 'open_rank',
        icon: 'rank',
        title: '排行榜',
        sub: `本地 / 全球 · 经典 ${this.best}`,
        gold: false,
        x: PAD,
        y: cy + cardH + gap,
      },
      {
        id: 'open_skin',
        icon: 'skin',
        title: '皮肤',
        sub: `已解锁 · ${this.unlockedSkins().length}`,
        gold: false,
        x: PAD + cardW + gap,
        y: cy + cardH + gap,
      },
    ];

    for (let i = 0; i < cards.length; i++) {
      this.drawHomeCard(cards[i], cardW, cardH);
    }

    // bottom small cards（与上方卡片同高、图标靠右）
    const smY = cy + cardH * 2 + gap + gap;
    const smH = Math.round(56 * SCALE);
    const smW = cardW;
    this.drawHomeSmallCard('open_reward', PAD, smY, smW, smH, '今日奖励', '领取 20 金币', 'gift');
    this.drawHomeSmallCard(
      'sound',
      PAD + smW + gap,
      smY,
      smW,
      smH,
      `声音：${this.soundOn ? '开' : '关'}`,
      '游戏音效',
      this.soundOn ? 'soundOn' : 'soundOff'
    );

    const shareY = smY + smH + gap;
    this.drawHomeSmallCard('open_intro', PAD, shareY, smW, smH, '游戏介绍', '玩法说明', 'info');
    this.drawHomeSmallCard(
      'share_home',
      PAD + smW + gap,
      shareY,
      smW,
      smH,
      '分享好友',
      '邀请一起玩',
      'share'
    );
  }

  drawHud() {
    const top = SAFE_TOP + Math.round(8 * SCALE);
    const timed = this.mode === 'timed';

    ctx.fillStyle = '#aaaaaa';
    ctx.font = font(500, 9);
    ctx.textAlign = 'left';
    ctx.fillText(timed ? '剩余' : '最高', PAD + 2, top + 12);
    ctx.textAlign = 'center';
    ctx.fillText('得分', W / 2, top + 12);
    ctx.textAlign = 'right';
    ctx.fillText('连击', W - PAD - 2, top + 12);

    ctx.fillStyle = timed && this.timedLeft <= 10000 ? COLORS.red : COLORS.ink;
    ctx.font = font(900, timed ? 22 : 20);
    ctx.textAlign = 'left';
    ctx.fillText(timed ? formatTime(this.timedLeft) : String(this.best), PAD + 2, top + 36);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 29);
    ctx.textAlign = 'center';
    ctx.fillText(String(this.score), W / 2, top + 40);
    ctx.font = font(900, 20);
    ctx.textAlign = 'right';
    ctx.fillText(`×${this.combo}`, W - PAD - 2, top + 36);

    const trackY = top + Math.round(52 * SCALE);
    fillRound(PAD + 2, trackY, W - PAD * 2 - 4, 3, 4, COLORS.line);
    let prog = 0;
    if (timed) {
      prog = (this.timedLeft / TIMED_MS) * (W - PAD * 2 - 4);
      if (prog > 0) {
        fillRound(
          PAD + 2,
          trackY,
          prog,
          3,
          4,
          this.timedLeft <= 10000 ? COLORS.red : COLORS.ink
        );
      }
    } else {
      prog = ((this.round % 10) / 10) * (W - PAD * 2 - 4);
      if (prog > 0) fillRound(PAD + 2, trackY, prog, 3, 4, COLORS.ink);
    }

    if (this.frenzyLeft > 0) {
      fillRound(PAD + 2, trackY + 8, W - PAD * 2 - 4, 3, 4, '#eadfbf');
      fillRound(
        PAD + 2,
        trackY + 8,
        Math.max(0, (this.frenzyLeft / 9000) * (W - PAD * 2 - 4)),
        3,
        4,
        COLORS.gold
      );
    }

    // pause
    const size = Math.round(36 * SCALE);
    const bx = W - PAD - size;
    const by = top + Math.round(64 * SCALE);
    const pausePressed = this.beginPressTransform(bx, by, size, size, 'pause');
    fillRound(bx, by, size, size, 11, pausePressed ? '#f0f0ec' : COLORS.paper);
    strokeRound(bx, by, size, size, 11, COLORS.line);
    drawIconCenter(ctx, 'pause', bx + size / 2, by + size / 2, Math.round(18 * SCALE), COLORS.ink);
    this.endPressTransform(pausePressed);
    this.addBtn('pause', bx - 4, by - 4, size + 8, size + 8);
  }

  drawOverlayCard(drawInner) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, W, H);
    const maxW = Math.min(W - 40, 390);
    const cardW = maxW;
    // estimate height via callback layout starting y
    const cardX = (W - cardW) / 2;
    const cardY = Math.max(SAFE_TOP + 40, H * 0.18);
    const pad = Math.round(23 * SCALE);
    // temporary measure: draw white card then content; height computed inside
    const metrics = { h: 0 };
    drawInner(cardX, cardY, cardW, pad, metrics, true);
    const cardH = metrics.h;
    fillRound(cardX, cardY, cardW, cardH, 20, 'rgba(255,255,255,0.97)');
    strokeRound(cardX, cardY, cardW, cardH, 20, COLORS.line);
    drawInner(cardX, cardY, cardW, pad, metrics, false);
  }

  drawResult() {
    this.drawOverlayCard((x, y, w, pad, metrics, measureOnly) => {
      let cy = y + pad;
      const innerW = w - pad * 2;

      const line = (fn) => {
        if (!measureOnly) fn();
      };

      line(() => {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = font(500, 9);
        ctx.textAlign = 'center';
        ctx.fillText(this.mode === 'timed' ? '限时模式 · 本局得分' : '本局得分', x + w / 2, cy + 8);
      });
      cy += Math.round(18 * SCALE);

      line(() => {
        ctx.fillStyle = COLORS.ink;
        ctx.font = font(900, 64);
        ctx.textAlign = 'center';
        ctx.fillText(String(this.score), x + w / 2, cy + Math.round(52 * SCALE));
      });
      cy += Math.round(64 * SCALE);

      if (this.score > this.oldBest) {
        line(() => {
          ctx.fillStyle = COLORS.gold;
          ctx.font = font(800, 11);
          ctx.fillText('新纪录', x + w / 2, cy + 8);
        });
      }
      cy += Math.round(20 * SCALE);

      line(() => {
        fillRound(x + pad, cy, innerW, Math.round(52 * SCALE), 12, '#fafaf8');
        ctx.fillStyle = '#888888';
        ctx.font = font(400, 10);
        ctx.textAlign = 'center';
        const recordLabel =
          this.mode === 'timed'
            ? this.score > this.oldBest
              ? '新的限时纪录'
              : '距离限时最高'
            : this.score > this.oldBest
              ? '新的最高纪录'
              : '距离最高纪录';
        ctx.fillText(recordLabel, x + w / 2, cy + Math.round(18 * SCALE));
        ctx.fillStyle = COLORS.ink;
        ctx.font = font(800, 15);
        const near =
          this.score > this.oldBest
            ? `领先 ${this.score - this.oldBest} 分`
            : `${Math.max(0, this.oldBest - this.score)} 分`;
        ctx.fillText(near, x + w / 2, cy + Math.round(38 * SCALE));
      });
      cy += Math.round(62 * SCALE);

      const statH = Math.round(48 * SCALE);
      const gap = 7;
      const sw = (innerW - gap) / 2;
      line(() => {
        fillRound(x + pad, cy, sw, statH, 12, '#fafaf8');
        strokeRound(x + pad, cy, sw, statH, 12, COLORS.line);
        fillRound(x + pad + sw + gap, cy, sw, statH, 12, '#fafaf8');
        strokeRound(x + pad + sw + gap, cy, sw, statH, 12, COLORS.line);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.ink;
        ctx.font = font(800, 16);
        ctx.fillText(String(this.maxCombo), x + pad + sw / 2, cy + Math.round(22 * SCALE));
        ctx.fillText(
          String(Math.max(0, this.round - 1)),
          x + pad + sw + gap + sw / 2,
          cy + Math.round(22 * SCALE)
        );
        ctx.fillStyle = '#aaaaaa';
        ctx.font = font(400, 9);
        ctx.fillText('最高连击', x + pad + sw / 2, cy + Math.round(38 * SCALE));
        ctx.fillText('完成回合', x + pad + sw + gap + sw / 2, cy + Math.round(38 * SCALE));
      });
      cy += statH + Math.round(18 * SCALE);

      const btnH = Math.round(46 * SCALE);
      const btnGap = Math.round(10 * SCALE);
      const rowGap = Math.round(12 * SCALE);
      const canRevive = this.mode !== 'timed' && this.revivesUsed < REVIVE_MAX;

      // 主操作：复活（可选）+ 重开，次要操作并排，减少纵向拥挤
      if (canRevive) {
        if (!measureOnly) {
          const left = REVIVE_MAX - this.revivesUsed;
          const label =
            this.coins >= REVIVE_COST
              ? `立即复活 · ${REVIVE_COST} 金币（剩 ${left} 次）`
              : `立即复活 · 金币不足（需 ${REVIVE_COST}）`;
          this.drawBtn(label, x + pad, cy, innerW, btnH, 'revive', 'gold');
        }
        cy += btnH + btnGap;
      }
      if (!measureOnly) {
        this.drawBtn('重新开始', x + pad, cy, innerW, btnH, 'again', 'dark');
      }
      cy += btnH + rowGap;

      const halfW = (innerW - gap) / 2;
      const subH = Math.round(42 * SCALE);
      if (!measureOnly) {
        this.drawBtn('分享成绩', x + pad, cy, halfW, subH, 'share_result', 'light');
        this.drawBtn('返回首页', x + pad + halfW + gap, cy, halfW, subH, 'result_home', 'light');
      }
      cy += subH + pad;
      metrics.h = cy - y;
    });
  }

  drawPause() {
    this.drawOverlayCard((x, y, w, pad, metrics, measureOnly) => {
      let cy = y + pad;
      const innerW = w - pad * 2;
      if (!measureOnly) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = font(500, 9);
        ctx.textAlign = 'center';
        ctx.fillText('游戏暂停', x + w / 2, cy + 8);
      }
      cy += Math.round(28 * SCALE);
      if (!measureOnly) {
        ctx.fillStyle = COLORS.ink;
        ctx.font = font(900, 22);
        ctx.fillText('稳住', x + w / 2, cy + 8);
      }
      cy += Math.round(36 * SCALE);
      if (!measureOnly) {
        ctx.fillStyle = '#999999';
        ctx.font = font(400, 12);
        ctx.fillText('下一次，晚一点。', x + w / 2, cy);
      }
      cy += Math.round(28 * SCALE);
      const btnH = Math.round(44 * SCALE);
      if (!measureOnly) {
        this.drawBtn('继续游戏', x + pad, cy, innerW, btnH, 'resume', 'dark');
      }
      cy += btnH + 8;
      if (!measureOnly) {
        this.drawBtn('退出本局', x + pad, cy, innerW, btnH, 'pause_home', 'light');
      }
      cy += btnH + pad;
      metrics.h = cy - y;
    });
  }

  drawPanelChrome(title, desc) {
    const top = SAFE_TOP + Math.round(12 * SCALE);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 28);
    ctx.textAlign = 'left';
    ctx.fillText(title, PAD, top + Math.round(28 * SCALE));

    const backW = Math.round(72 * SCALE);
    const backH = Math.round(32 * SCALE);
    const bx = W - PAD - backW;
    const by = top + Math.round(8 * SCALE);
    const backPressed = this.beginPressTransform(bx, by, backW, backH, 'back_home');
    fillRound(bx, by, backW, backH, 11, backPressed ? '#f0f0ec' : COLORS.paper);
    strokeRound(bx, by, backW, backH, 11, COLORS.line);
    const backIcon = Math.round(14 * SCALE);
    drawIcon(ctx, 'back', bx + 8, by + (backH - backIcon) / 2, backIcon, COLORS.ink);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 11);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('首页', bx + 8 + backIcon + 2, by + backH / 2);
    ctx.textBaseline = 'alphabetic';
    this.endPressTransform(backPressed);
    this.addBtn('back_home', bx - 2, by - 2, backW + 4, backH + 4);

    ctx.fillStyle = '#999999';
    ctx.font = font(400, 11);
    ctx.textAlign = 'left';
    ctx.fillText(desc, PAD, top + Math.round(56 * SCALE));
    return top + Math.round(78 * SCALE);
  }

  drawIntroPanel() {
    let y = this.drawPanelChrome('游戏介绍', '差一点点就完美。把玩法告诉好友一起挑战。');
    const boxH = Math.round(278 * SCALE);
    fillRound(PAD, y, W - PAD * 2, boxH, 16, COLORS.paper);
    strokeRound(PAD, y, W - PAD * 2, boxH, 16, COLORS.line);

    const lines = [
      { t: '怎么玩', c: COLORS.ink, w: 800, s: 13 },
      { t: '圆环从大变小，在合适时机点击靠近圆心。', c: '#666666', w: 400, s: 11 },
      { t: '越接近中心，得分越高；点空或错过即结束。', c: '#666666', w: 400, s: 11 },
      { t: '', c: COLORS.ink, w: 400, s: 8 },
      { t: '模式', c: COLORS.ink, w: 800, s: 13 },
      { t: '经典：一点即终，可用金币复活。', c: '#666666', w: 400, s: 11 },
      { t: '限时：1 分钟冲分，未命中不计分。', c: '#666666', w: 400, s: 11 },
      { t: '每日挑战：更高难度，冲击今日最高。', c: '#666666', w: 400, s: 11 },
      { t: '', c: COLORS.ink, w: 400, s: 8 },
      { t: '特殊', c: COLORS.ink, w: 800, s: 13 },
      { t: '连击提升倍率；达到节点触发狂热 ×2。', c: '#666666', w: 400, s: 11 },
      { t: '经典每 10 回合出现首领，击破奖励更高。', c: '#666666', w: 400, s: 11 },
    ];

    let ly = y + Math.round(22 * SCALE);
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.t) {
        ly += Math.round(line.s * SCALE);
        continue;
      }
      ctx.fillStyle = line.c;
      ctx.font = font(line.w, line.s);
      ctx.fillText(line.t, PAD + 16, ly);
      ly += Math.round((line.s + 10) * SCALE);
    }

    y += boxH + Math.round(14 * SCALE);
    this.drawBtn(
      '分享给好友',
      PAD,
      y,
      W - PAD * 2,
      Math.round(48 * SCALE),
      'share_intro',
      'gold'
    );
    y += Math.round(48 * SCALE) + 10;
    this.drawBtn(
      '开始挑战',
      PAD,
      y,
      W - PAD * 2,
      Math.round(48 * SCALE),
      'play',
      'dark'
    );
  }

  drawDailyPanel() {
    let y = this.drawPanelChrome('每日挑战', '每天一次，固定节奏。完成后记录今日最高分。');
    const daily = getNumber(dailyKey(), 0);
    fillRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.paper);
    strokeRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.line);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 13);
    ctx.textAlign = 'left';
    ctx.fillText('今日极限', PAD + 14, y + Math.round(28 * SCALE));
    ctx.fillStyle = '#999999';
    ctx.font = font(400, 10);
    ctx.fillText('目标：冲击 300 分以上', PAD + 14, y + Math.round(48 * SCALE));
    this.drawBtn(
      '开始今日挑战',
      PAD + 14,
      y + Math.round(62 * SCALE),
      W - PAD * 2 - 28,
      Math.round(42 * SCALE),
      'daily_play',
      'dark'
    );

    y += Math.round(132 * SCALE);
    const mw = (W - PAD * 2 - 9) / 2;
    const mh = Math.round(70 * SCALE);
    fillRound(PAD, y, mw, mh, 15, COLORS.paper);
    strokeRound(PAD, y, mw, mh, 15, COLORS.line);
    fillRound(PAD + mw + 9, y, mw, mh, 15, COLORS.paper);
    strokeRound(PAD + mw + 9, y, mw, mh, 15, COLORS.line);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 24);
    ctx.textAlign = 'left';
    ctx.fillText(String(daily), PAD + 14, y + Math.round(34 * SCALE));
    ctx.fillText(String(this.coins), PAD + mw + 9 + 14, y + Math.round(34 * SCALE));
    ctx.fillStyle = '#999999';
    ctx.font = font(400, 10);
    ctx.fillText('今日最高', PAD + 14, y + Math.round(54 * SCALE));
    ctx.fillText('金币', PAD + mw + 9 + 14, y + Math.round(54 * SCALE));
  }

  drawTaskPanel() {
    let y = this.drawPanelChrome('任务', '每日任务每天刷新；成就任务永久累计，完成后可领金币。');

    const tabH = Math.round(36 * SCALE);
    const tabW = (W - PAD * 2 - 8) / 2;
    const tabs = [
      { id: 'task_tab_daily', key: 'daily', label: '每日任务' },
      { id: 'task_tab_achieve', key: 'achieve', label: '成就任务' },
    ];
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      const tx = PAD + i * (tabW + 8);
      const active = this.taskTab === t.key;
      const tabPressed = this.beginPressTransform(tx, y, tabW, tabH, t.id);
      let bg = active ? COLORS.ink : COLORS.paper;
      if (tabPressed) bg = active ? '#000000' : '#f0f0ec';
      fillRound(tx, y, tabW, tabH, 12, bg);
      if (!active) strokeRound(tx, y, tabW, tabH, 12, COLORS.line);
      ctx.fillStyle = active ? '#ffffff' : '#666666';
      ctx.font = font(800, 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + tabW / 2, y + tabH / 2);
      ctx.textBaseline = 'alphabetic';
      this.endPressTransform(tabPressed);
      this.addBtn(t.id, tx, y, tabW, tabH);
    }
    y += tabH + Math.round(12 * SCALE);

    const ctxData = this.taskContext();
    const tasks =
      this.taskTab === 'daily' ? listDailyTasks(ctxData) : listAchieveTasks(ctxData);
    const claimPrefix = this.taskTab === 'daily' ? 'claim_daily_' : 'claim_ach_';

    const claimable = tasks.filter((t) => t.claimable).length;
    const done = tasks.filter((t) => t.done).length;
    const summaryH = Math.round(52 * SCALE);
    fillRound(PAD, y, W - PAD * 2, summaryH, 14, this.taskTab === 'daily' ? '#fffdf7' : COLORS.paper);
    strokeRound(
      PAD,
      y,
      W - PAD * 2,
      summaryH,
      14,
      this.taskTab === 'daily' ? '#eadfbf' : COLORS.line
    );
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 13);
    ctx.textAlign = 'left';
    ctx.fillText(
      this.taskTab === 'daily' ? '今日目标' : '永久成就',
      PAD + 14,
      y + Math.round(22 * SCALE)
    );
    ctx.fillStyle = '#999999';
    ctx.font = font(400, 11);
    ctx.fillText(`完成 ${done}/${tasks.length}`, PAD + 14, y + Math.round(40 * SCALE));
    ctx.textAlign = 'right';
    ctx.fillStyle = claimable ? COLORS.gold : '#999999';
    ctx.font = font(700, 12);
    ctx.fillText(claimable ? `${claimable} 个可领取` : '暂无奖励', W - PAD - 14, y + Math.round(32 * SCALE));
    y += summaryH + Math.round(10 * SCALE);

    const listTop = y;
    this.taskListTop = listTop;
    const hintH = Math.round(28 * SCALE);
    const screenBottom = H - SAFE_BOTTOM - Math.round(10 * SCALE);
    const listBottom = screenBottom - hintH;
    const rowH = Math.round(68 * SCALE);
    const gap = 8;
    const viewH = Math.max(40, listBottom - listTop);
    const contentH = tasks.length * (rowH + gap) - gap;
    this.taskScrollMax = Math.max(0, contentH - viewH);
    if (this.taskScroll > this.taskScrollMax) this.taskScroll = this.taskScrollMax;

    if (!tasks.length) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(500, 13);
      ctx.textAlign = 'center';
      ctx.fillText('暂无任务', W / 2, y + 40);
      return;
    }

    // 列表裁剪区：不占底部提示条
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD - 2, listTop, W - PAD * 2 + 4, viewH);
    ctx.clip();

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const ry = listTop - this.taskScroll + i * (rowH + gap);
      if (ry + rowH < listTop || ry > listBottom) continue;

      fillRound(PAD, ry, W - PAD * 2, rowH, 14, COLORS.paper);
      strokeRound(PAD, ry, W - PAD * 2, rowH, 14, COLORS.line);

      ctx.fillStyle = COLORS.ink;
      ctx.font = font(800, 13);
      ctx.textAlign = 'left';
      ctx.fillText(t.title, PAD + 14, ry + Math.round(22 * SCALE));
      ctx.fillStyle = '#999999';
      ctx.font = font(400, 10);
      ctx.fillText(t.desc, PAD + 14, ry + Math.round(40 * SCALE));
      ctx.fillStyle = COLORS.gold;
      ctx.font = font(700, 11);
      ctx.fillText(`+${t.reward} 金币`, PAD + 14, ry + Math.round(56 * SCALE));

      const btnW = Math.round(72 * SCALE);
      const btnH = Math.round(32 * SCALE);
      const bx = W - PAD - 14 - btnW;
      const by = ry + (rowH - btnH) / 2;

      if (t.claimed) {
        ctx.fillStyle = COLORS.green;
        ctx.font = font(700, 12);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('已领取', W - PAD - 14, ry + rowH / 2);
        ctx.textBaseline = 'alphabetic';
      } else if (t.claimable) {
        this.drawBtn('领取', bx, by, btnW, btnH, claimPrefix + t.id, 'gold');
      } else {
        drawIconCenter(ctx, 'circle', W - PAD - 24, ry + rowH / 2, Math.round(18 * SCALE), '#cccccc');
      }
    }
    ctx.restore();

    // 底部提示条：独立区域，不叠卡片
    if (this.taskScrollMax > 0) {
      const tipY = listBottom;
      ctx.fillStyle = this.getBg();
      ctx.fillRect(0, tipY, W, screenBottom - tipY + SAFE_BOTTOM + 4);

      // 顶部分隔线
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, tipY + 0.5);
      ctx.lineTo(W - PAD, tipY + 0.5);
      ctx.stroke();

      const atEnd = this.taskScroll >= this.taskScrollMax - 1;
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(500, 11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(atEnd ? '已经到底了' : '上滑查看更多', W / 2, tipY + hintH / 2);
      ctx.textBaseline = 'alphabetic';
    }
  }

  drawRankPanel() {
    const scopeLabel =
      this.rankScope === 'global' ? '全球排行，按最高分取前 30 名。' : '本地记录，按模式分别统计最高分。';
    let y = this.drawPanelChrome('排行榜', scopeLabel);

    // 本地 / 全球
    const scopeH = Math.round(34 * SCALE);
    const scopeW = (W - PAD * 2 - 8) / 2;
    const scopes = [
      { id: 'rank_scope_local', key: 'local', label: '本地' },
      { id: 'rank_scope_global', key: 'global', label: '全球' },
    ];
    for (let i = 0; i < scopes.length; i++) {
      const t = scopes[i];
      const tx = PAD + i * (scopeW + 8);
      const active = this.rankScope === t.key;
      const tabPressed = this.beginPressTransform(tx, y, scopeW, scopeH, t.id);
      let bg = active ? COLORS.ink : COLORS.paper;
      if (tabPressed) bg = active ? '#000000' : '#f0f0ec';
      fillRound(tx, y, scopeW, scopeH, 11, bg);
      if (!active) strokeRound(tx, y, scopeW, scopeH, 11, COLORS.line);
      ctx.fillStyle = active ? '#ffffff' : '#666666';
      ctx.font = font(800, 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + scopeW / 2, y + scopeH / 2);
      ctx.textBaseline = 'alphabetic';
      this.endPressTransform(tabPressed);
      this.addBtn(t.id, tx, y, scopeW, scopeH);
    }
    y += scopeH + Math.round(10 * SCALE);

    // 经典 / 限时
    const tabH = Math.round(34 * SCALE);
    const tabW = (W - PAD * 2 - 8) / 2;
    const tabs = [
      { id: 'rank_tab_classic', key: 'classic', label: '经典模式' },
      { id: 'rank_tab_timed', key: 'timed', label: '限时模式' },
    ];
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      const tx = PAD + i * (tabW + 8);
      const active = this.rankTab === t.key;
      const tabPressed = this.beginPressTransform(tx, y, tabW, tabH, t.id);
      let bg = active ? COLORS.ink : COLORS.paper;
      if (tabPressed) bg = active ? '#000000' : '#f0f0ec';
      fillRound(tx, y, tabW, tabH, 11, bg);
      if (!active) strokeRound(tx, y, tabW, tabH, 11, COLORS.line);
      ctx.fillStyle = active ? '#ffffff' : '#666666';
      ctx.font = font(800, 12);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + tabW / 2, y + tabH / 2);
      ctx.textBaseline = 'alphabetic';
      this.endPressTransform(tabPressed);
      this.addBtn(t.id, tx, y, tabW, tabH);
    }
    y += tabH + Math.round(12 * SCALE);

    if (this.rankScope === 'global') {
      this.drawGlobalRankList(y);
    } else {
      this.drawLocalRankList(y);
    }
  }

  drawLocalRankList(y) {
    const ranks = loadRanks(this.rankTab);
    const bestScore = this.rankTab === 'timed' ? this.timedBest : this.best;

    const summaryH = Math.round(58 * SCALE);
    fillRound(PAD, y, W - PAD * 2, summaryH, 14, this.rankTab === 'timed' ? '#fffdf7' : COLORS.paper);
    strokeRound(
      PAD,
      y,
      W - PAD * 2,
      summaryH,
      14,
      this.rankTab === 'timed' ? '#eadfbf' : COLORS.line
    );
    ctx.fillStyle = '#999999';
    ctx.font = font(500, 10);
    ctx.textAlign = 'left';
    ctx.fillText(this.rankTab === 'timed' ? '限时最高分' : '经典最高分', PAD + 14, y + Math.round(20 * SCALE));
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 22);
    ctx.fillText(String(bestScore || 0), PAD + 14, y + Math.round(44 * SCALE));
    ctx.fillStyle = '#999999';
    ctx.font = font(400, 11);
    ctx.textAlign = 'right';
    ctx.fillText(`共 ${ranks.length} 条记录`, W - PAD - 14, y + Math.round(34 * SCALE));
    y += summaryH + Math.round(10 * SCALE);

    const listBottom = H - SAFE_BOTTOM - Math.round(16 * SCALE);
    const rowH = Math.round(62 * SCALE);
    const maxRows = Math.max(1, Math.floor((listBottom - y) / (rowH + 8)));
    const show = ranks.slice(0, maxRows);

    if (!show.length) {
      fillRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.paper);
      strokeRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.line);
      const emptyIcon = this.rankTab === 'timed' ? 'clock' : 'rank';
      drawIconCenter(ctx, emptyIcon, W / 2, y + Math.round(42 * SCALE), Math.round(28 * SCALE), '#cccccc');
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(500, 13);
      ctx.textAlign = 'center';
      ctx.fillText('暂无本地记录', W / 2, y + Math.round(78 * SCALE));
      ctx.font = font(400, 11);
      ctx.fillText('去玩一局后会显示在这里', W / 2, y + Math.round(98 * SCALE));
      return;
    }

    for (let i = 0; i < show.length; i++) {
      const r = show[i];
      const ry = y + i * (rowH + 8);
      if (ry + rowH > listBottom) break;
      this.drawRankRow(ry, rowH, i + 1, String(r.score || 0), this.localRankSub(r), formatPlayAt(r.at), false);
    }
  }

  localRankSub(r) {
    const subBits = [];
    if (r.combo) subBits.push(`连击 ×${r.combo}`);
    if (r.round) subBits.push(`${r.round} 回合`);
    if (this.rankTab === 'timed') subBits.push('1 分钟');
    else if (r.mode === 'daily') subBits.push('每日挑战');
    else if (r.duration) subBits.push(`用时 ${formatTime(r.duration)}`);
    return subBits.join(' · ') || '本地成绩';
  }

  drawGlobalRankList(y) {
    const summaryH = Math.round(58 * SCALE);
    fillRound(PAD, y, W - PAD * 2, summaryH, 14, '#fffdf7');
    strokeRound(PAD, y, W - PAD * 2, summaryH, 14, '#eadfbf');
    ctx.fillStyle = '#999999';
    ctx.font = font(500, 10);
    ctx.textAlign = 'left';
    ctx.fillText(getNickname(), PAD + 14, y + Math.round(20 * SCALE));
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 18);
    const myLine =
      this.globalStatus === 'loading'
        ? '同步中…'
        : this.globalMyRank
          ? `全球第 ${this.globalMyRank} · ${this.globalMyScore || 0} 分`
          : this.globalMyScore != null
            ? `我的最高 ${this.globalMyScore} 分`
            : '暂未上榜';
    ctx.fillText(myLine, PAD + 14, y + Math.round(44 * SCALE));

    const refreshW = Math.round(72 * SCALE);
    const refreshH = Math.round(28 * SCALE);
    const rx = W - PAD - refreshW - 8;
    const ry = y + (summaryH - refreshH) / 2;
    const refreshPressed = this.beginPressTransform(rx, ry, refreshW, refreshH, 'rank_refresh');
    fillRound(rx, ry, refreshW, refreshH, 10, refreshPressed ? '#f0f0ec' : COLORS.paper);
    strokeRound(rx, ry, refreshW, refreshH, 10, COLORS.line);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(800, 11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.globalStatus === 'loading' ? '…' : '刷新', rx + refreshW / 2, ry + refreshH / 2);
    ctx.textBaseline = 'alphabetic';
    this.endPressTransform(refreshPressed);
    this.addBtn('rank_refresh', rx, ry, refreshW, refreshH);
    y += summaryH + Math.round(10 * SCALE);

    const listBottom = H - SAFE_BOTTOM - Math.round(16 * SCALE);
    const rowH = Math.round(62 * SCALE);

    if (this.globalStatus === 'loading' && !this.globalRanks.length) {
      fillRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.paper);
      strokeRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.line);
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(500, 13);
      ctx.textAlign = 'center';
      ctx.fillText('正在加载全球排行…', W / 2, y + Math.round(62 * SCALE));
      return;
    }

    if (this.globalStatus === 'error') {
      const boxH = Math.round(178 * SCALE);
      const btnH = Math.round(40 * SCALE);
      const btnY = y + boxH - Math.round(18 * SCALE) - btnH;
      fillRound(PAD, y, W - PAD * 2, boxH, 16, COLORS.paper);
      strokeRound(PAD, y, W - PAD * 2, boxH, 16, COLORS.line);

      ctx.fillStyle = COLORS.red;
      ctx.font = font(700, 14);
      ctx.textAlign = 'center';
      ctx.fillText('全球榜暂时不可用', W / 2, y + Math.round(36 * SCALE));

      ctx.fillStyle = '#888888';
      ctx.font = font(400, 11);
      const raw = String(this.globalError || '');
      let tip = '请稍后重试';
      let hint = '检查网络后点下方重新加载';
      if (/domain list|合法域名|url not in/i.test(raw)) {
        tip = '请求域名未配置';
        hint = '开发者工具可勾选不校验合法域名';
      } else if (/supabase-leaderboard|relation|does not exist|42P01/i.test(raw)) {
        tip = '云端表未就绪';
        hint = '请执行 docs/supabase-leaderboard.sql';
      } else if (raw) {
        tip = raw.length > 28 ? `${raw.slice(0, 28)}…` : raw;
      }
      ctx.fillText(tip, W / 2, y + Math.round(64 * SCALE));
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(400, 10);
      ctx.fillText(hint, W / 2, y + Math.round(86 * SCALE));

      this.drawBtn('重新加载', PAD + 36, btnY, W - PAD * 2 - 72, btnH, 'rank_refresh', 'light');
      return;
    }

    const show = this.globalRanks;
    if (!show.length) {
      fillRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.paper);
      strokeRound(PAD, y, W - PAD * 2, Math.round(120 * SCALE), 16, COLORS.line);
      drawIconCenter(ctx, 'rank', W / 2, y + Math.round(42 * SCALE), Math.round(28 * SCALE), '#cccccc');
      ctx.fillStyle = '#aaaaaa';
      ctx.font = font(500, 13);
      ctx.textAlign = 'center';
      ctx.fillText('暂无全球记录', W / 2, y + Math.round(78 * SCALE));
      ctx.font = font(400, 11);
      ctx.fillText('结算后会自动上传最高分', W / 2, y + Math.round(98 * SCALE));
      return;
    }

    const me = getPlayerId();
    const maxRows = Math.max(1, Math.floor((listBottom - y) / (rowH + 8)));
    for (let i = 0; i < Math.min(show.length, maxRows); i++) {
      const r = show[i];
      const ry = y + i * (rowH + 8);
      if (ry + rowH > listBottom) break;
      const mine = r.player_id === me;
      const subBits = [];
      if (r.combo) subBits.push(`连击 ×${r.combo}`);
      if (r.round) subBits.push(`${r.round} 回合`);
      if (mine) subBits.push('我');
      this.drawRankRow(
        ry,
        rowH,
        i + 1,
        String(r.score || 0),
        subBits.join(' · ') || '全球成绩',
        r.nickname || '匿名玩家',
        mine
      );
    }
  }

  drawRankRow(ry, rowH, rank, scoreText, subText, rightText, highlight) {
    fillRound(PAD, ry, W - PAD * 2, rowH, 14, highlight ? '#fffdf7' : COLORS.paper);
    strokeRound(PAD, ry, W - PAD * 2, rowH, 14, highlight ? '#eadfbf' : COLORS.line);

    const badge = Math.round(28 * SCALE);
    const bx = PAD + 14;
    const by = ry + (rowH - badge) / 2;
    const badgeColor = rank === 1 ? COLORS.gold : rank === 2 ? '#8a8a84' : rank === 3 ? '#b08968' : '#ecece8';
    const badgeText = rank <= 3 ? '#ffffff' : COLORS.ink;
    fillRound(bx, by, badge, badge, badge / 2, badgeColor);
    ctx.fillStyle = badgeText;
    ctx.font = font(800, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(rank), bx + badge / 2, by + badge / 2);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 20);
    ctx.textAlign = 'left';
    ctx.fillText(scoreText, bx + badge + 12, ry + Math.round(28 * SCALE));
    ctx.fillStyle = '#999999';
    ctx.font = font(400, 10);
    ctx.fillText(subText, bx + badge + 12, ry + Math.round(46 * SCALE));

    ctx.fillStyle = '#aaaaaa';
    ctx.font = font(500, 11);
    ctx.textAlign = 'right';
    ctx.fillText(String(rightText || ''), W - PAD - 14, ry + Math.round(36 * SCALE));
  }

  drawSkinPanel() {
    let y = this.drawPanelChrome('皮肤', '高分解锁主题，当前仅影响视觉主题。');
    const cols = 3;
    const gap = 8;
    const cellW = (W - PAD * 2 - gap * (cols - 1)) / cols;
    const cellH = Math.round(96 * SCALE);
    for (let i = 0; i < SKINS.length; i++) {
      const s = SKINS[i];
      const col = i % cols;
      const row = (i / cols) | 0;
      const sx = PAD + col * (cellW + gap);
      const sy = y + row * (cellH + gap);
      const unlocked = this.best >= s.need;
      const active = this.skin === s.id;
      const skinId = `skin_${s.id}`;
      const skinPressed = unlocked && this.beginPressTransform(sx, sy, cellW, cellH, skinId);
      ctx.globalAlpha = unlocked ? 1 : 0.4;
      fillRound(sx, sy, cellW, cellH, 13, skinPressed ? '#f0f0ec' : COLORS.paper);
      strokeRound(sx, sy, cellW, cellH, 13, active ? COLORS.ink : COLORS.line, active ? 1.5 : 1);
      ctx.beginPath();
      ctx.arc(sx + cellW / 2, sy + Math.round(30 * SCALE), Math.round(16 * SCALE), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(500, 10);
      ctx.textAlign = 'center';
      ctx.fillText(
        s.need ? `${s.name} · ${s.need}分` : s.name,
        sx + cellW / 2,
        sy + Math.round(68 * SCALE)
      );
      ctx.globalAlpha = 1;
      this.endPressTransform(skinPressed);
      if (unlocked) this.addBtn(skinId, sx, sy, cellW, cellH);
    }
  }

  drawRewardPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, W, H);

    const boxW = Math.min(W - 40, 350);
    const padX = 22;
    const padTop = Math.round(22 * SCALE);
    const padBottom = Math.round(22 * SCALE);
    const btnH = Math.round(44 * SCALE);
    const btnGap = 8;
    const innerW = boxW - padX * 2;

    // 按内容累加高度，避免白底包不住按钮
    let contentH = padTop;
    contentH += Math.round(28 * SCALE); // 标题
    contentH += Math.round(28 * SCALE); // 说明
    contentH += Math.round(46 * SCALE); // +20 金币
    contentH += btnH + btnGap + btnH;
    contentH += padBottom;

    const boxH = contentH;
    const bx = (W - boxW) / 2;
    const by = Math.round((H - boxH) / 2);

    fillRound(bx, by, boxW, boxH, 20, COLORS.paper);
    strokeRound(bx, by, boxW, boxH, 20, COLORS.line);

    let cy = by + padTop;

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(900, 18);
    ctx.textBaseline = 'middle';
    const giftSize = Math.round(20 * SCALE);
    const rewardTitle = '今日奖励';
    const titleW = ctx.measureText(rewardTitle).width;
    const titleStart = W / 2 - (giftSize + 6 + titleW) / 2;
    drawIcon(ctx, 'gift', titleStart, cy + Math.round(14 * SCALE) - giftSize / 2, giftSize, COLORS.ink);
    ctx.textAlign = 'left';
    ctx.fillText(rewardTitle, titleStart + giftSize + 6, cy + Math.round(14 * SCALE));
    cy += Math.round(28 * SCALE);

    ctx.fillStyle = '#999999';
    ctx.font = font(400, 12);
    ctx.textAlign = 'center';
    ctx.fillText('每天领取一次，保持回来。', W / 2, cy + Math.round(12 * SCALE));
    cy += Math.round(28 * SCALE);

    ctx.fillStyle = COLORS.gold;
    ctx.font = font(900, 30);
    const coinLabel = '+20 金币';
    const coinSize = Math.round(22 * SCALE);
    const coinW = ctx.measureText(coinLabel).width;
    const coinStart = W / 2 - (coinSize + 8 + coinW) / 2;
    drawIcon(ctx, 'coin', coinStart, cy + Math.round(20 * SCALE) - coinSize / 2, coinSize, COLORS.gold);
    ctx.textAlign = 'left';
    ctx.fillText(coinLabel, coinStart + coinSize + 8, cy + Math.round(20 * SCALE));
    cy += Math.round(46 * SCALE);

    ctx.textBaseline = 'alphabetic';
    this.drawBtn('领取', bx + padX, cy, innerW, btnH, 'claim_reward', 'dark');
    cy += btnH + btnGap;
    this.drawBtn('关闭', bx + padX, cy, innerW, btnH, 'close_reward', 'light');
  }

  drawTarget() {
    if (!this.target) return;
    const age =
      this.gameState === 'paused' && this.target.pausedAge != null
        ? this.target.pausedAge
        : this.gameTime - this.target.born;
    const p = Math.min(1, Math.max(0, age / this.target.life));
    this.target.r = this.target.max - (this.target.max - this.target.min) * p;
    const main = this.mainColor();
    const x = this.target.x + this.shakeX;
    const y = this.target.y;

    if (this.target.boss) {
      const wob = Math.sin((this.gameState === 'paused' ? age : this.gameTime) / 90 + this.target.phase) * 2.5;
      this.circle(x, y, this.target.r + 14 + wob, COLORS.red, 3, 0.17);
      this.circle(x, y, this.target.r, main, 4);
      this.circle(x, y, this.target.r * 0.5, COLORS.gold, 2);
    } else {
      this.circle(x, y, this.target.max * 1.55, main, 1, 0.06);
      this.circle(x, y, this.target.r, main, 3);
    }
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (this.gameState === 'playing' && age > this.target.life) {
      if (this.mode === 'timed') {
        this.missTarget('错过');
      } else {
        this.endGame();
      }
    }
  }

  drawParticles(dt) {
    const next = [];
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += (p.vx * dt) / 16;
      p.y += (p.vy * dt) / 16;
      p.vy += 0.08;
      p.life -= dt / 500;
      if (p.life <= 0) continue;
      next.push(p);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.boss ? COLORS.gold : this.mainColor();
      ctx.beginPath();
      ctx.arc(p.x + this.shakeX, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.particles = next;
    ctx.globalAlpha = 1;
  }

  drawToastAndBanner() {
    if (this.bannerText && this.gameTime < this.bannerUntil) {
      const p = 1 - (this.bannerUntil - this.gameTime) / 900;
      let a = 1;
      if (p < 0.2) a = p / 0.2;
      else if (p > 0.75) a = (1 - p) / 0.25;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillStyle = this.bannerColor;
      ctx.font = font(900, 11);
      ctx.textAlign = 'center';
      ctx.fillText(this.bannerText, W / 2, SAFE_TOP + Math.round(100 * SCALE));
      ctx.restore();
    }
    if (this.toastText && this.gameTime < this.toastUntil) {
      const p = 1 - (this.toastUntil - this.gameTime) / 700;
      const ty = H * 0.31 - p * 48;
      let a = p < 0.18 ? p / 0.18 : Math.max(0, 1 - (p - 0.18) / 0.82);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.toastColor;
      ctx.font = font(900, 22);
      ctx.textAlign = 'center';
      ctx.fillText(this.toastText, W / 2, ty);
      ctx.restore();
    }
  }

  updateShake() {
    if (this.shake > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shake *= 0.84;
      if (this.shake < 0.2) {
        this.shake = 0;
        this.shakeX = 0;
      }
    } else {
      this.shakeX = 0;
    }
  }

  loop() {
    const wall = Date.now();
    let dt = wall - this.lastWall;
    if (dt < 0) dt = 16;
    if (dt > 50) dt = 50;
    this.lastWall = wall;
    this.gameTime += dt;
    this.buttons = [];

    this.updateShake();
    this.tickRevive();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = this.getBg();
    ctx.fillRect(0, 0, W, H);

    if (this.gameState === 'playing' && this.frenzyLeft > 0) {
      this.frenzyLeft -= dt;
      if (this.frenzyLeft < 0) this.frenzyLeft = 0;
    }

    // 限时倒计时（暂停时冻结）
    if (this.gameState === 'playing' && this.mode === 'timed' && this.reviveCountdown <= 0) {
      this.timedLeft -= dt;
      if (this.timedLeft <= 0) {
        this.timedLeft = 0;
        this.endGame();
      }
    }

    if (
      this.gameState === 'playing' &&
      !this.target &&
      this.spawnAt > 0 &&
      this.gameTime >= this.spawnAt &&
      this.reviveCountdown <= 0
    ) {
      this.spawnTarget();
    }

    // 对局目标：playing / paused / 复活倒计时中仍可渲染背景粒子
    if (
      (this.gameState === 'playing' || this.gameState === 'paused') &&
      this.reviveCountdown <= 0
    ) {
      this.drawTarget();
    }
    this.drawParticles(dt);

    if (this.gameState === 'playing' && this.reviveCountdown <= 0) {
      this.drawHud();
    } else if (this.gameState === 'paused') {
      // 暂停时仍画目标，再叠卡片
      this.drawPause();
    } else if (this.gameState === 'result') {
      this.drawResult();
    } else if (this.gameState === 'home') {
      this.drawHome();
    } else if (this.gameState === 'panel') {
      if (this.panel === 'daily') this.drawDailyPanel();
      else if (this.panel === 'task') this.drawTaskPanel();
      else if (this.panel === 'rank') this.drawRankPanel();
      else if (this.panel === 'skin') this.drawSkinPanel();
      else if (this.panel === 'intro') this.drawIntroPanel();
      else if (this.panel === 'reward') {
        this.drawHome();
        this.buttons = [];
        this.drawRewardPanel();
      } else this.drawHome();
    }

    this.drawToastAndBanner();
    requestAnimationFrame(this.loop);
  }
}
