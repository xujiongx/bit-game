/**
 * 任务系统：每日任务 + 成就任务
 */
import { getJSON, setJSON } from './storage';

function dateKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

function dailyStatsKey() {
  return 'v10_daily_stats_' + dateKey();
}

function dailyClaimKey() {
  return 'v10_task_daily_claim_' + dateKey();
}

const ACH_CLAIM_KEY = 'v10_task_ach_claim';
const STATS_KEY = 'v10_play_stats';

/** 每日任务：每天刷新，奖励偏稳健 */
export const DAILY_TASKS = [
  { id: 'd_play1', title: '完成任意 1 局', desc: '经典 / 限时 / 每日均可', reward: 8, check: (c) => c.day.plays >= 1 },
  { id: 'd_score100', title: '单局达到 100 分', desc: '今日任意模式最高分', reward: 12, check: (c) => c.day.best >= 100 },
  { id: 'd_combo5', title: '单局达到 ×5 连击', desc: '今日最高连击', reward: 12, check: (c) => c.day.combo >= 5 },
  { id: 'd_timed1', title: '限时模式玩 1 局', desc: '完成一局 1 分钟挑战', reward: 15, check: (c) => c.day.timedPlays >= 1 },
  { id: 'd_daily150', title: '今日挑战达到 150 分', desc: '每日挑战模式', reward: 18, check: (c) => c.day.dailyBest >= 150 },
];

/** 成就任务：永久进度（16 个），分数门槛偏难，奖励对应提高 */
export const ACHIEVE_TASKS = [
  { id: 'a_best800', title: '初窥门径', desc: '经典最高分达到 800', reward: 30, check: (c) => c.best >= 800 },
  { id: 'a_best1500', title: '渐入佳境', desc: '经典最高分达到 1500', reward: 50, check: (c) => c.best >= 1500 },
  { id: 'a_best3000', title: '稳定输出', desc: '经典最高分达到 3000', reward: 80, check: (c) => c.best >= 3000 },
  { id: 'a_best5000', title: '差一点大师', desc: '经典最高分达到 5000', reward: 120, check: (c) => c.best >= 5000 },
  { id: 'a_combo12', title: '手感预热', desc: '历史最高连击 ×12', reward: 30, check: (c) => c.bestCombo >= 12 },
  { id: 'a_combo20', title: '手感在线', desc: '历史最高连击 ×20', reward: 50, check: (c) => c.bestCombo >= 20 },
  { id: 'a_combo35', title: '连击达人', desc: '历史最高连击 ×35', reward: 80, check: (c) => c.bestCombo >= 35 },
  { id: 'a_combo50', title: '连击疯子', desc: '历史最高连击 ×50', reward: 130, check: (c) => c.bestCombo >= 50 },
  { id: 'a_timed600', title: '限时新星', desc: '限时最高分达到 600', reward: 40, check: (c) => c.timedBest >= 600 },
  { id: 'a_timed1200', title: '限时高手', desc: '限时最高分达到 1200', reward: 70, check: (c) => c.timedBest >= 1200 },
  { id: 'a_timed2000', title: '限时王者', desc: '限时最高分达到 2000', reward: 110, check: (c) => c.timedBest >= 2000 },
  { id: 'a_plays20', title: '初来乍到', desc: '累计游玩 20 局', reward: 30, check: (c) => c.stats.plays >= 20 },
  { id: 'a_plays60', title: '日渐熟悉', desc: '累计游玩 60 局', reward: 55, check: (c) => c.stats.plays >= 60 },
  { id: 'a_plays150', title: '常驻玩家', desc: '累计游玩 150 局', reward: 100, check: (c) => c.stats.plays >= 150 },
  { id: 'a_skins3', title: '换装达人', desc: '解锁至少 3 个皮肤', reward: 45, check: (c) => c.skinsUnlocked >= 3 },
  { id: 'a_skins6', title: '全套收藏', desc: '解锁全部 6 个皮肤', reward: 90, check: (c) => c.skinsUnlocked >= 6 },
];

function defaultDayStats() {
  return { plays: 0, best: 0, combo: 0, timedPlays: 0, dailyBest: 0 };
}

function defaultStats() {
  return { plays: 0 };
}

export function getDayStats() {
  const s = getJSON(dailyStatsKey(), null);
  return s && typeof s === 'object' ? { ...defaultDayStats(), ...s } : defaultDayStats();
}

export function getPlayStats() {
  const s = getJSON(STATS_KEY, null);
  return s && typeof s === 'object' ? { ...defaultStats(), ...s } : defaultStats();
}

export function recordRun({ mode, score, maxCombo, best, bestCombo, timedBest, skinsUnlocked }) {
  const day = getDayStats();
  day.plays += 1;
  day.best = Math.max(day.best || 0, score || 0);
  day.combo = Math.max(day.combo || 0, maxCombo || 0);
  if (mode === 'timed') day.timedPlays = (day.timedPlays || 0) + 1;
  if (mode === 'daily') day.dailyBest = Math.max(day.dailyBest || 0, score || 0);
  setJSON(dailyStatsKey(), day);

  const stats = getPlayStats();
  stats.plays = (stats.plays || 0) + 1;
  setJSON(STATS_KEY, stats);

  return buildContext({ best, bestCombo, timedBest, skinsUnlocked });
}

export function buildContext({ best, bestCombo, timedBest, skinsUnlocked }) {
  return {
    best: best || 0,
    bestCombo: bestCombo || 0,
    timedBest: timedBest || 0,
    skinsUnlocked: skinsUnlocked || 1,
    day: getDayStats(),
    stats: getPlayStats(),
  };
}

export function getClaimedDaily() {
  const list = getJSON(dailyClaimKey(), []);
  return Array.isArray(list) ? list : [];
}

export function getClaimedAch() {
  const list = getJSON(ACH_CLAIM_KEY, []);
  return Array.isArray(list) ? list : [];
}

function setClaimedDaily(ids) {
  setJSON(dailyClaimKey(), ids);
}

function setClaimedAch(ids) {
  setJSON(ACH_CLAIM_KEY, ids);
}

export function listDailyTasks(ctx) {
  const claimed = getClaimedDaily();
  return DAILY_TASKS.map((t) => {
    const done = !!t.check(ctx);
    const claimedFlag = claimed.indexOf(t.id) >= 0;
    return {
      ...t,
      done,
      claimed: claimedFlag,
      claimable: done && !claimedFlag,
    };
  });
}

export function listAchieveTasks(ctx) {
  const claimed = getClaimedAch();
  return ACHIEVE_TASKS.map((t) => {
    const done = !!t.check(ctx);
    const claimedFlag = claimed.indexOf(t.id) >= 0;
    return {
      ...t,
      done,
      claimed: claimedFlag,
      claimable: done && !claimedFlag,
    };
  });
}

export function dailyProgress(ctx) {
  const list = listDailyTasks(ctx);
  const done = list.filter((t) => t.done).length;
  return { done, total: list.length, claimable: list.filter((t) => t.claimable).length };
}

/** @returns {{ ok: boolean, reward?: number, message?: string }} */
export function claimTask(type, id, ctx) {
  if (type === 'daily') {
    const task = DAILY_TASKS.find((t) => t.id === id);
    if (!task) return { ok: false, message: '任务不存在' };
    if (!task.check(ctx)) return { ok: false, message: '尚未完成' };
    const claimed = getClaimedDaily();
    if (claimed.indexOf(id) >= 0) return { ok: false, message: '已领取' };
    claimed.push(id);
    setClaimedDaily(claimed);
    return { ok: true, reward: task.reward };
  }
  const task = ACHIEVE_TASKS.find((t) => t.id === id);
  if (!task) return { ok: false, message: '任务不存在' };
  if (!task.check(ctx)) return { ok: false, message: '尚未完成' };
  const claimed = getClaimedAch();
  if (claimed.indexOf(id) >= 0) return { ok: false, message: '已领取' };
  claimed.push(id);
  setClaimedAch(claimed);
  return { ok: true, reward: task.reward };
}
