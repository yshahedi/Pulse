# Pulse Worker Monitor

A lightweight, real-time dashboard for observing every backend worker in the
Pulse runtime, with near-zero impact on backend performance.

In Pulse, "workers" are **C++ thread pools** inside four singletons. The monitor
treats each worker thread as a worker, grouped by pool, with an aggregate
roll-up:

| Pool | Source | What it does |
|------|--------|--------------|
| `js` | `MyV8` | Runs all JS functions/routes — the primary workers |
| `inbound` | `InboundServer` | HTTP/WS request handling on :4001 |
| `outbound` | `Outbound` | Outgoing HTTP/WS calls |
| `scheduler` | `Scheduler` | Interval tasks |

---

## Architecture

```
 worker threads                C++ (metrics.h)              transport            browser
 ┌───────────┐  relaxed atomic  ┌──────────────────┐                            ┌──────────┐
 │ JS pool   │ ───writes own───▶│ WorkerSlot[2048] │   500ms timer ─ defer ─▶  │ React /  │
 │ Inbound   │     slot only    │ (lock-free)      │   ┌─────────────────┐     │ TS / Vite│
 │ Outbound  │                  │ snapshot_json()  │──▶│ uWS WS :4002    │═════▶│ dashboard│
 │ Scheduler │                  └──────────────────┘   │ (own loop thd)  │ push └──────────┘
 └───────────┘                                         └─────────────────┘
```

- **Hot path:** each task runs inside a RAII `pmetrics::Scope`. A worker only
  ever writes **its own** cache-line-padded slot → lock-free, no contention, no
  allocation. Cost ≈ 4 relaxed atomic stores + 1 vdso clock read (**< 100 ns**).
- **Aggregation:** a dedicated low-priority thread snapshots every 500 ms — never
  on a worker's critical path.
- **Transport:** a self-contained uWS WebSocket server (own port, own event-loop
  thread) **pushes** the snapshot to all connected dashboards every 500 ms. One
  connection per dashboard regardless of worker count.
- **Compile-out:** everything is gated behind `-DPULSE_METRICS`. Without the flag
  `Scope`/`enqueue` become empty inlines and the WS server is never built — zero
  residual cost.

### Why push, and why it scales to hundreds of workers

The snapshot is built **once per 500 ms** on the metrics loop thread (O(active
workers)) and broadcast over **one** socket per dashboard. Worker count never
multiplies connections, and there is **no O(N) work on any worker's hot path** —
each worker only touches its own slot. "Real time" is defined as a **500 ms**
update interval: a stall or crash is reflected within one interval.

---

## Running it

### 1. Backend (build once with the flag)

The checked-in `Pulse` binary must be built with `-DPULSE_METRICS` (the `compile`
script already includes it):

```bash
# from repo root — rebuilds ./Pulse (links static V8; ~always needed once)
bash compile          # runs the -DPULSE_METRICS g++ command

./Pulse stop main.js  # stop the running instance
# wait 20 seconds (main.lock guard)
./Pulse start main.js # init.js calls Serve('start_metrics',{port:4002})
```

`init.js` starts the metrics WS server on **port 4002**. Verify:

```bash
curl -s http://127.0.0.1:4001/reload -d '{}'   # (functions hot-reload; unrelated)
ss -ltn | grep 4002                            # metrics WS listening
```

To **disable** monitoring entirely, rebuild without `-DPULSE_METRICS`; the WS
server won't start and `get_metrics` returns `{"enabled":false}`.

### 2. Dashboard

```bash
cd dashboard
npm install
npm run dev      # http://127.0.0.1:5180
```

The dashboard connects to `ws://<host>:4002` (editable in the header). Build a
static bundle with `npm run build` (output in `dist/`).

---

## Metric schema

Pushed as a JSON text frame every 500 ms (and immediately on connect):

```jsonc
{
  "enabled": true,
  "ts": 1751270400000,          // epoch ms of this snapshot
  "uptime_ms": 123456,
  "process": {
    "cpu_pct": 12.4,            // whole-process CPU%, Δjiffies/Δt
    "rss_kb": 256000,           // resident set size
    "threads": 42               // OS thread count (/proc/self/stat)
  },
  "pools": [
    {
      "id": 1, "name": "js",
      "workers": 8,             // live slots in this pool
      "busy": 3, "idle": 5,
      "queued": 12,             // enqueued − dequeued; -1 = unknown (inbound)
      "processed": 98213,       // cumulative, monotonic
      "errors": 4,
      "running": true
    }
    // ... inbound, outbound, scheduler
  ],
  "workers": [
    {
      "slot": 0, "pool": 1, "pool_name": "js",
      "state": "busy",          // "idle" | "busy" | (gone => omitted)
      "processed": 12031,       // cumulative for this worker
      "errors": 0,
      "last_seen_ms": 1751270399960,
      "age_ms": 40,             // now − last_seen (heartbeat staleness)
      "tid": 1234567890
    }
    // ... one per active worker thread
  ]
}
```

**Derived client-side** (keeps the backend stateless):
- **Throughput** = Δ`processed` / Δ`ts`, per worker and summed per pool.
- **Status:**
  - `busy` — slot is BUSY.
  - `stalled` — BUSY with `age_ms` > 3 s (task hung).
  - `idle` — IDLE.
  - `restarting` — a newly-appeared slot (pool scaling up).
  - `crashed` — pool `running` false or `workers == 0`; full backend loss shows
    as a disconnect banner.

A retired/crashed worker thread marks its slot unused on exit, so it disappears
from `workers` within one interval; the pool's `workers`/`busy` counts drop
accordingly.

### Live logs

The same WebSocket also streams the backend log. The server tails the newest
`./log/*.log` file on the metrics thread (never touching `Log()` or any worker
hot path) and pushes new lines:

```jsonc
{ "type": "log", "backlog": true,  "lines": ["2026-… [INFO] …", …] }  // last ~200 lines, sent once on connect
{ "type": "log", "backlog": false, "lines": ["2026-… [ERROR] …"]    }  // new lines, pushed each 500ms tick
```

Messages are distinguished by the `type` field (`"log"`); metrics snapshots have
no `type` and carry `enabled`. The dashboard's **Logs** panel renders these with
per-level colouring (INFO/WARN/ERROR/DEBUG), a level filter, a text filter, and
follow-tail (auto-scroll, pauses when you scroll up). Safeguards under load: the
server caps reads to 256 KB / 400 lines per tick (omissions are noted inline),
and the client keeps the last 3 000 lines. Log files rotate daily; the tailer
follows the newest file automatically.

---

## Overhead

| Path | Cost | Notes |
|------|------|-------|
| Per task (hot path) | **< 100 ns** | 4 relaxed atomic stores + 1 vdso clock read. No lock, no allocation, no syscall, no I/O. |
| Per `produce()` (enqueue) | ~1 atomic add | single relaxed `fetch_add`. |
| Snapshot (every 500 ms) | O(active workers) + 2 `/proc` reads | on a dedicated thread, off all hot paths. |
| Broadcast (every 500 ms) | one `ws->send` per connected dashboard | on the metrics loop thread only. |
| Idle backend, dashboard closed | timer ticks; no clients → send loop is empty | negligible. |
| Built without `-DPULSE_METRICS` | **0** | hooks compile to nothing; WS server absent. |

For perspective, a single JS task is a V8 `fn->Call` measured in microseconds to
milliseconds; < 100 ns of telemetry is **well under 0.01%** of that, and it is
false-sharing-free because each worker owns a 64-byte-aligned slot.

### Backend touch points (minimal & isolated)

- `metrics.h` — entire telemetry surface (new, fully gated).
- `pulse.cc` — `#include "metrics.h"`, one `pmetrics::Scope` per pool loop
  (JS/inbound/outbound/scheduler), `enqueue()` at the clean `produce()` entry
  points, and `get_metrics` / `start_metrics` actions on the existing `Serve`
  dispatcher (no new V8 globals).
- `js/system/init.js` — one line: `Serve('start_metrics', { port: 4002 })`.
- `compile` — added `-DPULSE_METRICS`.
