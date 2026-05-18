#ifndef MESSAGE_CLIENT_H
#define MESSAGE_CLIENT_H

#include <string>
#include <vector>
#include <memory>
#include <curl/curl.h>
#include <iostream>
#include <rapidjson/document.h>
#include <rapidjson/writer.h>
#include <rapidjson/stringbuffer.h>

struct Message {
    std::string role;      // "system", "user", "assistant"
    std::string content;

    Message(const std::string& r, const std::string& c)
        : role(r), content(c) {}

    void to_json(rapidjson::Value &obj,rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("role", rapidjson::Value(role.c_str(), allocator), allocator);
        obj.AddMember("content", rapidjson::Value(content.c_str(), allocator), allocator);

        return;
    }
};

struct ChatResponse {
    std::string content;
    std::string model;
    std::string finish_reason;
    int total_tokens;
    bool success;
    std::string error_message;

    ChatResponse() : total_tokens(0), success(false) {}
};

 static size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* output) {
        size_t total_size = size * nmemb;
        output->append((char*)contents, total_size);
        return total_size;
    }


static std::string buildRequestJson(const std::vector<Message>& messages,const std::string &model_,double temperature_,int max_tokens_) {
        rapidjson::Document doc(rapidjson::kObjectType);
        rapidjson::Document::AllocatorType& allocator = doc.GetAllocator();
        
        // Add model
        doc.AddMember("model", 
                      rapidjson::Value(model_.c_str(), allocator).Move(), 
                      allocator);
        
        // Add messages array
        rapidjson::Value messages_array(rapidjson::kArrayType);
        for (const auto& msg : messages) {
            rapidjson::Value msg_obj(rapidjson::kObjectType);
            msg.to_json(msg_obj, allocator);
            messages_array.PushBack(msg_obj, allocator);
        }
        doc.AddMember("messages", messages_array, allocator);
        
        // Add other parameters
        doc.AddMember("temperature", temperature_, allocator);
        doc.AddMember("max_tokens", max_tokens_, allocator);
        doc.AddMember("stream", false, allocator);
        
        // Convert to string
        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        doc.Accept(writer);
        
        return std::string(buffer.GetString(), buffer.GetSize());
    }
    

static ChatResponse parseResponse(const std::string& response_str) {
        ChatResponse response;
        
        rapidjson::Document doc;
        doc.Parse(response_str.c_str());
        
        if (doc.HasParseError()) {
            response.error_message = "JSON parse error: " + std::to_string(doc.GetParseError()) +
                                    " at offset " + std::to_string(doc.GetErrorOffset());
            response.success = false;
            return response;
        }
        
        // Check for errors first
        if (doc.HasMember("error") && doc["error"].IsObject()) {
            const rapidjson::Value& error = doc["error"];
            if (error.HasMember("message") && error["message"].IsString()) {
                response.error_message = error["message"].GetString();
            }
            response.success = false;
            return response;
        }
        
        // Check for choices
        if (doc.HasMember("choices") && doc["choices"].IsArray() && !doc["choices"].Empty()) {
            const rapidjson::Value& choices = doc["choices"];
            const rapidjson::Value& first_choice = choices[0];
            
            if (first_choice.HasMember("message") && 
                first_choice["message"].IsObject() &&
                first_choice["message"].HasMember("content") &&
                first_choice["message"]["content"].IsString()) {
                response.content = first_choice["message"]["content"].GetString();
            }
            
            if (doc.HasMember("model") && doc["model"].IsString()) {
                response.model = doc["model"].GetString();
            }
            
            if (first_choice.HasMember("finish_reason") && 
                first_choice["finish_reason"].IsString()) {
                response.finish_reason = first_choice["finish_reason"].GetString();
            }
            
            if (doc.HasMember("usage") && doc["usage"].IsObject()) {
                const rapidjson::Value& usage = doc["usage"];
                if (usage.HasMember("total_tokens") && usage["total_tokens"].IsInt()) {
                    response.total_tokens = usage["total_tokens"].GetInt();
                }
            }
            
            response.success = true;
        } else {
            response.error_message = "No valid choices in response";
            response.success = false;
        }
        
        return response;
    }

#endif // MESSAGE_CLIENT_H
