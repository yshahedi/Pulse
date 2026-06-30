function Sqlite(db, query, values) {
  // Log(query);
  let res = "";
  try {
    let dbPath = `./db/${db}`;
    //Log(JSON.stringify({ db:dbPath, query }));
    let valueParam = {};
    if (values) valueParam = { values };
    res = DB(JSON.stringify({ db: dbPath, query, ...valueParam }));
    //Log(res);
    return JSON.parse(res);
  }
  catch (e) {
    Log(`QUERY ERROR on ./db/${db}: ${query}`);
    Log(`Response: ${res}`);
    // DB() returns a plain (non-JSON) error string on failure, e.g.
    // "Prepare failed: database is locked". JSON.parse then throws a misleading
    // "Unexpected token ..." error. Surface the real DB message so callers can
    // react to it (e.g. retry on lock contention).
    if (typeof res === 'string' && res.length > 0 && res[0] !== '[' && res[0] !== '{') {
      throw new Error(res);
    }
    throw e;
  }
}