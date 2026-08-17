/**
 * 全球排行榜（Supabase REST）
 * 需先在 Supabase 执行 docs/supabase-leaderboard.sql
 */
import { getItem, setItem } from './storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GLOBAL_RANK_LIMIT } from './config';

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function request({ path, method = 'GET', data, query }) {
  return new Promise((resolve, reject) => {
    let url = `${SUPABASE_URL}/rest/v1/${path}`;
    if (query) {
      const parts = Object.keys(query).map(
        (k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`
      );
      url += (url.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
    }
    wx.request({
      url,
      method,
      data,
      header: headers(
        method === 'POST' || method === 'PATCH'
          ? { Prefer: 'return=representation' }
          : {}
      ),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg =
            (res.data && (res.data.message || res.data.error_description)) ||
            `HTTP ${res.statusCode}`;
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络异常'));
      },
    });
  });
}

function rpc(fn, args) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${SUPABASE_URL}/rest/v1/rpc/${fn}`,
      method: 'POST',
      data: args,
      header: headers(),
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg =
            (res.data && (res.data.message || res.data.hint)) ||
            `HTTP ${res.statusCode}`;
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '网络异常'));
      },
    });
  });
}

function randomId() {
  const s = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += s[(Math.random() * s.length) | 0];
  return `p_${Date.now().toString(36)}_${out}`;
}

export function getPlayerId() {
  let id = getItem('v10_player_id', '');
  if (!id) {
    id = randomId();
    setItem('v10_player_id', id);
  }
  return id;
}

export function getNickname() {
  let name = getItem('v10_nickname', '');
  if (!name) {
    const id = getPlayerId();
    name = `玩家${id.slice(-4)}`;
    setItem('v10_nickname', name);
  }
  return name;
}

export function setNickname(name) {
  const n = String(name || '')
    .trim()
    .slice(0, 12);
  if (!n) return getNickname();
  setItem('v10_nickname', n);
  return n;
}

/**
 * 拉取全球榜（按模式）
 * @returns {Promise<{list: Array, myRank: number|null, myScore: number|null}>}
 */
export function fetchGlobalRanks(mode) {
  const m = mode === 'timed' ? 'timed' : 'classic';
  const playerId = getPlayerId();
  return request({
    path: 'leaderboard',
    query: {
      select: 'player_id,nickname,mode,score,combo,round,updated_at',
      mode: `eq.${m}`,
      order: 'score.desc,updated_at.asc',
      limit: String(GLOBAL_RANK_LIMIT),
    },
  }).then((rows) => {
    const list = Array.isArray(rows) ? rows : [];
    let myRank = null;
    let myScore = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].player_id === playerId) {
        myRank = i + 1;
        myScore = list[i].score;
        break;
      }
    }
    // 若不在 TopN，再查自己的成绩用于摘要
    if (myRank == null) {
      return request({
        path: 'leaderboard',
        query: {
          select: 'score',
          mode: `eq.${m}`,
          player_id: `eq.${playerId}`,
          limit: '1',
        },
      })
        .then((mine) => {
          if (Array.isArray(mine) && mine[0]) myScore = mine[0].score;
          return { list, myRank, myScore };
        })
        .catch(() => ({ list, myRank, myScore }));
    }
    return { list, myRank, myScore };
  });
}

/**
 * 提交成绩：仅当更高分时更新（走 RPC，失败则尝试 upsert）
 */
export function submitGlobalScore({ mode, score, combo, round }) {
  const m = mode === 'timed' ? 'timed' : 'classic';
  const s = Math.max(0, Math.floor(Number(score) || 0));
  if (s <= 0) return Promise.resolve({ ok: false, reason: 'skip' });

  const payload = {
    p_player_id: getPlayerId(),
    p_nickname: getNickname(),
    p_mode: m,
    p_score: s,
    p_combo: Math.max(0, Math.floor(Number(combo) || 0)),
    p_round: Math.max(0, Math.floor(Number(round) || 0)),
  };

  return rpc('submit_leaderboard_score', payload)
    .then((data) => ({ ok: true, data }))
    .catch(() => {
      // RPC 未部署时回退：先读再写
      return request({
        path: 'leaderboard',
        query: {
          select: 'score',
          player_id: `eq.${payload.p_player_id}`,
          mode: `eq.${m}`,
          limit: '1',
        },
      })
        .then((rows) => {
          const prev = Array.isArray(rows) && rows[0] ? rows[0].score : 0;
          if (prev >= s) return { ok: true, data: { updated: false, score: prev } };
          const body = {
            player_id: payload.p_player_id,
            nickname: payload.p_nickname,
            mode: m,
            score: s,
            combo: payload.p_combo,
            round: payload.p_round,
            updated_at: new Date().toISOString(),
          };
          if (prev > 0) {
            return new Promise((resolve, reject) => {
              wx.request({
                url: `${SUPABASE_URL}/rest/v1/leaderboard?player_id=eq.${encodeURIComponent(
                  payload.p_player_id
                )}&mode=eq.${m}`,
                method: 'PATCH',
                data: body,
                header: headers({ Prefer: 'return=representation' }),
                success(res) {
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ ok: true, data: { updated: true, score: s } });
                  } else reject(new Error('更新失败'));
                },
                fail(err) {
                  reject(new Error((err && err.errMsg) || '网络异常'));
                },
              });
            });
          }
          return request({
            path: 'leaderboard',
            method: 'POST',
            data: body,
          }).then(() => ({ ok: true, data: { updated: true, score: s } }));
        });
    });
}
