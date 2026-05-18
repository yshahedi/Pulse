#ifndef _STRING_TOOLS_HPP_
#define _STRING_TOOLS_HPP_

#include <cstdint>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <iostream>
#include <iterator>
#include <set>
#include <cmath>
#include <sstream> // std::stringstream
#include <codecvt>
#include <locale>
#include <regex>

#define SAFE_STRING(str) str.erase(std::remove(str.begin(), str.end(), '\r'), str.end());

static inline std::string hashCode(std::string utf8, std::string postfix = "A")
{
     std::u16string input = std::wstring_convert<
                               std::codecvt_utf8_utf16<char16_t>, char16_t>{}
                               .from_bytes(utf8);
    int32_t hash = 0;

    if (input.length() == 0)
        return "";
    for (int i = 0; i < input.length(); i++)
    {
        int32_t chr = input[i];
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    std::stringstream ss;
    ss << std::hex << abs(hash); // int decimal_value
    std::string res(ss.str());

    return postfix + res;
}

static inline bool isSQLInjection(const std::string& userInput) {
        std::regex sqlInjectionPattern(
            R"((;|\btruncate\b|--|\bselect\b|\bunion\b|\bdrop\b|\bdelete\b|\binsert\b|\bupdate\b|\bexec\b|\bexecute\b|\/\*|\*\/))",
            std::regex_constants::icase);

        if (std::regex_search(userInput, sqlInjectionPattern)) {
            return true; 
        }
        return false; 
    }

static inline void ltrim(std::string &s)
{
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](int ch) { return !std::isspace(ch); }));
}

static inline void rtrim(std::string &s)
{
    s.erase(std::find_if(s.rbegin(), s.rend(), [](int ch) { return !std::isspace(ch); }).base(), s.end());
}

static inline void trim(std::string &s)
{
    ltrim(s);
    rtrim(s);
}

static inline std::string ltrim_copy(std::string s)
{
    ltrim(s);
    return s;
}

static inline std::string rtrim_copy(std::string s)
{
    rtrim(s);
    return s;
}

static inline std::string trim_copy(std::string s)
{
    trim(s);
    return s;
}

static inline std::string upperFirstLeter(std::string const &s)
{
    if (s.empty())
        return s;

    std::string str = s;
    str[0] = toupper(str[0]);
    return str;
}
static inline std::string lowerFirstLeter(std::string const &s)
{
    if (s.empty())
        return s;

    std::string str = s;
    str[0] = std::tolower(str[0]);
    return str;
}
static inline bool endsWith(std::string const &value, std::string const &ending)
{
    if (ending.size() > value.size())
        return false;
    return std::equal(ending.rbegin(), ending.rend(), value.rbegin());
}

static void eraseSubStr(std::string &mainStr, const std::string &toErase)
{
    size_t pos = mainStr.find(toErase);

    if (pos != std::string::npos) {
        mainStr.erase(pos, toErase.length());
    }
}

static bool hasEnding(std::string const &fullString, std::string const &ending)
{
    if (fullString.length() >= ending.length()) {
        return (0 == fullString.compare(fullString.length() - ending.length(), ending.length(), ending));
    } else {
        return false;
    }
}

static bool startingWith(std::string const &fullString, std::string const &starting)
{
    return (fullString.rfind(starting, 0) == 0);
}

static std::string replaceSubStringCopy(const std::string &source, const std::string &from, const std::string &to)
{
    std::string str(source);
    if (from.empty())
        return str;
    size_t start_pos = 0;
    while ((start_pos = str.find(from, start_pos)) != std::string::npos) {
        str.replace(start_pos, from.length(), to);
        start_pos += to.length();
    }
    return str;
}

static void replaceSubString(std::string &source, const std::string &from, const std::string &to)
{
    if (from.empty())
        return;
    size_t start_pos = 0;
    while ((start_pos = source.find(from, start_pos)) != std::string::npos) {
        source.replace(start_pos, from.length(), to);
        start_pos += to.length();
    }
    return;
}

static std::string removeSubstring(std::string const &str, std::string const &subString)
{
    std::string ret = str;
    size_t pos = ret.find(subString);

    if (pos != std::string::npos) {
        ret.erase(pos, subString.length());
    }
    return ret;
}

static std::string removePostFix(std::string const &str, std::string const &subString)
{
    size_t lastindex = str.rfind(subString);
    return str.substr(0, lastindex);
}

static std::string toLower(std::string const &str)
{
    std::string ret(str);
    std::transform(ret.begin(), ret.end(), ret.begin(), [](unsigned char c) { return std::tolower(c); });
    return ret;
}

static std::string toUpper(std::string const &str)
{
    std::string ret(str);
    std::transform(ret.begin(), ret.end(), ret.begin(), [](unsigned char c) { return std::toupper(c); });
    return ret;
}

static std::string convertCamelToNormal(std::string &str)
{
    if (str.empty()) {
        return str;
    }
    std::stringstream result;
    result << (char)toupper(str[0]);

    int i = 1;
    while (i < str.length()) {

        if (str[i] >= 'A' && str[i] <= 'Z') {
            result << " " << str[i];
        }

        // Else print the current character
        else {
            result << str[i];
        }
        i++;
    }
    return result.str();
}

static std::string join(const std::vector<long int> &vec, const std::string &pDelemiter)
{
    std::ostringstream oss;

    if (!vec.empty()) {
        std::copy(vec.begin(), vec.end() - 1, std::ostream_iterator<int>(oss, pDelemiter.c_str()));

        oss << vec.back();
    }
    return oss.str();
}

template <typename T>
    static std::string joinVector(const std::vector<T>& elements, const std::string& delimiter) {
        std::ostringstream oss;
        for (size_t i = 0; i < elements.size(); ++i) {
            oss << elements[i];
            if (i < elements.size() - 1) {
                oss << delimiter;
            }
        }
        return oss.str();
    }

static std::string join(const std::vector<uint32_t> &vec, const std::string &pDelemiter)
{
    std::ostringstream oss;

    if (!vec.empty()) {
        std::copy(vec.begin(), vec.end() - 1, std::ostream_iterator<int>(oss, pDelemiter.c_str()));

        oss << vec.back();
    }
    return oss.str();
}

static std::string join(const std::set<long int> &vec, const std::string &pDelemiter)
{
    std::ostringstream oss;

    bool first = true;
    for(auto &v:vec)
    {
        if(!first)  
            oss << pDelemiter;
        else
            first = false;
        oss << v;        
    }
    return oss.str();
}

static std::string join(const std::set<uint32_t> &vec, const std::string &pDelemiter)
{
    std::ostringstream oss;

    bool first = true;
    for(auto &v:vec)
    {
        if(!first)  
            oss << pDelemiter;
        else
            first = false;
        oss << v;        
    }
    return oss.str();
}

static std::vector<std::string> splitString(const std::string &pInputString, char pDelemiter)
{
    std::vector<std::string> result;
    std::stringstream ss(pInputString);
    std::string substr;
    while (std::getline(ss, substr, pDelemiter)) {
        result.push_back(substr);
    }
    return result;
}

static std::set<std::string> splitSet(const std::string &pInputString, char pDelemiter)
{
    std::set<std::string> result;
    std::stringstream ss(pInputString);
    std::string substr;
    while (std::getline(ss, substr, pDelemiter)) {
        result.insert(substr);
    }
    return result;
}

static std::set<uint32_t> splitSetNumber(const std::string &pInputString, char pDelemiter)
{
    std::set<std::uint32_t> result;
    std::stringstream ss(pInputString);
    std::string substr;
    while (std::getline(ss, substr, pDelemiter)) {
        result.insert(std::stoul(substr));
    }
    return result;
}

static std::string splitJoin(const std::string &pInputString, char pSplitDelemiter,char pJoinDelemiter)
{
    std::set<std::string> result;
    std::stringstream ss(pInputString);
    std::string substr;
    while (std::getline(ss, substr, pSplitDelemiter)) {
        result.insert(substr);
    }

    std::ostringstream oss;

    bool first = true;
    for(auto &v:result)
    {
        if(!first)  
            oss << pJoinDelemiter;
        else
            first = false;
        oss << v;        
    }
    return oss.str();
}

static std::string correctPath(const std::string &pPath)
{
    std::string path = pPath;
    if (path.back() != '/')
        path = path + "/";
    return path;
}
static std::string correctWindowsPath(const std::string &pPath)
{
    std::string path = pPath;
    if (path.back() != '\\')
        path = path + "\\";
    return path;
}

#endif // _STRING_TOOLS_HPP_
