create table if not exists public.tool_usage_counts (
  tool_id text primary key,
  submit_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tool_usage_counts enable row level security;

drop policy if exists "Tool usage counts are readable" on public.tool_usage_counts;

create policy "Tool usage counts are readable"
  on public.tool_usage_counts
  for select
  to anon, authenticated
  using (true);

create or replace function public.increment_tool_usage(p_tool_id text)
returns table(result_tool_id text, result_submit_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tool_usage_counts as usage_counts (tool_id, submit_count)
  values (p_tool_id, 1)
  on conflict (tool_id)
  do update set
    submit_count = usage_counts.submit_count + 1,
    updated_at = now();

  return query
  select usage_counts.tool_id, usage_counts.submit_count
  from public.tool_usage_counts as usage_counts
  where usage_counts.tool_id = p_tool_id;
end;
$$;

grant execute on function public.increment_tool_usage(text) to anon, authenticated;
