# Incident timeline (generated live by IncidentScribe)

- `T+0.5s [unknown] [deploy] deploy: orders-api v2.14.3 rolled out to 3/10 instances (canary)`
- `T+3.0s [unknown] [alert] alert: checkout p95 latency 4.2s (baseline 210ms), firing for 2m`
- `T+3.2s [unknown] [commander] HOLD — that recommendation has blast radius. Impact vs the suspected signature we already have: propose the lowest-risk mitigation first`
- `T+3.2s [unknown] [triage] MockLLM says: staged rollback first.`
- `T+5.0s [unknown] [sleuth] error signature: TIMEOUT_ERROR in orders-api/src/main/ts/pool.ts — first seen right after deploy window opened`
- `T+5.0s [unknown] [log] log: orders-api/src/main/ts/pool.ts:88 PoolTimeoutError TIMEOUT_ERROR acquiring connection (x1,204 in 60s)`
- `T+9.0s [unknown] [metric] metric: orders-api db connection pool utilization 100%, queue depth 312`
- `T+9.0s [unknown] [commander] HOLD — that recommendation has blast radius. Impact vs the known signature we already have: propose the lowest-risk mitigation first`
- `T+9.0s [unknown] [triage] MockLLM says: staged rollback first.`
- `T+14.0s [unknown] [sleuth] error signature: CHECKOUT_LOCK_ERROR in orders-api/src/main/ts/handler.ts — first seen right after deploy window opened`
- `T+14.0s [unknown] [log] log: orders-api/src/main/ts/handler.ts:41 CHECKOUT_LOCK_ERROR lock contention on cart rows (x87)`
- `T+20.0s [unknown] [alert] alert: checkout error rate 7.8% — page the on-call, recommend whether to restart all pods`
- `T+20.0s [unknown] [commander] HOLD — that recommendation has blast radius. Impact vs the known signature we already have: propose the lowest-risk mitigation first`
- `T+20.0s [unknown] [triage] MockLLM says: staged rollback first.`
- `T+21.5s [unknown] [feed] timeline exhausted — incident is yours, team`
