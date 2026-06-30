---
title: Pulse System Backend Guidelines
description: Architecture and development rules for the Pulse System backend
version: 1.0.0
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SKILL.md: Pulse System Development Architecture & Guidelines

You are working on an existing backend codebase.
Strictly follow every rule in this document for all tasks. Do not deviate from the established architecture.

---

## 1. System Overview

The Pulse System operates on a dual-repository architecture designed for modularity and scalability:

- **Backend (JavaScript/C++):** A modular service-oriented core using SQLite for persistent data storage.
- **React Panel (Frontend):** The administrative and user interface responsible for interacting with the Backend via a centralized API.

---

## 2. Backend Modular Architecture

The system is divided into functional modules (e.g., `base`, `authorizer`, `user-interface`, `human-capital`).

### 2.1 Persistence Layer

- Each module is assigned a dedicated SQLite database located in `/db/`.
- Database naming convention: `[module_name].db`

### 2.2 Functional Layer (Business Logic)

- **Location:** `/js/functions/`
- **Responsibility:** Defines data models and specific actions for each module.
- **Immutable General Actions:** Every function file contains standard actions that **MUST NOT** be modified:
  - `get_all`
  - `get`
  - `add`
  - `edit`  *(note: the update action is named `edit`, not `update`)*
  - `delete`

### 2.3 Registration & Routing

- **`js/system/add_function.js`** — The central registry. Any new module or tool must be defined here to be recognized by the system.
- **`js/routes/api.js`** — The API gateway. New modules must be added to the `modules` object here to enable request routing.
- **`js/tools/`** — Contains utility and helper functions accessible across modules.

---

## 3. Development Workflows

### 3.1 Adding a New Module

To create a new module (e.g., `new_module`), follow this workflow in order:

1. **Create Function File:** Create `js/functions/new_module.js`. Use the existing `base.js` as a structural template.
2. **Register Module:** Add the module reference in `js/system/add_function.js`.
3. **Expose Route:** Update `js/routes/api.js` by adding `new_module` to the `modules` list.
4. **Database:** Ensure the database connection logic points to `/db/new_module.db`.

### 3.2 Adding a Utility Tool

1. **Create Tool:** Add a new file in `js/tools/` (e.g., `js/tools/validator.js`).
2. **Register Tool:** Define the tool in `js/system/add_function.js` to make it globally accessible to other modules.

---

## 4. API Communication Standard

All communications between the React Panel and the Backend must adhere to the following protocol:

| Property       | Value                                   |
|----------------|-----------------------------------------|
| Endpoint       | `http://127.0.0.1:4001/api`             |
| Method         | `POST`                                  |
| Authentication | JWT in `x-api-key` HTTP Header          |

The HTTP server is started on **port 4001** in `js/system/init.js`, which registers the `api` and `reload` routes. The `x-api-key` header carries a JWT (`header.payload.signature`, base64 parts) issued by `base/do_login`. `js/routes/api.js` validates it by decoding the payload, checking `exp`, and confirming an active row in `user_token_tab`, then enforces RBAC via `PERMISSION_MAP` (admins bypass). The only public action (no token) is `base/do_login`. Responses are `{ "ok": true, "result": ... }` or `{ "ok": false, "error": "..." }`.

**Payload Format (JSON):**

```json
{
  "module": "module_name",
  "action": "action_name",
  "data": {
    "key": "value"
  }
}
```

---

## 5. Coding Standards & Constraints

| Rule | Description |
|------|-------------|
| **Naming Convention** | Use `snake_case` for file names, actions, and database columns. |
| **Security** | Always invoke `js/tools/is_sql_injection.js` for input validation before executing any database operations. |
| **Integrity** | Do **not** modify root files (`main.js`, `.cc`, `.h`, `.hpp`) unless explicitly instructed — these are the compiled core. |
| **Sync** | Ensure that changes in Backend actions are consistently reflected in the React Panel's API service calls. |

---

## 6. Directory Structure Reference

```
root
├── db/                     # SQLite Databases per module
├── js/
│   ├── functions/          # Business Logic (base.js, authorizer.js, etc.)
│   ├── routes/             # Route definitions (api.js is the entry point)
│   ├── system/             # Core initialization (add_function.js)
│   └── tools/              # Shared helper functions
├── log/                    # System logs
└── main.js                 # Application entry point
```

---
## 7.Available Extra Functions in javascript

### 7.1 Queue Management
- `QueueProduce(json_args: string)`: Enqueues a request. The JSON must contain `key` and `request`. Optional fields: `url`, `headers`, `timeout`, and `method`.
- `SetQueueConsumer(json_args: string)`: Registers a consumer for a queue. JSON requires `key`, `name`, and either `source` (JS code) or `file_name`.

### 7.2 File System Operations
- `CreateFile(path: string, filename: string, content: string)`: Creates a file at the specified path with the provided content. Returns `"OK"`.
- `ReadFile(filename: string)`: Reads a file as text. Returns the file content as a string, or an empty string if the file cannot be opened.
- `ReadFileBase64(filename: string)`: Reads a file in binary mode and returns its Base64-encoded representation. Returns an empty string on failure.
- `Ls(path: string)`: Lists directory contents at the given path, returning a semicolon-separated string of entries.

### 7.3 Context & State
- `GetContext(key: string)`: Retrieves a stored value from the runtime context associated with the given key.
- `SetContext(key: string, value: string)`: Stores a string value in the runtime context for the given key. Returns `"OK"`.

### 7.4 System & Execution
- `Execute(command: string)`: Executes a shell command on the host system and returns the output.
- `System(command: string, async_flag: string)`: Runs a system command. If `async_flag` is `"true"`, it runs in a detached thread. Returns `"Ok"`.
- `Instance(source: string)`: Executes the provided JavaScript source code within a dedicated runtime instance.
- `Sleep(ms: number)`: Pauses the execution for the specified number of milliseconds.
- `Time()`: Returns the current system time in nanoseconds as a string.

### 7.5 Utilities & Encoding
- `UUID()`: Generates and returns a unique version 4 UUID string.
- `Log(message: string, level: string, force: string)`: Logs a message to the system output. `level` can be "INFO", "DEBUG", or "ERROR".
- `Base64Encode(data: string)`: Returns the Base64-encoded version of the input string.
- `Base64Decode(data: string)`: Decodes a Base64-encoded string back to its original text.

### 7.6 Service & Networking
- `Serve(action: string, data: string)`: Dispatches runtime operations such as starting a `server`, defining a `route`, or adding a `function` via a JSON payload.
- `Service(json_args: string)`: Registers an outbound service (HTTP client configuration). Returns the service ID.
- `RemoveService(id: uint)`: Unregisters an outbound service using its ID.
- `SetScheduler(json_args: string)`: Schedules a task to run at specific intervals. Requires `interval` and `source`/`file_name`. Returns scheduler ID.
- `RemoveScheduler(id: uint)`: Stops and removes a scheduled task by its ID.

### Usage Notes
- All JSON arguments must be valid JSON strings; otherwise, the runtime may throw an error.
- Paths should be relative to the runtime execution directory or absolute if permissions allow.
- Memory and context are shared within the same instance scope unless otherwise specified.

---

## 8. Runtime Control (Pulse)

The Pulse runtime can be controlled using the following commands.

### 8.1 Start Runtime
- `./Pulse start main.js`
- Starts the Pulse runtime and loads the main JavaScript entry file (`main.js`).

### 8.2 Stop Runtime
- `./Pulse stop main.js`
- Stops the running Pulse instance.

**Important:**  
After executing `stop`, you must wait **20 seconds** before running `start` again.

### 8.3 Reload Functions
- `curl http://127.0.0.1:4001/reload -d '{}'`
- Reloads all JavaScript functions located in the `/functions` directory **without restarting the runtime**.

### 8.4 Reloading Other Files
The `reload` endpoint only reloads files inside the `/functions` directory.

If other files (such as `main.js` or other runtime-related scripts) are modified, you must fully restart Pulse using the following sequence:

1. `./Pulse stop main.js`
2. wait **20 seconds**
3. `./Pulse start main.js`

---

## 9. Implementation Ground Truth

The sections above are the rules. This section documents how the code *actually* behaves today — read it before editing, since some details span multiple files.

### 9.1 Runtime model (this is NOT Node.js)

Pulse is a custom C++/V8 host (`main.cc`, `pulse.cc`). JS files are not modules — they execute inside the host, which injects globals. There are no `require`/`import`, no `module.exports`. Key host-provided globals beyond the functions in Section 7:

- `Serv(action, obj)` — the runtime control primitive (note: `Serv`, not `Serve`). Used to register functions (`Serv('add_function', { name, file_name })`), start an HTTP server (`Serv('server', {...})`), and define routes (`Serv('route', {...})`).
- `DB(jsonArgs)` — raw SQLite access; always go through the `Sqlite(db, query, values)` wrapper in `js/tools/sqlite.js` instead of calling `DB` directly.
- `Instance(source)` — runs JS source in a fresh runtime instance (used by `main.js` to bootstrap).
- Inside a **route** file, the host injects `request` (JSON string body), `request_headers` (JSON string), and expects the file to assign the `response` string and push to the `headers` array. Routes are plain script bodies, not exported handlers — see `js/routes/api.js`.

### 9.2 Boot sequence

`main.js` → `AddFunction_()` (registers every tool/function/system file, in `js/system/add_function.js`) → `Init_()` (`js/system/init.js`). `Init_` starts the server on port 4001, registers the `api` + `reload` routes, calls `create_data_model` for each module (creates all tables, `CREATE TABLE IF NOT EXISTS`), then seeds via `Base('seed_admin')` and `Authorizer('seed_admin')`. Seeding is idempotent. The default admin is `ADMIN` / MD5(`admin123`).

### 9.3 Module function anatomy

A module file exports a single function `Name(action, req)` (e.g. `Base(action, req)` in `js/functions/base.js`). Internally it defines an `actions` object whose keys are action names; the dispatcher at the bottom wraps the call in `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK`. Each module pins its own DB via a local `let db = '<module>.db'`.

Security in the generic CRUD path is **whitelist-based, not regex-based**:
- `ALLOWED_COLUMNS` — per-table map of allowed column → type. Any column not listed is silently ignored on write and rejected on read.
- `FK_MAP` — drives automatic `LEFT JOIN`s so `get`/`get_all` return `<fk>_<field>` display columns.
- `ALLOWED_OPERATORS` — whitelist for the recursive `filters` builder in `get_all`.
- All values are passed as bound parameters to `Sqlite(...)`.

Because of this, the Section 5 rule about calling `is_sql_injection` applies mainly to free-text paths (e.g. the telegram bot in `js/system/load_org.js`); the core CRUD modules are protected by the whitelists + parameter binding above.

CRUD request shapes (the `data` object from the API payload becomes `req`):
- `get_all`: `{ name, filters, search, limit, offset, order_fields, order_dir }` → `{ rows, total_count }`. `filters` is a recursive group: `{ join: 'AND'|'OR', items: [ { key, operator, value } | <nested group> ] }`.
- `get`: `{ name, id }` → single row or `null`.
- `add`: `{ name, record }` → new id. `id`/`create_at`/`update_at` are stripped/auto-set.
- `edit`: `{ name, record }` (record must include `id`) → id.
- `delete`: `{ name, id }` → `true`.

### 9.4 Routing reality vs. registration

`js/routes/api.js` only routes three modules: `authorizer`, `base`, `user_interface`. The voucher/financial functions (`issue_voucher`, `reverse_voucher`, `financial`) are registered as callable functions in `add_function.js` but are **not** wired into the `modules` map in `api.js`, so they are not reachable over the API yet. To expose a new module you must add it in *both* `add_function.js` and the `modules` object in `api.js` (and, if it needs permissions, in `PERMISSION_MAP`).

### 9.5 Build & run

- **Build the binary** (rarely needed; the compiled `Pulse` is checked in): see the `compile` script. It is a single ` g++ -std=c++20 main.cc pulse.cc  -o Pulse -DV8_COMPRESS_POINTERS -DV8_31BIT_SMIS_ON_64BIT_ARCH -DV8_ENABLE_SANDBOX -Idl_c_iso8583_v0_0_3 -Idl_c_common_v0_0_2  -I/usr/local/include/ixwebsocket  -I/opt/botan-static/include/ -I/usr/local/include/uWebSockets/ -I/usr/local/include/uSockets/ -I/usr/local/include  -I/usr/local/include/v8/ -I/usr/local/include/botan-3/ -I/usr/include/mysql/ -I/usr/include/mysqlx/  /usr/local/lib/uSockets/uSockets.a /usr/local/lib/libixwebsocket.a /opt/botan-static/lib/libbotan-3.a -lmysqlcppconnx -lpthread   -lz   -luuid    -lcrypto  -lprotobuf    /usr/local/lib/libv8_monolith.a  /usr/local/lib/libv8_libplatform.a /usr/local/lib/libv8_libbase.a -lssl  -ldl  -lcurl -lsqlite3 -static-libstdc++ -static-libgcc` against a static V8 monolith and many system libs — do not run it unless explicitly asked, and never edit the `.cc`/`.h`/`.hpp` core (Section 5 rule).
- **Run:** `./Pulse start main.js`; **stop:** `./Pulse stop main.js` (then wait 20s before starting again — `main.lock` guards the instance).
- **Hot-reload JS functions** without restart: `curl http://127.0.0.1:4001/reload -d '{}'`. This re-runs `AddFunction_()` and `create_data_model` for all modules. Editing `main.js` or `js/system/init.js` requires a full stop/start.
- There is **no test framework, linter, or package manager** in this repo — no `package.json`, no `node_modules`. "Running a test" means hitting the API endpoint with `curl` against a running Pulse instance.


### 9.6 Logs & data

- Logs: `log/main_<YYYY-MM-DD>.log` (via the `Log()` global). The `api` route logs every request and response.
- SQLite DBs live in `db/` with WAL mode (`*.db-wal`, `*.db-shm` present). Schemas are defined *in code* inside each module's `create_data_model` action, not in migration files.

---

## 10. Final Rule

Do not bypass the established project structure.
If a new requirement appears, implement it by **extending the current architecture in the correct place** — never introduce a parallel structure.
