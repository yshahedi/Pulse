#ifndef PULSE_H
#define PULSE_H

#include <iostream>
#include <string>
#include <vector>
#include <thread>
#include <mutex>
#include <atomic>
#include <queue>
#include <future>
#include <condition_variable>
#include <memory>
#include <chrono>
#include <sstream>
#include <iomanip>
#include <openssl/ssl.h>
#include <openssl/err.h>
#include <rapidjson/document.h>
#include "safe_ptr.h"
#include "MyChannel.h"
#include "MyLogger.h"
#include "App.h"
#include <ixwebsocket/IXWebSocket.h>
#include <v8.h>
#include <libplatform/libplatform.h>
#include <curl/curl.h>
#include <filesystem>
#include <stdlib.h>
#include <rapidjson/schema.h>
#include <rapidjson/stringbuffer.h>
#include <rapidjson/writer.h>
//#include <mysqlx/xdevapi.h>
#include <sqlite3.h>

using namespace std;

namespace PULSE
{
    struct PerSocketData
    {
        uint32_t userId;
        uint32_t partyId;
        uint32_t organizationId;
        std::string token;
        std::string deviceId;
        std::string remoteAddress;
        std::string headers;
        bool isConnected;
    };

    struct QueueData
    {
        std::string key;
        std::string request="{}";
        std::string url="";
        std::string headers="[]";
        uint32_t timeout=60000;       
    };

    struct ManagedThread
    {
    public:
        std::jthread thread;
        std::shared_ptr<std::atomic<bool>> done;
        ManagedThread()
        {
            done = std::make_shared<std::atomic<bool>>(false);
        };
    };

    struct Service
    {
    public:
        uint32_t id;
        uint32_t endpoint_id;
        std::string name;
        std::string url;
        std::string content_type;
        bool check_schema;
        std::string schema;
        std::shared_ptr<rapidjson::SchemaDocument> schema_doc = nullptr;
        uint32_t method;
        uint32_t transport_protocol;
        uint32_t timeout;
        uint32_t architectural_style;
        std::map<std::string, std::string> headers;

        Service(uint32_t id_, uint32_t endpoint_id_, std::string name_, std::string url_, std::string content_type_, bool check_schema_, std::string schema_, uint32_t method_, uint32_t timeout_, uint32_t architectural_style_, uint32_t transport_protocol_)
            : id(id_), endpoint_id(endpoint_id_), name(name_), url(url_), content_type(content_type_), check_schema(check_schema_), schema(schema_), method(method_), timeout(timeout_), architectural_style(architectural_style_), transport_protocol(transport_protocol_)
        {
            AddSchemaDoc();
            if (content_type.length() == 0)
            {
                content_type = "application/json";
            }
        }
        Service(const Service &other) : id(other.id), endpoint_id(other.endpoint_id), name(other.name), url(other.url), content_type(other.content_type), check_schema(other.check_schema), schema(other.schema), method(other.method), timeout(other.timeout), architectural_style(other.architectural_style), transport_protocol(other.transport_protocol)
        {
            AddSchemaDoc();
            if (content_type.length() == 0)
            {
                content_type = "application/json";
            }
            headers.insert(other.headers.begin(), other.headers.end());
        }

        ~Service() {}

        void AddSchemaDoc()
        {
            if (check_schema)
            {
                rapidjson::Document schemaDoc;
                schemaDoc.Parse(schema.c_str());

                if (schemaDoc.HasParseError())
                {
                    Logger::instance().log(Logger::Level::ERROR, "Scham Format has error");
                    check_schema = false;
                }
                else
                {
                    schema_doc = std::make_shared<rapidjson::SchemaDocument>(schemaDoc);
                }
            }
        }
    };

    struct Api
    {
    public:
        uint32_t id;
        std::string function;
        bool check_schema;
        std::string schema;
        std::shared_ptr<rapidjson::SchemaDocument> schema_doc = nullptr;
        uint32_t method;
        uint32_t timeout;
        uint32_t architectural_style;

        Api(uint32_t id_, std::string function_, bool check_schema_, std::string schema_, uint32_t method_, uint32_t timeout_, uint32_t architectural_style_) : id(id_), function(function_), check_schema(check_schema_), schema(schema_), method(method_), timeout(timeout_), architectural_style(architectural_style_)
        {
            AddSchemaDoc();
        }
        Api(const Api &other) : id(other.id), function(other.function), check_schema(other.check_schema), schema(other.schema), method(other.method), timeout(other.timeout), architectural_style(other.architectural_style)
        {
            AddSchemaDoc();
        }

        ~Api() {}

        void AddSchemaDoc()
        {
            if (check_schema)
            {
                rapidjson::Document schemaDoc;
                schemaDoc.Parse(schema.c_str());

                if (schemaDoc.HasParseError())
                {
                    Logger::instance().log(Logger::Level::ERROR, "Scham Format has error");
                    check_schema = false;
                }
                else
                {
                    schema_doc = std::make_shared<rapidjson::SchemaDocument>(schemaDoc);
                }
            }
        }
    };

    struct Server
    {
    public:
        bool is_https;
        int port;
        std::atomic<uint32_t> max_request_worker;
        std::string cert_path;
        std::string key_path;
        uint32_t transport_protocol;
        std::atomic<int> busy;
        sf::safe_ptr<std::map<std::string, Api>> api;

        Server(bool is_https_ = false, int port_ = 8080, std::string cert_path_ = "certificate.pem", std::string key_path_ = "private_key.pem", uint32_t transport_protocol_ = 1) : is_https(is_https_), port(port_), cert_path(cert_path_), key_path(key_path_), transport_protocol(transport_protocol_)
        {
            busy.store(0);
            max_request_worker.store(std::thread::hardware_concurrency() * 2);
            if (max_request_worker.load() == 0)
                max_request_worker.store(50);
        }

        Server(const Server &other) : is_https(other.is_https), port(other.port), cert_path(other.cert_path), key_path(other.key_path), transport_protocol(other.transport_protocol)
        {
            max_request_worker.store(other.max_request_worker.load());
            busy.store(other.busy.load());
            api->clear();
            for (auto it = other.api->begin(); it != other.api->end(); it++)
            {
                api->emplace(it->first, it->second);
            }
        }

        ~Server() {}
    };

    struct SchedulerInfo
    {
    public:
        uint32_t id;
        std::atomic<uint32_t> interval;
        std::atomic<uint32_t> timeout;
        std::string source;
        std::atomic<int> running;

        SchedulerInfo(uint32_t id_, uint32_t interval_, uint32_t timeout_, std::string &source_) : id(id_), source(source_)
        {
            running.store(false);
            interval.store(interval_);
            timeout.store(timeout_);
        }

        SchedulerInfo(const SchedulerInfo &other) : id(other.id), source(other.source)
        {
            running.store(other.running.load());
            interval.store(other.interval.load());
            timeout.store(other.timeout.load());
        }

        ~SchedulerInfo() {}
    };

    struct RequestData
    {
    public:
        std::unique_ptr<std::string> url = nullptr;
        std::unique_ptr<std::string> body = nullptr;
        std::unique_ptr<std::string> token = nullptr;
        std::unique_ptr<std::string> headers;
        uWS::HttpResponse<false> *http_response = nullptr;
        uWS::HttpResponse<true> *https_response = nullptr;
        uWS::WebSocket<false, true, PerSocketData> *ws = nullptr;
        uWS::WebSocket<true, true, PerSocketData> *wss = nullptr;
        uWS::Loop *loop = nullptr;
        bool is_https = false;
        uint32_t protocol = 1; // 1: http 2:http2 3:ws
        std::chrono::steady_clock::time_point received_time;

        RequestData()
        {
            received_time = std::chrono::steady_clock::now();
        }
    };

    struct OutboundRequestData
    {
    public:
        std::unique_ptr<std::string> url = nullptr;
        std::unique_ptr<std::string> ws_token = nullptr;
        std::unique_ptr<std::string> ws_topic = nullptr;
        std::unique_ptr<std::string> callback = nullptr;
        std::unique_ptr<std::string> request = nullptr;
        std::unique_ptr<std::string> content_type = nullptr;
        std::unordered_map<std::string, std::string> headers;
        int method = 1;        // 1:post 2:get
        uint32_t protocol = 1; // 1:http1.1 2:http2 3:ws
        std::promise<std::string> response;
        std::chrono::steady_clock::time_point received_time;
        std::chrono::milliseconds time_out;
        uint32_t incomming_api_id;
        uint32_t endpoint_id;
        uint32_t endpoint_service_id;
        uint32_t service_id;
        bool is_mime = false;

        OutboundRequestData(std::chrono::milliseconds timeout = std::chrono::milliseconds(60000))
        {
            received_time = std::chrono::steady_clock::now();
            time_out = timeout;
        }
    };

    struct JsRequestData
    {
    public:
        std::unique_ptr<std::string> function_name = nullptr;
        std::unique_ptr<std::string> request = nullptr;
        std::unique_ptr<std::string> headers = nullptr;
        std::unique_ptr<std::string> url = nullptr;
        std::promise<std::string> response;
        std::chrono::steady_clock::time_point received_time;
        std::chrono::milliseconds time_out;

        JsRequestData(std::chrono::milliseconds timeout = std::chrono::milliseconds(10000))
        {
            received_time = std::chrono::steady_clock::now();
            time_out = timeout;
        }
    };

    extern void Run(std::string jsFileName="");
    //extern std::shared_ptr<mysqlx::Client> GetConnection(std::string username, std::string password, std::string host, std::string schema, int port = 33060, int poolSize = 7, int poolTimeout = 10000);
    //extern void Query(const std::string &token, const std::string &query, std::string &response);
    extern std::string ReadFile(const std::string& filePath,bool throwException=true);
    extern void CreateFile_(std::string &path, const std::string &filename, const std::string &content);
    extern void RemoveFile_(std::string &path, const std::string &filename);
    extern std::shared_ptr<std::vector<std::string>> listFiles_(const std::string &path);
    extern size_t write_cb(char *ptr, size_t size, size_t nmemb, void *userdata);
    extern const char *ToCString(const v8::String::Utf8Value &value);
    extern void Instance(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void QueueProduce(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void SetQueueConsumer(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Log(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Base64Encode(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Base64Decode(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Ls(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Execute(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void System(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void CallService(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void UUID(const v8::FunctionCallbackInfo<v8::Value> &args);
   // extern void GetQuery(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void CreateFile(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void ReadFile(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void ReadFileBase64(const v8::FunctionCallbackInfo<v8::Value> &args);
    //extern void Connect(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void GetContext(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void SetContext(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Sleep(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Time(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern void Serve(const v8::FunctionCallbackInfo<v8::Value> &args);
    extern rapidjson::Document runSqliteQuery(const std::string &db_file, const std::string &query);
    extern sqlite3 * openSqliteDB(const std::string &db_file);

    class Inbound;

    class WebSocketClient
    {
    private:
        ix::WebSocket webSocket;
        std::string url;
        std::string token;
        std::string callback;
        uint32_t timeout;

    public:
        WebSocketClient(const std::string &url_,
                        const std::string &token_,
                        const std::string &callback_,
                        uint32_t timeout_,
                        std::unordered_map<std::string, std::string> &headers_);
        void start();
        void stop();
        void send(const std::string &message);
    };

    class InboundServer
    {
    private:
        void addNewRequestWorker();
        void run_server();
        void run_ssl_server();
        uWS::App create_app();
        uWS::SSLApp create_app_ssl();
        SafeQueue<std::unique_ptr<RequestData>> request_queue_;
        sf::safe_ptr<std::vector<std::jthread>> listen_worker_;
        sf::safe_ptr<std::vector<ManagedThread>> request_worker_;
        std::jthread cleaner_;
        std::atomic<bool> running_{false};
        std::atomic<uint32_t> thread_index_{0};
        inline static std::mutex index_mutex_;
        sf::safe_ptr<std::set<struct us_listen_socket_t *>> listen_sockets_;
        Server server_;

    public:
        friend class Inbound;
        InboundServer(Server server);
        ~InboundServer();
        void start(uint32_t endpointId);
        void stop();
        void addNewApi(std::string route, Api api);
        void removeApi(uint32_t id);
        std::atomic<uint32_t> endpoit_id_;
    };

    class Inbound
    {
    public:
        Inbound(const Inbound &) = delete;
        Inbound &operator=(const Inbound &) = delete;
        static Inbound &getInstance();
        uint32_t start(Server server);
        void stop(uint32_t id);
        void stopAll();
        uint32_t addApi( uint32_t server_id, std::string route, Api api);
        uint32_t removeApi(uint32_t server_id, std::string route);
        void setLimit(uint32_t max_inbound) { max_inbound_.store(max_inbound); };

    private:
        Inbound();
        ~Inbound();
        std::atomic<uint32_t> max_inbound_{999999};
        std::atomic<uint32_t> last_server_id_{0};
        std::atomic<uint32_t> last_api_id_{0};
        sf::safe_ptr<std::map<uint32_t, std::unique_ptr<InboundServer>>> serverPool;
        inline static std::mutex id_mutex_;
    };

    class Outbound
    {
    public:
        Outbound(const Outbound &) = delete;
        Outbound &operator=(const Outbound &) = delete;
        static Outbound &getInstance();
        uint32_t addNewService(Service service);
        void removeService(uint32_t id);
        std::shared_ptr<std::string> call(uint32_t id, const std::string &request, std::shared_ptr<std::map<std::string, std::string>> headers = nullptr, const std::string &dynamicPath = "", const std::string &token = "", const std::string &callback = "", bool isMime=false);
        //std::shared_ptr<std::string> callByName(uint32_t apiId, const std::string &name, const std::string &request, std::shared_ptr<std::map<std::string, std::string>> headers = nullptr, const std::string &dynamicPath = "", const std::string &token = "", const std::string &callback = "");
        void start();
        void stop();
        void produce(std::unique_ptr<OutboundRequestData> req);
        void setLimit(uint32_t max_outbound) { max_outbound_.store(max_outbound); };
        sf::safe_ptr<std::map<std::string, std::pair<uWS::WebSocket<false, true, PerSocketData> *, uWS::WebSocket<true, true, PerSocketData> *>>> clients_;

    private:
        void addNewRequestWorker();
        Outbound();
        ~Outbound();
        std::jthread cleaner_;
        sf::safe_ptr<std::vector<ManagedThread>> request_worker_;
        sf::safe_ptr<std::map<uint32_t, Service>> services_;
        //sf::safe_ptr<std::map<std::string, uint32_t>> services_name_;
        SafeQueue<std::unique_ptr<OutboundRequestData>> request_queue_;
        sf::safe_ptr<std::map<std::string, std::shared_ptr<WebSocketClient>>> clientApps_;
        std::atomic<int> busy_{0};
        std::atomic<bool> running_{false};
        std::atomic<int> max_worker_count_;
        std::atomic<uint32_t> thread_index_{0};
        std::atomic<uint32_t> max_outbound_{999999};
        std::atomic<uint32_t> last_service_id_{0};
        inline static std::mutex index_mutex_;
        inline static std::mutex id_mutex_;
    };

    class MyV8
    {
    public:
        MyV8(const MyV8 &) = delete;
        MyV8 &operator=(const MyV8 &) = delete;

        static MyV8 &getInstance();
        void start();
        void stop();
        void restart();
        void addApiFunction(uint32_t inboundId, uint32_t id, const std::string &source);
        void removeApiFunction(uint32_t id);
        void addHandlerFunction(const std::string &name, const std::string &source);
        void removeHandlerFunction(const std::string &name);
        void addFunction(const std::string &name, const std::string &source);
        void removeFunction(const std::string &name);
        void produce(std::unique_ptr<JsRequestData> req);
        void reinit();
        bool checkToken(std::string token);
        void setContextValue(std::string key, std::string value);
        std::string getContextValue(std::string key);
        std::string getToken();
        SafeQueue<std::unique_ptr<QueueData>> queue_;
        sf::safe_ptr<std::map<std::string, std::string>> queue_key_consumer_;

        //sf::safe_ptr<std::map<std::string, std::shared_ptr<mysqlx::Client>>> connections_;

    private:
        MyV8();
        ~MyV8();
        void addNewRequestWorker();
        static v8::Global<v8::Function> compileFunction(
            const char *function_name,
            const char *source_code,
            v8::Isolate *isolate,
            v8::Local<v8::Context> context);
        static void InterruptCallback(v8::Isolate *isolate, void *data);
        static void startInterruptTimer(
            v8::Isolate *isolate,
            std::chrono::steady_clock::time_point *deadline,
            std::atomic<bool> &finished);

        std::unique_ptr<v8::Platform> platform_;
        std::jthread cleaner_;
        sf::safe_ptr<std::vector<ManagedThread>> request_worker_;
        sf::safe_ptr<std::map<std::string, std::string>> functions_;
        sf::safe_ptr<std::map<uint32_t, bool>> reinit_flg_;        
        SafeQueue<std::unique_ptr<JsRequestData>> request_queue_;
        sf::safe_ptr<std::map<std::string, std::string>> context_data_;
        sf::safe_ptr<std::vector<std::jthread>> queue_consumer_;
        std::atomic<int> busy_{0};
        std::atomic<bool> running_{false};
        std::atomic<uint32_t> thread_index_{0};
        inline static std::mutex index_mutex_;
        inline static std::string pulse_call_token_;
    };

    class Scheduler
    {
    public:
        Scheduler(const Scheduler &) = delete;
        Scheduler &operator=(const Scheduler &) = delete;

        static Scheduler &getInstance();
        void stop();
        void start();
        uint32_t startScheduler(SchedulerInfo &info);
        void changeInterval(uint32_t id, uint32_t interval);
        void removeScheduler(uint32_t id);
        void setLimit(uint32_t max_scheduler) { max_scheduler_.store(max_scheduler); };

    private:
        Scheduler();
        ~Scheduler();
        std::jthread cleaner_;
        std::atomic<bool> running_{false};
        std::atomic<uint32_t> last_id_{0};
        std::atomic<uint32_t> max_scheduler_{999999};
        inline static std::mutex id_mutex_;
        sf::safe_ptr<std::vector<ManagedThread>> schedulers;
        sf::safe_ptr<std::map<uint32_t, std::shared_ptr<SchedulerInfo>>> scheduler_info;
    };

    class Context
    {
    public:
        Context(const Context &) = delete;
        Context &operator=(const Context &) = delete;
        void setData(std::string key, std::string value);
        std::string getData(std::string key);
        static Context &getInstance();
       

    private:
        Context();
        ~Context();
        sf::safe_ptr<std::map<std::string, std::string>> data;
    };

}

#endif // PULSE_H
