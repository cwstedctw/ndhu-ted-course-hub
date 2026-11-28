-- 我的學習紀錄：資料表＋門禁（RLS）
-- 用法：Supabase 左側 SQL Editor → 貼上整份 → Run。重跑也不會壞（已經有就略過、規則會重建）。

-- 1. 資料表：一列＝一筆學習紀錄，user_id 記這筆是誰的（自動填登入者，不用自己給）
create table if not exists public.learning_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date   date not null default current_date,
  topic      text not null check (char_length(topic) between 1 and 200),
  minutes    integer check (minutes between 0 and 1440),
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

-- 2. 打開門禁：開了之後，沒有規則允許的事一律不准
alter table public.learning_logs enable row level security;

-- 3. 先清掉這張表所有舊規則（包括別的版本留下、名字不一樣的）。
--    同一個動作只要有一條規則放行就會放行，舊的太寬規則不清掉，新規則再對也擋不住。
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'learning_logs' loop
    execute format('drop policy %I on public.learning_logs', p.policyname);
  end loop;
end $$;

-- 4. 四條規則：登入的人只能看、寫、改、刪「user_id 是自己」的那幾列
create policy "本人可以看自己的紀錄" on public.learning_logs
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "本人只能新增自己的紀錄" on public.learning_logs
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "本人只能修改自己的紀錄" on public.learning_logs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "本人只能刪自己的紀錄" on public.learning_logs
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. 誰能碰這張表：只有登入的人（authenticated）；沒登入的（anon）什麼都不給
grant select, insert, update, delete on table public.learning_logs to authenticated;
revoke all on table public.learning_logs from anon;
