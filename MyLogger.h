#pragma once
#include <mutex>
#include <fstream>
#include <iostream>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <sys/stat.h>
#include "MyChannel.h"

class Logger {
public:
    enum class Level {
        INFO,
        WARN,
        ERROR,
        DEBUG
    };

    static Logger& instance() {
        static Logger inst;
        return inst;
    }

    void log(Level level, const std::string& msg,bool force=false) {
        auto now = std::chrono::system_clock::now();
        if(force || level==Level::DEBUG)
        {
            auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(now);
            auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now - seconds).count();
            std::time_t tt = std::chrono::system_clock::to_time_t(seconds);
            if(tt>=nextMidNigth_ || !file_.is_open())
            {
                setFile();                    
            }

            std::ostream& out = file_.is_open() ? file_ : std::cout;
            out << timestamp(tt)<<"."<< std::setw(3) << std::setfill('0') << ms
                << " [" << levelToStr(level) << "] "
                << msg
                << std::endl;
        }
        else
        {
            std::tuple<std::chrono::_V2::system_clock::time_point,Level,std::string> m(now, level, msg);
            log_queue_.Produce(std::move(m));    
        }    
    }

    void setFile(const std::string& path="",const std::string& mainFile="") {
        std::lock_guard<std::mutex> lock(mutex_);
        if(file_.is_open()) file_.close();
        std::string path_ = path;   

        if(path_.length()>0)
            mainPath_ = path_;
        else
            path_ = mainPath_;
        
        if(mainFile.length()>0)
            mainFile_ = mainFile;
        

        if (path_.back() != '/')
            path_ += "/";
        std::filesystem::create_directories(path_);
        std::filesystem::permissions(
            path_,
            std::filesystem::perms::owner_all | std::filesystem::perms::group_all | std::filesystem::perms::others_all,
            std::filesystem::perm_options::add);
        struct stat statbuf;
        int isDir = 0;
        if (stat(path_.c_str(), &statbuf) == -1 || !S_ISDIR(statbuf.st_mode))
        {
            const int dir_err = mkdir(path_.c_str(), 667);
            if (-1 == dir_err)
            {
                std::stringstream strTemp;
                strTemp << "Error in Creating " << path_ << " Directory";
                throw std::runtime_error(strTemp.str().c_str());
            }
        }

        auto now = std::chrono::system_clock::now();
        auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(now);
        std::time_t t = std::chrono::system_clock::to_time_t(seconds);
        path_+=mainFile_+"_"+timestamp(t,false)+".log";
        
        std::tm tm{};
        localtime_r(&t, &tm);
        tm.tm_hour = 0;
        tm.tm_min = 0;
        tm.tm_sec = 0;
        nextMidNigth_ = mktime(&tm);
        nextMidNigth_ += 24 * 60 * 60;   
        
        file_.open(path_, std::ios::app);
    }

private:
    Logger() 
    {
        worker_ = std::thread([&]()
        {
            std::tuple<std::chrono::_V2::system_clock::time_point,Level,std::string> req;
            while(log_queue_.ConsumeSync(req))
            {
                auto seconds = std::chrono::time_point_cast<std::chrono::seconds>(std::get<0>(req));
                auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::get<0>(req) - seconds).count();
                std::time_t tt = std::chrono::system_clock::to_time_t(seconds);
                if(tt>=nextMidNigth_ || !file_.is_open())
                {
                    setFile();                    
                }

                std::ostream& out = file_.is_open() ? file_ : std::cout;
                out << timestamp(tt)<<"."<< std::setw(3) << std::setfill('0') << ms
                    << " [" << levelToStr(std::get<1>(req)) << "] "
                    << std::get<2>(req)
                    << std::endl;
            }
        });
    };
    ~Logger() {
        if (file_.is_open()) file_.close();
    }

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;

    std::string timestamp(std::time_t t ,bool withTime=true) {
        
        char buf[32];
        std::strftime(buf, sizeof(buf), (withTime?"%Y-%m-%d %H:%M:%S":"%Y-%m-%d"), std::localtime(&t));
        return buf;
    }

    const char* levelToStr(Level l) {
        switch (l) {
            case Level::INFO:  return "INFO";
            case Level::WARN:  return "WARN";
            case Level::ERROR: return "ERROR";
            case Level::DEBUG: return "DEBUG";
        }
        return "UNK";
    }

    SafeQueue<std::tuple<std::chrono::_V2::system_clock::time_point,Level,std::string>> log_queue_;
    std::mutex mutex_;
    std::thread worker_;
    std::ofstream file_;
    std::time_t nextMidNigth_;
    std::string mainPath_;
    std::string mainFile_;
};