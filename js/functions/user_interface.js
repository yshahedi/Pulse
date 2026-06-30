function UserInterface(action, req) {
    let db = 'user_interface.db';

    // 1. Centralized Schema Definition (White-lists & Type Mapping)

    const FK_MAP = {
        // 'organization_id_fk': { table: 'organization_tab', fields: ['name'] },
        // 'customer_id_fk': { table: 'organization_tab', fields: ['name'] },
        // 'user_id_fk': { table: 'user_tab', fields: ['username', 'full_name'] },
        'page_id_fk': { table: 'page_tab', fields: ['name'] },
        'component_id_fk': { table: 'component_tab', fields: ['name'] },
        'layout_id_fk': { table: 'layout_tab', fields: ['name'] },
        'theme_id_fk': { table: 'theme_tab', fields: ['name'] }
    };

    const ALLOWED_COLUMNS = {
        page_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'layout_id_fk': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'route': 'string',
            'update_at': 'datetime'
        },
        component_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'type': 'string',
            'update_at': 'datetime'
        },
        layout_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        theme_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'is_active': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'primary_color': 'string',
            'secondary_color': 'string',
            'update_at': 'datetime'
        },
        page_component_tab: {
            'component_id_fk': 'number',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'page_id_fk': 'number',
            'position': 'number',
            'update_at': 'datetime'
        },
        ui_config_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'is_active': 'number',
            'organization_id_fk': 'number',
            'setting_key': 'string',
            'setting_value': 'string',
            'theme_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        }
    };

    // 2. Helper function to validate operators
    const isValidOperator = (op) => {
        const validOps = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'];
        return validOps.includes(op?.toUpperCase());
    };

    // 3. Action handlers
    const actions = {
        create_data_model: () => {
            Sqlite(db, `CREATE TABLE IF NOT EXISTS page_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    route TEXT DEFAULT NULL,
                    layout_id_fk INTEGER DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS component_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    type TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS layout_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS theme_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    primary_color TEXT DEFAULT NULL,
                    secondary_color TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS page_component_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    page_id_fk INTEGER NOT NULL,
                    component_id_fk INTEGER NOT NULL,
                    position INTEGER DEFAULT 0,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS ui_config_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER DEFAULT NULL,
                    theme_id_fk INTEGER DEFAULT NULL,
                    setting_key TEXT NOT NULL,
                    setting_value TEXT DEFAULT NULL,
                    is_active INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            return true;
        },

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

            const rows = Sqlite(db, rowsSql, [...values, limit || 10, offset || 0]);
            const totalResult = Sqlite(db, countSql, values);

            return { rows, total_count: totalResult[0]?.total || 0 };
        },

        get: (req) => {
            const name = req?.name;
            const id = req?.id ?? 0;
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

            const sql = `SELECT ${selectFields.join(', ')} FROM ${name} AS t1 ${joinSql} WHERE t1.id = ?`;
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
            // One SQLite connection per worker: a concurrent writer can cause a
            // transient "database is locked" (WAL write/snapshot conflict). Retry,
            // upgrading to BEGIN IMMEDIATE so the writer grabs the lock up-front
            // (no snapshot conflict). Reads never hit this, so they stay
            // concurrent (deferred); only contended writes pay the cost.
            const __msg = String((e && e.message) || e);
            if (__msg.indexOf('locked') !== -1 && ++__tx_attempt < 50) { __immediate = true; continue; }
            throw (e);
        }
    }

    return ret;
}

