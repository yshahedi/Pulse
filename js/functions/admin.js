function Admin(action, req) {
    let db = 'admin.db';

    // ────────────────────────────────────────────────────────────────────────
    // Admin / DevTools module.
    //
    // Persists the runtime objects an operator can create from the admin panel
    // — inbound routes, outbound services, schedulers and user-written
    // functions — into admin.db, and (re)registers them with the live Pulse
    // runtime via the Serv() control primitive.
    //
    // The generic CRUD path (get_all/get/add/edit/delete) is the SAME
    // whitelist-protected implementation used by base.js / user_interface.js
    // and MUST NOT be modified. Side effects that touch the runtime live in the
    // dedicated custom actions below (apply_route, apply_service,
    // apply_scheduler, remove_*, save_function, delete_function, boot).
    //
    // Persistence model: the panel writes rows here, then calls apply_* to make
    // them live immediately (no restart). On a cold start, init.js calls
    // Admin('boot', { server }) which re-registers every active row, so what the
    // operator builds survives a stop/start. Method codes follow the runtime
    // convention: 1=POST 2=GET 3=PUT 4=DELETE 5=PATCH.
    // ────────────────────────────────────────────────────────────────────────

    const CUSTOM_FILE_PATH = './js/functions';
    const CUSTOM_FILE_NAME = 'custom.js';
    const CUSTOM_FILE = `${CUSTOM_FILE_PATH}/${CUSTOM_FILE_NAME}`;

    const FK_MAP = {
        // no foreign-key display joins for the admin tables
    };

    const ALLOWED_COLUMNS = {
        route_tab: {
            'id': 'number',
            'name': 'string',
            'description': 'string',
            'source': 'string',
            'method': 'number',
            'timeout': 'number',
            'is_active': 'number',
            'runtime_id': 'number',
            'organization_id_fk': 'number',
            'customer_id_fk': 'number',
            'create_at': 'datetime',
            'update_at': 'datetime'
        },
        service_tab: {
            'id': 'number',
            'name': 'string',
            'description': 'string',
            'url': 'string',
            'method': 'number',
            'timeout': 'number',
            'headers': 'string',
            'is_active': 'number',
            'runtime_id': 'number',
            'organization_id_fk': 'number',
            'customer_id_fk': 'number',
            'create_at': 'datetime',
            'update_at': 'datetime'
        },
        scheduler_tab: {
            'id': 'number',
            'name': 'string',
            'description': 'string',
            'source': 'string',
            'interval': 'number',
            'timeout': 'number',
            'is_active': 'number',
            'runtime_id': 'number',
            'organization_id_fk': 'number',
            'customer_id_fk': 'number',
            'create_at': 'datetime',
            'update_at': 'datetime'
        },
        function_tab: {
            'id': 'number',
            'name': 'string',
            'description': 'string',
            'source': 'string',
            'is_active': 'number',
            'organization_id_fk': 'number',
            'customer_id_fk': 'number',
            'create_at': 'datetime',
            'update_at': 'datetime'
        }
    };

    const isValidOperator = (op) => {
        const validOps = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'];
        return validOps.includes(op?.toUpperCase());
    };

    // Resolve the inbound server id that hosts /api (port 4001). init.js stores
    // it in context; fall back to 1 (the first server started) if absent.
    const mainServerId = () => {
        const ctx = GetContext('MAIN_SERVER_ID');
        const n = Number(ctx);
        return Number.isFinite(n) && n > 0 ? n : (req?.server ? Number(req.server) : 1);
    };

    // Build the single-file Custom() dispatcher from all active function rows.
    // Each row's `source` is a JS function *body* receiving `req`. The generated
    // file exposes `Custom(name, req)` so routes and schedulers can call user
    // logic by name, e.g. Custom('my_fn', data).
    const buildCustomSource = () => {
        const rows = Sqlite(db, `SELECT name, source FROM function_tab WHERE is_active = 1 ORDER BY id`);
        let body = 'function Custom(name, req) {\n';
        body += '    const __fns = {\n';
        (rows || []).forEach(r => {
            const key = JSON.stringify(String(r.name || ''));
            const src = String(r.source || '');
            body += `        ${key}: function (req) {\n${src}\n        },\n`;
        });
        body += '    };\n';
        body += "    const fn = __fns[name];\n";
        body += "    if (!fn) throw 'Unknown custom function: ' + name;\n";
        body += '    return fn(req);\n';
        body += '}\n';
        return body;
    };

    const rebuildCustom = () => {
        const source = buildCustomSource();
        // Persist to disk so AddFunction_() reloads it on restart, AND hot-swap
        // the live definition so routes/schedulers see it immediately.
        try { CreateFile(CUSTOM_FILE_PATH, CUSTOM_FILE_NAME, source); } catch (e) { Log(`Admin.rebuildCustom write: ${e}`, 'ERROR'); }
        try { Serv('update_function', { name: 'Custom', source, refresh: true }); } catch (e) { Log(`Admin.rebuildCustom register: ${e}`, 'ERROR'); }
        return true;
    };

    const actions = {
        create_data_model: () => {
            Sqlite(db, `CREATE TABLE IF NOT EXISTS route_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    source TEXT DEFAULT NULL,
                    method INTEGER DEFAULT 1,
                    timeout INTEGER DEFAULT 60000,
                    is_active INTEGER DEFAULT 1,
                    runtime_id INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS service_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    url TEXT NOT NULL,
                    method INTEGER DEFAULT 1,
                    timeout INTEGER DEFAULT 60000,
                    headers TEXT DEFAULT '[]',
                    is_active INTEGER DEFAULT 1,
                    runtime_id INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS scheduler_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    source TEXT DEFAULT NULL,
                    interval INTEGER DEFAULT 60000,
                    timeout INTEGER DEFAULT 30000,
                    is_active INTEGER DEFAULT 1,
                    runtime_id INTEGER DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS function_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    source TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            return true;
        },

        // ── Standard whitelist CRUD (immutable — mirrors user_interface.js) ────
        get_all: (req) => {
            const { name, filters, search, limit, offset, order_fields, order_dir } = req;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';

            let selectFields = ['t1.*'];
            let joinSql = '';
            let joinCounter = 0;

            Object.keys(ALLOWED_COLUMNS[name]).forEach(col => {
                if (FK_MAP[col]) {
                    joinCounter++;
                    const fk = FK_MAP[col];
                    const alias = `${col}_ref_${joinCounter}`;
                    joinSql += ` LEFT JOIN ${fk.table} AS ${alias} ON t1.${col} = ${alias}.id `;
                    fk.fields.forEach(f => {
                        selectFields.push(`${alias}.${f} AS ${col}_${f}`);
                    });
                }
            });

            let values = [];

            const buildFilterGroup = (group) => {
                if (!group || !group.items || group.items.length === 0) return '';
                const joinStr = (group.join || 'AND').toUpperCase();

                const conditions = group.items.map(item => {
                    if (item.items) return `(${buildFilterGroup(item)})`;

                    const { key, operator, value } = item;
                    if (!ALLOWED_COLUMNS[name][key] || !isValidOperator(operator)) return null;

                    const op = operator.toLowerCase();
                    if (op === 'is' || op === 'is not') {
                        return `t1.${key} ${op} NULL`;
                    } else if (op === 'in' || op === 'not in') {
                        if (!Array.isArray(value)) return null;
                        const placeholders = value.map(() => '?').join(',');
                        values.push(...value);
                        return `t1.${key} ${op} (${placeholders})`;
                    } else {
                        values.push(value);
                        return `t1.${key} ${operator} ?`;
                    }
                }).filter(Boolean);

                return conditions.length > 0 ? conditions.join(` ${joinStr} `) : '';
            };

            let whereSql = '';
            const filterSql = buildFilterGroup(filters);
            if (filterSql) whereSql = `(${filterSql})`;

            if (search) {
                const searchConditions = Object.entries(ALLOWED_COLUMNS[name])
                    .map(([col, type]) => {
                        if (type === 'string') {
                            values.push(`%${search}%`);
                            return `t1.${col} LIKE ?`;
                        } else if (type === 'number' && !isNaN(search)) {
                            values.push(Number(search));
                            return `t1.${col} = ?`;
                        }
                        return null;
                    }).filter(Boolean);

                if (searchConditions.length > 0) {
                    whereSql = whereSql ? `${whereSql} AND (${searchConditions.join(' OR ')})` : `(${searchConditions.join(' OR ')})`;
                }
            }

            const finalWhere = whereSql ? `WHERE ${whereSql}` : '';

            let orderBy = 't1.id';
            if (order_fields?.length) {
                const validOrder = order_fields.filter(f => ALLOWED_COLUMNS[name][f]);
                if (validOrder.length) {
                    const dir = (order_dir || 'ASC').toUpperCase();
                    orderBy = validOrder.map(f => `t1.${f} ${dir}`).join(', ');
                }
            }

            const rowsSql = `
                SELECT ${selectFields.join(', ')}
                FROM ${name} AS t1
                ${joinSql}
                ${finalWhere}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `;

            const countSql = `SELECT COUNT(*) as total FROM ${name} AS t1 ${finalWhere}`;

            const rows = Sqlite(db, rowsSql, [...values, limit || 50, offset || 0]);
            const totalResult = Sqlite(db, countSql, values);

            return { rows, total_count: totalResult[0]?.total || 0 };
        },

        get: (req) => {
            const name = req?.name;
            const id = req?.id ?? 0;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            const sql = `SELECT t1.* FROM ${name} AS t1 WHERE t1.id = ?`;
            const result = Sqlite(db, sql, [id]);
            return result[0] || null;
        },

        add: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            let fields = [];
            let values = [];

            if (req?.record) {
                Object.keys(req.record).forEach(x => {
                    if (ALLOWED_COLUMNS[name][x] && x !== 'id' && x !== 'create_at' && x !== 'update_at') {
                        fields.push(x);
                        values.push(req.record[x]);
                    }
                });
            }

            fields.push('create_at', 'update_at');
            const now = Math.floor(Date.now() / 1000);
            values.push(now, now);

            const sql = `INSERT INTO ${name}(${fields.join(',')}) VALUES(${fields.map(() => '?').join(',')})`;
            Sqlite(db, sql, values);

            return Sqlite(db, `SELECT LAST_INSERT_ROWID() as id;`)?.[0]?.id ?? 0;
        },

        edit: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            let fields = [];
            let values = [];
            const id = req?.record?.id;

            if (!id) throw "Missing record ID for update.";

            if (req?.record) {
                Object.keys(req.record).forEach(x => {
                    if (ALLOWED_COLUMNS[name][x] && x !== 'id' && x !== 'create_at' && x !== 'update_at') {
                        fields.push(`${x}=?`);
                        values.push(req.record[x]);
                    }
                });
            }

            fields.push('update_at=?');
            values.push(Math.floor(Date.now() / 1000));

            values.push(id);
            const sql = `UPDATE ${name} SET ${fields.join(',')} WHERE id=?`;
            Sqlite(db, sql, values);

            return id;
        },

        delete: (req) => {
            let name = req?.name;
            if (!ALLOWED_COLUMNS?.[name]) throw 'Table not found!';
            const id = req?.id ?? 0;
            Sqlite(db, `DELETE FROM ${name} WHERE id=?`, [id]);
            return true;
        },

        // ── Runtime registration actions ──────────────────────────────────────

        // Register (or re-register) an inbound route on the main server from its
        // route_tab row. Tears down any previous registration first so repeated
        // applies don't stack duplicate handlers.
        apply_route: (req) => {
            const id = req?.id ?? req?.record?.id;
            if (!id) throw 'route id required';
            const row = Sqlite(db, `SELECT * FROM route_tab WHERE id = ?`, [id])?.[0];
            if (!row) throw 'route not found';

            const sid = mainServerId();
            // Remove the old handler if present — idempotent. The runtime stores
            // routes under a leading-slash key (addApi uses "/" + name) but does
            // NOT prepend it on remove, so we must pass the slash form here.
            try { Serv('remove_route', { route: `/${row.name}`, server: sid }); } catch (_) { }

            if (row.is_active !== 1) {
                Sqlite(db, `UPDATE route_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
                return { id, active: false };
            }

            const rid = Serv('route', {
                route: row.name,
                server: sid,
                source: row.source || `response='OK';`,
                method: row.method || 1,
                timeout: row.timeout || 60000
            });
            const runtimeId = Number(rid);
            Sqlite(db, `UPDATE route_tab SET runtime_id = ?, update_at = ? WHERE id = ?`,
                [Number.isFinite(runtimeId) ? runtimeId : null, Math.floor(Date.now() / 1000), id]);
            return { id, runtime_id: runtimeId, route: `/${row.name}` };
        },

        remove_route: (req) => {
            const id = req?.id;
            if (!id) throw 'route id required';
            const row = Sqlite(db, `SELECT * FROM route_tab WHERE id = ?`, [id])?.[0];
            if (row) {
                try { Serv('remove_route', { route: `/${row.name}`, server: mainServerId() }); } catch (_) { }
                Sqlite(db, `UPDATE route_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
            }
            return true;
        },

        // Register an outbound service from its service_tab row; stores the
        // returned service id so callers can reach it via CallService(id).
        apply_service: (req) => {
            const id = req?.id ?? req?.record?.id;
            if (!id) throw 'service id required';
            const row = Sqlite(db, `SELECT * FROM service_tab WHERE id = ?`, [id])?.[0];
            if (!row) throw 'service not found';

            // Drop any previous registration for this row.
            if (row.runtime_id) { try { Serv('remove_service', { id: Number(row.runtime_id) }); } catch (_) { } }

            if (row.is_active !== 1) {
                Sqlite(db, `UPDATE service_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
                return { id, active: false };
            }

            let headers = [];
            try { headers = JSON.parse(row.headers || '[]'); } catch (_) { headers = []; }

            const sid = Serv('service', {
                url: row.url,
                method: row.method || 1,
                timeout: row.timeout || 60000,
                headers: Array.isArray(headers) ? headers : []
            });
            const runtimeId = Number(sid);
            Sqlite(db, `UPDATE service_tab SET runtime_id = ?, update_at = ? WHERE id = ?`,
                [Number.isFinite(runtimeId) ? runtimeId : null, Math.floor(Date.now() / 1000), id]);
            return { id, runtime_id: runtimeId };
        },

        remove_service: (req) => {
            const id = req?.id;
            if (!id) throw 'service id required';
            const row = Sqlite(db, `SELECT * FROM service_tab WHERE id = ?`, [id])?.[0];
            if (row) {
                if (row.runtime_id) { try { Serv('remove_service', { id: Number(row.runtime_id) }); } catch (_) { } }
                Sqlite(db, `UPDATE service_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
            }
            return true;
        },

        // Register a scheduler from its scheduler_tab row. set_scheduler has no
        // update primitive, so we remove the old timer then start a fresh one.
        apply_scheduler: (req) => {
            const id = req?.id ?? req?.record?.id;
            if (!id) throw 'scheduler id required';
            const row = Sqlite(db, `SELECT * FROM scheduler_tab WHERE id = ?`, [id])?.[0];
            if (!row) throw 'scheduler not found';

            if (row.runtime_id) { try { Serv('remove_scheduler', { id: Number(row.runtime_id) }); } catch (_) { } }

            if (row.is_active !== 1) {
                Sqlite(db, `UPDATE scheduler_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
                return { id, active: false };
            }

            const sid = Serv('set_scheduler', {
                interval: row.interval || 60000,
                timeout: row.timeout || 30000,
                source: row.source || `Log('scheduler ${row.name}');`
            });
            const runtimeId = Number(sid);
            Sqlite(db, `UPDATE scheduler_tab SET runtime_id = ?, update_at = ? WHERE id = ?`,
                [Number.isFinite(runtimeId) ? runtimeId : null, Math.floor(Date.now() / 1000), id]);
            return { id, runtime_id: runtimeId };
        },

        remove_scheduler: (req) => {
            const id = req?.id;
            if (!id) throw 'scheduler id required';
            const row = Sqlite(db, `SELECT * FROM scheduler_tab WHERE id = ?`, [id])?.[0];
            if (row) {
                if (row.runtime_id) { try { Serv('remove_scheduler', { id: Number(row.runtime_id) }); } catch (_) { } }
                Sqlite(db, `UPDATE scheduler_tab SET runtime_id = NULL, update_at = ? WHERE id = ?`, [Math.floor(Date.now() / 1000), id]);
            }
            return true;
        },

        // Upsert a user function and regenerate the single Custom() file so it is
        // immediately callable from routes/schedulers as Custom('<name>', data).
        save_function: (req) => {
            const name = req?.name;
            const source = req?.source ?? '';
            const description = req?.description ?? '';
            const id = req?.id;
            if (!name) throw 'function name required';
            const now = Math.floor(Date.now() / 1000);

            if (id) {
                Sqlite(db, `UPDATE function_tab SET name=?, source=?, description=?, is_active=1, update_at=? WHERE id=?`,
                    [name, source, description, now, id]);
            } else {
                const existing = Sqlite(db, `SELECT id FROM function_tab WHERE name = ?`, [name])?.[0];
                if (existing) {
                    Sqlite(db, `UPDATE function_tab SET source=?, description=?, is_active=1, update_at=? WHERE id=?`,
                        [source, description, now, existing.id]);
                } else {
                    Sqlite(db, `INSERT INTO function_tab(name, source, description, is_active, create_at, update_at) VALUES(?,?,?,1,?,?)`,
                        [name, source, description, now, now]);
                }
            }
            rebuildCustom();
            const savedId = id || Sqlite(db, `SELECT id FROM function_tab WHERE name = ?`, [name])?.[0]?.id;
            return { id: savedId, name };
        },

        delete_function: (req) => {
            const id = req?.id;
            if (!id) throw 'function id required';
            Sqlite(db, `DELETE FROM function_tab WHERE id = ?`, [id]);
            rebuildCustom();
            return true;
        },

        rebuild_custom: () => rebuildCustom(),

        // Cold-start loader. Called from init.js on every boot: rebuilds the
        // Custom() file then re-registers every active route/service/scheduler
        // so operator-created objects survive a stop/start. Best-effort per row.
        boot: (req) => {
            if (req?.server) SetContext('MAIN_SERVER_ID', `${Number(req.server)}`);
            actions.create_data_model();
            rebuildCustom();

            const now = Math.floor(Date.now() / 1000);
            const sid = mainServerId();
            let routes = 0, services = 0, schedulers = 0;

            (Sqlite(db, `SELECT * FROM route_tab WHERE is_active = 1`) || []).forEach(row => {
                try {
                    try { Serv('remove_route', { route: `/${row.name}`, server: sid }); } catch (_) { }
                    const rid = Number(Serv('route', {
                        route: row.name, server: sid,
                        source: row.source || `response='OK';`,
                        method: row.method || 1, timeout: row.timeout || 60000
                    }));
                    Sqlite(db, `UPDATE route_tab SET runtime_id=?, update_at=? WHERE id=?`, [Number.isFinite(rid) ? rid : null, now, row.id]);
                    routes++;
                } catch (e) { Log(`Admin.boot route ${row.name}: ${e}`, 'ERROR'); }
            });

            (Sqlite(db, `SELECT * FROM service_tab WHERE is_active = 1`) || []).forEach(row => {
                try {
                    let headers = [];
                    try { headers = JSON.parse(row.headers || '[]'); } catch (_) { headers = []; }
                    const rid = Number(Serv('service', {
                        url: row.url, method: row.method || 1, timeout: row.timeout || 60000,
                        headers: Array.isArray(headers) ? headers : []
                    }));
                    Sqlite(db, `UPDATE service_tab SET runtime_id=?, update_at=? WHERE id=?`, [Number.isFinite(rid) ? rid : null, now, row.id]);
                    services++;
                } catch (e) { Log(`Admin.boot service ${row.name}: ${e}`, 'ERROR'); }
            });

            (Sqlite(db, `SELECT * FROM scheduler_tab WHERE is_active = 1`) || []).forEach(row => {
                try {
                    const rid = Number(Serv('set_scheduler', {
                        interval: row.interval || 60000, timeout: row.timeout || 30000,
                        source: row.source || `Log('scheduler ${row.name}');`
                    }));
                    Sqlite(db, `UPDATE scheduler_tab SET runtime_id=?, update_at=? WHERE id=?`, [Number.isFinite(rid) ? rid : null, now, row.id]);
                    schedulers++;
                } catch (e) { Log(`Admin.boot scheduler ${row.name}: ${e}`, 'ERROR'); }
            });

            Log(`Admin.boot: registered ${routes} route(s), ${services} service(s), ${schedulers} scheduler(s).`);
            return { routes, services, schedulers, server: sid };
        }
    };

    let ret;
    let __tx_attempt = 0;
    let __immediate = false;
    for (;;) {
        try {
            Sqlite(db, __immediate ? 'BEGIN IMMEDIATE;' : 'BEGIN TRANSACTION;');
            const fn = actions[action];
            if (!fn) throw `Unknown action: ${action}`;
            ret = fn(req);
            Sqlite(db, 'COMMIT;');
            break;
        }
        catch (e) {
            try { Sqlite(db, 'ROLLBACK;'); } catch (_) { }
            const __msg = String((e && e.message) || e);
            if (__msg.indexOf('locked') !== -1 && ++__tx_attempt < 50) { __immediate = true; continue; }
            throw (e);
        }
    }

    return ret;
}
