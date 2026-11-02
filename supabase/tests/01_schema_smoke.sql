-- Smoke tests for the Fixie schema. Run after the migrations (see 05 §14).
\set ON_ERROR_STOP 1
-- Users via auth trigger
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','priya@x.dev','{"provider_id":"101","user_name":"priya","full_name":"Priya"}'),
 ('00000000-0000-0000-0000-0000000000b2','outsider@x.dev','{"provider_id":"202","user_name":"outsider"}'),
 ('00000000-0000-0000-0000-0000000000c3','noprov@x.dev','{}');
select 'profiles', count(*) from profiles;

insert into installations (id, github_installation_id, account_github_id, account_login, account_type, repository_selection)
values ('10000000-0000-0000-0000-000000000001', 555, 900, 'Agent-X-Hackathon-2026-Team-MisfitMinds', 'organization', 'selected');
insert into installation_settings (installation_id) values ('10000000-0000-0000-0000-000000000001');
insert into memberships (user_id, installation_id, role) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','admin');
insert into repositories (id, installation_id, github_repo_id, full_name, name, default_branch, is_private)
values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', 777, 'Agent-X-Hackathon-2026-Team-MisfitMinds/fixie-demo-python','fixie-demo-python','main', false);
insert into repo_access (user_id, repository_id, installation_id, permission) values
 ('00000000-0000-0000-0000-0000000000a1','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin');

-- Enabling without setup must fail (CHECK)
do $$ begin
  update repositories set enabled = true where id = '20000000-0000-0000-0000-000000000001';
  raise exception 'SHOULD HAVE FAILED';
exception when check_violation then raise notice 'enable blocked without setup: ok'; end $$;
update repositories set protection_status='ok', workflow_status='present', actions_can_create_prs=true, config_status='missing', enabled=true
 where id = '20000000-0000-0000-0000-000000000001';

insert into issues (id, installation_id, repository_id, github_issue_id, number, title, reporter_login)
values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', 4242, 12, 'Leap day crashes parser', 'sara');
insert into runs (id, installation_id, repository_id, issue_id, trigger, triggered_by_login)
values ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','label','priya');

-- Second active run on same issue must fail
do $$ begin
  insert into runs (installation_id, repository_id, issue_id, trigger, triggered_by_login)
  values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','label','priya');
  raise exception 'SHOULD HAVE FAILED';
exception when unique_violation then raise notice 'one active run per issue: ok'; end $$;

-- Ingest a realistic batch (7 gates only -> PR must be flagged ungated)
select ingest_events('40000000-0000-0000-0000-000000000001', $j$[
 {"seq":1,"ts":"2026-11-01T10:00:00Z","type":"run.status","data":{"status":"provisioning","tier":"t1_fix","model":{"preset":"ollama","name":"qwen3-coder:30b"},"sandbox":{"image":"python:3.12-bookworm"}}},
 {"seq":2,"ts":"2026-11-01T10:00:01Z","type":"step.started","data":{"step":"reproduce","attempt":2}},
 {"seq":3,"ts":"2026-11-01T10:00:02Z","type":"command.started","step":"baseline","data":{"commandSeq":1,"step":"baseline","command":"pytest -q","cwd":"/work"}},
 {"seq":4,"ts":"2026-11-01T10:00:09Z","type":"command.finished","data":{"commandSeq":1,"exitCode":1,"durationMs":7000,"outputBytes":1200,"redactionCount":0,"logKey":"i/r/commands/1.log.gz"}},
 {"seq":5,"ts":"2026-11-01T10:00:10Z","type":"tests.reported","data":{"phase":"repro_before","framework":"pytest","results":[{"testId":"tests/test_fixie_issue_12.py::test_leap","outcome":"failed","isRepro":true,"failureMessage":"ValueError: invalid day"}]}},
 {"seq":6,"ts":"2026-11-01T10:00:11Z","type":"gate.evaluated","data":{"gate":"repro_fails_before","attempt":1,"passed":true,"evidence":{"testId":"tests/test_fixie_issue_12.py::test_leap"}}},
 {"seq":7,"ts":"2026-11-01T10:00:12Z","type":"llm.call","data":{"purpose":"patch","step":"fix","preset":"ollama","model":"qwen3-coder:30b","inputTokens":5000,"outputTokens":400,"costUsd":0}},
 {"seq":8,"ts":"2026-11-01T10:00:13Z","type":"bisect.finished","data":{"status":"found","firstBadSha":"a1b2c3d4e5f60718293a4b5c6d7e8f9012345678","steps":5}},
 {"seq":9,"ts":"2026-11-01T10:00:14Z","type":"hypothesis.updated","data":{"ordinal":1,"summary":"Feb day limit ignores leap years","files":["src/dates/parse.py"],"status":"trying"}},
 {"seq":10,"ts":"2026-11-01T10:00:15Z","type":"hypothesis.updated","data":{"ordinal":1,"summary":"Feb day limit ignores leap years","status":"accepted"}},
 {"seq":11,"ts":"2026-11-01T10:00:16Z","type":"checkpoint.created","data":{"seq":2,"kind":"attempt","hypothesisOrdinal":1,"attempt":1,"result":"rolled_back","failingTests":2,"newFailures":2,"reason":"added 2 failing tests"}},
 {"seq":12,"ts":"2026-11-01T10:00:17Z","type":"proof_card.ready","data":{"proofCard":{"x":1},"confidence":{"score":86,"level":"high"}}}
]$j$::jsonb);
-- duplicate delivery is idempotent
select ingest_events('40000000-0000-0000-0000-000000000001', '[{"seq":7,"type":"llm.call","data":{"purpose":"patch","step":"fix","preset":"ollama","model":"m","costUsd":5}}]');

select status, tier, model_preset, repro_attempts, llm_calls_count, llm_cost_usd, rollbacks, hypotheses_count, confidence_level, bisect->>'status' as bisect, started_at is not null as started, last_event_seq
from runs where id='40000000-0000-0000-0000-000000000001';
select summary, status, files from hypotheses;
select seq, exit_code, log_object_key from run_commands;

-- gates: 7 of 9 passed then PR opened -> must be flagged + incident + paused
insert into gate_results (run_id, installation_id, gate, attempt, passed) select '40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', g, 1, true
 from unnest(array['repro_passes_after','no_new_failures','lint_clean','typecheck_clean','diff_size','blocked_paths']::gate_kind[]) g;
select 'failing gates', failing_gates('40000000-0000-0000-0000-000000000001');
select ingest_events('40000000-0000-0000-0000-000000000001', '[{"seq":13,"type":"pr.opened","data":{"githubPrId":9001,"number":57,"url":"https://github.com/x/y/pull/57","headBranch":"fixie/issue-12","headSha":"a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"}}]');
select 'pr', number, ungated from pull_requests;
select 'incident', kind, details->'failingGates' from safety_incidents;
select 'paused', paused_at is not null, pause_reason from installations;

-- terminal status
select ingest_events('40000000-0000-0000-0000-000000000001', '[{"seq":14,"ts":"2026-11-01T10:09:00Z","type":"run.status","data":{"status":"succeeded","outcome":"pr_opened"}}]');
select 'terminal', status, outcome, finished_at from runs;

-- audit append-only
do $$ begin
  update audit_log set actor_label='x';
  raise exception 'SHOULD HAVE FAILED';
exception when insufficient_privilege then raise notice 'audit append-only: ok'; end $$;

-- rate limit
select 'rl', hit_rate_limit('u1', 2, 60), hit_rate_limit('u1', 2, 60), hit_rate_limit('u1', 2, 60);

-- RLS as member vs outsider
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'member sees runs', count(*) from runs;
select 'member sees events', count(*) from run_events;
select 'member sees incidents (admin)', count(*) from safety_incidents;
select 'member metrics', installation_metrics('10000000-0000-0000-0000-000000000001', '2026-10-01', '2026-12-01')->>'runs' as runs,
       installation_metrics('10000000-0000-0000-0000-000000000001', '2026-10-01', '2026-12-01')->>'breakingCommitsFound' as bisect_found,
       installation_metrics('10000000-0000-0000-0000-000000000001', '2026-10-01', '2026-12-01')->'byModel' as by_model;
select 'member profiles visible', count(*) from profiles;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select 'outsider sees runs', count(*) from runs;
select 'outsider sees events', count(*) from run_events;
select 'outsider sees installs', count(*) from installations;
select 'outsider sees profiles', count(*) from profiles;
do $$ begin
  perform * from run_ingest_tokens;
  raise exception 'SHOULD HAVE FAILED';
exception when insufficient_privilege then raise notice 'ingest tokens hidden from authenticated: ok'; end $$;
do $$ begin
  insert into runs (installation_id, repository_id, issue_id, trigger, triggered_by_login)
  values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','dashboard','x');
  raise exception 'SHOULD HAVE FAILED';
exception when insufficient_privilege then raise notice 'browser cannot write: ok'; end $$;
reset role;

-- sessions functions
insert into auth.sessions (id, user_id, user_agent, ip) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Chrome','1.2.3.4');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'sessions', count(*) from list_my_sessions();
select 'revoke', revoke_my_session('50000000-0000-0000-0000-000000000001');
reset role;

-- purge works
update runs set finished_at = now() - interval '40 days', started_at = now() - interval '41 days', suspicious='[{"path":"a.py","snippet":"code"}]', diagnosis='x';
select 'purge', purge_expired_data();
select 'after purge', diagnosis is null, suspicious, evidence_purged_at is not null from runs;
