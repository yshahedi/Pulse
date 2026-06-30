#include "pulse.h"
//#include "deepseek.h"
//#include "gpt.h"
#include <iostream>
#include <memory>
#include <unistd.h>
#include <sys/stat.h>
#include <sys/prctl.h>
#include <sys/types.h>
#include <fcntl.h>
#include <cstdlib>
#include <signal.h>
#include "MyLogger.h"
#include "MyEncryption.h"
#include "MyString.h"
#include <fstream>
#include <sstream>
//#include "switch.h"

uint32_t maxServerId = 0;
std::string lockFileName = "";


static void sigHandler(int s)
{
    if (s == SIGINT || s == SIGTERM)
    {
        Logger::instance().log(Logger::Level::INFO, "Shuting down ...");
        PULSE::Inbound::getInstance().stopAll();
        PULSE::Outbound::getInstance().stop();
        PULSE::MyV8::getInstance().stop();
        PULSE::Scheduler::getInstance().stop();
        std::this_thread::sleep_for(std::chrono::seconds(5));
        std::filesystem::remove(lockFileName);
        Logger::instance().log(Logger::Level::INFO, "Bye.");
        std::this_thread::sleep_for(std::chrono::seconds(1));
        exit(0);
    }
    else if (s == 10)
    {
        PULSE::Scheduler::getInstance().stop();
        PULSE::Outbound::getInstance().stop();
        PULSE::Inbound::getInstance().stopAll();
        std::this_thread::sleep_for(std::chrono::seconds(1));
        PULSE::Outbound::getInstance().start();
        PULSE::Run();
        PULSE::Scheduler::getInstance().start();
    }
}

static void daemonize(std::string lockFile)
{
    int i, lfp;
    char str[10];
    if (getppid() == 1)
        return;
    i = fork();
    if (i < 0)
        exit(1);
    if (i > 0)
        exit(0);

    std::string processName = "Pulse_" + lockFile;
    prctl(PR_SET_NAME, processName.c_str());
    setsid();
    lockFileName = lockFile + ".lock";
    lfp = open(lockFileName.c_str(), O_RDWR | O_CREAT, 0640);
    if (lfp < 0)
    {
        std::cerr << "Can Not Open Process File" << std::endl;
        exit(1);
    }
    if (lockf(lfp, F_TLOCK, 0) < 0)
    {
        std::cerr << "Can Not Run Again. Process File is Lock!" << std::endl;
        exit(0);
    }

    snprintf(str, sizeof(str), "%d\n", getpid());
    write(lfp, str, strlen(str)); /* record pid to lockfile */
    signal(SIGCHLD, SIG_IGN);     /* ignore child */
    signal(SIGTSTP, SIG_IGN);     /* ignore tty signals */
    signal(SIGTTOU, SIG_IGN);
    signal(SIGTTIN, SIG_IGN);
    signal(SIGHUP, sigHandler);  /* catch hangup signal */
    signal(SIGTERM, sigHandler); /* catch kill signal */
    signal(SIGINT, sigHandler);  /* catch kill signal */
    signal(10, sigHandler);
}

int main(int argc, char *argv[])
{


    if (argc < 2)
    {
        std::cout << "Error: Command not specified" << std::endl;
        return 1;
    }
    if (argc < 3)
    {
        std::cout << "Error: js filename not specified" << std::endl;
        return 1;
    }
    std::string file = argv[2];
    file = removePostFix(file, ".js");
    if (std::string(argv[1]) == "stop" || std::string(argv[1]) == "reload")
    {
        std::string processName = "Pulse_" + file;
        std::string command = "pgrep '" + processName + "'";

        FILE *pipe = popen(command.c_str(), "r");
        if (!pipe)
        {
            perror("popen");
            return 1;
        }

        char buffer[128];
        std::string result = "";
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr)
        {
            auto pid = atoi(buffer);
            if (pid > 0)
            {
                if (std::string(argv[1]) == "stop")
                    kill(pid, SIGINT);
                else if (std::string(argv[1]) == "reload")
                    kill(pid, 10);
            }
        }

        pclose(pipe);
        return 0;
    }
    else if (std::string(argv[1]) == "run" || std::string(argv[1]) == "start")
    {
        daemonize(file);
        Logger::instance().setFile("./log", file);
        Logger::instance().log(Logger::Level::INFO, "Logger Started");
        try
        {
            Logger::instance().log(Logger::Level::INFO, "Load System Functions ...");
            PULSE::MyV8::getInstance().addFunction("Serv", R"(
        function Serv(action,data){
            let r = Serve(action,JSON.stringify(data));
            Log(r);
            if(Number(r)) return Number(r);
            else return r;
        }
        )");
            Logger::instance().log(Logger::Level::INFO, "Load " + std::string(argv[2]) + " ...");
            std::string source = PULSE::ReadFile(argv[2]);
            Logger::instance().log(Logger::Level::INFO, "Compiling ...");
            PULSE::MyV8::getInstance().addHandlerFunction("main", source);
            Logger::instance().log(Logger::Level::INFO, "Start V8 Engine ...");
            PULSE::MyV8::getInstance().start();
            Logger::instance().log(Logger::Level::INFO, "Start Outbounds Services ...");
            PULSE::Outbound::getInstance().start();
            Logger::instance().log(Logger::Level::INFO, "Start Scheduler ...");
            PULSE::Scheduler::getInstance().start();
            std::this_thread::sleep_for(std::chrono::seconds(1));
            PULSE::Run(argv[2]);


            while (true)
            {
                std::this_thread::sleep_for(std::chrono::seconds(2));
            }
        }
        catch (std::exception &e)
        {
            std::string error = "Fatal Error:";
            error+=e.what();
            Logger::instance().log(Logger::Level::ERROR, error);
        }
        catch (...)
        {
            Logger::instance().log(Logger::Level::ERROR, "Fatal Error!");
        }
        return 0;
    }
    else
    {
        std::cout << "Error: Wrong Command!" << std::endl;
    }
}
