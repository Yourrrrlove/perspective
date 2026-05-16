# Security Policy

## Supported Versions

Security updates are applied only to the latest release.

## Reporting a Vulnerability

To report a security issue, please use the GitHub Security Advisory
["Report a Vulnerability"](https://github.com/perspective-dev/perspective/security/advisories/new)
tab.

Report security bugs in third-party modules to the person or team maintaining
the module. You can also report a vulnerability through the
[npm contact form](https://www.npmjs.com/support) by selecting "I'm reporting a
security vulnerability".

## Escalation

If you do not receive an acknowledgement of your report within 6 business days,
or if you cannot find a private security contact for the project, you may
escalate to the OpenJS Foundation CNA at `security@lists.openjsf.org`.

If the project acknowledges your report but does not provide any further
response or engagement within 14 days, escalation is also appropriate.

## Threat Model

The Perspective WebSocket `Server` (the Python `tornado.py`/`aiohttp.py`/
`starlette.py` adapters and the Node `WebSocketServer`) is not a security
boundary against its `Client`. Any `Client` that can send messages to a
`Server` is treated as the author of the queries it submits, and is permitted
to create or delete `Table`/`View` resources, author arbitrary
[expression columns](./docs/md/explanation/view/config/expressions.md), and —
for `Virtual Server` backends (DuckDB, ClickHouse, Polars, custom
`VirtualServerHandler`) — author SQL fragments executed under the configured
database role. The `Virtual Server` SQL builder does not parameterize or
validate client-supplied identifiers, expressions, or operators, because
there is no privilege boundary inside the engine for it to enforce.

The bundled WebSocket adapters above are reference integrations: they do not
implement authentication, authorization, CSRF protection, rate limiting, or
origin enforcement, and are not intended to be exposed directly to untrusted
networks. Production deployments must place an authenticating reverse proxy,
application-framework middleware, or API gateway between the network and the
`Server`.

### In-browser WASM deployments are not affected

This applies only when the `Server` runs in a separate process reached
over a network transport (WebSocket). In-browser deployments — including 
`perspective` running entirely in a Web Worker, the
[`perspective-server` WASM build](./docs/md/explanation/architecture.md),
[`duckdb-wasm`](./docs/md/how_to/javascript/virtual_server/duckdb.md),
and any other `Virtual Server` whose backend executes inside the browser
tab — do not have this concern. The `Client` and `Server` share a single
security context (the browser tab, under the same-origin policy of the
embedding page), there is no network transport for a third-party principal
to reach, and the only principal who can submit queries is the same user who
loaded the page. SQL or expression "injection" by that user against a backend
running inside their own tab is not a privilege escalation.

### In scope

The following remain in scope for security reports:

- Memory-safety bugs in the C++ engine, Rust crates, or WASM module.
- Bugs in the `<perspective-viewer>` Shadow DOM, CSS, or sanitization paths
  that allow injected markup or styles to escape the component or affect
  the embedding page.
- Crashes, hangs, panics, or denial-of-service in the engine reachable from
  well-formed protobuf messages.
- Breaches of the trust model above — for example, a `Client` causing effects
  on a different `Client`'s `Server` state in a configuration where those
  `Client`s share a `Server` but are intended to be isolated, or an
  expression column reaching state outside the `Server` it was authored
  against.
- Vulnerabilities in the published artifacts themselves (supply-chain).
