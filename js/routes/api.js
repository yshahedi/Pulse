Log(request, 'DEBUG');
response = 'OK';
try {

    let req = JSON.parse(request);
    let module = req?.module;
    let action = req?.action;
    if (!module || !action) throw new Error('module or action not found');
    let data = req?.data ?? {};

    const modules = {
        authorizer(action, data) { return Authorizer(action, data) },
        base(action, data) { return Base(action, data) },
        user_interface(action, data) { return UserInterface(action, data) },
        admin(action, data) { return Admin(action, data) }
    };

    // ── Public actions (no token required) ───────────────────────────────────
    const PUBLIC_ACTIONS = [
        { module: 'base', action: 'do_login' }
    ];
    const isPublic = PUBLIC_ACTIONS.some(p => p.module === module && p.action === action);

    // ── Per-action permission map ─────────────────────────────────────────────
    // Maps { module → action → tableName? → required_permission }.
    // A null value means "authenticated users only, no extra permission needed".
    // Functions that start with 'get_user_' for the caller's own user_id are open.
    const PERMISSION_MAP = {
        base: {
            get_all: {
                user_tab:              'page.users.view',
                user_group_tab:        'page.groups.view',
                user_group_member_tab: 'groups.view',
            },
            get:    { user_tab: 'users.view', user_group_tab: 'groups.view' },
            add:    {
                user_tab:              'users.create',
                user_group_tab:        'groups.create',
                user_group_member_tab: 'groups.edit',
            },
            edit:   { user_tab: 'users.edit',   user_group_tab: 'groups.edit' },
            delete: {
                user_tab:              'users.delete',
                user_group_tab:        'groups.delete',
                user_group_member_tab: 'groups.edit',
            },
        },
        authorizer: {
            get_all: {
                role_tab:            'page.roles.view',
                permission_tab:      'page.permissions.view',
                role_permission_tab: 'roles.view',
                user_role_tab:       'users.view',
                user_group_role_tab: 'groups.view',
                user_permission_tab: 'users.view',
            },
            get:    { role_tab: 'roles.view', permission_tab: 'permissions.view' },
            add:    {
                role_tab:            'roles.create',
                permission_tab:      'permissions.create',
                role_permission_tab: 'roles.edit',
                user_role_tab:       'users.edit',
                user_group_role_tab: 'groups.edit',
                user_permission_tab: 'users.edit',
            },
            edit:   { role_tab: 'roles.edit', permission_tab: 'permissions.edit' },
            delete: {
                role_tab:            'roles.delete',
                permission_tab:      'permissions.delete',
                role_permission_tab: 'roles.edit',
                user_role_tab:       'users.edit',
                user_group_role_tab: 'groups.edit',
                user_permission_tab: 'users.edit',
            },
            get_user_roles:               null, // caller's own data — no restriction
            get_role_permissions:         'roles.view',
            get_group_roles:              'groups.view',
            get_user_direct_permissions:  null,
            get_user_permissions:         null,
            get_user_effective_permissions: null,
            check_permission:             null,
            get_role_users:               'roles.view',
        },
        // Admin / DevTools: managing runtime routes, services, schedulers and
        // operator-written functions is privileged. Admins bypass this entirely;
        // everyone else needs the matching permission.
        admin: {
            get_all:          'admin.view',
            get:              'admin.view',
            add:              'admin.edit',
            edit:             'admin.edit',
            delete:           'admin.edit',
            apply_route:      'admin.edit',
            remove_route:     'admin.edit',
            apply_service:    'admin.edit',
            remove_service:   'admin.edit',
            apply_scheduler:  'admin.edit',
            remove_scheduler: 'admin.edit',
            save_function:    'admin.edit',
            delete_function:  'admin.edit',
            rebuild_custom:   'admin.edit',
            boot:             'admin.edit',
        },
    };

    let jwtPayload = null;

    if (!isPublic) {
        // ── JWT validation ────────────────────────────────────────────────────
        let request_headers_json = JSON.parse(request_headers);
        // Token may arrive in the x-api-key header (preferred) or, to keep
        // browser calls a CORS "simple request" (no preflight), inside the body
        // as `api_key`/`token`. Header wins when both are present.
        let api_key = request_headers_json['x-api-key'] || req?.api_key || req?.token;

        if (!api_key || api_key === 'null' || api_key === 'undefined') {
            throw new Error('UNAUTHORIZED');
        }

        const jwtParts = api_key.split('.');
        if (jwtParts.length !== 3) throw new Error('UNAUTHORIZED');

        try {
            jwtPayload = JSON.parse(Base64Decode(jwtParts[1]));
        } catch (_) {
            throw new Error('UNAUTHORIZED');
        }

        const nowSec = Math.floor(Date.now() / 1000);
        if (!jwtPayload || !jwtPayload.exp || jwtPayload.exp < nowSec) {
            throw new Error('UNAUTHORIZED');
        }

        const tokenRows = Sqlite('base.db',
            `SELECT id FROM user_token_tab WHERE token = ? AND is_active = 1 AND expiry_date > ?`,
            [api_key, nowSec]
        );
        if (!tokenRows || tokenRows.length === 0) {
            throw new Error('UNAUTHORIZED');
        }

        // ── Permission enforcement ────────────────────────────────────────────
        // Admins bypass all permission checks.
        const isAdmin = jwtPayload.is_admin === true;

        if (!isAdmin) {
            const moduleMap = PERMISSION_MAP[module];
            if (moduleMap) {
                const actionEntry = moduleMap[action];
                // actionEntry is either a string (flat requirement), an object (table-keyed),
                // null (no restriction), or undefined (module/action not in map → open).
                if (actionEntry !== undefined && actionEntry !== null) {
                    let required;
                    if (typeof actionEntry === 'string') {
                        required = actionEntry;
                    } else {
                        // Look up by table name (data.name for generic CRUD actions)
                        const tableName = data?.name;
                        required = tableName ? actionEntry[tableName] : null;
                    }
                    if (required) {
                        const userId = jwtPayload.user_id;
                        const allowed = Authorizer('check_permission', { user_id: userId, resource: required });
                        if (!allowed) {
                            throw new Error('FORBIDDEN');
                        }
                    }
                }
            }
        }
    }

    Log(JSON.stringify({ module, action, data }));
    const fn = modules[module];
    if (!fn) throw new Error(`Unknown module: ${module}`);
    response = JSON.stringify({ ok: true, result: fn(action, data) });
    Log(response);
}
catch (e) {
    Log(e);
    const errMsg = e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Unknown Error!');
    response = JSON.stringify({ ok: false, error: errMsg });
}
headers.push({ key: 'Access-Control-Allow-Origin', value: '*' });
headers.push({ key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' });
headers.push({ key: 'Access-Control-Allow-Headers', value: '*' });