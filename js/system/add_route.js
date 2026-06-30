function AddRoutes_(serverId) {
    Log('Add Route...');
    let ApiId = Serv('route', { route: 'test', server: serverId, source: `Log('test');response='OK';` });
}