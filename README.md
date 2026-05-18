# Pulse Engine

**Pulse Engine** is a high‑performance, C++–based runtime for executing backend services, integrations, and automation workflows using JavaScript.  
It is designed as a lightweight, production‑grade execution core that can run entirely headless (no UI dependencies) and is easy to deploy, operate, and scale.

---

## Overview

Pulse Engine provides:

- A **server‑side JavaScript runtime** for building HTTP/WebSocket services, automation workflows, agents, and bots.
- A **centralized execution core** that orchestrates multiple services and workloads in parallel.
- A **multi‑threaded architecture** with automatic load distribution and minimal resource usage.
- Integration hooks for **AI‑assisted development and execution** (ChatGPT, DeepSeek, etc.).

It is intended as a foundational runtime for:

- Backend microservices
- Integration and automation platforms
- Service Bus / message‑driven architectures
- Intelligent agents, bots, and AI‑driven workflows

---

## Key Design Goals

- **High Throughput**: Sustain high TPS on modest hardware.
- **Low Footprint**: Operate efficiently on small Linux cloud instances (e.g. 1 vCPU, 2 GB RAM).
- **Predictable Latency**: Multi‑threaded processing and internal scheduling tuned for production workloads.
- **Developer Ergonomics**: Service definitions in JavaScript, minimal boilerplate, fast iteration.
- **Centralized Runtime**: Unified engine for HTTP/WebSocket endpoints, background jobs, and automation flows.

---

## Architecture

Pulse Engine is implemented entirely in C++ and embeds a JavaScript engine for user‑defined logic. The high‑level architecture includes:

- **Core Runtime**
  - Multi‑threaded execution engine
  - Task scheduling and job queue
  - Automatic load balancing across worker threads
- **Service Layer**
  - HTTP service endpoints
  - WebSocket endpoints
  - Background workers and scheduled jobs
  - Workflow orchestration and back‑pressure handling
- **Integration Layer**
  - Database connectors (SQL/NoSQL adapters, etc.)
  - External service integrations (HTTP, WebSocket, message queues)
  - File and document management
- **AI Integration Layer**
  - Optional integration with ChatGPT, DeepSeek, and other models
  - AI‑assisted code/service generation
  - In‑service AI calls (e.g. enrichment, classification, reasoning)

All services share the same runtime but are isolated at the logical level via service definitions.

---

## Performance Characteristics

Pulse Engine is optimized for real‑world production workloads:

- Capable of handling **10,000+ TPS** on a lightweight single server (depending on workload and environment).
- Designed for **minimal hardware consumption**:
  - Tested on Linux cloud servers with **1 CPU core** and **2 GB RAM**.
- Startup and deployment are streamlined:
  - Installation can typically be completed in **under 3 minutes** on a clean server.
- **Multi‑threaded execution**:
  - Services can be executed in parallel with automatic load distribution.
  - The engine internally manages thread pools and resource usage.

> Note: Exact performance numbers will vary based on workload, I/O patterns, and system configuration. Benchmarking is recommended for your specific use case.

---

## Developer Experience

Pulse is designed so that even junior JavaScript developers can work effectively with it:

- **Service Definitions in JavaScript**
  - Write business logic using familiar JS syntax.
  - Define HTTP routes, WebSocket handlers, and background jobs as JS modules.
- **Minimal Learning Curve**
  - Clear, modular service definition model.
  - Runtime abstracts away low‑level threading, scheduling, and load balancing.
- **Standard Tooling**
  - Works well alongside existing CI/CD pipelines.
  - Configuration via simple files/environment variables (see Configuration section).

# Pulse Runtime API

Pulse provides a lightweight runtime environment for executing JavaScript services and dynamically managing servers, APIs, schedulers, and external services.

This document describes:

- CLI commands
- JavaScript runtime helper functions
- `Serve()` runtime management API

---

## CLI Commands

Pulse provides simple commands to control JavaScript service files.

### Run a Service
```bash
pulse run <file_name>
```

### Stop a Service
```bash
pulse stop <file_name>
```

### Reload a Service
```bash
pulse reload <file_name>
```

---

## JavaScript Runtime Functions

Helper functions available inside Pulse JavaScript scripts.

### Logging
`Log(text)`: Writes a message to the Pulse log system.

### File Operations
- `Ls(path)`: Returns the list of files inside the specified directory.
- `CreateFile(path, filename, content)`: Creates a file with the specified content.
- `ReadFile(path)`: Returns file content as text.
- `ReadFileBase64(path)`: Returns file content encoded as Base64.

### System Commands
`System(command)`: Executes a Linux command.
Example: `System("ls -la")`

### Service Invocation
`CallService({ headers, id, request, path, token, callback })`: Used to call external or internal services (HTTP/WebSocket).

### Context Storage
- `GetContext(key)`: Returns the stored value.
- `SetContext(key, value)`: Stores a value using the specified key.

### Utility
`Sleep(milliseconds)`: Pauses execution for the specified duration.

---

## Runtime Management API

`Serve(action, data)` is used for dynamic orchestration.

### Server Management
- **Create Server:** `Serve('server', { port, is_ssl, certificate, private_key, transport_protocol })`
- **Stop Server:** `Serve('stop_server', { id })`

### Route Management
- **Create Route:** `Serve('route', { file_name, route, server, timeout, method, schema })`
- **Reload Route:** `Serve('reload', { file_name, id, server })`
- **Remove Route:** `Serve('remove_route', { route, server })`

### Function & Handler Management
- **Functions:** `add_function`, `remove_function`, `update_function`
- **Handlers:** `add_handler_function`, `remove_handler_function`

### Scheduler
- **Create Scheduler:** `Serve('set_scheduler', { timeout, interval, source })`
- **Remove Scheduler:** `Serve('remove_scheduler', { id })`

### System Reload
- `Serve('reload', {})`: Reloads main JS, services, APIs, and schedulers.

