#include "pulse.h"
#include "metrics.h"

#include <uuid/uuid.h>
#include <sys/stat.h>
#include <fstream>
#include "MyEncryption.h"
#include "MyString.h"
// #include "gpt.h"
// #include "deepseek.h"

#define QUEUET_TIMEOUT 10
#define MAX_LISTENER 100

#define LICENSE_MESSAGE "license limitation, Please contact yshahedi@gmail.com to arrange for renewal or to obtain a new license."

namespace PULSE
{

    int debug_callback(CURL *handle, curl_infotype type, char *data, size_t size, void *userptr) {
        const char *prefix;
        switch (type) {
            case CURLINFO_TEXT:        prefix = "* ";   break;
            case CURLINFO_HEADER_OUT:  prefix = "=> ";  break;
            case CURLINFO_HEADER_IN:   prefix = "<= ";  break;
            case CURLINFO_DATA_OUT:    prefix = ">> ";  break;
            case CURLINFO_DATA_IN:     prefix = "<< ";  break;
            default: return 0;
        }
        std::string result = std::string(prefix) + std::string(data, size);
        Logger::instance().log(Logger::Level::DEBUG, result);
        return 0;
}


    std::string urlEncode(const std::string &value)
    {
        std::ostringstream escaped;
        escaped.fill('0');
        escaped << std::hex;

        for (char c : value)
        {
            // Keep alphanumeric and other accepted characters intact
            if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~' || c == '[' || c == ']')
            {
                escaped << c;
            }
            else
            {
                // Percent-encode
                escaped << '%' << std::setw(2) << int((unsigned char)c);
            }
        }

        return escaped.str();
    }

    std::vector<JsonValue> rapidJsonArrayToVector(const rapidjson::Value& arr) {
    std::vector<JsonValue> result;

    if (!arr.IsArray()) {
        throw std::runtime_error("Value is not an array");
    }

    result.reserve(arr.Size());

    for (const auto& item : arr.GetArray()) {
        if (item.IsNull()) {
            result.emplace_back(nullptr);
        }
        else if (item.IsString()) {
            result.emplace_back(std::string(item.GetString(), item.GetStringLength()));
        }
        else if (item.IsBool()) {
            result.emplace_back(item.GetBool());
        }
        else if (item.IsInt64()) {
            result.emplace_back(item.GetInt64());
        }
        else if (item.IsUint64()) {
            result.emplace_back(item.GetUint64());
        }
        else if (item.IsDouble()) {
            result.emplace_back(item.GetDouble());
        }
        else {
            throw std::runtime_error("Unsupported JSON value type in array");
        }
    }

    return result;
}

    std::string jsonToQueryParamsEncoded(const std::string &jsonStr)
    {
        rapidjson::Document doc;
        doc.Parse(jsonStr.c_str());

        if (doc.HasParseError())
        {
            return "";
        }

        std::stringstream query;
        bool first = true;

        std::function<void(const rapidjson::Value &, const std::string &)> processValue;
        processValue = [&](const rapidjson::Value &val, const std::string &keyPath)
        {
            if (val.IsObject())
            {
                for (auto itr = val.MemberBegin(); itr != val.MemberEnd(); ++itr)
                {
                    std::string newKey = keyPath.empty()
                                             ? itr->name.GetString()
                                             : keyPath + "[" + urlEncode(itr->name.GetString()) + "]";
                    processValue(itr->value, newKey);
                }
            }
            else if (val.IsArray())
            {
                for (rapidjson::SizeType i = 0; i < val.Size(); i++)
                {
                    std::string newKey = keyPath + "[" + std::to_string(i) + "]";
                    processValue(val[i], newKey);
                }
            }
            else
            {
                std::string encodedValue;

                if (val.IsString())
                {
                    encodedValue = urlEncode(val.GetString());
                }
                else if (val.IsInt())
                {
                    encodedValue = std::to_string(val.GetInt());
                }
                else if (val.IsUint())
                {
                    encodedValue = std::to_string(val.GetUint());
                }
                else if (val.IsInt64())
                {
                    encodedValue = std::to_string(val.GetInt64());
                }
                else if (val.IsUint64())
                {
                    encodedValue = std::to_string(val.GetUint64());
                }
                else if (val.IsDouble())
                {
                    encodedValue = std::to_string(val.GetDouble());
                }
                else if (val.IsBool())
                {
                    encodedValue = val.GetBool() ? "true" : "false";
                }
                else if (val.IsNull())
                {
                    encodedValue = "";
                }

                if (!first)
                    query << "&";
                query << urlEncode(keyPath) << "=" << encodedValue;
                first = false;
            }
        };

        if (doc.IsObject())
        {
            for (auto itr = doc.MemberBegin(); itr != doc.MemberEnd(); ++itr)
            {
                processValue(itr->value, urlEncode(itr->name.GetString()));
            }
        }

        return query.str();
    }

    void Run(std::string jsFileName)
    {
        try
        {
            std::string filename = jsFileName;
            if (jsFileName.length() == 0)
            {
                filename = MyV8::getInstance().getContextValue("MAIN_FILE");
                Logger::instance().log(Logger::Level::INFO, "Load " + filename + " ...");
                std::string source = PULSE::ReadFile(filename);
                Logger::instance().log(Logger::Level::INFO, "Compiling ...");
                PULSE::MyV8::getInstance().addHandlerFunction("main", source);
                PULSE::MyV8::getInstance().reinit();
            }

            Logger::instance().log(Logger::Level::INFO, "Running " + filename + " ...");
            auto timeout = std::chrono::milliseconds(60000);
            std::unique_ptr<JsRequestData> req = std::make_unique<JsRequestData>(timeout);
            req->function_name = std::make_unique<std::string>("main");
            req->request = std::make_unique<std::string>("{\"token\":\"" + MyV8::getInstance().getToken() + "\"}");
            req->url = std::make_unique<std::string>("/");
            req->headers = std::make_unique<std::string>("");
            req->method = std::make_unique<std::string>("");
            std::future<std::string> future = req->response.get_future();
            MyV8::getInstance().produce(std::move(req));
            auto status = future.wait_for(timeout);
            std::string response;
            if (status != std::future_status::ready)
            {
                throw std::runtime_error("Error (Timeout occurred)");
            }
            MyV8::getInstance().setContextValue("MAIN_FILE", filename);
            Logger::instance().log(Logger::Level::INFO, "Done.");
        }
        catch (const std::exception &e)
        {
            Logger::instance().log(Logger::Level::ERROR, e.what());
        }
    }

    std::shared_ptr<mysqlx::Client> GetConnection(std::string username, std::string password, std::string host, std::string schema, int port, int poolSize, int poolTimeout)
    {
        return std::make_shared<mysqlx::Client>(
            mysqlx::SessionOption::USER, username, mysqlx::SessionOption::PWD, password, mysqlx::SessionOption::HOST, host,
            mysqlx::SessionOption::PORT, port, mysqlx::SessionOption::DB, schema, mysqlx::ClientOption::POOLING, true,
            mysqlx::ClientOption::POOL_MAX_SIZE, poolSize, mysqlx::ClientOption::POOL_QUEUE_TIMEOUT, poolTimeout,
            mysqlx::ClientOption::POOL_MAX_IDLE_TIME, 500);
    }

    void Query(const std::string &token, const std::string &query, std::string &response)
    {
        auto it = MyV8::getInstance().connections_->find(token);
        if (it == MyV8::getInstance().connections_->end())
        {
            Logger::instance().log(Logger::Level::ERROR, "connection not found");
            response = "";
            return;
        }
        auto client = it->second;
        if (client == nullptr)
            return;
        mysqlx::Session session = client->getSession();
        mysqlx::SqlResult res = session.sql(query.c_str()).execute();
        rapidjson::Document recordList;
        recordList.SetArray();

        if (res.hasData())
        {
            const mysqlx::Columns &columns = res.getColumns();
            mysqlx::Row record = res.fetchOne();

            while (record)
            {
                rapidjson::Document sqlRowResultJSON(&recordList.GetAllocator());
                sqlRowResultJSON.SetObject();
                for (unsigned index = 0; index < res.getColumnCount(); ++index)
                {
                    std::stringstream typeStream;
                    typeStream << columns[index].getType();
                    std::string columnType = typeStream.str();
                    std::string ColumnName = columns[index].getColumnName();
                    if (record[index].isNull())
                    {
                        sqlRowResultJSON.AddMember(rapidjson::Value(ColumnName.c_str(), sqlRowResultJSON.GetAllocator()).Move(), rapidjson::Value(rapidjson::Type::kNullType).Move(), sqlRowResultJSON.GetAllocator());
                    }
                    else if (columnType == "BIT" || columnType == "TINYINT" || columnType == "SMALLINT" || columnType == "MEDIUMINT" ||
                             columnType == "INT" || columnType == "BIGINT" || columnType == "BIT" || columnType == "BOOLEAN" ||
                             columnType == "BOOL" || columnType == "DECIMAL" || columnType == "DATETIMEs" || columnType == "DATE" || columnType == "TIME")
                    {

                        uint32_t resultValue = record[index];
                        sqlRowResultJSON.AddMember(rapidjson::Value(ColumnName.c_str(), sqlRowResultJSON.GetAllocator()).Move(),
                                                   rapidjson::Value(resultValue).Move(), sqlRowResultJSON.GetAllocator());
                    }
                    else if (columnType == "FLOAT" || columnType == "DOUBLE")
                    {

                        double resultValue = record[index];
                        sqlRowResultJSON.AddMember(rapidjson::Value(ColumnName.c_str(), sqlRowResultJSON.GetAllocator()).Move(),
                                                   rapidjson::Value(resultValue).Move(), sqlRowResultJSON.GetAllocator());
                    }
                    else if (columnType == "CHAR" || columnType == "VARCHAR" || columnType == "BINARY" ||
                             columnType == "VARBINARY" || columnType == "TINYBLOB" || columnType == "BLOB" ||
                             columnType == "MEDIUMBLOB" || columnType == "LONGBLOB" || columnType == "TINYTEXT" ||
                             columnType == "TEXT" || columnType == "MEDIUMTEXT" || columnType == "LONGTEXT" ||
                             columnType == "STRING")
                    {

                        std::string resultValue = record[index].get<std::string>();
                        sqlRowResultJSON.AddMember(rapidjson::Value(ColumnName.c_str(), sqlRowResultJSON.GetAllocator()).Move(),
                                                   rapidjson::Value(resultValue.c_str(), sqlRowResultJSON.GetAllocator()).Move(),
                                                   sqlRowResultJSON.GetAllocator());
                    }
                    else
                    {
                    std:
                        string error = "unsupported data type for column [" + std::string(columns[index].getColumnName()) + "] Type [...]";
                        Logger::instance().log(Logger::Level::ERROR, error);
                    }
                }
                recordList.PushBack(sqlRowResultJSON, sqlRowResultJSON.GetAllocator());
                record = res.fetchOne();
            }
        }
        else
        {
            Logger::instance().log(Logger::Level::ERROR, "No rows in the result");
        }
        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        recordList.Accept(writer);
        response = std::string(buffer.GetString(), buffer.GetSize());
    }

    std::string ReadFile(const std::string &filePath, bool throwException)
    {
        std::ifstream file(filePath);
        if (!file.is_open())
        {
            if (throwException)
                throw std::runtime_error("Could not open file: " + filePath);
            else
                return "";
        }
        std::stringstream buffer;
        buffer << file.rdbuf();
        return buffer.str();
    }

    void CreateFile_(std::string &path, const std::string &filename, const std::string &content)
    {
        if (path.empty() || filename.empty())
            return;
        if (path.back() != '/')
            path += "/";
        std::filesystem::create_directories(path);
        std::filesystem::permissions(
            path,
            std::filesystem::perms::owner_all | std::filesystem::perms::group_all | std::filesystem::perms::others_all,
            std::filesystem::perm_options::add);
        struct stat statbuf;
        int isDir = 0;
        if (stat(path.c_str(), &statbuf) == -1 || !S_ISDIR(statbuf.st_mode))
        {
            const int dir_err = mkdir(path.c_str(), 667);
            if (-1 == dir_err)
            {
                std::stringstream strTemp;
                strTemp << "Error in Creating " << path << " Directory";
                throw std::runtime_error(strTemp.str().c_str());
            }
        }

        std::stringstream outFileName;
        outFileName << path << filename;
        std::ofstream outfile(outFileName.str().c_str());

        if (outfile.is_open())
        {
            outfile << content << std::endl;
            outfile.close();
            std::filesystem::permissions(
                outFileName.str().c_str(),
                std::filesystem::perms::owner_read | std::filesystem::perms::owner_write | std::filesystem::perms::group_read | std::filesystem::perms::group_write | std::filesystem::perms::others_read | std::filesystem::perms::others_write,
                std::filesystem::perm_options::add);
            // chown(outFileName.str().c_str(),1001,1001);
        }
        else
        {
            throw std::runtime_error("Error in Opening File");
        }
    }

    void RemoveFile_(std::string &path, const std::string &filename)
    {
        try
        {
            if (path.empty() || filename.empty())
                return;
            if (path.back() != '/')
                path += "/";
            std::string filepath = path + filename;
            if (std::filesystem::exists(filepath))
            {
                auto res = std::filesystem::remove(filepath);
                if (res)
                    return;
                std::stringstream strTemp;
                strTemp << "Error removing file: " << filepath;
                throw std::runtime_error(strTemp.str().c_str());
            }
            else
            {
                std::stringstream strTemp;
                strTemp << "File does not exist: " << filepath;
                throw std::runtime_error(strTemp.str().c_str());
            }
        }
        catch (const std::filesystem::filesystem_error &e)
        {
            std::stringstream strTemp;
            strTemp << "Error removing file: " << e.what();
            throw std::runtime_error(strTemp.str().c_str());
        }
    }

    std::shared_ptr<std::vector<std::string>> listFiles_(const std::string &path)
    {
        auto files = std::make_shared<std::vector<std::string>>();

        try
        {
            for (const auto &entry : std::filesystem::directory_iterator(path))
            {
                if (entry.is_regular_file())
                {
                    files->push_back(entry.path().filename().string());
                }
            }
        }
        catch (const std::filesystem::filesystem_error &e)
        {
            std::string error = "Error reading directory: " + std::string(e.what());
            Logger::instance().log(Logger::Level::ERROR, "Error processing request in thread: unknown error");
        }

        return files;
    }

    size_t write_cb(char *ptr, size_t size, size_t nmemb, void *userdata)
    {
        auto *response = static_cast<std::string *>(userdata);
        response->append(ptr, size * nmemb);
        return size * nmemb;
    }

    sqlite3 *openSqliteDB(const std::string &db_file)
    {
        // Per-worker (per-thread) connection cache. Each worker thread owns its
        // OWN sqlite3* per db file, so SQLite transaction state (BEGIN/COMMIT) is
        // private to the thread and concurrent workers can never corrupt each
        // other's transactions. WAL mode allows concurrent readers across
        // connections; busy_timeout makes concurrent writers wait for the write
        // lock instead of failing with SQLITE_BUSY. Connections are closed when
        // the worker thread exits (ConnCache destructor).
        struct ConnCache
        {
            std::map<std::string, sqlite3 *> conns;
            ~ConnCache()
            {
                for (auto &kv : conns)
                    if (kv.second)
                        sqlite3_close(kv.second);
            }
        };
        static thread_local ConnCache cache;

        auto it = cache.conns.find(db_file);
        if (it != cache.conns.end())
        {
            return it->second;
        }

        sqlite3 *db = nullptr;

        int flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;
        if (sqlite3_open_v2(db_file.c_str(), &db, flags, nullptr) != SQLITE_OK)
        {
            throw std::runtime_error("Cannot open DB: " + std::string(sqlite3_errmsg(db)));
        }

        auto close_db = [&]()
        {
            if (db)
                sqlite3_close(db);
        };

        try
        {
            sqlite3_exec(
                db,
                "PRAGMA journal_mode=WAL;",
                nullptr, nullptr, nullptr);

            sqlite3_exec(
                db,
                "PRAGMA temp_store=MEMORY;",
                nullptr, nullptr, nullptr);

            // Smaller per-connection page cache: with one connection per worker
            // there can be many connections, so keep each modest (~2 MB) to bound
            // total memory instead of the 20 MB used by a single shared handle.
            sqlite3_exec(
                db,
                "PRAGMA cache_size=-2000;",
                nullptr, nullptr, nullptr);

            sqlite3_exec(
                db,
                "PRAGMA synchronous=NORMAL;",
                nullptr, nullptr, nullptr);

            // Wait (instead of erroring) up to 5s if another worker holds the
            // write lock — WAL serializes writers, this just makes them queue.
            sqlite3_busy_timeout(db, 5000);

            cache.conns.emplace(db_file, db);
            return db;
        }
        catch (...)
        {
            close_db();
            throw;
        }
    }

    rapidjson::Document runSqliteQuery(const std::string &db_file, const std::string &query, const std::vector<JsonValue> & values )
    {
        sqlite3 *db = openSqliteDB(db_file);
        sqlite3_stmt *stmt = nullptr;

        rapidjson::Document doc;
        doc.SetArray();
        auto &allocator = doc.GetAllocator();

        auto close_stmt = [&]()
        {
            if (stmt)
                sqlite3_finalize(stmt);
        };

        try
        {
            if (sqlite3_prepare_v2(
                    db,
                    query.c_str(),
                    -1,
                    &stmt,
                    nullptr) != SQLITE_OK)
            {
                throw std::runtime_error(
                    "Prepare failed: " + std::string(sqlite3_errmsg(db)));
            }


            int col_count = sqlite3_column_count(stmt);
            uint32_t index = 0;
            for (const auto &value : values)
            {
                index++;
                if (std::holds_alternative<std::nullptr_t>(value))
                {
                   // Logger::instance().log(Logger::Level::DEBUG, std::to_string(index)+"=> null");
                   sqlite3_bind_null(stmt, index);
                }
                else if (std::holds_alternative<std::string>(value)) {
                    sqlite3_bind_text(stmt, index, std::get<std::string>(value).c_str(), -1, SQLITE_TRANSIENT);
                  //  Logger::instance().log(Logger::Level::DEBUG, std::to_string(index)+"=> "+ std::get<std::string>(value));
                }
                else if (std::holds_alternative<int64_t>(value)) {
                    sqlite3_bind_int64(stmt, index, std::get<int64_t>(value));
                   // Logger::instance().log(Logger::Level::DEBUG, std::to_string(index)+"=> "+ std::to_string(std::get<int64_t>(value)));
                }
                else if (std::holds_alternative<double>(value)) {
                    sqlite3_bind_double(stmt, index, std::get<double>(value));
                   // Logger::instance().log(Logger::Level::DEBUG, std::to_string(index)+"=> "+ std::to_string(std::get<double>(value)));
                }
                else if (std::holds_alternative<bool>(value)) {
                    sqlite3_bind_int(stmt, index, std::get<bool>(value));
                   // Logger::instance().log(Logger::Level::DEBUG, std::to_string(index)+"=> "+ std::to_string(std::get<bool>(value)));
                }
            }

            auto rc = sqlite3_step(stmt);

            if (rc!= SQLITE_ROW && rc != SQLITE_DONE) {
                throw std::runtime_error(
                    "Prepare failed: " + std::string(sqlite3_errmsg(db)));
            } 

            while (rc == SQLITE_ROW)
            {
                rapidjson::Value row(rapidjson::kObjectType);

                for (int i = 0; i < col_count; ++i)
                {
                    const char *col_name =
                        sqlite3_column_name(stmt, i);

                    rapidjson::Value key(col_name, allocator);

                    switch (sqlite3_column_type(stmt, i))
                    {
                    case SQLITE_INTEGER:
                        row.AddMember(
                            key,
                            (uint64_t)sqlite3_column_int64(stmt, i),
                            allocator);
                        break;

                    case SQLITE_FLOAT:
                        row.AddMember(
                            key,
                            sqlite3_column_double(stmt, i),
                            allocator);
                        break;

                    case SQLITE_TEXT:
                    {
                        const char *text =
                            reinterpret_cast<const char *>(
                                sqlite3_column_text(stmt, i));
                        row.AddMember(
                            key,
                            rapidjson::Value(text, allocator),
                            allocator);
                        break;
                    }

                    case SQLITE_NULL:
                    default:
                        row.AddMember(
                            key,
                            rapidjson::Value().SetNull(),
                            allocator);
                        break;
                    }
                }

                doc.PushBack(row, allocator);
                rc = sqlite3_step(stmt);
            }
            close_stmt();
            return doc;
        }
        catch (...)
        {
            close_stmt();
            throw;
        }
    }

    const char *ToCString(const v8::String::Utf8Value &value)
    {
        return *value ? *value : "<string conversion failed>";
    }

    void QueueProduce(const v8::FunctionCallbackInfo<v8::Value> &args)
    {

        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);

            rapidjson::Document doc;
            doc.Parse(data.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("Request parse error");
            }

            if (!doc.IsObject())
            {
                throw std::runtime_error("json format error");
            }
            if (doc.HasMember("key") && doc["key"].IsString() &&
                doc.HasMember("request") && doc["request"].IsString())
            {
                // Logger::instance().log(Logger::Level::DEBUG, "QUEUE:" + std::string(doc["key"].GetString()));
                std::unique_ptr<QueueData> request = std::make_unique<QueueData>();
                request->key = doc["key"].GetString();
                request->request = doc["request"].GetString();
                if (doc.HasMember("url") && doc["url"].IsString())
                    request->url = doc["url"].GetString();
                if (doc.HasMember("headers") && doc["headers"].IsString())
                    request->headers = doc["headers"].GetString();
                if (doc.HasMember("timeout") && doc["timeout"].IsUint())
                    request->timeout = doc["timeout"].GetUint();
                if (doc.HasMember("method") && doc["method"].IsString())
                    request->method = doc["method"].GetString();
                MyV8::getInstance().queue_.Produce(std::move(request));
                std::string response = "OK";
                resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                throw std::runtime_error("wrong request json format");
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void SetQueueConsumer(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);

            rapidjson::Document doc;
            doc.Parse(data.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("Request parse error");
            }

            if (!doc.IsObject())
            {
                throw std::runtime_error("json format error");
            }
            if (doc.HasMember("key") && doc["key"].IsString() &&
                doc.HasMember("name") && doc["name"].IsString() &&
                ((doc.HasMember("source") && doc["source"].IsString()) ||
                 (doc.HasMember("file_name") && doc["file_name"].IsString())))
            {
                std::string source = "";
                if (doc.HasMember("source") && doc["source"].IsString())
                {
                    source = doc["source"].GetString();
                }
                else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                {
                    source = ReadFile(doc["file_name"].GetString(), true);
                }
                MyV8::getInstance().addHandlerFunction(doc["name"].GetString(), source);
                MyV8::getInstance().reinit();
                MyV8::getInstance().queue_key_consumer_->emplace(doc["key"].GetString(), doc["name"].GetString());
                resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                throw std::runtime_error("wrong request json format");
            }

            std::string response = "OK";
            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void UUID(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            uuid_t uuidObject;
            uuid_generate(uuidObject);
            char uuidChar[37];
            uuid_unparse(uuidObject, uuidChar);
            std::string response(uuidChar);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Log(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string log = ToCString(str0);
            Logger::Level level = Logger::Level::INFO;
            bool isForce = false;
            if (args.Length() >= 2)
            {
                v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
                std::string lvl = ToCString(str1);
                if (lvl == "INFO")
                {
                    level = Logger::Level::INFO;
                }
                else if (lvl == "DEBUG")
                {
                    level = Logger::Level::DEBUG;
                }
                else if (lvl == "ERROR")
                {
                    level = Logger::Level::ERROR;
                }
            }
            if (args.Length() >= 3)
            {
                v8::String::Utf8Value str2(args.GetIsolate(), args[2]);
                std::string force = ToCString(str2);
                isForce = (force == "true");
            }
            std::string response = "OK";
            Logger::instance().log(level, log, isForce);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Base64Encode(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);
            std::string response = Crypto::base64Encode(data);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Base64Decode(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);
            std::string response = Crypto::base64Decode(data);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Instance(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        static std::atomic<int32_t> sequence = 0;
        sequence++;
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }
            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string source = ToCString(str0);
            std::string name = "instance_" + std::to_string(sequence);
            // Logger::instance().log(Logger::Level::INFO, "Create New Instance...");
            MyV8::getInstance().addHandlerFunction(name, source);
            MyV8::getInstance().reinit();
            // Logger::instance().log(Logger::Level::INFO, "Create New Instance:" + name);
            auto timeout = std::chrono::milliseconds(60000);
            std::unique_ptr<JsRequestData> req = std::make_unique<JsRequestData>(timeout);
            req->function_name = std::make_unique<std::string>(std::move(name));
            req->request = std::make_unique<std::string>("{}");
            req->url = std::make_unique<std::string>("/");
            req->headers = std::make_unique<std::string>("");
            req->method = std::make_unique<std::string>("");
            std::future<std::string> future = req->response.get_future();
            MyV8::getInstance().produce(std::move(req));
            auto status = future.wait_for(timeout);
            std::string response;
            if (status == std::future_status::ready)
            {
                response = future.get();
                rapidjson::Document doc;
                doc.Parse(response.c_str());

                if (doc.HasParseError())
                {
                    throw std::runtime_error("Wrong Response format");
                }
                if (doc.HasMember("error_desc") && doc["error_desc"].IsString())
                {
                    throw std::runtime_error(std::string(doc["error_desc"].GetString()).c_str());
                }
            }
            else
            {
                throw std::runtime_error("Error (Timeout occurred)");
            }

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Ls(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string path = ToCString(str0);

            std::string response = "";
            for (const auto &entry : std::filesystem::directory_iterator(path))
            {
                response += entry.path();
                response += ";";
            }
            if (response.length() > 0)
                response.pop_back();

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Execute(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string command = ToCString(str0);

            uuid_t uuidObject;
            uuid_generate(uuidObject);
            char uuidChar[37];
            uuid_unparse(uuidObject, uuidChar);
            std::string uuid(uuidChar);
            std::string response = "";
            Logger::instance().log(Logger::Level::INFO, command);

            // std::thread([command,uuid]
            {
                std::array<char, 128> buffer;

                /* std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(command.c_str(), "r"), pclose);
                 if (!pipe)
                 {
                     throw std::runtime_error("popen() failed!");
                 }
                 while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr)
                 {
                     response += buffer.data();
                 }*/
            }

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void System(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string command = ToCString(str0);
            bool asyncFlg = false;
            if (args.Length() == 2)
            {
                v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
                std::string asyncFlgStr = ToCString(str1);
                asyncFlg = (asyncFlgStr == "true");
            }
            std::string response = "Ok";
            if (asyncFlg)
            {
                Logger::instance().log(Logger::Level::INFO, "Execute command async...");
                std::thread cmd_thread([command = std::move(command)]()
                                       {
                    Logger::instance().log(Logger::Level::INFO, command.c_str());
                    system(command.c_str()); });

                cmd_thread.detach();
            }
            else
            {
                Logger::instance().log(Logger::Level::INFO, command.c_str());
                system(command.c_str());
            }

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Connect(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 5)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string usename = ToCString(str0);
            v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
            std::string password = ToCString(str1);
            v8::String::Utf8Value str2(args.GetIsolate(), args[2]);
            std::string host = ToCString(str2);
            v8::String::Utf8Value str3(args.GetIsolate(), args[3]);
            std::string schema = ToCString(str3);

            long int port = args[4]->Int32Value(isolate->GetCurrentContext()).FromMaybe(33060);

            std::string response = "";
            std::string key_ = usename + host + schema + std::to_string(port);
            std::string key = Crypto::base64Encode(key_);
            if (MyV8::getInstance().connections_->find(key) == MyV8::getInstance().connections_->end())
            {
                auto con = GetConnection(usename, password, host, schema, port);
                MyV8::getInstance().connections_->emplace(key, con);
            }
            response = key;

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void GetQuery(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string token = ToCString(str0);
            v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
            std::string query = ToCString(str1);

            std::string response = "OK";
            Query(token, query, response);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void CallService(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);
            // Logger::instance().log(Logger::Level::INFO, data);
            rapidjson::Document doc;
            doc.Parse(data.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("Request parse error");
            }

            if (!doc.IsObject())
            {
                throw std::runtime_error("json format error");
            }
            std::shared_ptr<std::map<std::string, std::string>> headers = std::make_shared<std::map<std::string, std::string>>();
            if (doc.HasMember("headers") && doc["headers"].IsArray())
            {
                for (const auto &item : doc["headers"].GetArray())
                {
                    if (item.HasMember("key") && item["key"].IsString() && item.HasMember("value") && item["value"].IsString())
                    {
                        if (item["key"].GetString() == "Content-Type")
                            continue;
                        headers->emplace(item["key"].GetString(), item["value"].GetString());
                    }
                }
            }

            if (doc.HasMember("id") && doc["id"].IsUint() &&
                doc.HasMember("request") && doc["request"].IsString())
            {
                std::string path = "";
                std::string token = "";
                std::string callback = "";
                bool isMime = false;
                if (doc.HasMember("path") && doc["path"].IsString())
                    path = doc["path"].GetString();
                if (doc.HasMember("token") && doc["token"].IsString())
                    token = doc["token"].GetString();
                if (doc.HasMember("callback") && doc["callback"].IsString())
                    callback = doc["callback"].GetString();
                if (doc.HasMember("mime") && doc["mime"].IsBool())
                    isMime = doc["mime"].GetBool();

                auto response = Outbound::getInstance().call(doc["id"].GetUint(), doc["request"].GetString(), headers, path, token, callback, isMime);
                if (!response)
                    resp = v8::String::NewFromUtf8(isolate, "Service Not Found", v8::NewStringType::kNormal).ToLocalChecked();
                else
                    resp = v8::String::NewFromUtf8(isolate, response->c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                throw std::runtime_error("json format error");
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void CreateFile(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 3)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string path = ToCString(str0);
            v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
            std::string filename = ToCString(str1);
            v8::String::Utf8Value str2(args.GetIsolate(), args[2]);
            std::string content = ToCString(str2);

            std::string response = "OK";
            CreateFile_(path, filename, content);

            resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void ReadFile(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string filename = ToCString(str0);

            std::ifstream file(filename);
            if (!file)
            {
                resp = v8::String::NewFromUtf8(isolate, "", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                std::string fileContent((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

                resp = v8::String::NewFromUtf8(isolate, fileContent.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void ReadFileBase64(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string filename = ToCString(str0);

            std::ifstream file(filename, std::ios::binary);
            if (!file)
            {
                resp = v8::String::NewFromUtf8(isolate, "", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                std::string fileContent((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

                resp = v8::String::NewFromUtf8(isolate, Crypto::base64Encode(fileContent).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void DB(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string data = ToCString(str0);

            rapidjson::Document doc;
            doc.Parse(data.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("json parse error");
            }

            if (!doc.IsObject())
            {
                throw std::runtime_error("json format error");
            }

            if (doc.HasMember("query") && doc["query"].IsString() && doc.HasMember("db") && doc["db"].IsString())
            {
                std::string dbFileName = doc["db"].GetString();
                rapidjson::StringBuffer buffer;
                rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
                std::vector<JsonValue> values;
                if(doc.HasMember("values") && doc["values"].IsArray())
                {
                    values = rapidJsonArrayToVector(doc["values"]);
                }
               
                auto dbResp = runSqliteQuery(dbFileName, doc["query"].GetString(),values);
                dbResp.Accept(writer);
                std::string response = buffer.GetString();
                resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                throw std::runtime_error("json format error");
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void GetContext(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string key = ToCString(str0);

            std::string val = MyV8::getInstance().getContextValue(key);
            resp = v8::String::NewFromUtf8(isolate, val.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void SetContext(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 2)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string key = ToCString(str0);
            v8::String::Utf8Value str1(args.GetIsolate(), args[1]);
            std::string value = ToCString(str1);

            MyV8::getInstance().setContextValue(key, value);
            resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Sleep(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 1)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            long int ms = args[0]->Int32Value(isolate->GetCurrentContext()).FromMaybe(1000);

            std::this_thread::sleep_for(std::chrono::milliseconds(ms));
            resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Time(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            auto now = std::chrono::high_resolution_clock::now();
            long long nanoseconds = std::chrono::duration_cast<std::chrono::nanoseconds>(
                                        now.time_since_epoch())
                                        .count();
            // auto duration = std::chrono::duration_cast<std::chrono::nanoseconds>(time);
            resp = v8::String::NewFromUtf8(isolate, std::to_string(nanoseconds).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    void Serve(const v8::FunctionCallbackInfo<v8::Value> &args)
    {
        v8::Isolate *isolate = args.GetIsolate();
        v8::HandleScope scope(isolate);
        v8::Local<v8::String> resp;
        try
        {
            if (args.Length() < 2)
            {
                throw std::runtime_error("Argument Length Is Wrong!");
            }

            v8::String::Utf8Value str0(args.GetIsolate(), args[0]);
            std::string action = ToCString(str0);
            v8::String::Utf8Value str2(args.GetIsolate(), args[1]);
            std::string data = ToCString(str2);

            rapidjson::Document doc;
            doc.Parse(data.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("Json parse error");
            }

            if (!doc.IsObject())
            {
                throw std::runtime_error("json format error");
            }

            /* if (action == "chat")
             {
                 if (doc.HasMember("type") && doc["type"].IsString() &&
                     doc.HasMember("api_key") && doc["api_key"].IsString() &&
                     doc.HasMember("user_message") && doc["user_message"].IsString() &&
                     doc.HasMember("system_message") && doc["system_message"].IsString())
                 {
                     uint32_t tempreture = 0;
                     if (doc.HasMember("tempreture") && doc["tempreture"].IsNumber())
                         tempreture = doc["tempreture"].GetUint64();
                     std::shared_ptr<ChatResponse> response;
                     std::string type = doc["type"].GetString();
                     if (type == "gpt")
                     {
                         std::shared_ptr<OpenAIClient> gptClient = std::make_shared<OpenAIClient>(doc["api_key"].GetString(), tempreture, "gpt-4.1-mini");
                         response = std::make_shared<ChatResponse>(gptClient->singleChat(doc["user_message"].GetString(), doc["system_message"].GetString()));
                     }
                     else if (type == "deepseek")
                     {
                         std::shared_ptr<DeepSeekClient> dsClient = std::make_shared<DeepSeekClient>(doc["api_key"].GetString(), tempreture, "deepseek-chat");
                         response = std::make_shared<ChatResponse>(dsClient->singleChat(doc["user_message"].GetString(), doc["system_message"].GetString()));
                     }
                     if (!response->success)
                     {
                         throw std::runtime_error(response->error_message.c_str());
                     }
                     resp = v8::String::NewFromUtf8(isolate, response->content.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                 }
                 else
                 {
                     throw std::runtime_error("wrong request json format");
                 }
             }
             else */
            if (action == "server")
            {
                if (doc.HasMember("port") && doc["port"].IsUint())
                {
                    bool isSSl = false;
                    uint32_t maxWorker = 50;
                    std::string certPath = "";
                    std::string privateKey = "";
                    uint32_t protocol = 1;
                    if (doc.HasMember("is_ssl") && doc["is_ssl"].IsBool() && doc["is_ssl"].GetBool())
                        isSSl = true;
                    if (doc.HasMember("certificate") && doc["certificate"].IsString())
                        certPath = doc["certificate"].GetString();
                    if (doc.HasMember("private_key") && doc["private_key"].IsString())
                        privateKey = doc["private_key"].GetString();
                    if (doc.HasMember("transport_protocol") && doc["transport_protocol"].IsUint())
                        protocol = doc["transport_protocol"].GetUint();

                    Server server(isSSl, doc["port"].GetUint(), certPath, privateKey, protocol);
                    auto id = Inbound::getInstance().start(server);
                    resp = v8::String::NewFromUtf8(isolate, std::to_string(id).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "route")
            {
                if (((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())) &&
                    doc.HasMember("route") && doc["route"].IsString() &&
                    doc.HasMember("server") && doc["server"].IsUint())
                {
                    bool check_schema = false;
                    std::string schema = "";
                    uint32_t method = 1;
                    uint32_t timeout = 60000;
                    uint32_t architectural_style = 1;
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }

                    if (doc.HasMember("timeout") && doc["timeout"].IsNumber())
                        timeout = doc["timeout"].GetUint64();
                    if (doc.HasMember("method") && doc["method"].IsNumber())
                        method = doc["method"].GetUint();
                    if (doc.HasMember("architectural_style") && doc["architectural_style"].IsNumber())
                        architectural_style = doc["architectural_style"].GetUint();
                    if (doc.HasMember("schema") && doc["schema"].IsString())
                    {
                        check_schema = true;
                        schema = doc["schema"].GetString();
                    }
                    std::string route = "/";
                    route += doc["route"].GetString();
                    Api api(0, doc["route"].GetString(), check_schema, schema, method, timeout, architectural_style);
                    auto id = Inbound::getInstance().addApi(doc["server"].GetUint(), route, api);
                    MyV8::getInstance().addApiFunction(doc["server"].GetUint(), id, source);
                    MyV8::getInstance().reinit();
                    resp = v8::String::NewFromUtf8(isolate, std::to_string(id).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "reload_api")
            {
                if (((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())) &&
                    doc.HasMember("id") && doc["id"].IsUint() &&
                    doc.HasMember("server") && doc["server"].IsUint())
                {
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    MyV8::getInstance().addApiFunction(doc["server"].GetUint(), doc["id"].GetUint(), source);
                    MyV8::getInstance().reinit();
                    resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "remove_route")
            {
                if (doc.HasMember("route") && doc["route"].IsString() &&
                    doc.HasMember("server") && doc["server"].IsUint())
                {

                    auto id = Inbound::getInstance().removeApi(doc["server"].GetUint(), doc["route"].GetString());
                    MyV8::getInstance().removeApiFunction(id);
                    MyV8::getInstance().reinit();
                    resp = v8::String::NewFromUtf8(isolate, std::to_string(id).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "stop_server")
            {
                if (doc.HasMember("id") && doc["id"].IsUint())
                {
                    Inbound::getInstance().stop(doc["id"].GetUint());
                    resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "add_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString() &&
                    ((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())))
                {
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    MyV8::getInstance().addFunction(doc["name"].GetString(), source);
                    MyV8::getInstance().reinit();
                    std::string response = std::string(doc["name"].GetString()) + " added sucessfully.";
                    resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "remove_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString())
                {
                    MyV8::getInstance().removeFunction(doc["name"].GetString());
                    MyV8::getInstance().reinit();
                    std::string response = std::string(doc["name"].GetString()) + " removed sucessfully.";
                    resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "update_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString() &&
                    ((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())))
                {
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    MyV8::getInstance().removeFunction(doc["name"].GetString());
                    MyV8::getInstance().addFunction(doc["name"].GetString(), source);
                    if (doc.HasMember("refresh") && doc["refresh"].IsBool() && doc["refresh"].GetBool())
                    {
                        MyV8::getInstance().reinit();
                    }
                    std::string response = std::string(doc["name"].GetString()) + " updated sucessfully.";
                    resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "update_api_function")
            {
                if (doc.HasMember("id") && doc["id"].IsUint() &&
                    doc.HasMember("server") && doc["server"].IsUint() &&
                    doc.HasMember("name") && doc["name"].IsString() &&
                    ((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())))
                {
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    MyV8::getInstance().removeApiFunction(doc["id"].GetUint());
                    MyV8::getInstance().addApiFunction(doc["server"].GetUint(), doc["id"].GetUint(), source);
                    if (doc.HasMember("refresh") && doc["refresh"].IsBool() && doc["refresh"].GetBool())
                    {
                        MyV8::getInstance().reinit();
                    }
                    std::string response = std::string(doc["name"].GetString()) + " updated sucessfully.";
                    resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "update_handler_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString() &&
                    ((doc.HasMember("source") && doc["source"].IsString()) ||
                     (doc.HasMember("file_name") && doc["file_name"].IsString())))
                {
                    std::string source = "";
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    MyV8::getInstance().removeHandlerFunction(doc["name"].GetString());
                    MyV8::getInstance().addHandlerFunction(doc["name"].GetString(), source);
                    if (doc.HasMember("refresh") && doc["refresh"].IsBool() && doc["refresh"].GetBool())
                    {
                        MyV8::getInstance().reinit();
                    }
                    std::string response = std::string(doc["name"].GetString()) + " updated sucessfully.";
                    resp = v8::String::NewFromUtf8(isolate, response.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "service")
            {

                std::string content_type = "application/json";
                bool check_schema = false;
                std::string schema = "";
                uint32_t method = 1;
                uint32_t timeout = 60000;
                uint32_t architectural_style = 1;
                uint32_t transport_protocol = 1;
                std::map<std::string, std::string> headers;

                if (doc.HasMember("url") && doc["url"].IsString())
                {
                    if (doc.HasMember("timeout") && doc["timeout"].IsNumber())
                        timeout = doc["timeout"].GetUint64();
                    if (doc.HasMember("method") && doc["method"].IsNumber())
                        method = doc["method"].GetUint();
                    if (doc.HasMember("architectural_style") && doc["architectural_style"].IsNumber())
                        architectural_style = doc["architectural_style"].GetUint();
                    if (doc.HasMember("transport_protocol") && doc["transport_protocol"].IsNumber())
                        transport_protocol = doc["transport_protocol"].GetUint();
                    if (doc.HasMember("schema") && doc["schema"].IsString())
                    {
                        check_schema = true;
                        schema = doc["schema"].GetString();
                    }

                    Service service(0, 0, "", doc["url"].GetString(), content_type, check_schema, schema, method, timeout, architectural_style, transport_protocol);
                    if (doc.HasMember("headers") && doc["headers"].IsArray())
                    {
                        for (const auto &item : doc["headers"].GetArray())
                        {
                            if (item.HasMember("key") && item["key"].IsString() && item.HasMember("value") && item["value"].IsString())
                            {
                                service.headers.emplace(item["key"].GetString(), item["value"].GetString());
                            }
                        }
                    }

                    auto id = Outbound::getInstance().addNewService(service);
                    resp = v8::String::NewFromUtf8(isolate, std::to_string(id).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "remove_service")
            {
                if (doc.HasMember("id") && doc["id"].IsUint())
                {
                    Outbound::getInstance().removeService(doc["id"].GetUint());
                    resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "reload")
            {
                std::thread([&]()
                            {
                        PULSE::Scheduler::getInstance().stop();
                        Run();
                        PULSE::Scheduler::getInstance().start(); })
                    .detach();
                resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else if (action == "exit")
            {
                std::thread([&]()
                            {
                        Logger::instance().log(Logger::Level::INFO, "Shuting down ...");
                        Inbound::getInstance().stopAll();
                        Outbound::getInstance().stop();
                        MyV8::getInstance().stop();
                        Scheduler::getInstance().stop();
                        std::this_thread::sleep_for(std::chrono::seconds(3));
                        Logger::instance().log(Logger::Level::INFO, "Unlock Application...");
                        std::filesystem::remove(".lock");
                        Logger::instance().log(Logger::Level::INFO, "Bye.");
                        std::this_thread::sleep_for(std::chrono::seconds(1));
                        exit(0); })
                    .detach();

                resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else if (action == "set_scheduler")
            {
                uint32_t timeout = 30000;
                uint32_t interval = 60000;
                std::string source = "Log('Hello');";

                {
                    if (doc.HasMember("timeout") && doc["timeout"].IsNumber())
                        timeout = doc["timeout"].GetUint64();
                    if (doc.HasMember("interval") && doc["interval"].IsNumber())
                        interval = doc["interval"].GetUint64();
                    if (doc.HasMember("source") && doc["source"].IsString())
                    {
                        source = doc["source"].GetString();
                    }
                    else if (doc.HasMember("file_name") && doc["file_name"].IsString())
                    {
                        source = ReadFile(doc["file_name"].GetString(), true);
                    }
                    SchedulerInfo info(0, interval, timeout, source);
                    auto id = Scheduler::getInstance().startScheduler(info);
                    resp = v8::String::NewFromUtf8(isolate, std::to_string(id).c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
            }
            else if (action == "remove_scheduler")
            {
                if (doc.HasMember("id") && doc["id"].IsUint())
                {
                    Scheduler::getInstance().removeScheduler(doc["id"].GetUint());
                    resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "add_handler_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString() &&
                    doc.HasMember("source") && doc["source"].IsString())
                {
                    MyV8::getInstance().addHandlerFunction(doc["name"].GetString(), doc["source"].GetString());
                    MyV8::getInstance().reinit();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "remove_handler_function")
            {
                if (doc.HasMember("name") && doc["name"].IsString())
                {
                    MyV8::getInstance().removeHandlerFunction(doc["name"].GetString());
                    MyV8::getInstance().reinit();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "get_system_info")
            {
                if (doc.HasMember("key") && doc["key"].IsString())
                {
                    auto val = Context::getInstance().getData(doc["key"].GetString());
                    resp = v8::String::NewFromUtf8(isolate, val.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
                }
                else
                {
                    throw std::runtime_error("wrong request json format");
                }
            }
            else if (action == "get_metrics")
            {
                std::string snap = pmetrics::snapshot_json();
                resp = v8::String::NewFromUtf8(isolate, snap.c_str(), v8::NewStringType::kNormal).ToLocalChecked();
            }
            else if (action == "start_metrics")
            {
                int port = 4002;
                if (doc.HasMember("port") && doc["port"].IsUint())
                    port = doc["port"].GetUint();
                pmetrics::start_server(port);
                resp = v8::String::NewFromUtf8(isolate, "OK", v8::NewStringType::kNormal).ToLocalChecked();
            }
            else
            {
                throw std::runtime_error("action not found");
            }
        }
        catch (std::exception &e)
        {
            resp = v8::String::NewFromUtf8(isolate, e.what(), v8::NewStringType::kNormal).ToLocalChecked();
        }
        catch (...)
        {
            resp = v8::String::NewFromUtf8(isolate, "Unknown Exception!", v8::NewStringType::kNormal).ToLocalChecked();
        }

        args.GetReturnValue().Set(resp);
        return;
    }

    InboundServer::InboundServer(Server server)
        : server_(server)
    {
        request_queue_.SetTimeout(QUEUET_TIMEOUT);
    }

    InboundServer::~InboundServer()
    {
        stop();
    }

    void InboundServer::addNewRequestWorker()
    {
        Logger::instance().log(Logger::Level::INFO, "Add New InboundServer Worker");
        ManagedThread mt;
        mt.thread = std::jthread([&](std::shared_ptr<std::atomic<bool>> done)
                                 {
                int index = 0;
                {
                    std::lock_guard<std::mutex> lock(index_mutex_);
                    thread_index_++;
                    index = thread_index_.load();
                }
                std::unique_ptr<RequestData> req;
                while(running_.load())
                {
                
                
                while (request_queue_.ConsumeSync(req)) 
                {
                    if(!running_.load())
                    {
                        request_queue_.Produce(std::move(req));
                        break;
                    }
                    if(req==nullptr) continue;
                    //Logger::instance().log(Logger::Level::DEBUG,"ConsumeSync "+std::to_string(index)+"...");
                    req->loop->defer([&, request = move(req)]()
                    {
                        //Logger::instance().log(Logger::Level::DEBUG,"Loop Defer "+std::to_string(index)+"...");
                        const auto timeNow = std::chrono::system_clock::now();
                        const std::time_t dateTimeNow = std::chrono::system_clock::to_time_t(timeNow);
                        server_.busy++;
                        if(server_.busy>=request_worker_->size() && server_.busy<=server_.max_request_worker)
                        {
                            addNewRequestWorker();
                            //request_queue_.Produce(std::move(req));
                            //return;
                        }

                        pmetrics::Scope _ms(pmetrics::POOL_INBOUND);

                        std::string response;
                        std::string error_response;
                        uint32_t duration = 0;
                        uint32_t apiId;
                        //uint32_t methodId;
                        try {
                            if(request->url==nullptr)
                            {
                                request->url=std::make_unique<std::string>("");
                            }
                            if(request->body==nullptr)
                            {
                                request->body=std::make_unique<std::string>("");
                            }
                            if(request->headers==nullptr)
                            {
                                request->headers=std::make_unique<std::string>("");
                            }
                            if(request->method==nullptr)
                            {
                                request->method=std::make_unique<std::string>("");
                            }
                            auto it = server_.api->find(*(request->url.get()));
                            if(it==server_.api->end())
                            {
                                throw std::runtime_error("Rout not found");
                            }
                            apiId = it->second.id;
                            //methodId=it->second.method;
                            std::unique_ptr<JsRequestData> req=std::make_unique<JsRequestData>(std::chrono::milliseconds(it->second.timeout));
                            std::string func="api_"+std::to_string(it->second.id);
                            req->function_name=std::make_unique<std::string>(std::move(func));
                            
                            if(it->second.architectural_style==1 &&  it->second.check_schema)
                            {
                                rapidjson::Document doc;
                                doc.Parse(request->body->c_str());

                                if (doc.HasParseError()) {
                                    throw std::runtime_error("Wrong data format");
                                }
                                rapidjson::SchemaValidator validator(*(it->second.schema_doc.get()));

                                if (!doc.Accept(validator)) 
                                {
                                    std::string error="";
                                    rapidjson::StringBuffer sb;
                                    validator.GetInvalidSchemaPointer().StringifyUriFragment(sb);
                                    error+="Invalid schema: ";
                                    error+=sb.GetString();
                                    error+="\nKeyword: ";
                                    error+=validator.GetInvalidSchemaKeyword();
                                    sb.Clear();
                                    validator.GetInvalidDocumentPointer().StringifyUriFragment(sb);
                                    error+="\nInvalid document: ";
                                    error+=sb.GetString();
                                    throw std::runtime_error(error.c_str());
                                }
                            }
                            
                            req->request=std::make_unique<std::string>(*(request->body.get()));
                            req->headers=std::make_unique<std::string>(*(request->headers.get()));
                            req->url=std::make_unique<std::string>(*(request->url.get()));
                            req->method=std::make_unique<std::string>(*(request->method.get()));
                            std::future<std::string> future = req->response.get_future();
                            auto timeout = req->time_out;
                            //Logger::instance().log(Logger::Level::DEBUG,"Produce V8 From Inbound "+std::to_string(index)+"...");
                            MyV8::getInstance().produce(std::move(req));
                            //Logger::instance().log(Logger::Level::DEBUG,"Wait v8 From Inbound "+std::to_string(index)+"...");
                            auto status = future.wait_for(timeout);
                            //Logger::instance().log(Logger::Level::DEBUG,"After Wait v8 From Inbound "+std::to_string(index)+"...");                       
                            if (status == std::future_status::ready) {
                                response= future.get();
                            }
                            else {
                                throw std::runtime_error("Timeout occurred");
                            }

                            auto processing_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                                std::chrono::steady_clock::now() - request->received_time);
                            duration = processing_time.count();
                            rapidjson::Document doc;
                            doc.Parse(response.c_str());

                            if (doc.HasParseError()) {
                                throw std::runtime_error("Json parse error");
                            }

                            if(!doc.IsObject())
                            {
                                throw std::runtime_error("Json format error");
                            }

                            if(doc.HasMember("error_code") && doc["error_code"].IsNumber() && doc["error_code"].GetInt64()!=0)
                            {
                                std::string error="";
                                if(doc.HasMember("error_desc") && doc["error_desc"].IsString())
                                {
                                    error=doc["error_desc"].GetString();
                                }
                                else
                                {
                                    error="Error code :"+std::to_string(doc["error_code"].GetInt64());
                                }
                                throw std::runtime_error(error.c_str());
                            }
                            bool hasContentType=false;
                            if(request->protocol==1 || request->protocol==2 )
                            {
                                if((request->is_https && request->https_response==nullptr) || (!request->is_https && request->http_response==nullptr))
                                {
                                    throw std::runtime_error("reference to null pointer error!");
                                } 
                                if(doc.HasMember("headers") && doc["headers"].IsArray())
                                {
                                    for (const auto& item : doc["headers"].GetArray()) {
                                        if(item.HasMember("key") && item["key"].IsString() && item.HasMember("value") && item["value"].IsString())
                                        {
                                            if(item["key"].GetString()=="Content-Type") hasContentType=true;
                                            if (request->is_https) {
                                                request->https_response->writeHeader(item["key"].GetString(), item["value"].GetString());
                                            } else {
                                                request->http_response->writeHeader(item["key"].GetString(), item["value"].GetString());
                                            }
                                        }
                                    }
                                }
                                if(!hasContentType)
                                {
                                    if (request->is_https) {
                                        request->https_response->writeHeader("Content-Type", "application/json");
                                    } else {
                                        request->http_response->writeHeader("Content-Type", "application/json");
                                    }
                                }
                                if(doc.HasMember("response") && doc["response"].IsString())
                                {

                                    if (request->is_https) {
                                        request->https_response->writeHeader("X-Processing-Time", 
                                                                        std::to_string(processing_time.count()));
                                        request->https_response->end(doc["response"].GetString());
                                    } else {
                                        request->http_response->writeHeader("X-Processing-Time", 
                                                                        std::to_string(processing_time.count()));
                                        request->http_response->end(doc["response"].GetString());
                                    }
                                    
                                }
                                else
                                {
                                    throw std::runtime_error("response not found");
                                }
                            }
                            else if(request->protocol==3)
                            {
                                if((request->is_https && request->wss==nullptr) || (!request->is_https && request->ws==nullptr))
                                {
                                    throw std::runtime_error("reference to null pointer error!");
                                }
                                if(doc.HasMember("response") && doc["response"].IsString())
                                {
                                    if (request->is_https) {
                                        request->wss->send(doc["response"].GetString(),uWS::OpCode::TEXT);
                                    }
                                    else
                                    {
                                        request->ws->send(doc["response"].GetString(),uWS::OpCode::TEXT);
                                    }
                                }
                            }
                            
                        }
                        catch (const std::exception& e) {
                            _ms.fail();
                            Logger::instance().log(Logger::Level::ERROR, e.what());

                            error_response = "{\"error\": \"";
                            error_response+=e.what();
                            error_response+="\"}";
                            if(request->protocol==1 || request->protocol==2 )
                            {
                                if (request->is_https) {
                                    request->https_response->writeStatus("500 Internal Server Error");
                                    request->https_response->end(error_response);
                                } else {
                                    request->http_response->writeStatus("500 Internal Server Error");
                                    request->http_response->end(error_response);
                                }
                            }
                            else if(request->protocol==3)
                            {
                                if (request->is_https) {
                                    request->wss->send(error_response,uWS::OpCode::TEXT);
                                }
                                else
                                {
                                    request->ws->send(error_response,uWS::OpCode::TEXT);
                                }
                            }

                        }
                        catch(...)
                        {
                            _ms.fail();
                            Logger::instance().log(Logger::Level::ERROR, "Error processing request in thread: unknown error");

                            error_response = R"({"error": "Internal server error"})";
                            if(request->protocol==1 || request->protocol==2 )
                            {
                                if (request->is_https) {
                                    request->https_response->writeStatus("500 Internal Server Error");
                                    request->https_response->end(error_response);
                                } else {
                                    request->http_response->writeStatus("500 Internal Server Error");
                                    request->http_response->end(error_response);
                                }
                                }
                            else if(request->protocol==3)
                            {
                                if (request->is_https) {
                                    request->wss->send(error_response,uWS::OpCode::TEXT);
                                }
                                else
                                {
                                    request->ws->send(error_response,uWS::OpCode::TEXT);
                                }
                            }
                        }
                       /* try{
                            ADD_(ServiceBus,incomming_transaction_log_tab,addReq,addResp,0,{
                                uint32_t endpointId = endpoit_id_.load();
                                addReq.mutable_record()->set_api_id_fk(apiId);
                                addReq.mutable_record()->set_endpoint_id(endpointId);
                                addReq.mutable_record()->set_endpoint(std::to_string(endpointId));
                                addReq.mutable_record()->set_request(*(request->body.get()));
                                addReq.mutable_record()->set_requets_date(dateTimeNow);
                                addReq.mutable_record()->set_duration(duration);
                                addReq.mutable_record()->set_response(error_response.length()>0?error_response:response);
                                addReq.mutable_record()->set_method(methodId==2?"GET":"POST");
                                addReq.mutable_record()->set_route(*(request->url.get()));                            
                            })
                        }
                        catch (const std::exception& e) {
                            Logger::instance().log(Logger::Level::ERROR, e.what());
                        }
                        catch(...)
                        {
                            Logger::instance().log(Logger::Level::ERROR, "Unknown Error in logging!");
                        }*/

                        server_.busy--;
                    
                    });
                } 
                if (index > 2)
                {
                    break;
                }

            }
                done->store(true);
                Logger::instance().log(Logger::Level::INFO, "Killed Inbound Thread Index #"+std::to_string(index)); }, mt.done);
        request_worker_->emplace_back(std::move(mt));
    }

    void InboundServer::start(uint32_t endpointId)
    {
        running_.store(true);
        endpoit_id_ = endpointId;
        cleaner_ = std::jthread([&]
                                {
                                    while (running_.load())
                                    {
                                        for (auto it = request_worker_->begin(); it != request_worker_->end();)
                                        {
                                            if (it->done->load())
                                            {
                                                it = request_worker_->erase(it);
                                            }
                                            else
                                            {
                                                ++it;
                                            }
                                        }
                                        std::this_thread::sleep_for(std::chrono::seconds(1));
                                    }
                                    for (auto it = request_worker_->begin(); it != request_worker_->end();)
                                    {
                                        it = request_worker_->erase(it);
                                    } });
        for (int i = 0; i < 2; i++)
        {
            // Logger::instance().log(Logger::Level::INFO, "Add new Inboundserver worker");
            addNewRequestWorker();
        }

        for (int i = 0; i < 5; i++)
        {
            if (server_.is_https)
                listen_worker_->push_back(std::jthread(&InboundServer::run_ssl_server, this));
            else
                listen_worker_->push_back(std::jthread(&InboundServer::run_server, this));
        }

        // std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }

    void InboundServer::stop()
    {
        thread_index_.store(0);
        running_.store(false);
        for (auto it = listen_sockets_->begin(); it != listen_sockets_->end(); it++)
        {
            us_listen_socket_close(0, *it);
        }
        Logger::instance().log(Logger::Level::INFO, "Inbound server stopped");
    }

    void InboundServer::addNewApi(std::string route, Api api)
    {
        removeApi(api.id);
        server_.api->emplace(route, api);
    }

    void InboundServer::removeApi(uint32_t id)
    {
        for (auto it = server_.api->begin(); it != server_.api->end();)
        {
            if (it->second.id == id)
            {
                it = server_.api->erase(it);
            }
            else
            {
                it++;
            }
        }
    }

    void InboundServer::run_server()
    {
        auto app = create_app();

        app.listen(server_.port, [this](auto *listen_socket)
                   {
                if (listen_socket) {
                    if(listen_sockets_->find(listen_socket)==listen_sockets_->end()) listen_sockets_->insert(listen_socket);
                    std::string log= "HTTP server listening on port " +std::to_string(server_.port);
                    if(server_.transport_protocol==3) log= "HTTP server listening on port " +std::to_string(server_.port);
                    Logger::instance().log(Logger::Level::INFO, log);
                } else {
                    std::string log= "Failed to start HTTP server on port " +std::to_string(server_.port);
                    if(server_.transport_protocol==3) log="Failed to start WS server on port " +std::to_string(server_.port);
                    Logger::instance().log(Logger::Level::ERROR, log);
                } });

        app.run();
    }

    void InboundServer::run_ssl_server()
    {
        try
        {
            auto app = create_app_ssl();

            app.listen(server_.port, [this](auto *listen_socket)
                       {
                    if (listen_socket) {
                        if(listen_sockets_->find(listen_socket)==listen_sockets_->end()) listen_sockets_->insert(listen_socket);
                        std::string log= "HTTPS server listening on port " +std::to_string(server_.port);
                        if(server_.transport_protocol==3) log= "WS server listening on port " +std::to_string(server_.port);
                        Logger::instance().log(Logger::Level::INFO, log);
                    } else {
                         std::string log= "Failed to start HTTPS server on port " +std::to_string(server_.port);
                         if(server_.transport_protocol==3) log="Failed to start WS server on port " +std::to_string(server_.port);
                        Logger::instance().log(Logger::Level::ERROR, log);
                    } });

            app.run();
        }
        catch (const std::exception &e)
        {
            Logger::instance().log(Logger::Level::ERROR, e.what());
            Logger::instance().log(Logger::Level::ERROR, "Make sure certificate.pem and private_key.pem exist in current directory");
        }
    }

    uWS::App InboundServer::create_app()
    {
        uWS::App app;

        if (server_.transport_protocol == 1)
        {

            app.options("/*", [](auto *res, auto *req)
                        {
                    std::string reqHeaders;

                    if (auto hdr = req->getHeader("access-control-request-headers"); !hdr.empty()) {
                        reqHeaders = std::string(hdr);
                    }

                    res->writeHeader("Access-Control-Allow-Origin", "*");
                    res->writeHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

                    if (!reqHeaders.empty()) {
                        res->writeHeader("Access-Control-Allow-Headers", reqHeaders);
                    } else {
                        res->writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
                    }

                    res->writeStatus("204 No Content");
                    res->end();
                
                });

            app.any("/*", [this](auto *res, auto *req)
                    {
                        
                        auto it = server_.api->find(std::string(req->getUrl()));
                        if(it==server_.api->end())
                        {
                            res->writeStatus("404 Rout not found");
                            res->end();
                            return;
                        }
                        
                        /*std::string_view method = req->getMethod();
                        if (( it->second.method ==1 && method != "post") || 
                        ( it->second.method ==2 && method != "get") ||
                        ( it->second.method ==3 && method != "put") || 
                        ( it->second.method ==4 && method != "delete")  
                        ) {
                            res->writeStatus("405 Method Not Allowed")
                            ->end();
                            return;
                        }*/

                        //Logger::instance().log(Logger::Level::DEBUG,"request_worker_->size():"+std::to_string(request_worker_->size()));
                        //Logger::instance().log(Logger::Level::DEBUG,"listen_worker_->size():"+std::to_string(listen_worker_->size()));
                        if(request_worker_->size()>=listen_worker_->size() && listen_worker_->size()<MAX_LISTENER)
                        {
                            //Logger::instance().log(Logger::Level::DEBUG,"Add New Listener...");
                            listen_worker_->push_back(std::jthread(&InboundServer::run_server, this));
                        }

                    std::unique_ptr<std::string> headers = std::make_unique<std::string>("");
                        *headers += "{";
                        for (auto [key, value] : *req)
                        {
                            //Logger::instance().log(Logger::Level::DEBUG,std::string(key));
                            //Logger::instance().log(Logger::Level::DEBUG,std::string(value));
                            *headers +="\"";
                            *headers +=key;
                            *headers +="\":\"";
                            *headers +=replaceSubStringCopy(std::string(value),"\"","\\\"");
                            *headers +="\",";
                        }
                        if ((*headers).ends_with(',')) {
                            (*headers).pop_back();
                        }
                        *headers += "}";

                    std::unique_ptr<std::string> body;                
                    std::unique_ptr<std::string> url =std::make_unique<std::string>(std::string(req->getUrl()));
                    std::unique_ptr<std::string> method =std::make_unique<std::string>(std::string(req->getMethod()));
                    res->onData([this, res, headers=std::move(headers),url=std::move(url), body = std::move(body),method = std::move(method)]
                            (std::string_view data, bool last) mutable {
                        if (!body.get()) {
                            body=std::make_unique<std::string>("");
                        }
                        body->append(data);
                        if (last) { 
                            std::unique_ptr<RequestData> request =std::make_unique<RequestData>();
                            request->url =std::move(url);
                            request->method =std::move(method);
                            request->body = std::move(body);
                            request->http_response = res;
                            request->is_https =false;
                            request->headers = std::move(headers);
                            request->loop = uWS::Loop::get();
                            //Logger::instance().log(Logger::Level::DEBUG,"GET REQUEST");
                            //Logger::instance().log(Logger::Level::DEBUG, *request->body);
                            //Logger::instance().log(Logger::Level::DEBUG, *request->headers);
                                request_queue_.Produce(std::move(request)); 
                            //Logger::instance().log(Logger::Level::DEBUG,"AFTER PRODUCE.");
                            
                        }
                    });
                    
                    res->onAborted([this]() {
                        Logger::instance().log(Logger::Level::INFO, "Request aborted (HTTP)");
                    }); });
        }
        else if (server_.transport_protocol == 3)
        {
            app.ws<PerSocketData>("/*", {.compression = uWS::SHARED_COMPRESSOR,
                                         .maxPayloadLength = 16 * 1024,
                                         .idleTimeout = 60, // seconds
                                         .maxBackpressure = 1 * 1024 * 1024,
                                         .closeOnBackpressureLimit = false,
                                         .resetIdleTimeoutOnSend = true,
                                         .sendPingsAutomatically = true,

                                         .upgrade = [](auto *res, auto *req, auto *context)
                                         {

                    std::string headers="";
                    headers += "{";
                    for (auto [key, value] : *req)
                    {
                        headers +="\"";
                        headers +=key;
                        headers +="\":\"";
                        headers +=replaceSubStringCopy(std::string(value),"\"","\\\"");
                        headers +="\",";
                    }
                    if ((headers).ends_with(',')) {
                        (headers).pop_back();
                    }
                    headers += "}";
                    res->template upgrade<PerSocketData>({
                        .headers = headers
                    }, req->getHeader("sec-websocket-key"),
                        req->getHeader("sec-websocket-protocol"),
                        req->getHeader("sec-websocket-extensions"),
                        context); },
                                         .open = [this](auto *ws)
                                         { Logger::instance().log(Logger::Level::INFO, "Secure client connected"); },

                                         .message = [this](auto *ws, std::string_view message, uWS::OpCode opCode)
                                         {
                                             auto *data = ws->getUserData();

                                             if (data->token.length() > 0 && data->remoteAddress != ws->getRemoteAddressAsText())
                                             {
                                                 data->isConnected = false;
                                                 Logger::instance().log(Logger::Level::ERROR, "Connection has been changed");
                                                 return;
                                             }

                                             data->remoteAddress = ws->getRemoteAddressAsText();
                                             data->isConnected = true;

                                             auto it = Outbound::getInstance().clients_->find(data->token);
                                             if (it == Outbound::getInstance().clients_->end())
                                             {
                                                 uuid_t uuidObject;
                                                 uuid_generate(uuidObject);
                                                 char uuidChar[37];
                                                 uuid_unparse(uuidObject, uuidChar);
                                                 data->token = std::string(uuidChar);

                                                 Outbound::getInstance().clients_->emplace(data->token, std::make_pair(ws, nullptr));
                                             }

                                             std::unique_ptr<RequestData> request = std::make_unique<RequestData>();
                                             request->token = std::make_unique<std::string>(data->token);
                                             request->method= std::make_unique<std::string>("ws");
                                             request->body = std::make_unique<std::string>(message);
                                             request->ws = ws;
                                             request->is_https = false;
                                             request->protocol = 3;
                                             request->headers = std::make_unique<std::string>(data->headers);
                                             request->loop = uWS::Loop::get();
                                             // Logger::instance().log(Logger::Level::DEBUG,"GET REQUEST");
                                             // Logger::instance().log(Logger::Level::DEBUG, *request->body);
                                             request_queue_.Produce(std::move(request));
                                             // Logger::instance().log(Logger::Level::DEBUG,"AFTER PRODUCE");
                                         },
                                         .drain = [&](auto) {},
                                         .ping = [&](auto *ws, std::string_view message)
                                         {
                                             Logger::instance().log(Logger::Level::INFO, "PING");
                                             //  Logger::instance().log(Logger::Level::INFO, std::string(message));
                                         },
                                         .pong = [&](auto *ws, std::string_view message)
                                         {
                                             Logger::instance().log(Logger::Level::INFO, "PONG");
                                             // Logger::instance().log(Logger::Level::INFO, std::string(message));
                                         },
                                         .close = [&](auto *ws, int, std::string_view message)
                                         {
                    auto *data=ws->getUserData();
                    data->isConnected = false;
                    Logger::instance().log(Logger::Level::INFO, "Secure client disconnected"); }

                                        });
        }

        return app;
    }

    uWS::SSLApp InboundServer::create_app_ssl()
    {

        uWS::SSLApp app({.key_file_name = server_.key_path.c_str(), .cert_file_name = server_.cert_path.c_str()});

        if (server_.transport_protocol == 1)
        {

            app.options("/*", [](auto *res, auto *req)
                        {
                    std::string reqHeaders;

                    if (auto hdr = req->getHeader("access-control-request-headers"); !hdr.empty()) {
                        reqHeaders = std::string(hdr);
                    }

                    res->writeHeader("Access-Control-Allow-Origin", "*");
                    res->writeHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

                    if (!reqHeaders.empty()) {
                        res->writeHeader("Access-Control-Allow-Headers", reqHeaders);
                    } else {
                        res->writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
                    }

                    res->writeStatus("204 No Content");
                    res->end();
                });

            app.any("/*", [this](auto *res, auto *req)
                    {
                        
                        auto it = server_.api->find(std::string(req->getUrl()));
                        if(it==server_.api->end())
                        {
                            res->writeStatus("404 Rout not found");
                            res->end();
                            return;
                        }
                        /*std::string_view method = req->getMethod();
                        if (( it->second.method ==1 && method != "post") || 
                        ( it->second.method ==2 && method != "get") ||
                        ( it->second.method ==3 && method != "put") || 
                        ( it->second.method ==4 && method != "delete")  
                        ) {
                            res->writeStatus("405 Method Not Allowed")
                            ->end();
                            return;
                        }*/

                        if(request_worker_->size()>=listen_worker_->size() && listen_worker_->size()<MAX_LISTENER)
                        {
                            listen_worker_->push_back(std::jthread(&InboundServer::run_ssl_server, this));
                        }

                        std::unique_ptr<std::string> headers = std::make_unique<std::string>("");
                        *headers += "{";
                        for (auto [key, value] : *req)
                        {
                            //Logger::instance().log(Logger::Level::DEBUG,std::string(key));
                            //Logger::instance().log(Logger::Level::DEBUG,std::string(value));
                            *headers +="\"";
                            *headers +=key;
                            *headers +="\":\"";
                            *headers +=replaceSubStringCopy(std::string(value),"\"","\\\"");
                            *headers +="\",";
                        }
                        if ((*headers).ends_with(',')) {
                            (*headers).pop_back();
                        }
                        *headers += "}";

                    std::unique_ptr<std::string> body;
                    std::unique_ptr<std::string> url =std::make_unique<std::string>(std::string(req->getUrl()));
                    std::unique_ptr<std::string> method =std::make_unique<std::string>(std::string(req->getMethod()));
                    res->onData([this, res, headers=std::move(headers),url=std::move(url), body = std::move(body),method = std::move(method)]
                            (std::string_view data, bool last) mutable {
                        if (!body.get()) {
                            body=std::make_unique<std::string>("");
                        }
                        body->append(data);
                        if (last) {
                            std::unique_ptr<RequestData> request =std::make_unique<RequestData>();
                            request->url =std::move(url);
                            request->method =std::move(method);
                            request->body = std::move(body);
                            request->https_response = res;
                            request->is_https =true;
                            request->headers = std::move(headers);
                            request->loop = uWS::Loop::get();
                            //Logger::instance().log(Logger::Level::DEBUG,"GET REQUEST");
                            //Logger::instance().log(Logger::Level::DEBUG, *request->body);
                            request_queue_.Produce(std::move(request));
                            //Logger::instance().log(Logger::Level::DEBUG,"AFTER PRODUCE");
                        }
                    });
                    
                    res->onAborted([this]() {
                    Logger::instance().log(Logger::Level::INFO, "Request aborted (HTTPS)");
                    }); });
        }
        else if (server_.transport_protocol == 3)
        {
            app.ws<PerSocketData>("/*", {.compression = uWS::SHARED_COMPRESSOR,
                                         .maxPayloadLength = 16 * 1024,
                                         .idleTimeout = 60, // seconds
                                         .maxBackpressure = 1 * 1024 * 1024,
                                         .closeOnBackpressureLimit = false,
                                         .resetIdleTimeoutOnSend = true,
                                         .sendPingsAutomatically = true,

                                         .upgrade = [](auto *res, auto *req, auto *context)
                                         {

                    std::string headers="";
                    headers += "{";
                    for (auto [key, value] : *req)
                    {
                        headers +="\"";
                        headers +=key;
                        headers +="\":\"";
                        headers +=replaceSubStringCopy(std::string(value),"\"","\\\"");
                        headers +="\",";
                    }
                    if ((headers).ends_with(',')) {
                        (headers).pop_back();
                    }
                    headers += "}";
                    res->template upgrade<PerSocketData>({
                        .headers = headers
                    }, req->getHeader("sec-websocket-key"),
                        req->getHeader("sec-websocket-protocol"),
                        req->getHeader("sec-websocket-extensions"),
                        context); },
                                         .open = [this](auto *ws)
                                         { Logger::instance().log(Logger::Level::INFO, "Secure client connected"); },

                                         .message = [this](auto *ws, std::string_view message, uWS::OpCode opCode)
                                         {
                                             auto *data = ws->getUserData();

                                             if (data->token.length() > 0 && data->remoteAddress != ws->getRemoteAddressAsText())
                                             {
                                                 data->isConnected = false;
                                                 Logger::instance().log(Logger::Level::ERROR, "Connection has been changed");
                                                 return;
                                             }

                                             data->remoteAddress = ws->getRemoteAddressAsText();
                                             data->isConnected = true;

                                             auto it = Outbound::getInstance().clients_->find(data->token);
                                             if (it == Outbound::getInstance().clients_->end())
                                             {
                                                 uuid_t uuidObject;
                                                 uuid_generate(uuidObject);
                                                 char uuidChar[37];
                                                 uuid_unparse(uuidObject, uuidChar);
                                                 data->token = std::string(uuidChar);

                                                 Outbound::getInstance().clients_->emplace(data->token, std::make_pair(nullptr, ws));
                                             }

                                             std::unique_ptr<RequestData> request = std::make_unique<RequestData>();
                                             request->token = std::make_unique<std::string>(data->token);
                                             request->body = std::make_unique<std::string>(message);
                                             request->method= std::make_unique<std::string>("ws");
                                             request->wss = ws;
                                             request->is_https = true;
                                             request->protocol = 3;
                                             request->headers = std::make_unique<std::string>(data->headers);
                                             request->loop = uWS::Loop::get();
                                             request_queue_.Produce(std::move(request)); },
                                         .drain = [&](auto) {},
                                         .ping = [&](auto *ws, std::string_view message)
                                         {
                                             Logger::instance().log(Logger::Level::INFO, "PING");
                                             //  Logger::instance().log(Logger::Level::INFO, std::string(message));
                                         },
                                         .pong = [&](auto *ws, std::string_view message)
                                         {
                                             Logger::instance().log(Logger::Level::INFO, "PONG");
                                             //  Logger::instance().log(Logger::Level::INFO, std::string(message));
                                         },
                                         .close = [&](auto *ws, int, std::string_view message)
                                         {
                    auto *data=ws->getUserData();
                    data->isConnected = false;
                    Logger::instance().log(Logger::Level::INFO, "Secure client disconnected"); }

                                        });
        }
        return app;
    }

    Inbound &Inbound::getInstance()
    {
        static Inbound instance;
        return instance;
    }

    Inbound::Inbound() {}

    Inbound::~Inbound() {}

    uint32_t Inbound::start(Server server)
    {
        Logger::instance().log(Logger::Level::INFO, "Inbound starting...");
        uint32_t id = 0;
        {
            std::lock_guard<std::mutex> lock(id_mutex_);
            last_server_id_++;
            id = last_server_id_.load();
        }
        if (serverPool->size() > max_inbound_.load())
        {
            Logger::instance().log(Logger::Level::ERROR, LICENSE_MESSAGE);
            throw std::runtime_error(LICENSE_MESSAGE);
        }
        auto it = serverPool->find(id);
        if (it != serverPool->end())
        {
            serverPool->erase(it);
        }

        std::unique_ptr<InboundServer> srv = std::make_unique<InboundServer>(server);
        srv->start(id);
        serverPool->emplace(id, std::move(srv));
        Context::getInstance().setData("INBOUND_" + std::to_string(id), "1");
        return id;
    }

    void Inbound::stop(uint32_t id)
    {

        auto it = serverPool->find(id);
        if (it != serverPool->end())
        {
            serverPool->erase(it);
        }
        Context::getInstance().setData("INBOUND_" + std::to_string(id), "0");
    }

    void Inbound::stopAll()
    {
        for (auto it = serverPool->begin(); it != serverPool->end();)
        {
            it = serverPool->erase(it);
        }
    }

    uint32_t Inbound::addApi(uint32_t server_id, std::string route, Api api)
    {
        uint32_t id = 0;
        {
            std::lock_guard<std::mutex> lock(id_mutex_);
            last_api_id_++;
            id = last_api_id_.load();
            api.id = id;
        }
        auto it = serverPool->find(server_id);
        if (it != serverPool->end())
        {
            it->second->addNewApi(route, api);
        }
        Context::getInstance().setData("API_" + std::to_string(id), "1");
        return id;
    }

    uint32_t Inbound::removeApi(uint32_t server_id, std::string route)
    {
        uint32_t id = 0;
        auto it = serverPool->find(server_id);
        if (it != serverPool->end())
        {
            auto itRout = it->second->server_.api->find(route);
            if (itRout != it->second->server_.api->end())
            {
                id = itRout->second.id;
                it->second->removeApi(itRout->second.id);
            }
        }
        Context::getInstance().setData("API_" + std::to_string(id), "0");
        return id;
    }

    Outbound &Outbound::getInstance()
    {
        static Outbound instance;
        return instance;
    }

    void Outbound::addNewRequestWorker()
    {
        Logger::instance().log(Logger::Level::INFO, "Add New Outbound Worker");
        ManagedThread mt;
        mt.thread = std::jthread([&](std::shared_ptr<std::atomic<bool>> done)
                                 {
                int index = 0;
                {
                    std::lock_guard<std::mutex> lock(index_mutex_);
                    thread_index_++;
                    index = thread_index_.load();
                }
                
                std::unique_ptr<OutboundRequestData> req;
                while(running_.load())
                {
                
                while (request_queue_.ConsumeSync(req)) {
                    if(!running_.load())
                    {
                        request_queue_.Produce(std::move(req));
                        break;
                    }
                    if(req==nullptr)
                    {
                        continue;
                    }
                    const auto timeNow = std::chrono::system_clock::now();
                    const std::time_t dateTimeNow = std::chrono::system_clock::to_time_t(timeNow);
                    std::string response;
                    std::string query="";
                    uint32_t duration=0;
                    busy_++;
                    if(busy_>=request_worker_->size() && busy_<=max_worker_count_)
                    {
                        addNewRequestWorker();
                        //request_queue_.Produce(std::move(req));
                        //continue;
                    }

                    pmetrics::Scope _ms(pmetrics::POOL_OUTBOUND);

                    try
                    {
                        if(req->protocol==1 || req->protocol==2)
                        {
                            CURL* curl = curl_easy_init();
                            if (!curl) {
                                throw std::runtime_error("Error to init curl!");
                            }
                            if(req->url==nullptr)
                            {
                                throw std::runtime_error("Outbound url not found!");
                            }
                            try
                            {
                                if(req->is_mime)
                                {
                                    struct curl_slist* headers = nullptr;
                                    curl_mime *mime = curl_mime_init(curl);
                                    curl_mimepart *part = nullptr;
                                    try
                                    {
                                        if(req->request!=nullptr && req->request->length()>0)
                                            {
                                                rapidjson::Document doc;
                                                doc.Parse(req->request->c_str());
                                                if (doc.HasParseError())
                                                {
                                                    throw std::runtime_error("Wrong mime data format");
                                                }
                                                if (!doc.IsArray())
                                                {
                                                    throw std::runtime_error("Wrong mime data format, request should be array of fields");
                                                }
                                                for (const auto& item : doc.GetArray())
                                                {
                                                    part = curl_mime_addpart(mime);

                                                    if(item.HasMember("name") && item["name"].IsString())
                                                    {
                                                        curl_mime_name(part, item["name"].GetString());
                                                    }


                                                    if(item.HasMember("data") && item["data"].IsString())
                                                    {
                                                        curl_mime_data(part, item["data"].GetString(), CURL_ZERO_TERMINATED);
                                                    }

                                                    if(item.HasMember("raw") && item["raw"].IsString())
                                                    {
                                                        std::string fileBuffer = Crypto::base64Decode(std::string(item["raw"].GetString()));
                                                        curl_mime_data(part, fileBuffer.c_str(), fileBuffer.length());
                                                    }

                                                    if(item.HasMember("filedata") && item["filedata"].IsString())
                                                    {
                                                        curl_mime_filedata(part, item["filedata"].GetString());
                                                    }


                                                    if(item.HasMember("filename") && item["filename"].IsString())
                                                    {
                                                        curl_mime_filename(part, item["filename"].GetString());
                                                    }


                                                    if(item.HasMember("type") && item["type"].IsString())
                                                    {
                                                        curl_mime_type(part, item["type"].GetString());
                                                    }
                                                }
                                            }

                                            for (auto &header : req->headers)
                                            {
                                                std::string ct=header.first+": "+header.second;
                                                headers = curl_slist_append(headers, ct.c_str());
                                            }
                                
                                            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
                                            
                                            
                                            std::string finalUrl = (*(req->url.get()));
                                            curl_easy_setopt(curl, CURLOPT_URL, finalUrl.c_str());
                                            curl_easy_setopt(curl, CURLOPT_MIMEPOST, mime);
                                            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
                                            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
                                           // curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L);
                                            //curl_easy_setopt(curl, CURLOPT_DEBUGFUNCTION, debug_callback);

                                           // Logger::instance().log(Logger::Level::DEBUG,"Service Url:"+ finalUrl);
                                           // Logger::instance().log(Logger::Level::DEBUG,"Service Request:"+ (*(req->request.get())));
                                           // Logger::instance().log(Logger::Level::DEBUG,"Service Timeout:"+ std::to_string((long) req->time_out.count()));

                                            curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long) req->time_out.count());
                                            curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, (long) req->time_out.count());
                                            curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
                                            CURLcode res = curl_easy_perform(curl);
                                            if (res == CURLE_OK) {
                                            //    Logger::instance().log(Logger::Level::DEBUG,"Service Response:"+ response);
                                                req->response.set_value(response);
                                                auto processing_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                                                        std::chrono::steady_clock::now() - req->received_time);
                                                duration = processing_time.count();
                                            }
                                            else
                                            {
                                                throw std::runtime_error("call service error!"+std::string(curl_easy_strerror(res)));
                                            }
                                            curl_slist_free_all(headers);
                                            curl_mime_free(mime);
                                        }
                                        catch (...) {
                                            curl_slist_free_all(headers);
                                            curl_mime_free(mime);
                                            throw;
                                        }
                                        
                                }
                                else
                                {
                                    struct curl_slist* headers = nullptr;
                                    if(req->content_type!=nullptr)
                                    {
                                        std::string ct="Content-Type: "+(*(req->content_type.get()));
                                        headers = curl_slist_append(headers, ct.c_str());
                                    }
                                    else
                                    {
                                        headers = curl_slist_append(headers, "Content-Type: application/json");
                                    }
                                

                                    if(req->method==2)//get
                                    {
                                        curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
                                        if(req->request!=nullptr && req->request->length()>0)
                                        {
                                            query = jsonToQueryParamsEncoded(*(req->request.get())); 
                                        }
                                    }
                                    else if(req->method==1)//post
                                    {
                                        curl_easy_setopt(curl, CURLOPT_POST, 1L);
                                        
                                        if(req->request!=nullptr && req->request->length()>0)
                                        {
                                            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, (*(req->request.get())).c_str());
                                        }
                                        
                                    }
                                    else if(req->method==3)//put
                                    {
                                        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
                                        
                                        if(req->request!=nullptr && req->request->length()>0)
                                        {
                                            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, (*(req->request.get())).c_str());
                                        }
                                        
                                    }
                                    else if(req->method==4)//delete
                                    {
                                        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
                                        if(req->request!=nullptr && req->request->length()>0)
                                        {
                                            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, (*(req->request.get())).c_str());
                                        }
                                        
                                    }
                                    else if(req->method==5)//patch
                                    {
                                        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PATCH");
                                        if(req->request!=nullptr && req->request->length()>0)
                                        {
                                            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, (*(req->request.get())).c_str());
                                        }
                                        
                                    }
                                    for (auto &header : req->headers)
                                    {
                                        std::string ct=header.first+": "+header.second;
                                        headers = curl_slist_append(headers, ct.c_str());
                                    }
                                
                                    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

                                    std::string finalUrl = (*(req->url.get()));
                                    if(query.length()>0) finalUrl+="?"+query;
                                    
                                    //Logger::instance().log(Logger::Level::DEBUG,"Service Url:"+ finalUrl);
                                    //Logger::instance().log(Logger::Level::DEBUG,"Service Request:"+ (*(req->request.get())));
                                    //Logger::instance().log(Logger::Level::DEBUG,"Service Timeout:"+ std::to_string((long) req->time_out.count()));

                                    curl_easy_setopt(curl, CURLOPT_URL, finalUrl.c_str());
                                    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
                                    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

                                    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, (long) req->time_out.count());
                                    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT_MS, (long) req->time_out.count());
                                    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
                                    //curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L);
                                    //curl_easy_setopt(curl, CURLOPT_DEBUGFUNCTION, debug_callback);
                                

                                    CURLcode res = curl_easy_perform(curl);
                                    curl_slist_free_all(headers);
                                    if (res == CURLE_OK) {
                                    //    Logger::instance().log(Logger::Level::DEBUG,"Service Response:"+ response);
                                        req->response.set_value(response);
                                        auto processing_time = std::chrono::duration_cast<std::chrono::milliseconds>(
                                                std::chrono::steady_clock::now() - req->received_time);
                                        duration = processing_time.count();
                                    }
                                    else
                                    {
                                        throw std::runtime_error("call service error!");
                                    }    
                                }
                                curl_easy_cleanup(curl); 
                            }
                            catch(...)
                            {
                                curl_easy_cleanup(curl); 
                                throw; 
                            }
                        }
                        else if(req->protocol==3)
                        {
                            
                            if(req->request!=nullptr && req->request->length()>0)
                            {
                                if(req->ws_token!=nullptr)
                                {
                                    auto it = clients_->find(*req->ws_token);
                                    if(it != clients_->end())
                                    {
                                        if(it->second.first!=nullptr)
                                        {
                                            it->second.first->send((*(req->request.get())),uWS::OpCode::TEXT);
                                        }
                                        else if(it->second.second!=nullptr)
                                        {
                                            it->second.second->send((*(req->request.get())),uWS::OpCode::TEXT);
                                        }
                                    }
                                    else
                                    {
                                        auto itClient = clientApps_->find(*req->ws_token);
                                        if(itClient!=clientApps_->end())
                                        {
                                            itClient->second->send((*(req->request.get())));
                                        }
                                        else
                                        {
                                            if(req->callback==nullptr)
                                            {
                                                throw std::runtime_error("call function not defined!");
                                            }
                                            
                                            std::shared_ptr<WebSocketClient> client = std::make_shared<WebSocketClient>(*req->url,*req->ws_token,*req->callback,req->time_out.count(),req->headers);
                                            client->start(); 
                                            Logger::instance().log(Logger::Level::INFO,(*(req->url.get())) + ": Sending request..." );
                                            client->send((*(req->request.get()))); 
                                            Logger::instance().log(Logger::Level::INFO,(*(req->url.get())) + ": Done." );                                           
                                            clientApps_->emplace(*req->ws_token,client);
                                        }
                                    }
                                }
                            }
                            req->response.set_value("{\"headers\":[],\"response\":\"OK\"}");
                        }  
                    }
                    catch (const std::exception& e) {
                    response="{\"headers\":[],\"error_code\":-1,\"error_desc\":\"";
                        response+=e.what();
                        response+="\"}";
                        req->response.set_value(response);
                    }
                    catch(...)
                    {
                        response="{\"headers\":[],\"error_code\":-1,\"error_desc\":\"Unknown Error\"}";
                        req->response.set_value(response);
                    }
                    /*try{
                        ADD_(ServiceBus,outgoing_transaction_log_tab,addReq,addResp,0,{
                            //addReq.mutable_record()->set_incomming_log_id_fk();
                            addReq.mutable_record()->set_incomming_api_id_fk(req->incomming_api_id);
                            addReq.mutable_record()->set_endpoint_id_fk(req->endpoint_id);
                            if(req->request!=nullptr)
                                addReq.mutable_record()->set_request(*(req->request.get()));
                            else
                                addReq.mutable_record()->set_request("");
                            addReq.mutable_record()->set_requets_date(dateTimeNow);
                            addReq.mutable_record()->set_duration(duration);
                            addReq.mutable_record()->set_response(response);
                            addReq.mutable_record()->set_endpoint_service_id_fk(req->endpoint_service_id);
                            //addReq.mutable_record()->set_endpoint_authorization_id_fk(); 
                            //addReq.mutable_record()->set_token_id_fk();                            
                        })
                    }
                    catch (const std::exception& e) {
                        Logger::instance().log(Logger::Level::ERROR, e.what());
                    }
                    catch(...)
                    {
                        Logger::instance().log(Logger::Level::ERROR, "Error in Logging!");
                    }*/
                    
                    busy_--;
                }
                if (index > 2)
                {
                    break;
                }
            }
                
                 done->store(true);
                 Logger::instance().log(Logger::Level::INFO, "Killed Outbound Thread Index #" +std::to_string(index) ); }, mt.done);
        request_worker_->emplace_back(std::move(mt));
    }

    uint32_t Outbound::addNewService(Service service)
    {
        if (services_->size() > max_outbound_.load())
        {
            Logger::instance().log(Logger::Level::ERROR, LICENSE_MESSAGE);
            throw std::runtime_error(LICENSE_MESSAGE);
        }
        uint32_t id = 0;
        {
            std::lock_guard<std::mutex> lock(id_mutex_);
            last_service_id_++;
            id = last_service_id_.load();
            service.id = id;
        }
        removeService(id);
        services_->emplace(id, service);
        // services_name_->emplace(service.name, id);
        Context::getInstance().setData("SERVICE_" + std::to_string(id), "1");
        return id;
    }

    void Outbound::removeService(uint32_t id)
    {
        auto it = services_->find(id);
        if (it != services_->end())
        {
            /*if(it->second.transport_protocol==3)
            {
               auto itClient = clientApps_->find(id);
                if(itClient==clientApps_->end())
                {
                    itClient->second->stop();
                    clientApps_->erase(itClient);
                }
            }*/
            services_->erase(it);
        }
        /*for (auto it1 = services_name_->begin(); it1 != services_name_->end();)
        {
            if (it1->second == id)
            {
                it1 = services_name_->erase(it1);
                break;
            }
            else
            {
                it1++;
            }
        }*/
        Context::getInstance().setData("SERVICE_" + std::to_string(id), "0");
    }

    std::shared_ptr<std::string> Outbound::call(uint32_t id, const std::string &request, std::shared_ptr<std::map<std::string, std::string>> headers, const std::string &dynamicPath, const std::string &token, const std::string &callback, bool isMime)
    {
        auto it = services_->find(id);
        if (it == services_->end())
            return nullptr;
        std::shared_ptr<std::string> response;

        std::unique_ptr<OutboundRequestData> req = std::make_unique<OutboundRequestData>(std::chrono::milliseconds(it->second.timeout));
        req->endpoint_service_id = it->first;
        req->endpoint_id = it->second.endpoint_id;
        // req->incomming_api_id = apiId;
        req->service_id = it->second.id;
        if (it->second.architectural_style == 1 && it->second.check_schema)
        {
            rapidjson::Document doc;
            doc.Parse(request.c_str());

            if (doc.HasParseError())
            {
                throw std::runtime_error("Wrong data format");
            }
            rapidjson::SchemaValidator validator(*(it->second.schema_doc.get()));

            if (!doc.Accept(validator))
            {
                std::string error = "";
                rapidjson::StringBuffer sb;
                validator.GetInvalidSchemaPointer().StringifyUriFragment(sb);
                error += "Invalid schema: ";
                error += sb.GetString();
                error += "\nKeyword: ";
                error += validator.GetInvalidSchemaKeyword();
                sb.Clear();
                validator.GetInvalidDocumentPointer().StringifyUriFragment(sb);
                error += "\nInvalid document: ";
                error += sb.GetString();
                throw std::runtime_error(error.c_str());
            }
        }

        req->content_type = std::make_unique<std::string>(it->second.content_type);
        req->url = std::make_unique<std::string>(it->second.url + dynamicPath);
        req->request = std::make_unique<std::string>(request);
        req->method = it->second.method;
        req->protocol = it->second.transport_protocol;
        req->is_mime = isMime;
        if (req->protocol == 3)
        {
            req->ws_token = std::make_unique<std::string>(token);
            req->callback = std::make_unique<std::string>(callback);
        }
        for (auto &header : it->second.headers)
        {
            if (header.first == "Content-Type")
                continue;
            req->headers.emplace(header.first, header.second);
        }
        if (headers != nullptr)
        {
            for (auto it1 = headers->begin(); it1 != headers->end(); it1++)
            {
                if (it1->first == "Content-Type")
                    continue;
                req->headers.emplace(it1->first, it1->second);
            }
        }

        std::future<std::string> future = req->response.get_future();
        auto timeout = req->time_out;
        Outbound::getInstance().produce(std::move(req));
        auto status = future.wait_for(timeout);
        if (status == std::future_status::ready)
        {
            response = std::make_shared<std::string>(future.get());
        }
        else
        {
            throw std::runtime_error("Timeout occurred");
        }
        return response;
    }

    /* std::shared_ptr<std::string> Outbound::callByName(uint32_t apiId, const std::string &name, const std::string &request, std::shared_ptr<std::map<std::string, std::string>> headers, const std::string &dynamicPath, const std::string &token, const std::string &callback)
     {
         auto it = services_name_->find(name);
         if (it == services_name_->end())
             return nullptr;
         return call(apiId, it->second, request, headers, dynamicPath, token, callback);
     }*/

    void Outbound::start()
    {
        Logger::instance().log(Logger::Level::INFO, "Outbound starting...");
        running_.store(true);
        cleaner_ = std::jthread([&]
                                {
            while(running_.load())
            {
                for (auto it = request_worker_->begin(); it != request_worker_->end(); ) 
                {
                    if (it->done->load()) {
                        it = request_worker_->erase(it);
                    } else {
                        ++it;
                    }
                }
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
            for (auto it = request_worker_->begin(); it != request_worker_->end(); ) 
            {
                it = request_worker_->erase(it);
            } });
        for (int i = 0; i < 2; i++)
        {
            addNewRequestWorker();
        }
        // std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    void Outbound::stop()
    {
        thread_index_.store(0);
        running_.store(false);
        for (auto it = clientApps_->begin(); it != clientApps_->end();)
        {
            it->second->stop();
            it = clientApps_->erase(it);
        }

        Logger::instance().log(Logger::Level::INFO, "Outbound workers stopped");
    }

    void Outbound::produce(std::unique_ptr<OutboundRequestData> req)
    {
        pmetrics::enqueue(pmetrics::POOL_OUTBOUND);
        request_queue_.Produce(std::move(req));
    }

    Outbound::Outbound()
    {
        if (max_worker_count_ == 0)
            max_worker_count_ = std::thread::hardware_concurrency() * 2;
        if (max_worker_count_ == 0)
            max_worker_count_ = 50;
        curl_global_init(CURL_GLOBAL_DEFAULT);
        request_queue_.SetTimeout(QUEUET_TIMEOUT);
    };

    Outbound::~Outbound()
    {
        curl_global_cleanup();
    };

    MyV8 &MyV8::getInstance()
    {
        static MyV8 instance;
        return instance;
    }

    void MyV8::addNewRequestWorker()
    {
        Logger::instance().log(Logger::Level::INFO, "Add New JS Thread");
        ManagedThread mt;
        mt.thread = std::jthread([&](std::shared_ptr<std::atomic<bool>> done)
                                 {
        int index = 0;
        {
            std::lock_guard<std::mutex> lock(index_mutex_);
            thread_index_++;
            index = thread_index_.load();
        }
        std::unique_ptr<JsRequestData> req;

        while (running_.load())
        {
            reinit_flg_->insert_or_assign(index, false);
            v8::Isolate::CreateParams params;
            params.array_buffer_allocator = v8::ArrayBuffer::Allocator::NewDefaultAllocator();
            v8::Isolate *isolate = v8::Isolate::New(params);
            {
                v8::Isolate::Scope isolate_scope(isolate);
                v8::HandleScope handle_scope(isolate);
                v8::TryCatch try_catch(isolate);
                auto context = v8::Context::New(isolate);
                v8::Context::Scope context_scope(context);
                std::map<std::string, v8::Global<v8::Function>> gfn;
                for (auto it = functions_->begin(); it != functions_->end(); it++)
                {
                    try
                    {
                        v8::Global<v8::Function> tmp = compileFunction(it->first.c_str(), it->second.c_str(), isolate, context);
                        gfn.emplace(it->first, std::move(tmp));
                    }
                    catch (const std::exception &e)
                    {
                        std::string error = "error to compile Js function " + it->first + ":" +std::string(e.what());
                        Logger::instance().log(Logger::Level::ERROR, error);
                    }
                    catch (...)
                    {
                        std::string error = "error to compile Js function " + it->first;
                        Logger::instance().log(Logger::Level::ERROR, error);
                    }
                }

                auto tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Log").ToLocalChecked(),
                    v8::Function::New(context, Log).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Ls").ToLocalChecked(),
                    v8::Function::New(context, Ls).ToLocalChecked());
                 tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Base64Encode").ToLocalChecked(),
                    v8::Function::New(context, Base64Encode).ToLocalChecked());
                 tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Base64Decode").ToLocalChecked(),
                    v8::Function::New(context, Base64Decode).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "UUID").ToLocalChecked(),
                    v8::Function::New(context, UUID).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Execute").ToLocalChecked(),
                    v8::Function::New(context, Execute).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "System").ToLocalChecked(),
                    v8::Function::New(context, System).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "GetMysqlQuery").ToLocalChecked(),
                    v8::Function::New(context, GetQuery).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "CreateFile").ToLocalChecked(),
                    v8::Function::New(context, CreateFile).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "ReadFileBase64").ToLocalChecked(),
                    v8::Function::New(context, ReadFileBase64).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "ReadFile").ToLocalChecked(),
                    v8::Function::New(context, ReadFile).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "MysqlConnect").ToLocalChecked(),
                    v8::Function::New(context, Connect).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "CallService").ToLocalChecked(),
                    v8::Function::New(context, CallService).ToLocalChecked());
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "DB").ToLocalChecked(),
                    v8::Function::New(context, DB).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "GetContext").ToLocalChecked(),
                    v8::Function::New(context, GetContext).ToLocalChecked());

                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "SetContext").ToLocalChecked(),
                    v8::Function::New(context, SetContext).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Serve").ToLocalChecked(),
                    v8::Function::New(context, Serve).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Instance").ToLocalChecked(),
                    v8::Function::New(context, Instance).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "QueueProduce").ToLocalChecked(),
                    v8::Function::New(context, QueueProduce).ToLocalChecked());

                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "SetQueueConsumer").ToLocalChecked(),
                    v8::Function::New(context, SetQueueConsumer).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Sleep").ToLocalChecked(),
                    v8::Function::New(context, Sleep).ToLocalChecked());
                
                tmp = context->Global()->Set(
                    context,
                    v8::String::NewFromUtf8(isolate, "Time").ToLocalChecked(),
                    v8::Function::New(context, Time).ToLocalChecked());
                
                    
               // bool reinitFlg = !(*reinit_flg_)[index];
                uint32_t maxWorker = std::thread::hardware_concurrency()*2;
                if(maxWorker==0) maxWorker=50;
                while (request_queue_.ConsumeSync(req))
                {
                    if(!running_.load())
                    {
                        if(req!=nullptr) request_queue_.Produce(std::move(req));
                        break;
                    }
                    if (req == nullptr)
                    {
                        if((*reinit_flg_)[index]) break;
                        continue;
                    }
                    if((*reinit_flg_)[index])
                    {
                        request_queue_.Produce(std::move(req));
                        break;
                    }
                    busy_++;
                    if (busy_ >= request_worker_->size() && busy_ <= maxWorker)
                    {
                        //request_queue_.Produce(std::move(req));
                        addNewRequestWorker();
                        //continue;
                    }

                    pmetrics::Scope _ms(pmetrics::POOL_JS);

                    v8::HandleScope handle_scope(isolate);
                    v8::TryCatch try_catch(isolate);
                    try
                    {
                        if (req->function_name == nullptr)
                        {
                            throw std::runtime_error("Function name not found!");
                        }
                        if (req->request == nullptr)
                        {
                            req->request = std::make_unique<std::string>("");
                        }
                        if (req->headers == nullptr)
                        {
                            req->headers = std::make_unique<std::string>("");
                        }
                        if (req->url == nullptr)
                        {
                            req->url = std::make_unique<std::string>("");
                        }
                        if (req->method == nullptr)
                        {
                            req->method = std::make_unique<std::string>("");
                        }
                        auto it = gfn.find(*(req->function_name.get()));
                        if (it == gfn.end())
                        {
                            throw std::runtime_error("JS function not found!:"+(*(req->function_name.get())));
                        }
                        v8::Local<v8::Function> fn = it->second.Get(isolate);
                        v8::Local<v8::Value> args[4];
                        args[0] = v8::String::NewFromUtf8(isolate, req->request->c_str()).ToLocalChecked();
                        args[1] = v8::String::NewFromUtf8(isolate, req->url->c_str()).ToLocalChecked();
                        args[2] = v8::String::NewFromUtf8(isolate, req->headers->c_str()).ToLocalChecked();
                        args[3] = v8::String::NewFromUtf8(isolate, req->method->c_str()).ToLocalChecked();

                        std::atomic<bool> finished{false};
                        std::chrono::steady_clock::time_point deadline = std::chrono::steady_clock::now() + req->time_out;
                        startInterruptTimer(isolate, &deadline, finished);

                        v8::Local<v8::Value> result;
                        if (!fn->Call(context, context->Global(), 4, args).ToLocal(&result))
                        {
                            finished = true;
                            if (try_catch.HasTerminated())
                            {
                                Logger::instance().log(Logger::Level::ERROR, "Timeout");
                                isolate->CancelTerminateExecution();
                                throw std::runtime_error("JS execution timed out (interrupt)");
                            }

                            v8::String::Utf8Value err(isolate, try_catch.Exception());
                            throw std::runtime_error(*err);
                        }
                        finished = true;
                        v8::String::Utf8Value utf8(isolate, result);
                        if (*utf8)
                        {
                            req->response.set_value(std::string(*utf8));
                        }
                    }
                    catch (const std::exception &e)
                    {
                        _ms.fail();
                        std::string responseJson = "{\"headers\":[],\"error_code\":-1,\"error_desc\":\"";
                        responseJson += e.what();
                        responseJson += "\"}";
                        req->response.set_value(responseJson);
                    }
                    catch (...)
                    {
                        _ms.fail();
                        std::string responseJson = "{\"headers\":[],\"error_code\":-1,\"error_desc\":\"Unknown Error\"}";
                        req->response.set_value(responseJson);
                    }
                    busy_--;

                    if((*reinit_flg_)[index]) break;
                }
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(200));
            isolate->Dispose();
            delete params.array_buffer_allocator;   
      
            if (index > 4)
            {
                break;
            }
            //Logger::instance().log(Logger::Level::INFO, "Reinit JS Thread Index #"+std::to_string(index));
        } 
        done->store(true); 
        Logger::instance().log(Logger::Level::INFO, "Killed JS Thread Index #"+std::to_string(index)); }, mt.done);
        request_worker_->emplace_back(std::move(mt));
    }

    bool MyV8::checkToken(std::string token)
    {
        return pulse_call_token_ == token;
    }

    std::string MyV8::getToken()
    {
        return pulse_call_token_;
    }

    void MyV8::start()
    {
        Logger::instance().log(Logger::Level::INFO, "JS engine starting...");
        running_.store(true);

        cleaner_ = std::jthread([&]
                                {
                                    while (running_.load())
                                    {
                                        for (auto it = request_worker_->begin(); it != request_worker_->end();)
                                        {
                                            if (it->done->load())
                                            {
                                                it = request_worker_->erase(it);
                                            }
                                            else
                                            {
                                                ++it;
                                            }
                                        }
                                        std::this_thread::sleep_for(std::chrono::seconds(1));
                                    }
                                    for(auto it = request_worker_->begin(); it != request_worker_->end(); ++it)
                                    {
                                        request_queue_.Produce(nullptr);
                                    }
                                    std::this_thread::sleep_for(std::chrono::seconds(1));
                                    for (auto it = request_worker_->begin(); it != request_worker_->end();)
                                    {
                                        it = request_worker_->erase(it);
                                    }

                                    for (auto it = queue_consumer_->begin(); it != queue_consumer_->end();)
                                    {
                                        it = queue_consumer_->erase(it);
                                    }
                                });

        for (int i = 0; i < 5; ++i)
        {
            queue_consumer_->emplace_back(std::jthread([&]
                                                       {
                std::unique_ptr<QueueData> item;
                while ( queue_.ConsumeSync(item))
                {
                    if(!running_.load())
                    {
                        queue_.Produce(std::move(item));
                        break;
                    }
                    if (item == nullptr)
                        continue;
                    auto it = queue_key_consumer_->find(item->key);
                    if (it != queue_key_consumer_->end())
                    {
                        try
                        {
                            auto timeout = std::chrono::milliseconds(item->timeout);
                            std::unique_ptr<JsRequestData> req = std::make_unique<JsRequestData>(timeout);
                            std::string name = it->second;
                            req->function_name = std::make_unique<std::string>(std::move(name));
                            req->request = std::make_unique<std::string>(item->request);
                            req->url = std::make_unique<std::string>(item->url);
                            req->headers = std::make_unique<std::string>(item->headers);
                            req->method = std::make_unique<std::string>(item->method);
                            std::future<std::string> future = req->response.get_future();
                            request_queue_.Produce(std::move(req));
                            auto status = future.wait_for(timeout);
                            std::string response;
                            if (status == std::future_status::ready)
                            {
                                response = future.get();
                                rapidjson::Document doc;
                                doc.Parse(response.c_str());

                                if (doc.HasParseError())
                                {
                                    throw std::runtime_error("Wrong Response format");
                                }
                                if (doc.HasMember("error_desc") && doc["error_desc"].IsString())
                                {
                                    throw std::runtime_error(std::string(doc["error_desc"].GetString()).c_str());
                                }
                            }
                            else
                            {
                                throw std::runtime_error("Error (Timeout occurred)");
                            }
                        }
                        catch (const std::exception &e)
                        {
                            std::string error = "Queue Consumer #" + item->key + " Error: " + std::string(e.what());
                            Logger::instance().log(Logger::Level::ERROR, error);
                        }
                        catch (...)
                        {
                            std::string error = "Scheduler #" + item->key + " Error: ";
                            Logger::instance().log(Logger::Level::ERROR, error);
                        }
                    }
                } }));
        }

        uuid_t uuidObject;
        uuid_generate(uuidObject);
        char uuidChar[37];
        uuid_unparse(uuidObject, uuidChar);
        pulse_call_token_ = std::string(uuidChar);

        for (int i = 0; i < 2; i++)
        {
            addNewRequestWorker();
        }
        // std::this_thread::sleep_for(std::chrono::seconds(1));
        Logger::instance().log(Logger::Level::INFO, "Scrip processor started successfully");
    }

    void MyV8::stop()
    {
        thread_index_.store(0);
        running_.store(false);
        for (auto it = reinit_flg_->begin(); it != reinit_flg_->end(); it++)
        {
            request_queue_.Produce(nullptr);
        }
        Logger::instance().log(Logger::Level::INFO, "Scrip processor server stopped");
    }
    void MyV8::reinit()
    {
        Logger::instance().log(Logger::Level::INFO, "Reinit Functions...");
        for (auto it = reinit_flg_->begin(); it != reinit_flg_->end(); it++)
        {
            it->second = true;
        }
        /*for (auto it = reinit_flg_->begin(); it != reinit_flg_->end(); it++)
        {
            request_queue_.Produce(nullptr);
        }*/
    }

    void MyV8::restart()
    {
        stop();
        std::this_thread::sleep_for(std::chrono::milliseconds(1000));
        start();
    }

    void MyV8::addApiFunction(uint32_t inboundId, uint32_t id, const std::string &source)
    {
        std::string name = "api_" + std::to_string(id);
        // std::string path = "./api/";
        auto it = functions_->find(name);
        if (it != functions_->end())
        {
            functions_->erase(it);
        }
        // CreateFile_(path, std::to_string(id) + ".js", source);
        std::string tmpSource = "function " + name + "(request,url,request_headers,method){\nlet inbound=" + std::to_string(inboundId) + ";\n let api=" + std::to_string(id) + ";\nlet response=null;\nlet headers=[];\ntry{\n";
        tmpSource += source;
        tmpSource += "\n if (typeof response === 'string') {return JSON.stringify({headers,response});} \nelse\n {return JSON.stringify({headers,response:JSON.stringify(response)});}\n}\ncatch(e){ Log(`" + name + ":${e}`);\nreturn JSON.stringify({headers,error_code:-1,error_desc:`${e}`});}\n};";
        functions_->emplace(name, tmpSource);
    }

    void MyV8::removeApiFunction(uint32_t id)
    {
        std::string name = "api_" + std::to_string(id);
        auto it = functions_->find(name);
        if (it != functions_->end())
        {
            /*std::string path = "./api/";
            RemoveFile_(path, std::to_string(id) + ".js");*/
            functions_->erase(it);
        }
    }

    void MyV8::addHandlerFunction(const std::string &name, const std::string &source)
    {
        // std::string path = "./js/";
        auto it = functions_->find(name);
        if (it != functions_->end())
        {
            functions_->erase(it);
        }
        // CreateFile_(path, name + ".js", source);
        std::string tmpSource = "function " + name + "(request,url,request_headers,method){\n let response=null;\nlet headers=[];\ntry{\n";
        tmpSource += source;
        tmpSource += "\n if (typeof response === 'string') {return JSON.stringify({headers,response});} \nelse\n {return JSON.stringify({headers,response:JSON.stringify(response)});}\n}\ncatch(e){ Log(`" + name + ":${e}`);\nreturn JSON.stringify({headers,error_code:-1,error_desc:`${e}`});}\n};";
        functions_->emplace(name, tmpSource);
    }

    void MyV8::removeHandlerFunction(const std::string &name)
    {
        auto it = functions_->find(name);
        if (it != functions_->end())
        {
            // std::string path = "./js/";
            // RemoveFile_(path, name + ".js");
            functions_->erase(it);
        }
    }

    void MyV8::addFunction(const std::string &name, const std::string &source)
    {
        /*std::string path = "./js/";
        CreateFile_(path, name + ".js", source);*/
        removeFunction(name);
        functions_->emplace(name, source);
    }

    void MyV8::removeFunction(const std::string &name)
    {
        auto it = functions_->find(name);
        if (it != functions_->end())
        {
            /*std::string path = "./js/";
            RemoveFile_(path, name + ".js");*/
            functions_->erase(it);
        }
    }

    void MyV8::produce(std::unique_ptr<JsRequestData> req)
    {
        pmetrics::enqueue(pmetrics::POOL_JS);
        request_queue_.Produce(std::move(req));
    }

    void MyV8::setContextValue(std::string key, std::string value)
    {
        auto it = context_data_->find(key);
        if (it == context_data_->end())
        {
            context_data_->emplace(key, value);
        }
        else
        {
            it->second = value;
        }
    }

    std::string MyV8::getContextValue(std::string key)
    {
        auto it = context_data_->find(key);
        if (it != context_data_->end())
        {
            return it->second;
        }
        return "";
    }

    MyV8::MyV8()
    {
        std::string icuPath = "./icudt78b.dat";
        Logger::instance().log(Logger::Level::INFO, "initializing ICU...");
        if (!v8::V8::InitializeICUDefaultLocation(icuPath.c_str()))
        {
            Logger::instance().log(Logger::Level::ERROR, "Failed to initialize ICU");
        }
        v8::V8::InitializeExternalStartupData(icuPath.c_str());

        platform_ = v8::platform::NewDefaultPlatform();
        v8::V8::InitializePlatform(platform_.get());
        v8::V8::Initialize();
        request_queue_.SetTimeout(QUEUET_TIMEOUT);
    };
    MyV8::~MyV8()
    {
        stop();
    };

    v8::Global<v8::Function> MyV8::compileFunction(
        const char *function_name,
        const char *source_code,
        v8::Isolate *isolate,
        v8::Local<v8::Context> context)
    {
        v8::Global<v8::Function> fn;
        v8::HandleScope handle_scope(isolate);
        v8::TryCatch try_catch(isolate);

        v8::Local<v8::String> source =
            v8::String::NewFromUtf8(isolate, source_code).ToLocalChecked();

        v8::Local<v8::Script> script;
        if (!v8::Script::Compile(context, source).ToLocal(&script))
        {
            throw std::runtime_error("JS compile error");
        }

        if (script->Run(context).IsEmpty())
        {
            v8::String::Utf8Value err(isolate, try_catch.Exception());
            throw std::runtime_error(*err);
        }

        v8::Local<v8::Value> fn_val;
        if (!context->Global()->Get(
                                  context,
                                  v8::String::NewFromUtf8(isolate, function_name).ToLocalChecked())
                 .ToLocal(&fn_val) ||
            !fn_val->IsFunction())
        {
            throw std::runtime_error(std::string(std::string(function_name) + " is not a function").c_str());
        }

        fn.Reset(isolate, fn_val.As<v8::Function>());
        return std::move(fn);
    }

    void MyV8::InterruptCallback(v8::Isolate *isolate, void *data)
    {
        auto *deadline = static_cast<std::chrono::steady_clock::time_point *>(data);

        if (std::chrono::steady_clock::now() > *deadline)
        {
            isolate->TerminateExecution();
        }
    }

    void MyV8::startInterruptTimer(
        v8::Isolate *isolate,
        std::chrono::steady_clock::time_point *deadline,
        std::atomic<bool> &finished)
    {
        std::thread([=, &finished]()
                    {
                while (!finished.load()) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(5));
                    isolate->RequestInterrupt(InterruptCallback, deadline);
                } })
            .detach();
    }

    Scheduler &Scheduler::getInstance()
    {
        static Scheduler instance;
        return instance;
    }

    Scheduler::Scheduler() {}
    Scheduler::~Scheduler() {}
    void Scheduler::stop()
    {
        for (auto it = scheduler_info->begin(); it != scheduler_info->end(); ++it)
        {
            it->second->running.store(false);
        }
        // std::this_thread::sleep_for(std::chrono::seconds(3));
        running_.store(false);
        Logger::instance().log(Logger::Level::INFO, "Scheduler workers stopped");
    }

    void Scheduler::start()
    {
        Logger::instance().log(Logger::Level::INFO, "Scheduler starting...");
        running_.store(true);
        cleaner_ = std::jthread([&]
                                {
            while(running_.load())
            {
                for (auto it = schedulers->begin(); it != schedulers->end(); ) 
                {
                    if (it->done->load()) {
                        it = schedulers->erase(it);
                    } else {
                        ++it;
                    }
                }
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
            for (auto it = schedulers->begin(); it != schedulers->end(); ) 
            {
                it = schedulers->erase(it);
            } });
        Logger::instance().log(Logger::Level::INFO, "Scheduler started.");
    }

    uint32_t Scheduler::startScheduler(SchedulerInfo &info)
    {
        uint32_t id = 0;
        {
            std::lock_guard<std::mutex> lock(id_mutex_);
            last_id_++;
            id = last_id_.load();
            info.id = id;
        }
        if (id <= 0)
            throw std::runtime_error("id is not valid");
        if (scheduler_info->size() > max_scheduler_.load())
        {
            Logger::instance().log(Logger::Level::ERROR, LICENSE_MESSAGE);
            throw std::runtime_error(LICENSE_MESSAGE);
        }

        info.id = id;

        std::shared_ptr<SchedulerInfo> schedulerInfo = std::make_shared<SchedulerInfo>(info);
        scheduler_info->emplace(id, schedulerInfo);
        std::string name = "scheduler_" + std::to_string(id);
        MyV8::getInstance().addHandlerFunction(name, schedulerInfo->source);
        MyV8::getInstance().reinit();
        ManagedThread mt;
        mt.thread = std::jthread([&, id, schedulerInfo](std::shared_ptr<std::atomic<bool>> done)
                                 {
        auto next = std::chrono::steady_clock::now();
        schedulerInfo->running.store(true);
        Context::getInstance().setData("SCHEDULER_"+std::to_string(id),"1");
        while (schedulerInfo->running.load())
        {
            next += std::chrono::milliseconds(schedulerInfo->interval.load());
            try
            {
                pmetrics::enqueue(pmetrics::POOL_SCHED);
                pmetrics::Scope _ms(pmetrics::POOL_SCHED);
                auto timeout = std::chrono::milliseconds(schedulerInfo->timeout.load());
                std::unique_ptr<JsRequestData> req=std::make_unique<JsRequestData>(timeout);
                std::string name = "scheduler_" + std::to_string(id);
                req->function_name=std::make_unique<std::string>(std::move(name));
                req->request=std::make_unique<std::string>("{}");
                req->url=std::make_unique<std::string>("/");
                req->headers=std::make_unique<std::string>("");
                req->method=std::make_unique<std::string>("");
                std::future<std::string> future = req->response.get_future();
                MyV8::getInstance().produce(std::move(req));
                auto status = future.wait_for(timeout); 
                std::string response;   
                if (status == std::future_status::ready) {
                    response = future.get();
                    rapidjson::Document doc;
                    doc.Parse(response.c_str());

                    if (doc.HasParseError())
                    {
                        throw std::runtime_error("Wrong Response format");
                    }
                    if(doc.HasMember("error_desc") && doc["error_desc"].IsString())
                    {
                        throw std::runtime_error(std::string(doc["error_desc"].GetString()).c_str());
                    }
                }
                else {
                    throw std::runtime_error("Error (Timeout occurred)");
                }
            }
            catch (const std::exception &e)
            {
                std::string error = "Scheduler #"+std::to_string(id)+" Error: " +std::string(e.what()); 
                Logger::instance().log(Logger::Level::ERROR, error);
            }
            catch (...)
            {
                std::string error = "Scheduler #"+std::to_string(id)+" Error: "; 
                Logger::instance().log(Logger::Level::ERROR, error);
            }

            std::this_thread::sleep_until(next);
            next = std::chrono::steady_clock::now();
        } 
        done->store(true); }, mt.done);
        schedulers->emplace_back(std::move(mt));
        return id;
    }

    void Scheduler::changeInterval(uint32_t id, uint32_t interval)
    {
        auto it = scheduler_info->find(id);
        if (it != scheduler_info->end())
        {
            it->second->interval.store(interval);
        }
    }

    void Scheduler::removeScheduler(uint32_t id)
    {
        auto it = scheduler_info->find(id);
        if (it != scheduler_info->end())
        {
            it->second->running.store(false);
            scheduler_info->erase(it);
        }
        Context::getInstance().setData("SCHEDULER_" + std::to_string(id), "0");
        std::string name = "scheduler_" + std::to_string(id);
        MyV8::getInstance().removeHandlerFunction(name);
        MyV8::getInstance().reinit();
    }

    WebSocketClient::WebSocketClient(const std::string &url_,
                                     const std::string &token_,
                                     const std::string &callback_,
                                     uint32_t timeout_,
                                     std::unordered_map<std::string, std::string> &headers_)
        : url(url_), token(token_), callback(callback_), timeout(timeout_)
    {

        webSocket.setUrl(url);
        Logger::instance().log(Logger::Level::INFO, "callback:" + callback);
        Logger::instance().log(Logger::Level::INFO, "token:" + token);
        Logger::instance().log(Logger::Level::INFO, "timeout:" + std::to_string(timeout));

        webSocket.setOnMessageCallback(
            [this](const ix::WebSocketMessagePtr &msg)
            {
                if (msg->type == ix::WebSocketMessageType::Open)
                {
                    Logger::instance().log(Logger::Level::INFO, url + ": Protocol=> " + msg->openInfo.protocol);
                    Logger::instance().log(Logger::Level::INFO, url + ": Connected!");
                }
                else if (msg->type == ix::WebSocketMessageType::Message)
                {
                    Logger::instance().log(Logger::Level::INFO, "callback:" + callback);
                    Logger::instance().log(Logger::Level::INFO, "token:" + token);
                    Logger::instance().log(Logger::Level::INFO, "timeout:" + std::to_string(timeout));
                    try
                    {
                        auto to = std::chrono::milliseconds(timeout);
                        std::unique_ptr<JsRequestData> req = std::make_unique<JsRequestData>(to);
                        req->function_name = std::make_unique<std::string>(callback);
                        req->request = std::make_unique<std::string>(msg->str);
                        req->url = std::make_unique<std::string>(token);
                        req->headers = std::make_unique<std::string>("");
                        req->method = std::make_unique<std::string>("");
                        std::future<std::string> future = req->response.get_future();
                        MyV8::getInstance().produce(std::move(req));
                        auto status = future.wait_for(to);
                        std::string response;
                        if (status == std::future_status::ready)
                        {
                            response = future.get();
                            rapidjson::Document doc;
                            doc.Parse(response.c_str());

                            if (doc.HasParseError())
                            {
                                throw std::runtime_error("Wrong Response format");
                            }
                            if (doc.HasMember("error_desc") && doc["error_desc"].IsString())
                            {
                                throw std::runtime_error(std::string(doc["error_desc"].GetString()).c_str());
                            }
                        }
                        else
                        {
                            throw std::runtime_error("Error (Timeout occurred)");
                        }
                    }
                    catch (const std::exception &e)
                    {
                        Logger::instance().log(Logger::Level::INFO, "message:" + msg->str);
                        std::string error = "Callback " + url + " Error: " + std::string(e.what());
                        Logger::instance().log(Logger::Level::ERROR, error);
                    }
                    catch (...)
                    {
                        Logger::instance().log(Logger::Level::INFO, "message:" + msg->str);
                        std::string error = "Callback " + url + " Error: Unknown";
                        Logger::instance().log(Logger::Level::ERROR, error);
                    }
                }
                else if (msg->type == ix::WebSocketMessageType::Close)
                {
                    Logger::instance().log(Logger::Level::INFO, url + ": Connection closed");
                }
                else if (msg->type == ix::WebSocketMessageType::Error)
                {
                    Logger::instance().log(Logger::Level::ERROR, url + ":" + msg->errorInfo.reason);
                }
            });

        Logger::instance().log(Logger::Level::INFO, url + ": Set WebSocket headers...");
        ix::WebSocketHttpHeaders headers;
        for (auto &header : headers_)
        {
            headers[header.first.c_str()] = header.second;
        }
        webSocket.setExtraHeaders(headers);
        webSocket.enableAutomaticReconnection();
        webSocket.setPingInterval(45);
        Logger::instance().log(Logger::Level::INFO, url + ": Ready.");
    }

    void WebSocketClient::start()
    {
        Logger::instance().log(Logger::Level::INFO, url + ": Starting WebSocket...");
        webSocket.start();
        Logger::instance().log(Logger::Level::INFO, url + ": Started.");
    }

    void WebSocketClient::stop()
    {
        webSocket.stop();
        Logger::instance().log(Logger::Level::INFO, url + ": Stoped.");
    }

    void WebSocketClient::send(const std::string &message)
    {
        webSocket.send(message);
    }

    Context &Context::getInstance()
    {
        static Context instance;
        return instance;
    }

    Context::Context() {}
    Context::~Context() {}

    void Context::setData(std::string key, std::string value)
    {
        auto it = data->find(key);
        if (it == data->end())
        {
            data->emplace(key, value);
        }
        else
        {
            it->second = value;
        }
    }

    std::string Context::getData(std::string key)
    {
        auto it = data->find(key);
        if (it != data->end())
        {
            return it->second;
        }
        return "";
    }

}
