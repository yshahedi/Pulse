// metrics.h — Lightweight, near-zero-overhead worker telemetry for Pulse.
//
// The ENTIRE telemetry surface lives in this header and is gated behind the
// PULSE_METRICS compile flag. When the flag is absent every hook below is an
// empty inline (no instructions, no symbols), so the feature compiles out with
// zero residual cost — see the #else branch at the bottom.
//
// Design (why this is cheap on the hot path):
//   * Each worker thread owns ONE cache-line-padded slot in a fixed global
//     array. A thread only ever writes its own slot, so there is no contention,
//     no false sharing, no locks and no allocation on the task path.
//   * Per task we do ~4 relaxed atomic stores + 1 vdso clock read (<100ns),
//     which is statistically invisible next to a V8 fn->Call (µs–ms).
//   * Aggregation (snapshot) only happens on a dedicated low-priority thread on
//     a 500ms timer — never on a worker's critical path.
//
// Transport: a self-contained uWS WebSocket server (own port, own event loop
// thread) pushes a JSON snapshot to all connected dashboards every 500ms. It is
// completely isolated from the application's HTTP/WS servers and auth model.
#ifndef PULSE_METRICS_H
#define PULSE_METRICS_H

#include <cstdint>
#include <string>

namespace pmetrics
{
    // Pool ids — one logical worker pool per Pulse subsystem.
    enum Pool : uint32_t
    {
        POOL_JS = 1,        // MyV8 — runs all JS functions/routes (primary workers)
        POOL_INBOUND = 2,   // InboundServer — HTTP/WS request handling
        POOL_OUTBOUND = 3,  // Outbound — outgoing HTTP/WS calls
        POOL_SCHED = 4,     // Scheduler — interval tasks
    };
}

#ifdef PULSE_METRICS

#include <atomic>
#include <array>
#include <chrono>
#include <thread>
#include <set>
#include <string>
#include <sstream>
#include <fstream>
#include <deque>
#include <vector>
#include <filesystem>
#include <cstdint>
#include <cstdio>
#include <unistd.h>

// uWS (App.h / Loop) is pulled in by pulse.h, which is always included before
// this header in pulse.cc. We only reference uWS inside this gated block.

namespace pmetrics
{
    enum State : uint8_t { ST_UNUSED = 0, ST_IDLE = 1, ST_BUSY = 2 };

    static constexpr size_t MAX_WORKERS = 2048;

    // One slot per worker thread, padded to a cache line so neighbouring slots
    // never share a line (no false sharing between workers).
    struct alignas(64) WorkerSlot
    {
        std::atomic<uint8_t>  state{ST_UNUSED};
        std::atomic<uint32_t> pool{0};
        std::atomic<uint64_t> processed{0};
        std::atomic<uint64_t> errors{0};
        std::atomic<uint64_t> last_seen_ms{0}; // wall-clock of last task boundary
        std::atomic<uint64_t> tid{0};
        char _pad[64 - ((sizeof(std::atomic<uint8_t>) + sizeof(std::atomic<uint32_t>) +
                         4 * sizeof(std::atomic<uint64_t>)) % 64)];
    };

    inline std::array<WorkerSlot, MAX_WORKERS> g_slots;
    inline std::atomic<uint32_t> g_next_slot{0};

    // Per-pool monotonic enqueue/dequeue counters. queue_depth = enqueued - dequeued.
    // Only updated at single, well-defined produce() entry points + the Scope
    // ctor (dequeue), so the difference is an exact backlog gauge.
    inline std::array<std::atomic<uint64_t>, 8> g_enq{};
    inline std::array<std::atomic<uint64_t>, 8> g_deq{};

    inline std::atomic<uint64_t> g_start_ms{0};

    inline uint64_t now_ms()
    {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::system_clock::now().time_since_epoch())
            .count();
    }

    inline uint64_t this_tid()
    {
        return static_cast<uint64_t>(
            std::hash<std::thread::id>{}(std::this_thread::get_id()));
    }

    // Lazily claims a slot for the calling thread on first use, and releases it
    // (marks ST_UNUSED) when the thread exits — so a crashed/retired worker
    // disappears from the dashboard within one interval.
    struct Registrant
    {
        int idx = -1;
        void ensure(uint32_t pool)
        {
            if (idx >= 0) return;
            uint32_t i = g_next_slot.fetch_add(1, std::memory_order_relaxed);
            if (i >= MAX_WORKERS) { idx = MAX_WORKERS - 1; return; } // shared overflow slot
            idx = static_cast<int>(i);
            g_slots[idx].pool.store(pool, std::memory_order_relaxed);
            g_slots[idx].tid.store(this_tid(), std::memory_order_relaxed);
            g_slots[idx].last_seen_ms.store(now_ms(), std::memory_order_relaxed);
            g_slots[idx].state.store(ST_IDLE, std::memory_order_relaxed);
        }
        ~Registrant()
        {
            if (idx >= 0 && idx < (int)MAX_WORKERS)
                g_slots[idx].state.store(ST_UNUSED, std::memory_order_relaxed);
        }
    };
    inline thread_local Registrant g_reg;

    // RAII guard placed around a single unit of work on a worker thread.
    //   ctor: claim slot (first time) -> mark BUSY, stamp heartbeat, dequeue++.
    //   dtor: processed++, stamp heartbeat, mark IDLE.
    // All stores are relaxed atomics on the thread's own slot: lock-free, no alloc.
    struct Scope
    {
        int idx;
        explicit Scope(uint32_t pool)
        {
            g_reg.ensure(pool);
            idx = g_reg.idx;
            g_deq[pool & 7].fetch_add(1, std::memory_order_relaxed);
            auto &s = g_slots[idx];
            s.last_seen_ms.store(now_ms(), std::memory_order_relaxed);
            s.state.store(ST_BUSY, std::memory_order_relaxed);
        }
        void fail()
        {
            g_slots[idx].errors.fetch_add(1, std::memory_order_relaxed);
        }
        ~Scope()
        {
            auto &s = g_slots[idx];
            s.processed.fetch_add(1, std::memory_order_relaxed);
            s.last_seen_ms.store(now_ms(), std::memory_order_relaxed);
            s.state.store(ST_IDLE, std::memory_order_relaxed);
        }
    };

    // Called at each pool's produce() entry point. One relaxed add.
    inline void enqueue(uint32_t pool)
    {
        g_enq[pool & 7].fetch_add(1, std::memory_order_relaxed);
    }

    // --- Process-level resource sampling (cheap, only on the 500ms tick) -------
    struct ProcStat { double cpu_pct = 0.0; uint64_t rss_kb = 0; uint64_t threads = 0; };

    inline ProcStat sample_proc()
    {
        ProcStat out;
        // RSS + thread count from /proc/self/statm and /proc/self/stat.
        {
            std::ifstream f("/proc/self/statm");
            uint64_t size_pages = 0, rss_pages = 0;
            if (f >> size_pages >> rss_pages)
                out.rss_kb = rss_pages * (sysconf(_SC_PAGESIZE) / 1024);
        }
        uint64_t utime = 0, stime = 0, num_threads = 0;
        {
            std::ifstream f("/proc/self/stat");
            std::string line;
            std::getline(f, line);
            // Fields after the (comm) parenthesised field: skip up to the ')'.
            auto rp = line.rfind(')');
            if (rp != std::string::npos)
            {
                std::istringstream is(line.substr(rp + 2));
                std::string tok;
                // index after comm: field 3 = state ... we want utime(14),stime(15),num_threads(20)
                // relative to the substring, field 1 == original field 3.
                int rel = 1; // we are now at original field 3
                while (is >> tok)
                {
                    if (rel == 12) utime = std::strtoull(tok.c_str(), nullptr, 10);      // field 14
                    else if (rel == 13) stime = std::strtoull(tok.c_str(), nullptr, 10); // field 15
                    else if (rel == 18) { num_threads = std::strtoull(tok.c_str(), nullptr, 10); break; } // field 20
                    rel++;
                }
            }
        }
        out.threads = num_threads;

        // CPU% = Δjiffies / Δwallclock, kept between calls. snapshot() is only
        // ever called from the single metrics loop thread, so a static is safe.
        static uint64_t prev_jiffies = 0;
        static uint64_t prev_wall_ms = 0;
        uint64_t jiffies = utime + stime;
        uint64_t wall = now_ms();
        long hz = sysconf(_SC_CLK_TCK);
        if (prev_wall_ms != 0 && wall > prev_wall_ms && hz > 0)
        {
            double dj = double(jiffies - prev_jiffies);
            double dt_s = double(wall - prev_wall_ms) / 1000.0;
            out.cpu_pct = (dj / double(hz)) / dt_s * 100.0;
        }
        prev_jiffies = jiffies;
        prev_wall_ms = wall;
        return out;
    }

    inline const char *pool_name(uint32_t p)
    {
        switch (p)
        {
        case POOL_JS: return "js";
        case POOL_INBOUND: return "inbound";
        case POOL_OUTBOUND: return "outbound";
        case POOL_SCHED: return "scheduler";
        default: return "other";
        }
    }

    inline const char *state_name(uint8_t s)
    {
        return s == ST_BUSY ? "busy" : (s == ST_IDLE ? "idle" : "unused");
    }

    // Build the full JSON snapshot. O(active workers); runs only on the tick.
    inline std::string snapshot_json()
    {
        uint64_t now = now_ms();
        ProcStat ps = sample_proc();

        struct Agg { uint64_t workers=0, busy=0, idle=0, processed=0, errors=0; };
        std::array<Agg, 8> agg{};

        std::ostringstream w; // per-worker array
        w << "[";
        bool first = true;
        uint32_t used = g_next_slot.load(std::memory_order_relaxed);
        if (used > MAX_WORKERS) used = MAX_WORKERS;
        for (uint32_t i = 0; i < used; ++i)
        {
            auto &s = g_slots[i];
            uint8_t st = s.state.load(std::memory_order_relaxed);
            if (st == ST_UNUSED) continue;
            uint32_t p = s.pool.load(std::memory_order_relaxed);
            uint64_t pr = s.processed.load(std::memory_order_relaxed);
            uint64_t er = s.errors.load(std::memory_order_relaxed);
            uint64_t ls = s.last_seen_ms.load(std::memory_order_relaxed);

            Agg &a = agg[p & 7];
            a.workers++;
            if (st == ST_BUSY) a.busy++; else a.idle++;
            a.processed += pr;
            a.errors += er;

            if (!first) w << ",";
            first = false;
            w << "{\"slot\":" << i
              << ",\"pool\":" << p
              << ",\"pool_name\":\"" << pool_name(p) << "\""
              << ",\"state\":\"" << state_name(st) << "\""
              << ",\"processed\":" << pr
              << ",\"errors\":" << er
              << ",\"last_seen_ms\":" << ls
              << ",\"age_ms\":" << (now >= ls ? now - ls : 0)
              << ",\"tid\":" << s.tid.load(std::memory_order_relaxed)
              << "}";
        }
        w << "]";

        std::ostringstream pools;
        pools << "[";
        bool pf = true;
        for (uint32_t p = 1; p <= 4; ++p)
        {
            Agg &a = agg[p & 7];
            uint64_t enq = g_enq[p & 7].load(std::memory_order_relaxed);
            uint64_t deq = g_deq[p & 7].load(std::memory_order_relaxed);
            int64_t qd = (int64_t)enq - (int64_t)deq;
            if (qd < 0) qd = 0;
            // Inbound enqueue is multi-site, so its depth is reported as -1 (unknown).
            bool has_q = (p == POOL_JS || p == POOL_OUTBOUND || p == POOL_SCHED);
            if (!pf) pools << ",";
            pf = false;
            pools << "{\"id\":" << p
                  << ",\"name\":\"" << pool_name(p) << "\""
                  << ",\"workers\":" << a.workers
                  << ",\"busy\":" << a.busy
                  << ",\"idle\":" << a.idle
                  << ",\"queued\":" << (has_q ? (long long)qd : -1)
                  << ",\"processed\":" << a.processed
                  << ",\"errors\":" << a.errors
                  << ",\"running\":" << (a.workers > 0 ? "true" : "false")
                  << "}";
        }
        pools << "]";

        std::ostringstream out;
        out << "{\"enabled\":true"
            << ",\"ts\":" << now
            << ",\"uptime_ms\":" << (now - g_start_ms.load(std::memory_order_relaxed))
            << ",\"process\":{\"cpu_pct\":" << ps.cpu_pct
            << ",\"rss_kb\":" << ps.rss_kb
            << ",\"threads\":" << ps.threads << "}"
            << ",\"pools\":" << pools.str()
            << ",\"workers\":" << w.str()
            << "}";
        return out.str();
    }

    // --- Live log tailing -----------------------------------------------------
    // We tail the newest ./log/*.log file on the metrics loop thread and push
    // new lines to dashboards. Reading appended bytes (small, every 500ms) costs
    // nothing on any worker hot path and never touches Log() itself.
    inline std::string g_log_dir = "./log";
    inline std::string g_log_file;             // currently-tailed file
    inline uint64_t g_log_off = 0;             // byte offset already streamed
    inline std::string g_log_partial;          // leftover incomplete trailing line
    inline std::deque<std::string> g_log_ring; // recent lines for new-client backlog
    inline bool g_log_inited = false;
    static constexpr size_t LOG_RING_MAX = 500;
    static constexpr size_t LOG_MAX_LINES_PER_TICK = 400;
    static constexpr uint64_t LOG_MAX_BYTES_PER_TICK = 256 * 1024;

    inline std::string json_escape(const std::string &s)
    {
        std::string o;
        o.reserve(s.size() + 8);
        for (unsigned char c : s)
        {
            switch (c)
            {
            case '"': o += "\\\""; break;
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            default:
                if (c < 0x20)
                {
                    char b[8];
                    std::snprintf(b, sizeof(b), "\\u%04x", c);
                    o += b;
                }
                else
                    o += (char)c;
            }
        }
        return o;
    }

    inline std::string find_newest_log()
    {
        std::string best;
        std::filesystem::file_time_type best_t;
        std::error_code ec;
        std::filesystem::directory_iterator it(g_log_dir, ec), end;
        for (; !ec && it != end; it.increment(ec))
        {
            const auto &p = it->path();
            if (p.extension() != ".log") continue;
            std::error_code ec2;
            auto t = std::filesystem::last_write_time(p, ec2);
            if (ec2) continue;
            if (best.empty() || t > best_t) { best = p.string(); best_t = t; }
        }
        return best;
    }

    // Read up to maxLines complete lines from the tail (last maxBytes) of a file.
    inline std::vector<std::string> read_tail_lines(const std::string &path, uint64_t maxBytes, size_t maxLines)
    {
        std::vector<std::string> lines;
        std::ifstream f(path, std::ios::binary);
        if (!f) return lines;
        f.seekg(0, std::ios::end);
        uint64_t size = (uint64_t)f.tellg();
        uint64_t start = size > maxBytes ? size - maxBytes : 0;
        f.seekg((std::streamoff)start);
        std::string data;
        data.resize(size - start);
        if (!data.empty()) f.read(&data[0], (std::streamsize)data.size());
        size_t p = 0, nl;
        while ((nl = data.find('\n', p)) != std::string::npos) { lines.push_back(data.substr(p, nl - p)); p = nl + 1; }
        if (start > 0 && !lines.empty()) lines.erase(lines.begin()); // drop partial first line
        if (lines.size() > maxLines) lines.erase(lines.begin(), lines.end() - maxLines);
        return lines;
    }

    // Returns complete log lines appended since the last call (loop thread only).
    inline std::vector<std::string> read_new_log_lines()
    {
        std::vector<std::string> out;
        std::string newest = find_newest_log();
        if (newest.empty()) return out;

        if (newest != g_log_file)
        {
            // First attach or daily rotation: tail the new file from its end so
            // we stream only fresh lines (backlog is delivered separately on open).
            g_log_file = newest;
            g_log_partial.clear();
            std::error_code ec;
            auto sz = std::filesystem::file_size(newest, ec);
            g_log_off = ec ? 0 : sz;
        }

        std::ifstream f(g_log_file, std::ios::binary);
        if (!f) return out;
        f.seekg(0, std::ios::end);
        uint64_t size = (uint64_t)f.tellg();
        if (size < g_log_off) { g_log_off = 0; g_log_partial.clear(); } // truncated
        uint64_t avail = size - g_log_off;
        if (avail == 0) return out;
        if (avail > LOG_MAX_BYTES_PER_TICK) { g_log_off = size - LOG_MAX_BYTES_PER_TICK; avail = LOG_MAX_BYTES_PER_TICK; g_log_partial.clear(); }

        f.seekg((std::streamoff)g_log_off);
        std::string chunk;
        chunk.resize(avail);
        f.read(&chunk[0], (std::streamsize)avail);
        g_log_off = size;

        std::string data = g_log_partial + chunk;
        g_log_partial.clear();
        size_t p = 0, nl;
        while ((nl = data.find('\n', p)) != std::string::npos) { out.push_back(data.substr(p, nl - p)); p = nl + 1; }
        g_log_partial = data.substr(p);

        if (out.size() > LOG_MAX_LINES_PER_TICK)
        {
            size_t omitted = out.size() - LOG_MAX_LINES_PER_TICK;
            out.erase(out.begin(), out.end() - LOG_MAX_LINES_PER_TICK);
            out.insert(out.begin(), "... (" + std::to_string(omitted) + " earlier log lines omitted under load)");
        }
        for (auto &l : out) { g_log_ring.push_back(l); if (g_log_ring.size() > LOG_RING_MAX) g_log_ring.pop_front(); }
        return out;
    }

    inline std::string make_log_msg(const std::vector<std::string> &lines, bool backlog)
    {
        std::ostringstream o;
        o << "{\"type\":\"log\",\"backlog\":" << (backlog ? "true" : "false") << ",\"lines\":[";
        for (size_t i = 0; i < lines.size(); ++i)
        {
            if (i) o << ",";
            o << "\"" << json_escape(lines[i]) << "\"";
        }
        o << "]}";
        return o.str();
    }

    // --- Dedicated WebSocket push server --------------------------------------
    struct DashData {};
    using DashWS = uWS::WebSocket<false, true, DashData>;

    inline std::set<DashWS *> g_clients;       // touched only on the loop thread
    inline std::atomic<void *> g_loop{nullptr};
    inline std::atomic<bool> g_started{false};

    inline void broadcast_now()
    {
        // Runs on the uWS loop thread (via defer) → ws->send is thread-safe here.
        if (!g_log_inited) { read_new_log_lines(); g_log_inited = true; } // seed offset to EOF
        std::string snap = snapshot_json();
        std::vector<std::string> newlines = read_new_log_lines();
        std::string logmsg = newlines.empty() ? std::string() : make_log_msg(newlines, false);
        for (auto *ws : g_clients)
        {
            ws->send(snap, uWS::OpCode::TEXT);
            if (!logmsg.empty()) ws->send(logmsg, uWS::OpCode::TEXT);
        }
    }

    inline void run_server(int port)
    {
        uWS::App app;
        app.ws<DashData>("/*", {
            .compression = uWS::SHARED_COMPRESSOR,
            .maxPayloadLength = 4 * 1024,
            .idleTimeout = 0,
            .open = [](auto *ws) {
                g_clients.insert((DashWS *)ws);
                ((DashWS *)ws)->send(snapshot_json(), uWS::OpCode::TEXT);
                // Send a log backlog (tail of the newest log file) so the panel
                // shows recent history immediately on connect.
                std::string newest = find_newest_log();
                if (!newest.empty())
                {
                    auto backlog = read_tail_lines(newest, 64 * 1024, 200);
                    if (!backlog.empty())
                        ((DashWS *)ws)->send(make_log_msg(backlog, true), uWS::OpCode::TEXT);
                }
            },
            .message = [](auto * /*ws*/, std::string_view, uWS::OpCode) {},
            .close = [](auto *ws, int, std::string_view) {
                g_clients.erase((DashWS *)ws);
            },
        });
        app.listen(port, [port](auto *sock) {
            if (sock)
                Logger::instance().log(Logger::Level::INFO,
                    "Metrics WS server listening on port " + std::to_string(port));
            else
                Logger::instance().log(Logger::Level::ERROR,
                    "Metrics WS server failed to bind port " + std::to_string(port));
        });
        g_loop.store(uWS::Loop::get());
        app.run(); // blocks on this thread
    }

    // Idempotent. Spawns the WS server loop + the 500ms broadcast ticker.
    inline void start_server(int port)
    {
        bool expected = false;
        if (!g_started.compare_exchange_strong(expected, true))
            return; // already running
        g_start_ms.store(now_ms(), std::memory_order_relaxed);

        std::thread([port] { run_server(port); }).detach();

        std::thread([] {
            for (;;)
            {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                auto *loop = static_cast<uWS::Loop *>(g_loop.load());
                if (loop) loop->defer([] { broadcast_now(); });
            }
        }).detach();
    }

    inline void stop_server() { /* threads are daemon; process exit reclaims */ }
}

#else // !PULSE_METRICS — everything compiles to nothing.

namespace pmetrics
{
    struct Scope { explicit Scope(uint32_t) {} void fail() {} };
    inline void enqueue(uint32_t) {}
    inline void start_server(int) {}
    inline void stop_server() {}
    inline std::string snapshot_json() { return "{\"enabled\":false}"; }
}

#endif // PULSE_METRICS
#endif // PULSE_METRICS_H
