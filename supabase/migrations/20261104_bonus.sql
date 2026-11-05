-- BIX bonus support. REVIEW AND APPLY MANUALLY; this artifact has NOT been deployed.
-- Requires existing public.brokers/entries/goals/transactions and their user_id RLS policies.
begin;
alter table public.brokers
  add column if not exists own_deposit numeric check (own_deposit >= 0 and own_deposit <= 1e12),
  add column if not exists bonus_percent numeric check (bonus_percent >= 0 and bonus_percent <= 1e12),
  add column if not exists turnover_required numeric check (turnover_required >= 0 and turnover_required <= 1e12),
  add column if not exists initial_net_turnover numeric check (initial_net_turnover >= 0 and initial_net_turnover <= 1e12),
  add column if not exists initial_bonus_profit numeric check (abs(initial_bonus_profit) <= 1e12),
  add column if not exists current_balance numeric check (current_balance >= 0 and current_balance <= 1e12),
  add column if not exists baseline_date date check (baseline_date is null or current_balance is not null);
alter table public.entries
  add column if not exists net_turnover numeric check (net_turnover >= 0 and net_turnover <= 1e12),
  add column if not exists bonus_profit numeric check (abs(bonus_profit) <= 1e12),
  add column if not exists bonus_status text check (bonus_status in ('active', 'released', 'cancelled')),
  add column if not exists reconciled boolean;
alter table public.transactions
  add column if not exists bonus_deduction numeric check (bonus_deduction >= 0 and bonus_deduction <= 1e12),
  add column if not exists post_balance numeric check (post_balance >= 0 and post_balance <= 1e12),
  add column if not exists bonus_status text check (bonus_status in ('active', 'released', 'cancelled')),
  add column if not exists after_close boolean,
  add column if not exists sort_order bigint check (sort_order >= 0);
-- No backfill: NULL keeps legacy manual P&L and existing backups unchanged.

-- Invoker rights preserve existing RLS. Transactional replacement prevents partial restore.
create or replace function public.bix_replace_state(payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  delete from public.transactions where user_id = uid;
  delete from public.goals where user_id = uid;
  delete from public.entries where user_id = uid;
  delete from public.brokers where user_id = uid;
  insert into public.brokers(id,user_id,name,currency,initial_balance,own_deposit,bonus_percent,turnover_required,initial_net_turnover,initial_bonus_profit,current_balance,baseline_date)
    select id,uid,name,currency,initial_balance,own_deposit,bonus_percent,turnover_required,initial_net_turnover,initial_bonus_profit,current_balance,baseline_date from jsonb_populate_recordset(null::public.brokers, payload->'brokers');
  insert into public.entries(id,user_id,broker_id,date,opening,closing,cash_flow,note,net_turnover,bonus_profit,bonus_status,reconciled)
    select id,uid,broker_id,date,opening,closing,cash_flow,note,net_turnover,bonus_profit,bonus_status,reconciled from jsonb_populate_recordset(null::public.entries,payload->'entries');
  insert into public.goals(id,user_id,broker_id,period,start_date,end_date,target)
    select id,uid,broker_id,period,start_date,end_date,target from jsonb_populate_recordset(null::public.goals,payload->'goals');
  insert into public.transactions(id,user_id,broker_id,date,amount,note,bonus_deduction,post_balance,bonus_status,after_close,sort_order)
    select id,uid,broker_id,date,amount,note,bonus_deduction,post_balance,bonus_status,after_close,sort_order from jsonb_populate_recordset(null::public.transactions,payload->'transactions');
end;
$$;
revoke all on function public.bix_replace_state(jsonb) from public;
grant execute on function public.bix_replace_state(jsonb) to authenticated;
commit;
