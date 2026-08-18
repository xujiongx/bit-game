/**
 * 运行时配置（微信小游戏无法直接读 .env.local）
 * 与 .env.local 保持同步
 */
export const SUPABASE_URL = 'https://wrelqgrfccrzlhzvlmsb.supabase.co';
export const SUPABASE_ANON_KEY =
  'sb_publishable_eavPQ0muvQd-vcnmIwkuqg_frGu3GKR';

export const GLOBAL_RANK_LIMIT = 30;

/** 与微信后台提审游戏名称保持一致，界面与分享统一使用 */
export const GAME_NAME = '差一点-极限点击';
export const GAME_TAGLINE = '等待 · 判断 · 点击';
export const GAME_HINT = '越接近中心，得分越高';
