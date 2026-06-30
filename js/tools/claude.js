function Claude(command, data, path_params) {

    const API_TOKEN = GetContext("CLAUDE_API_KEY");
    if (!API_TOKEN) throw ('Missing CLAUDE_API_KEY in context configuration!');
    const api = {
        /* =========================
            MESSAGES
        ========================= */

        message: {
            method: 'post',
            path: 'messages',
            metadata: {
                model: 'claude-opus-4-8',
                max_tokens: 1024
            },
            headers: []
        },

        count_tokens: {
            method: 'post',
            path: 'messages/count_tokens',
            metadata: {
                model: 'claude-opus-4-8'
            },
            headers: []
        },

        message_batch_create: {
            method: 'post',
            path: 'messages/batches',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'message-batches-2024-09-24' }]
        },

        message_batch_list: {
            method: 'get',
            path: 'messages/batches',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'message-batches-2024-09-24' }]
        },

        message_batch_get: {
            method: 'get',
            path: `messages/batches/${path_params?.batch_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'message-batches-2024-09-24' }]
        },

        message_batch_cancel: {
            method: 'post',
            path: `messages/batches/${path_params?.batch_id}/cancel`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'message-batches-2024-09-24' }]
        },

        message_batch_results: {
            method: 'get',
            path: `messages/batches/${path_params?.batch_id}/results`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'message-batches-2024-09-24' }]
        },

        /* =========================
           FILES
        ========================= */

        create_file: {
            method: 'post',
            path: 'files',
            metadata: [],
            headers: [{ key: 'anthropic-beta', value: 'files-api-2025-04-14' }],
            mime: true
        },

        list_files: {
            method: 'get',
            path: 'files',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'files-api-2025-04-14' }]
        },

        get_file: {
            method: 'get',
            path: `files/${path_params?.file_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'files-api-2025-04-14' }]
        },

        download_file_content: {
            method: 'get',
            path: `files/${path_params?.file_id}/content`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'files-api-2025-04-14' }]
        },

        delete_file: {
            method: 'delete',
            path: `files/${path_params?.file_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'files-api-2025-04-14' }]
        },

        /* =========================
           SKILLS
        ========================= */

        create_skill: {
            method: 'post',
            path: 'skills',
            metadata: [],
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }],
            mime: true
        },

        list_skills: {
            method: 'get',
            path: 'skills',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        get_skill: {
            method: 'get',
            path: `skills/${path_params?.skill_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        delete_skill: {
            method: 'delete',
            path: `skills/${path_params?.skill_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        /* Skill Versions */

        create_skill_version: {
            method: 'post',
            path: `skills/${path_params?.skill_id}/versions`,
            metadata: [],
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }],
            mime: true
        },

        list_skill_versions: {
            method: 'get',
            path: `skills/${path_params?.skill_id}/versions`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        get_skill_version: {
            method: 'get',
            path: `skills/${path_params?.skill_id}/versions/${path_params?.version}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        download_skill_version_content: {
            method: 'get',
            path: `skills/${path_params?.skill_id}/versions/${path_params?.version}/content`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        delete_skill_version: {
            method: 'delete',
            path: `skills/${path_params?.skill_id}/versions/${path_params?.version}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'skills-2025-10-02' }]
        },

        /* =========================
           ENVIRONMENTS
        ========================= */

        create_environment: {
            method: 'post',
            path: 'environments',
            metadata: {
                config: {
                    type: 'cloud',
                    networking: { type: 'unrestricted' }
                }
            },
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_environments: {
            method: 'get',
            path: 'environments',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_environment: {
            method: 'get',
            path: `environments/${path_params?.environment_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        update_environment: {
            method: 'post',
            path: `environments/${path_params?.environment_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_environment: {
            method: 'delete',
            path: `environments/${path_params?.environment_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        archive_environment: {
            method: 'post',
            path: `environments/${path_params?.environment_id}/archive`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* =========================
           MODELS
        ========================= */

        list_models: {
            method: 'get',
            path: 'models',
            metadata: {},
            headers: []
        },

        get_model: {
            method: 'get',
            path: `models/${path_params?.model}`,
            metadata: {},
            headers: []
        },

        /* ========================================
        AGENTS
        ======================================== */

        create_agent: {
            method: 'post',
            path: 'agents',
            metadata: {

            },
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_agents: {
            method: 'get',
            path: 'agents',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_agent: {
            method: 'get',
            path: `agents/${path_params?.agent_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        update_agent: {
            method: 'post',
            path: `agents/${path_params?.agent_id}`,
            metadata: {

            },
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_agent: {
            method: 'delete',
            path: `agents/${path_params?.agent_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },
        /* ========================================
        ENVIRONMENTS WORK
        ======================================== */

        create_environment_work: {
            method: 'post',
            path: `environments/${path_params?.environment_id}/work`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_environment_work: {
            method: 'get',
            path: `environments/${path_params?.environment_id}/work`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_environment_work: {
            method: 'get',
            path: `environments/${path_params?.environment_id}/work/${path_params?.work_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           SESSIONS
           ======================================== */

        create_session: {
            method: 'post',
            path: 'sessions',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_sessions: {
            method: 'get',
            path: 'sessions',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_session: {
            method: 'get',
            path: `sessions/${path_params?.session_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_session: {
            method: 'delete',
            path: `sessions/${path_params?.session_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           SESSION EVENTS
           ======================================== */
        send_event: {
            method: 'post',
            path: `sessions/${path_params?.session_id}/events`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_session_events: {
            method: 'get',
            path: `sessions/${path_params?.session_id}/events`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        stream_session_events: {
            method: 'get',
            path: `sessions/${path_params?.session_id}/events/stream`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           SESSION RESOURCES
           ======================================== */

        list_session_resources: {
            method: 'get',
            path: `sessions/${path_params?.session_id}/resources`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_session_resource: {
            method: 'get',
            path: `sessions/${path_params?.session_id}/resources/${path_params?.resource_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           VAULTS
           ======================================== */

        create_vault: {
            method: 'post',
            path: 'vaults',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_vaults: {
            method: 'get',
            path: 'vaults',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_vault: {
            method: 'get',
            path: `vaults/${path_params?.vault_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_vault: {
            method: 'delete',
            path: `vaults/${path_params?.vault_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           MEMORY STORES
           ======================================== */

        create_memory_store: {
            method: 'post',
            path: 'memory_stores',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_memory_stores: {
            method: 'get',
            path: 'memory_stores',
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_memory_store: {
            method: 'get',
            path: `memory_stores/${path_params?.memory_store_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_memory_store: {
            method: 'delete',
            path: `memory_stores/${path_params?.memory_store_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        /* ========================================
           MEMORIES (inside memory store)
           ======================================== */

        create_memory: {
            method: 'post',
            path: `memory_stores/${path_params?.memory_store_id}/memories`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        list_memories: {
            method: 'get',
            path: `memory_stores/${path_params?.memory_store_id}/memories`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        get_memory: {
            method: 'get',
            path: `memory_stores/${path_params?.memory_store_id}/memories/${path_params?.memory_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        update_memory: {
            method: 'post',
            path: `memory_stores/${path_params?.memory_store_id}/memories/${path_params?.memory_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        },

        delete_memory: {
            method: 'delete',
            path: `memory_stores/${path_params?.memory_store_id}/memories/${path_params?.memory_id}`,
            metadata: {},
            headers: [{ key: 'anthropic-beta', value: 'managed-agents-2026-04-01' }]
        }

    };

    let id = 0;
    let path = api?.[command]?.path ?? '';
    let headers = api?.[command]?.headers ?? [];
    let sendData = null;

    switch (api?.[command]?.method) {
        case 'post':
            id = Number(GetContext("CLAUDE_POST_SERVICE"));
            break;
        case 'get':
            id = Number(GetContext("CLAUDE_GET_SERVICE"));
            break;
        case 'put':
            id = Number(GetContext("CLAUDE_PUT_SERVICE"));
            break;
        case 'delete':
            id = Number(GetContext("CLAUDE_DEL_SERVICE"));
            break;
        case 'patch':
            id = Number(GetContext("CLAUDE_PATCH_SERVICE"));
            break;
    }


    if (!api?.[command]?.mime) {
        sendData = api?.[command]?.metadata ?? {};
        sendData = { ...sendData, ...data };
    }
    else {
        sendData = api?.[command]?.metadata ?? [];
        sendData = [...sendData, ...data]
    }

    Log(JSON.stringify(sendData));
    let resp = "";
    try {
        resp = CallService(JSON.stringify({ id, path, request: JSON.stringify(sendData), headers: [...headers, { key: 'x-api-key', value: API_TOKEN }, { key: 'anthropic-version', value: '2023-06-01' }, { key: 'user-agent', value: 'curl/8.5.0' }], mime: !!api?.[command]?.mime }));
        Log(resp);
        let ret = JSON.parse(resp);
        if (ret?.error) throw (ret?.error?.userMessage ?? ret?.error?.message ?? ret?.error?.code ?? 'Unknown Error');
        return ret;
    }
    catch (e) {
        Log(`ERROR to call Service...`);
        Log(JSON.stringify(data));
        Log(e);
        throw e;
    }

}
