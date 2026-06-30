# Pulse API Bomber

A zero-dependency load generator for the Pulse API. Logs in, then hammers
`POST /api` with a configurable mix of **read-only** actions while printing live
throughput / latency / error stats — so you can watch the monitoring dashboard
(`ws://127.0.0.1:4002`) react under load.

Requires Node 18+ (uses global `fetch`); tested on Node 26. No `npm install`.

## Usage

```bash
# defaults: 50 workers, 30s, mixed read-only actions
node tester/bomber.mjs

node tester/bomber.mjs -c 200 -d 60        # 200 concurrent for 60s
node tester/bomber.mjs --rps 500 -d 30     # open-loop, cap ~500 req/s
node tester/bomber.mjs -s login            # only public do_login (no auth)
node tester/bomber.mjs -s read             # only authenticated reads
node tester/bomber.mjs --spike -d 60       # cycle concurrency in bursts
```

### Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `-u, --url` | `http://127.0.0.1:4001/api` | API endpoint |
| `-c, --concurrency` | `50` | closed-loop worker count |
| `--rps` | off | target req/s (open-loop; overrides `-c` pacing) |
| `-d, --duration` | `30` | seconds to run, `0` = until Ctrl-C |
| `-s, --scenario` | `mixed` | `login` \| `read` \| `mixed` |
| `--spike` | off | ramp concurrency in bursts to exercise worker autoscaling |
| `--user` / `--pass` | `ADMIN` / `123456` | credentials (password is MD5'd to match the backend) |
| `--raw-pass` | off | treat `--pass` as an already-MD5'd hash |
| `--think` | `0` | ms delay after each request per worker |
| `-q, --quiet` | off | summary only, no per-second lines |

The password is MD5-hashed before sending (the backend stores `MD5(password)`,
matching the frontend's `CryptoJS.MD5`). The seeded admin is `ADMIN` / `123456`.

### Request mix

All actions are **read-only** (no data mutation):
- `base/do_login` (public)
- `base/get_all { name: user_tab }`
- `authorizer/get_all { name: role_tab | permission_tab }`
- `authorizer/get_user_permissions { user_id }`

### Output

Per-second lines plus a final summary: total requests, req/s, ok/fail, error
breakdown, and latency min/avg/p50/p90/p99/max. Ctrl-C prints the summary early.

---

## Finding (FIXED): SQLite concurrency bug surfaced by this tester

Before the fix, the bomber at concurrency ≳ 8 produced **50–80 % errors**, all
backend transaction-state failures:

```
Prepare failed: cannot start a transaction within a transaction
Prepare failed: cannot commit  - no transaction is active
Prepare failed: cannot rollback - no transaction is active
```

**Cause:** every module action wraps its work in `BEGIN TRANSACTION` / `COMMIT`
/ `ROLLBACK` (dispatcher in `js/functions/*.js`), but all V8 worker threads
share **one SQLite connection per `.db` file** (`openSqliteDB` in `pulse.cc`).
Transaction state is per-connection, so concurrent `BEGIN`/`COMMIT` from
different workers interleaved and clobbered each other. The well-formed error
`{"ok":false,"error":"Unexpected token P in JSON at position 0"}` was the `P` of
`"Prepare failed…"` returned by `DB()` and rejected by `JSON.parse` in
`js/tools/sqlite.js`.

**Fix (per-worker connections):**
- `pulse.cc` `openSqliteDB` now keeps a **thread_local** connection cache — each
  worker thread owns its own `sqlite3*` per db file, so transaction state is
  private and concurrent workers can't corrupt each other. Each connection sets
  `busy_timeout(5000)` and a modest `cache_size` (many connections now exist).
- `js/tools/sqlite.js` surfaces the real DB error string (instead of a
  misleading `JSON.parse` "Unexpected token" error).
- The module dispatchers (`base`, `authorizer`, `user_interface`) wrap the
  transaction in a retry loop that, on a `database is locked` conflict, retries
  with `BEGIN IMMEDIATE` (the writer grabs the write lock up-front, avoiding the
  WAL read-then-write snapshot conflict). Reads never conflict, so they stay
  deferred and **concurrent** (WAL allows many readers).

**Result:** `0 %` errors at concurrency 20 / 50 / 100 / 200 across read, write,
and mixed scenarios; reads run concurrently (~4,775 req/s @ conc 50, p50 ~9 ms);
:4001 stable. Contended writers serialize (correct — SQLite has one writer),
queueing via `busy_timeout` instead of failing.
