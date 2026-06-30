function V0(command, data, path_params) {
    //const API_TOKEN = 'v1:team_hpE93nI4piV4xkTT322ZqTj8:vcp_1jGcZ8L9tZAjrIeYziJKG0VVNjxVarinmSidKbf80Wl39ene9R1t4Uc7';
    //const API_TOKEN = 'v1:team_hpE93nI4piV4xkTT322ZqTj8:vcp_0Avq0sbqLtoGYnWEyXsYMtOvTeZWoknB29ysxqXLWyfmi4p2Dh2Ka23W';
    const API_TOKEN = 'v1:team_hpE93nI4piV4xkTT322ZqTj8:vcp_3fczqn9EAaUJ5a0bDm1j87X8Y42IkurEp3DHCQ9efc8Ho6f0j34byPqf';
    const API_TOKEN_CLAUDE = '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';
    const api = {
        project_create: { method: 'post', path: `projects` },
        project_find: { method: 'get', path: `projects` },
        project_update: { method: 'patch', path: `projects/${path_params?.projectId ?? 0}` },
        project_get_by_id: { method: 'get', path: `projects/${path_params?.projectId ?? 0}` },
        project_get_by_chat_id: { method: 'get', path: `chats/${path_params?.chatId ?? '0'}/project` },
        project_assign_to_chat: { method: 'post', path: `projects/${path_params?.projectId ?? 0}/assign` },
        project_create_environment_variables: { method: 'post', path: `projects/${path_params?.projectId ?? 0}/env-vars` },
        project_delete_environment_variables: { method: 'post', path: `projects/${path_params?.projectId ?? 0}/env-vars/delete` },
        project_find_environment_variables: { method: 'get', path: `projects/${path_params?.projectId ?? 0}/env-vars` },
        project_get_environment_variables: { method: 'post', path: `projects/${path_params?.projectId ?? 0}/env-vars/${path_params?.environmentVariableId ?? 0}` },
        project_update_environment_variables: { method: 'patch', path: `projects/${path_params?.projectId ?? 0}/env-vars` },

        chat_create: { method: 'post', path: `chats` },
        chat_find: { method: 'get', path: `chats` },
        chat_init: { method: 'post', path: `chats/init` },
        chat_update: { method: 'patch', path: `chats/${path_params?.chatId ?? '0'}` },
        chat_delete: { method: 'del', path: `chats/${path_params?.chatId ?? '0'}` },
        chat_get: { method: 'get', path: `chats/${path_params?.chatId ?? '0'}` },
        chat_favorite: { method: 'put', path: `chats/${path_params?.chatId ?? '0'}/favorite` },
        chat_fork: { method: 'post', path: `chats/${path_params?.chatId ?? '0'}/fork` },
        chat_restore_version: { method: 'post', path: `chats/${path_params?.chatId ?? '0'}/versions/${path_params?.versionId ?? 0}/restore` },
        chat_send_message: { method: 'post', path: `chats/${path_params?.chatId ?? 0}/messages` },
        chat_find_message: { method: 'get', path: `chats/${path_params?.chatId ?? 0}/messages` },
        chat_get_message: { method: 'get', path: `chats/${path_params?.chatId ?? 0}/messages/${path_params?.messageId ?? 0}` },
        chat_find_version: { method: 'get', path: `chats/${path_params?.chatId ?? 0}/versions` },
        chat_resume_message: { method: 'post', path: `chats/${path_params?.chatId ?? 0}/messages/${path_params?.messageId ?? 0}/resume` },
        chat_stop_message: { method: 'post', path: `chats/${path_params?.chatId ?? 0}/messages/${path_params?.messageId ?? 0}/stop` },

        report_usage: { method: 'get', path: `reports/usage` },
        report_user_activity: { method: 'get', path: `reports/user-activity` }
    };

    let id = 0;
    let path = api?.[command]?.path ?? '';
    switch (api?.[command]?.method) {
        case 'post':
            id = Number(GetContext("V0_POST_SERVICE"));
            break;
        case 'get':
            id = Number(GetContext("V0_GET_SERVICE"));
            break;
        case 'put':
            id = Number(GetContext("V0_PUT_SERVICE"));
            break;
        case 'del':
            id = Number(GetContext("V0_DEL_SERVICE"));
            break;
        case 'patch':
            id = Number(GetContext("V0_PATCH_SERVICE"));
            break;
    }



    Log(JSON.stringify(data));
    let resp = "";
    try {
        resp = CallService(JSON.stringify({ id, path, request: JSON.stringify(data), headers: [{ key: 'Authorization', value: `Bearer ${API_TOKEN}` }, { key: 'User-Agent', value: 'v0-sdk/0.1.0' }, { key: 'Accept', value: '*/*' }, { key: 'Connection', value: 'keep-alive' }] }));
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