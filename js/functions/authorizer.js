function Authorizer(action, req) {
    let db = 'authorizer.db';

    // 1. Centralized Schema Definition (White-lists & Type Mapping)

    const FK_MAP = {
        //'organization_id_fk': { table: 'organization_tab', fields: ['name', 'code'] },
        //'customer_id_fk': { table: 'organization_tab', fields: ['name'] },
        //'user_id_fk': { table: 'user_tab', fields: ['username', 'full_name'] },
        'role_id_fk': { table: 'role_tab', fields: ['name'] },
        'permission_id_fk': { table: 'permission_tab', fields: ['name'] }
    };

    const ALLOWED_COLUMNS = {
        role_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'update_at': 'datetime'
        },
        permission_tab: {
            'action_type': 'string',
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'description': 'string',
            'id': 'number',
            'name': 'string',
            'organization_id_fk': 'number',
            'resource': 'string',
            'scope': 'string',
            'update_at': 'datetime'
        },
        role_permission_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'permission_id_fk': 'number',
            'role_id_fk': 'number',
            'update_at': 'datetime'
        },
        user_role_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'role_id_fk': 'number',
            'update_at': 'datetime',
            'user_id_fk': 'number'
        },
        access_control_list_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'is_allow': 'number',
            'organization_id_fk': 'number',
            'permission_id_fk': 'number',
            'resource': 'string',
            'role_id_fk': 'number',
            'update_at': 'datetime'
        },
        user_group_role_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'role_id_fk': 'number',
            'update_at': 'datetime',
            'user_group_id_fk': 'number'
        },
        user_permission_tab: {
            'create_at': 'datetime',
            'customer_id_fk': 'number',
            'id': 'number',
            'organization_id_fk': 'number',
            'permission_id_fk': 'number',
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
            Sqlite(db, `CREATE TABLE IF NOT EXISTS role_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS permission_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT DEFAULT NULL,
                    resource TEXT DEFAULT NULL,
                    scope TEXT DEFAULT NULL,
                    action_type TEXT DEFAULT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            // Migrate: add scope/action_type to permission_tab for DBs created before
            // those columns existed. Guard with PRAGMA so we never run a duplicate ALTER
            // (which would throw and get logged as a QUERY ERROR on every start/reload).
            const permCols = Sqlite(db, `PRAGMA table_info(permission_tab)`).map(c => c.name);
            if (!permCols.includes('scope')) Sqlite(db, `ALTER TABLE permission_tab ADD COLUMN scope TEXT DEFAULT NULL`);
            if (!permCols.includes('action_type')) Sqlite(db, `ALTER TABLE permission_tab ADD COLUMN action_type TEXT DEFAULT NULL`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS role_permission_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    role_id_fk INTEGER NOT NULL,
                    permission_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_role_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    role_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS access_control_list_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    role_id_fk INTEGER DEFAULT NULL,
                    permission_id_fk INTEGER DEFAULT NULL,
                    resource TEXT DEFAULT NULL,
                    is_allow INTEGER DEFAULT 1,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_group_role_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_group_id_fk INTEGER NOT NULL,
                    role_id_fk INTEGER NOT NULL,
                    organization_id_fk INTEGER DEFAULT NULL,
                    customer_id_fk INTEGER DEFAULT NULL,
                    create_at INTEGER DEFAULT (unixepoch()),
                    update_at INTEGER DEFAULT (unixepoch())
                    );`);
            Sqlite(db, `CREATE TABLE IF NOT EXISTS user_permission_tab (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    user_id_fk INTEGER NOT NULL,
                    permission_id_fk INTEGER NOT NULL,
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
        },

        // ── Access-management custom actions ────────────────────────────────

        get_user_roles: (req) => {
            const user_id = req?.user_id;
            if (!user_id) throw 'user_id is required';
            return Sqlite(db, `
                SELECT ur.id, ur.user_id_fk, ur.role_id_fk,
                       r.name AS role_name, r.description AS role_description,
                       ur.create_at, ur.update_at
                FROM user_role_tab ur
                JOIN role_tab r ON ur.role_id_fk = r.id
                WHERE ur.user_id_fk = ?
                ORDER BY r.name
            `, [user_id]);
        },

        get_role_users: (req) => {
            const role_id = req?.role_id;
            if (!role_id) throw 'role_id is required';
            return Sqlite(db, `
                SELECT ur.id, ur.user_id_fk, ur.role_id_fk,
                       ur.create_at, ur.update_at
                FROM user_role_tab ur
                WHERE ur.role_id_fk = ?
                ORDER BY ur.user_id_fk
            `, [role_id]);
        },

        get_role_permissions: (req) => {
            const role_id = req?.role_id;
            if (!role_id) throw 'role_id is required';
            return Sqlite(db, `
                SELECT rp.id, rp.role_id_fk, rp.permission_id_fk,
                       p.name AS permission_name, p.description AS permission_description,
                       p.resource AS permission_resource,
                       rp.create_at, rp.update_at
                FROM role_permission_tab rp
                JOIN permission_tab p ON rp.permission_id_fk = p.id
                WHERE rp.role_id_fk = ?
                ORDER BY p.name
            `, [role_id]);
        },

        get_group_roles: (req) => {
            const user_group_id = req?.user_group_id;
            if (!user_group_id) throw 'user_group_id is required';
            return Sqlite(db, `
                SELECT ugr.id, ugr.user_group_id_fk, ugr.role_id_fk,
                       r.name AS role_name, r.description AS role_description,
                       ugr.create_at, ugr.update_at
                FROM user_group_role_tab ugr
                JOIN role_tab r ON ugr.role_id_fk = r.id
                WHERE ugr.user_group_id_fk = ?
                ORDER BY r.name
            `, [user_group_id]);
        },

        get_user_direct_permissions: (req) => {
            const user_id = req?.user_id;
            if (!user_id) throw 'user_id is required';
            return Sqlite(db, `
                SELECT up.id, up.user_id_fk, up.permission_id_fk,
                       p.name AS permission_name, p.description AS permission_description,
                       p.resource AS permission_resource,
                       up.create_at, up.update_at
                FROM user_permission_tab up
                JOIN permission_tab p ON up.permission_id_fk = p.id
                WHERE up.user_id_fk = ?
                ORDER BY p.name
            `, [user_id]);
        },

        get_user_permissions: (req) => {
            const user_id = req?.user_id;
            if (!user_id) throw 'user_id is required';

            // 1. Roles assigned directly to user
            const userRoles = Sqlite(db, `SELECT role_id_fk FROM user_role_tab WHERE user_id_fk = ?`, [user_id]);
            let roleIds = userRoles.map(r => r.role_id_fk);

            // 2. Get user's groups from base.db via Base() global
            try {
                const groupResult = Base('get_all', {
                    name: 'user_group_member_tab',
                    filters: { join: 'AND', items: [{ key: 'user_id_fk', operator: '=', value: user_id }] },
                    limit: 1000,
                    offset: 0
                });
                const groupIds = (groupResult?.rows ?? []).map(g => g.user_group_id_fk);

                if (groupIds.length > 0) {
                    const placeholders = groupIds.map(() => '?').join(',');
                    const groupRoles = Sqlite(db, `SELECT role_id_fk FROM user_group_role_tab WHERE user_group_id_fk IN (${placeholders})`, groupIds);
                    groupRoles.forEach(r => { if (!roleIds.includes(r.role_id_fk)) roleIds.push(r.role_id_fk); });
                }
            } catch (e) {
                Log(`get_user_permissions: could not fetch group memberships: ${e}`);
            }

            // 3. Permissions from all roles
            let permissions = [];
            if (roleIds.length > 0) {
                const placeholders = roleIds.map(() => '?').join(',');
                permissions = Sqlite(db, `
                    SELECT DISTINCT p.id, p.name, p.description, p.resource, 'role' AS source
                    FROM role_permission_tab rp
                    JOIN permission_tab p ON rp.permission_id_fk = p.id
                    WHERE rp.role_id_fk IN (${placeholders})
                `, roleIds);
            }

            // 4. Direct user permissions
            const directPerms = Sqlite(db, `
                SELECT DISTINCT p.id, p.name, p.description, p.resource, 'direct' AS source
                FROM user_permission_tab up
                JOIN permission_tab p ON up.permission_id_fk = p.id
                WHERE up.user_id_fk = ?
            `, [user_id]);

            // Merge, deduplicate by permission id
            const seen = new Set(permissions.map(p => p.id));
            directPerms.forEach(p => { if (!seen.has(p.id)) permissions.push(p); });

            return permissions;
        },

        check_permission: (req) => {
            const { user_id, resource } = req;
            if (!user_id || !resource) throw 'user_id and resource are required';
            const allPerms = actions.get_user_permissions({ user_id });
            return allPerms.some(p => p.resource === '*' || p.resource === resource);
        },

        // Returns just the resource strings — optimised for the frontend permission set.
        get_user_effective_permissions: (req) => {
            const { user_id } = req;
            if (!user_id) throw 'user_id is required';
            const perms = actions.get_user_permissions({ user_id });
            return perms.map(p => p.resource).filter(Boolean);
        },

        seed_admin: () => {
            const now = Math.floor(Date.now() / 1000);

            // Idempotent: skip if admin role already exists
            const existingRole = Sqlite(db, `SELECT id FROM role_tab WHERE name = 'Administrator' LIMIT 1`);
            if (existingRole.length > 0) {
                Log('seed_admin (authorizer): admin role already exists, skipping.');
                return { role_id: existingRole[0].id };
            }

            // Create Administrator role
            Sqlite(db, `INSERT INTO role_tab (name, description, create_at, update_at) VALUES (?, ?, ?, ?)`,
                ['Administrator', 'System administrator with full access', now, now]);
            const roleId = Sqlite(db, `SELECT LAST_INSERT_ROWID() as id`)[0].id;

            // Full permission catalogue — naming convention:
            //   menu.{key}.view          → sidebar visibility
            //   page.{segment}.view      → route-level page access
            //   {resource}.{action}      → CRUD operation
            //   button.{id}.click        → UI button visibility
            //   api.{module}.{table}.*   → raw API call
            //   *                        → wildcard (full access)
            const defaultPermissions = [
                // Wildcard
                { name: 'Full Access',                resource: '*',                            scope: 'action',  action_type: 'view',   description: 'Unrestricted access to every resource' },
                // Menu visibility
                { name: 'Menu: Dashboard',            resource: 'menu.dashboard.view',          scope: 'menu',    action_type: 'view',   description: 'Show Dashboard in sidebar' },
                { name: 'Menu: Catalog',              resource: 'menu.catalog.view',            scope: 'menu',    action_type: 'view',   description: 'Show Catalog in sidebar' },
                { name: 'Menu: Orders',               resource: 'menu.orders.view',             scope: 'menu',    action_type: 'view',   description: 'Show Orders in sidebar' },
                { name: 'Menu: Customers',            resource: 'menu.customers.view',          scope: 'menu',    action_type: 'view',   description: 'Show Customers in sidebar' },
                { name: 'Menu: Reports',              resource: 'menu.reports.view',            scope: 'menu',    action_type: 'view',   description: 'Show Reports in sidebar' },
                { name: 'Menu: Access',               resource: 'menu.access.view',             scope: 'menu',    action_type: 'view',   description: 'Show Access Management in sidebar' },
                { name: 'Menu: Settings',             resource: 'menu.settings.view',           scope: 'menu',    action_type: 'view',   description: 'Show Settings in sidebar' },
                // Page access
                { name: 'Page: Users',                resource: 'page.users.view',              scope: 'page',    action_type: 'view',   description: 'Access the Users management page' },
                { name: 'Page: Roles',                resource: 'page.roles.view',              scope: 'page',    action_type: 'view',   description: 'Access the Roles management page' },
                { name: 'Page: Permissions',          resource: 'page.permissions.view',        scope: 'page',    action_type: 'view',   description: 'Access the Permissions management page' },
                { name: 'Page: Groups',               resource: 'page.groups.view',             scope: 'page',    action_type: 'view',   description: 'Access the Groups management page' },
                { name: 'Page: Reports',              resource: 'page.reports.view',            scope: 'page',    action_type: 'view',   description: 'Access the Reports page' },
                { name: 'Page: Settings',             resource: 'page.settings.view',           scope: 'page',    action_type: 'view',   description: 'Access Settings pages' },
                // User CRUD
                { name: 'Users: View',                resource: 'users.view',                   scope: 'action',  action_type: 'view',   description: 'Read user records' },
                { name: 'Users: Create',              resource: 'users.create',                 scope: 'action',  action_type: 'create', description: 'Create new users' },
                { name: 'Users: Edit',                resource: 'users.edit',                   scope: 'action',  action_type: 'edit',   description: 'Edit existing users' },
                { name: 'Users: Delete',              resource: 'users.delete',                 scope: 'action',  action_type: 'delete', description: 'Delete users' },
                // Role CRUD
                { name: 'Roles: View',                resource: 'roles.view',                   scope: 'action',  action_type: 'view',   description: 'Read role records' },
                { name: 'Roles: Create',              resource: 'roles.create',                 scope: 'action',  action_type: 'create', description: 'Create new roles' },
                { name: 'Roles: Edit',                resource: 'roles.edit',                   scope: 'action',  action_type: 'edit',   description: 'Edit roles and their permissions' },
                { name: 'Roles: Delete',              resource: 'roles.delete',                 scope: 'action',  action_type: 'delete', description: 'Delete roles' },
                // Permission CRUD
                { name: 'Permissions: View',          resource: 'permissions.view',             scope: 'action',  action_type: 'view',   description: 'Read permission records' },
                { name: 'Permissions: Create',        resource: 'permissions.create',           scope: 'action',  action_type: 'create', description: 'Create new permissions' },
                { name: 'Permissions: Edit',          resource: 'permissions.edit',             scope: 'action',  action_type: 'edit',   description: 'Edit existing permissions' },
                { name: 'Permissions: Delete',        resource: 'permissions.delete',           scope: 'action',  action_type: 'delete', description: 'Delete permissions' },
                // Group CRUD
                { name: 'Groups: View',               resource: 'groups.view',                  scope: 'action',  action_type: 'view',   description: 'Read group records' },
                { name: 'Groups: Create',             resource: 'groups.create',                scope: 'action',  action_type: 'create', description: 'Create new user groups' },
                { name: 'Groups: Edit',               resource: 'groups.edit',                  scope: 'action',  action_type: 'edit',   description: 'Edit groups and their members/roles' },
                { name: 'Groups: Delete',             resource: 'groups.delete',                scope: 'action',  action_type: 'delete', description: 'Delete user groups' },
                // Reports
                { name: 'Reports: View',              resource: 'reports.view',                 scope: 'action',  action_type: 'view',   description: 'View reports' },
                { name: 'Reports: Export',            resource: 'reports.export',               scope: 'action',  action_type: 'export', description: 'Export report data' },
                // Buttons
                { name: 'Button: Add User',           resource: 'button.user_add.click',        scope: 'button',  action_type: 'click',  description: 'Show the Add User button' },
                { name: 'Button: Add Role',           resource: 'button.role_add.click',        scope: 'button',  action_type: 'click',  description: 'Show the Add Role button' },
                { name: 'Button: Add Permission',     resource: 'button.permission_add.click',  scope: 'button',  action_type: 'click',  description: 'Show the Add Permission button' },
                { name: 'Button: Add Group',          resource: 'button.group_add.click',       scope: 'button',  action_type: 'click',  description: 'Show the Add Group button' },
            ];

            const permIds = [];
            for (const perm of defaultPermissions) {
                Sqlite(db, `INSERT INTO permission_tab (name, description, resource, scope, action_type, create_at, update_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [perm.name, perm.description, perm.resource, perm.scope, perm.action_type, now, now]);
                permIds.push(Sqlite(db, `SELECT LAST_INSERT_ROWID() as id`)[0].id);
            }

            // Assign all permissions to Administrator role
            for (const permId of permIds) {
                Sqlite(db, `INSERT INTO role_permission_tab (role_id_fk, permission_id_fk, create_at, update_at) VALUES (?, ?, ?, ?)`,
                    [roleId, permId, now, now]);
            }

            Log(`seed_admin (authorizer): created Administrator role (id=${roleId}) with ${permIds.length} permissions.`);
            return { role_id: roleId, permission_ids: permIds };
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
