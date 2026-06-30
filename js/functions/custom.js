function Custom(name, req) {
    const __fns = {
        "test": function (req) {
// Body of a function callable as Custom('<name>', req).
// `req` is whatever the caller passes; return any JSON-serialisable value.
return { hello: req && req.who ? req.who : 'world' };
        },
    };
    const fn = __fns[name];
    if (!fn) throw 'Unknown custom function: ' + name;
    return fn(req);
}

