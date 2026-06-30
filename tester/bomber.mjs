#!/usr/bin/env node
// bomber.mjs — Pulse API load tester.
//
// Hammers the Pulse API (POST /api on :4001) with a configurable mix of
// read-only actions so you can watch the monitoring dashboard (:4002) react.
// Zero dependencies — uses Node's global fetch (Node 18+; tested on Node 26).
//
// Quick start (with Pulse running):
//   node tester/bomber.mjs                       # 50 workers, 30s, mixed reads
//   node tester/bomber.mjs -c 200 -d 60          # 200 concurrent for 60s
//   node tester/bomber.mjs --rps 500 -d 30       # open-loop, cap 500 req/s
//   node tester/bomber.mjs -s login              # only public do_login (no auth)
//   node tester/bomber.mjs --spike               # ramp bursts to test scaling
//
// Flags:
//   -u, --url        API base URL            (default http://127.0.0.1:4001/api)
//   -c, --concurrency  closed-loop workers   (default 50)
//       --rps        target req/s (open-loop; overrides closed-loop pacing)
//   -d, --duration   seconds to run, 0 = forever  (default 30)
//   -s, --scenario   login | read | mixed    (default mixed)
//       --spike      cycle concurrency in bursts to exercise worker autoscaling
//       --user       admin username          (default ADMIN)
//       --pass       admin password          (default admin123)
//       --think      ms delay after each request per worker (default 0)
//   -q, --quiet      suppress per-second lines (summary only)

// ── arg parsing ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const opt = {
  url: 'http://127.0.0.1:4001/api',
  concurrency: 50,
  rps: 0,
  duration: 30,
  scenario: 'mixed',
  spike: false,
  user: 'ADMIN',
  pass: '123456',
  think: 0,
  quiet: false,
}
const aliases = { u: 'url', c: 'concurrency', d: 'duration', s: 'scenario', q: 'quiet' }
for (let i = 0; i < argv.length; i++) {
  let a = argv[i]
  if (!a.startsWith('-')) continue
  let key = a.replace(/^-+/, '')
  key = aliases[key] || key
  if (key === 'raw-pass') { opt.rawpass = true; continue }
  if (key === 'spike' || key === 'quiet') { opt[key] = true; continue }
  const val = argv[++i]
  if (['concurrency', 'rps', 'duration', 'think'].includes(key)) opt[key] = Number(val)
  else opt[key] = val
}

// ── helpers ──────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now()
const md5 = (s) => createHash('md5').update(s).digest('hex')
// Backend stores MD5(password) (frontend sends CryptoJS.MD5). Hash unless the
// caller passes an already-hashed value via --raw-pass.
const PASS = opt.rawpass ? opt.pass : md5(opt.pass)

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

async function call(body, headers = {}) {
  const t0 = now()
  try {
    const res = await fetch(opt.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* non-json */ }
    const ok = res.ok && json && json.ok === true
    return { ms: now() - t0, httpStatus: res.status, ok, appError: json && json.ok === false ? json.error : null, json }
  } catch (e) {
    return { ms: now() - t0, httpStatus: 0, ok: false, appError: e.code || e.message, json: null }
  }
}

// ── stats ────────────────────────────────────────────────────────────────────
const stats = {
  total: 0, ok: 0, fail: 0,
  http: {},        // status code -> count
  errs: {},        // app/transport error -> count
  sumMs: 0, minMs: Infinity, maxMs: 0,
  // reservoir of latencies for percentiles (circular, fixed memory)
  lat: new Float64Array(200_000), latLen: 0, latPos: 0,
  windowCount: 0,  // requests since last per-second tick
}
function record(r) {
  stats.total++
  stats.sumMs += r.ms
  if (r.ms < stats.minMs) stats.minMs = r.ms
  if (r.ms > stats.maxMs) stats.maxMs = r.ms
  stats.lat[stats.latPos] = r.ms
  stats.latPos = (stats.latPos + 1) % stats.lat.length
  if (stats.latLen < stats.lat.length) stats.latLen++
  stats.windowCount++
  stats.http[r.httpStatus] = (stats.http[r.httpStatus] || 0) + 1
  if (r.ok) stats.ok++
  else {
    stats.fail++
    const k = r.appError || `http_${r.httpStatus}`
    stats.errs[k] = (stats.errs[k] || 0) + 1
  }
}
function percentiles() {
  const n = stats.latLen
  if (!n) return { p50: 0, p90: 0, p99: 0 }
  const arr = Array.from(stats.lat.subarray(0, n)).sort((a, b) => a - b)
  const at = (p) => arr[Math.min(n - 1, Math.floor((p / 100) * n))]
  return { p50: at(50), p90: at(90), p99: at(99) }
}

// ── request generators ───────────────────────────────────────────────────────
let TOKEN = null
let ADMIN_ID = null

function buildPool() {
  const login = () => call({ module: 'base', action: 'do_login', data: { username: opt.user, password: PASS } })
  const authHdr = () => ({ 'x-api-key': TOKEN })
  const reads = [
    () => call({ module: 'base', action: 'get_all', data: { name: 'user_tab', limit: 10 } }, authHdr()),
    () => call({ module: 'authorizer', action: 'get_all', data: { name: 'role_tab', limit: 10 } }, authHdr()),
    () => call({ module: 'authorizer', action: 'get_all', data: { name: 'permission_tab', limit: 20 } }, authHdr()),
    () => call({ module: 'authorizer', action: 'get_user_permissions', data: { user_id: ADMIN_ID } }, authHdr()),
  ]
  if (opt.scenario === 'login') return [login]
  if (opt.scenario === 'read') return TOKEN ? reads : [login]
  // mixed: weight reads heavier than logins
  return TOKEN ? [login, ...reads, ...reads] : [login]
}
let POOL = [login_placeholder]
function login_placeholder() { return call({ module: 'base', action: 'do_login', data: { username: opt.user, password: PASS } }) }
function pick() { return POOL[(Math.random() * POOL.length) | 0] }

// ── runners ──────────────────────────────────────────────────────────────────
let running = true

async function closedLoopWorker() {
  while (running) {
    record(await pick()())
    if (opt.think) await sleep(opt.think)
  }
}

async function openLoopPacer() {
  // Fire at a fixed rate regardless of completion; cap in-flight to avoid runaway.
  const intervalMs = 1000 / opt.rps
  const maxInFlight = Math.max(opt.concurrency, opt.rps) * 4
  let inFlight = 0
  let next = now()
  while (running) {
    next += intervalMs
    if (inFlight < maxInFlight) {
      inFlight++
      pick()().then((r) => { record(r); inFlight-- })
    }
    const wait = next - now()
    if (wait > 1) await sleep(wait)
  }
}

// Spike mode: a manager varies `desired` concurrency in bursts. The manager
// spawns workers until the population reaches `desired` (scale UP); each worker
// bows out when it notices the population exceeds `desired` (scale DOWN). This
// drives Pulse worker autoscaling so you can watch pools grow and shrink.
let desired = 0
let alive = 0

function spikeWorker() {
  alive++
  ;(async () => {
    while (running && alive <= desired) {
      record(await pick()())
      if (opt.think) await sleep(opt.think)
    }
    alive--
  })()
}

async function spikeController() {
  const levels = [10, 50, 150, 30, 250, 5]
  let i = 0
  const manager = setInterval(() => {
    while (alive < desired) spikeWorker()
  }, 100)
  while (running) {
    desired = levels[i++ % levels.length]
    if (!opt.quiet) process.stdout.write(`\n  ▶ spike → ~${desired} concurrent\n`)
    await sleep(5000)
  }
  clearInterval(manager)
}

// ── reporting ────────────────────────────────────────────────────────────────
function tick() {
  if (opt.quiet) return
  const rps = stats.windowCount
  stats.windowCount = 0
  const p = percentiles()
  const errPct = stats.total ? ((stats.fail / stats.total) * 100).toFixed(1) : '0.0'
  process.stdout.write(
    `  ${new Date().toISOString().substr(11, 8)}  ` +
    `${String(rps).padStart(6)} req/s | total ${String(stats.total).padStart(8)} | ` +
    `err ${errPct.padStart(5)}% | p50 ${p.p50.toFixed(1)}ms p90 ${p.p90.toFixed(1)}ms p99 ${p.p99.toFixed(1)}ms\n`,
  )
}

function summary(reason) {
  running = false
  const p = percentiles()
  const avg = stats.total ? stats.sumMs / stats.total : 0
  const wall = (now() - START) / 1000
  console.log(`\n${'─'.repeat(64)}`)
  console.log(`Bomber summary (${reason})`)
  console.log(`  target        ${opt.url}`)
  console.log(`  scenario      ${opt.scenario}${opt.spike ? ' +spike' : ''}   mode ${opt.rps ? `open-loop ${opt.rps} rps` : `closed-loop ${opt.concurrency}`}`)
  console.log(`  wall time     ${wall.toFixed(1)}s`)
  console.log(`  requests      ${stats.total}  (${(stats.total / wall).toFixed(0)} req/s avg)`)
  console.log(`  ok / fail     ${stats.ok} / ${stats.fail}  (${stats.total ? ((stats.fail / stats.total) * 100).toFixed(2) : 0}% errors)`)
  console.log(`  latency ms    min ${stats.minMs === Infinity ? 0 : stats.minMs.toFixed(1)}  avg ${avg.toFixed(1)}  p50 ${p.p50.toFixed(1)}  p90 ${p.p90.toFixed(1)}  p99 ${p.p99.toFixed(1)}  max ${stats.maxMs.toFixed(1)}`)
  console.log(`  http codes    ${JSON.stringify(stats.http)}`)
  if (Object.keys(stats.errs).length) console.log(`  errors        ${JSON.stringify(stats.errs)}`)
  console.log(`${'─'.repeat(64)}`)
  process.exit(0)
}

// ── main ─────────────────────────────────────────────────────────────────────
let START = 0
process.on('SIGINT', () => summary('interrupted'))

;(async () => {
  console.log(`Pulse bomber → ${opt.url}`)
  console.log(`  authenticating as ${opt.user} ...`)
  const lr = await call({ module: 'base', action: 'do_login', data: { username: opt.user, password: PASS } })
  if (lr.ok && lr.json && lr.json.result) {
    TOKEN = typeof lr.json.result === 'string' ? lr.json.result : (lr.json.result.token || lr.json.result.api_key)
    const payload = TOKEN ? decodeJwtPayload(TOKEN) : null
    ADMIN_ID = payload ? payload.user_id : null
    console.log(`  ✓ logged in (user_id=${ADMIN_ID}, admin=${payload ? payload.is_admin : '?'})`)
  } else {
    console.log(`  ✗ login failed (${lr.appError || lr.httpStatus}). Falling back to login-only bombing.`)
    opt.scenario = 'login'
  }
  POOL = buildPool()
  console.log(`  scenario=${opt.scenario}  pool=${POOL.length} request type(s)`)
  console.log(`  mode=${opt.rps ? `open-loop ${opt.rps} req/s` : `closed-loop ${opt.concurrency} workers`}${opt.spike ? '  +spike' : ''}  duration=${opt.duration || '∞'}s`)
  console.log(`  watch the dashboard at ws://127.0.0.1:4002 (npm run dev in dashboard/)\n`)

  START = now()
  const ticker = setInterval(tick, 1000)
  if (opt.duration > 0) setTimeout(() => { clearInterval(ticker); summary('duration reached') }, opt.duration * 1000)

  if (opt.spike) {
    spikeController()
  } else if (opt.rps > 0) {
    openLoopPacer()
  } else {
    const workers = []
    for (let i = 0; i < opt.concurrency; i++) workers.push(closedLoopWorker())
    await Promise.all(workers)
  }
})()
