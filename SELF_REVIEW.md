# Self Review

## Weakest Part

The weakest part is production hardening around the realtime boundary. Socket authentication and tenant-scoped rooms are implemented, but CORS is broad and the frontend currently applies every authenticated lead event through one callback before reloading data. The authorization model is stronger than the presentation layer, but the event-handling contract could be more explicit.

## Six-Month Redesign

I would separate realtime delivery from lead-list refreshes with typed event payloads and a shared client-side store. I would also add an outbox or transactional event table so database changes and emitted events cannot diverge, then scale API and worker services independently on ECS with managed PostgreSQL and Redis.

## Known Trade-off

The project favors explicit tenant filters and composite foreign keys over a more abstract tenancy framework. This makes the safety boundary visible and testable, but it adds repeated tenant-aware query code. The demo frontend also refreshes after mutations, which is less efficient than maintaining a normalized client cache but keeps the state behavior easy to reason about.

## Biggest Production Risk

A misconfigured realtime or cache path could expose data across tenants if a future event bypasses the room helpers or trusts client-provided tenant information. Production CORS, rate limiting, secrets management, and structured audit logging also need to be hardened before deployment.

## Missing Test Coverage

The next tests should cover:

- Socket reconnect and account switching in the same browser session.
- Event payload filtering and client state updates without a full page reload.
- API startup when Redis is unavailable and recovery after Redis returns.
- Compose startup from empty volumes with host-port overrides.
- Login rate limiting, CORS policy, and secret configuration failures.

## Next Week

I would first add a typed realtime event contract with focused cross-tenant and reconnect tests. Then I would restrict CORS, add login rate limiting, add structured logs and metrics, and document a repeatable ECS deployment and migration process.
