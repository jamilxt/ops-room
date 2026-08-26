# Incident timeline (generated live by IncidentScribe)

- `T+0.5s [deploy] deploy: orders-api v2.14.3 rolled out to 3/10 instances (canary)`
- `T+3.0s [sleuth] error signature: 2026-09-05T14:00:21.312Z orders-api/src/main/ts/pool.ts:88 PoolTimeoutError TIMEOUT_ERROR acquiring connection, waited 5000ms`
- `T+3.0s [sleuth] error signature: 2026-09-05T14:00:24.104Z orders-api/src/main/ts/handler.ts:41 CheckoutLockError CHECKOUT_LOCK_ERROR lock contention on cart rows, lock held 3.1s`
- `T+3.0s [alert] alert: checkout p95 latency 4.2s (baseline 210ms), firing for 2m`
- `T+3.9s [triage] hypothesis: checkout latency correlates with the deploy; suspect connection-pool exhaustion in orders-api`
- `T+5.0s [log] log: orders-api/src/main/ts/pool.ts:88 PoolTimeoutError TIMEOUT_ERROR acquiring connection (x1,204 in 60s)`
- `T+9.0s [metric] metric: orders-api db connection pool utilization 100%, queue depth 312`
- `T+9.9s [triage] hypothesis: partial degradation, likely a bad instance behind the load balancer`
- `T+14.0s [log] log: orders-api/src/main/ts/handler.ts:41 CHECKOUT_LOCK_ERROR lock contention on cart rows (x87)`
- `T+20.0s [alert] alert: checkout error rate 7.8% — page the on-call, recommend whether to restart all pods`
- `T+20.9s [triage] REVISED PROPOSAL: roll back the 3 canary instances only; all-pods restart is off the table`
- `T+20.9s [commander] HOLD — that proposal does not reference any confirmed signature (TIMEOUT_ERROR, CHECKOUT_LOCK_ERROR). Confirmed evidence so far: TIMEOUT_ERROR, CHECKOUT_LOCK_ERROR. Revise it against the confirmed signatures — PROPOSAL must cite at least one (REVISED PROPOSAL:).`
- `T+20.9s [triage] PROPOSAL: restart ALL orders-api pods immediately to clear the stuck connection pool`
- `T+21.5s [feed] timeline exhausted — incident is yours, team`
- `T+28.0s [comms] STATUS UPDATE (deterministic): We identified degraded checkout performance following a canary deploy to orders-api. Two error signatures were confirmed by automated log analysis. A mitigation review is underway under risk supervision. Services remain partially degraded while we roll out the safest fix first.`
