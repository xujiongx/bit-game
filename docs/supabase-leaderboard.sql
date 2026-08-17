-- 差一点 · 全球排行榜（在 Supabase SQL Editor 中执行一次）
-- 项目：wrelqgrfccrzlhzvlmsb

create table if not exists public.leaderboard (
  id bigserial primary key,
  player_id text not null,
  nickname text not null default '匿名玩家',
  mode text not null check (mode in ('classic', 'timed')),
  score integer not null default 0 check (score >= 0),
  combo integer not null default 0 check (combo >= 0),
  round integer not null default 0 check (round >= 0),
  updated_at timestamptz not null default now(),
  constraint leaderboard_player_mode unique (player_id, mode)
);

create index if not exists leaderboard_mode_score_idx
  on public.leaderboard (mode, score desc, updated_at asc);

alter table public.leaderboard enable row level security;

drop policy if exists "leaderboard_select" on public.leaderboard;
create policy "leaderboard_select"
  on public.leaderboard for select
  using (true);

drop policy if exists "leaderboard_insert" on public.leaderboard;
create policy "leaderboard_insert"
  on public.leaderboard for insert
  with check (true);

drop policy if exists "leaderboard_update" on public.leaderboard;
create policy "leaderboard_update"
  on public.leaderboard for update
  using (true);

grant select, insert, update on table public.leaderboard to anon, authenticated;
grant usage, select on sequence public.leaderboard_id_seq to anon, authenticated;

-- 仅在更高分时更新
create or replace function public.submit_leaderboard_score(
  p_player_id text,
  p_nickname text,
  p_mode text,
  p_score integer,
  p_combo integer default 0,
  p_round integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_after integer;
begin
  if p_player_id is null or length(trim(p_player_id)) = 0 then
    raise exception 'invalid player_id';
  end if;
  if p_mode not in ('classic', 'timed') then
    raise exception 'invalid mode';
  end if;
  if p_score is null or p_score < 0 then
    raise exception 'invalid score';
  end if;

  select score into v_before
  from public.leaderboard
  where player_id = p_player_id and mode = p_mode;

  insert into public.leaderboard (
    player_id, nickname, mode, score, combo, round, updated_at
  ) values (
    p_player_id,
    coalesce(nullif(trim(p_nickname), ''), '匿名玩家'),
    p_mode,
    p_score,
    greatest(0, coalesce(p_combo, 0)),
    greatest(0, coalesce(p_round, 0)),
    now()
  )
  on conflict (player_id, mode) do update set
    nickname = excluded.nickname,
    score = greatest(public.leaderboard.score, excluded.score),
    combo = case
      when excluded.score > public.leaderboard.score then excluded.combo
      else public.leaderboard.combo
    end,
    round = case
      when excluded.score > public.leaderboard.score then excluded.round
      else public.leaderboard.round
    end,
    updated_at = case
      when excluded.score > public.leaderboard.score then now()
      else public.leaderboard.updated_at
    end
  returning score into v_after;

  return jsonb_build_object(
    'score', v_after,
    'updated', v_before is null or v_after > v_before,
    'player_id', p_player_id,
    'mode', p_mode
  );
end;
$$;

grant execute on function public.submit_leaderboard_score(text, text, text, integer, integer, integer)
  to anon, authenticated, service_role;
