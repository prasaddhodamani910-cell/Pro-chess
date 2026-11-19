#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <thread>
#include <vector>
#include <filesystem>
#include <atomic>
#include "gui_embedded.h"

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "user32.lib")

namespace fs = std::filesystem;

static std::atomic<bool> g_running(true);

BOOL WINAPI ConsoleHandler(DWORD ctrlType) {
    if (ctrlType == CTRL_C_EVENT || ctrlType == CTRL_CLOSE_EVENT || ctrlType == CTRL_SHUTDOWN_EVENT) {
        g_running.store(false);
        return TRUE;
    }
    return FALSE;
}

std::string get_mime_type(const std::string& path) {
    if (path.rfind(".html") != std::string::npos) return "text/html; charset=utf-8";
    if (path.rfind(".css") != std::string::npos) return "text/css; charset=utf-8";
    if (path.rfind(".js") != std::string::npos) return "application/javascript; charset=utf-8";
    if (path.rfind(".png") != std::string::npos) return "image/png";
    if (path.rfind(".json") != std::string::npos) return "application/json";
    if (path.rfind(".svg") != std::string::npos) return "image/svg+xml";
    return "text/plain";
}

std::string get_base_dir() {
    char buffer[MAX_PATH];
    GetModuleFileNameA(NULL, buffer, MAX_PATH);
    std::string path(buffer);
    size_t pos = path.find_last_of("\\/");
    return (pos != std::string::npos) ? path.substr(0, pos) : ".";
}

void handle_client(SOCKET client_socket, const std::string& gui_dir) {
    char buffer[4096];
    int bytes_read = recv(client_socket, buffer, sizeof(buffer) - 1, 0);
    if (bytes_read <= 0) {
        closesocket(client_socket);
        return;
    }
    buffer[bytes_read] = '\0';

    std::istringstream req(buffer);
    std::string method, url, version;
    req >> method >> url >> version;

    if (url.empty() || url == "/") {
        url = "/index.html";
    }

    size_t qpos = url.find('?');
    if (qpos != std::string::npos) {
        url = url.substr(0, qpos);
    }

    // Try disk first
    std::string file_path = gui_dir + url;
    for (char& c : file_path) {
        if (c == '/') c = '\\';
    }

    std::vector<char> content;
    std::string mime;
    bool found = false;

    if (fs::exists(file_path)) {
        std::ifstream file(file_path, std::ios::binary);
        if (file.is_open()) {
            content.assign((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
            mime = get_mime_type(file_path);
            found = true;
        }
    }

    // Fallback to embedded assets
    if (!found) {
        const auto& embedded = get_embedded_assets();
        auto it = embedded.find(url);
        if (it != embedded.end()) {
            content.assign(it->second.data.begin(), it->second.data.end());
            mime = it->second.mime;
            found = true;
        }
    }

    if (found) {
        std::ostringstream response;
        response << "HTTP/1.1 200 OK\r\n";
        response << "Content-Type: " << mime << "\r\n";
        response << "Content-Length: " << content.size() << "\r\n";
        response << "Access-Control-Allow-Origin: *\r\n";
        response << "Connection: close\r\n";
        response << "Cache-Control: no-cache\r\n\r\n";

        std::string header = response.str();
        send(client_socket, header.c_str(), (int)header.length(), 0);
        send(client_socket, content.data(), (int)content.size(), 0);
    } else {
        std::string not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found";
        send(client_socket, not_found.c_str(), (int)not_found.length(), 0);
    }

    closesocket(client_socket);
}

void run_server(int port, const std::string& gui_dir) {
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) return;

    SOCKET server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket == INVALID_SOCKET) {
        WSACleanup();
        return;
    }

    int opt = 1;
    setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in server_addr;
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = htonl(INADDR_ANY); // Bind to 0.0.0.0 for maximum reachability
    server_addr.sin_port = htons(port);

    if (bind(server_socket, (sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        closesocket(server_socket);
        WSACleanup();
        return;
    }

    if (listen(server_socket, 32) == SOCKET_ERROR) {
        closesocket(server_socket);
        WSACleanup();
        return;
    }

    while (g_running.load()) {
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_socket, &read_fds);

        timeval tv;
        tv.tv_sec = 0;
        tv.tv_usec = 200000; // 200ms

        int activity = select(0, &read_fds, NULL, NULL, &tv);
        if (activity > 0 && FD_ISSET(server_socket, &read_fds)) {
            SOCKET client = accept(server_socket, NULL, NULL);
            if (client != INVALID_SOCKET) {
                std::thread(handle_client, client, gui_dir).detach();
            }
        }
    }

    closesocket(server_socket);
    WSACleanup();
}

std::string find_browser_executable() {
    const std::vector<std::string> candidates = {
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
    };

    for (const auto& path : candidates) {
        if (fs::exists(path)) {
            return path;
        }
    }
    return "";
}

int main() {
    SetConsoleCtrlHandler(ConsoleHandler, TRUE);

    std::string base_dir = get_base_dir();
    std::string gui_dir = base_dir + "\\gui";

    int port = 8099;

    std::cout << "========================================================\n";
    std::cout << "           Prasad Chess Engine - Desktop App            \n";
    std::cout << "========================================================\n";
    std::cout << "Engine Elo Levels : 250, 500, 750, 1200, 1750, 2200, 2700, 3000\n";
    std::cout << "Themes            : Lichess & Chess.com (Board + Vector Pieces)\n";
    std::cout << "--------------------------------------------------------\n";
    std::cout << "[*] Starting local offline server on port " << port << "...\n";

    std::thread server_thread(run_server, port, gui_dir);
    server_thread.detach();

    Sleep(500); // Give server a moment to start

    std::string app_url = "http://127.0.0.1:" + std::to_string(port) + "/index.html";
    std::string browser_exe = find_browser_executable();

    char temp_dir[MAX_PATH];
    GetTempPathA(MAX_PATH, temp_dir);
    std::string profile_dir = std::string(temp_dir) + "PrasadChessProfile";

    bool launched = false;

    if (!browser_exe.empty()) {
        std::cout << "[*] Launching standalone app window (" << browser_exe << ")...\n";
        // Passing --user-data-dir makes Edge launch as a persistent dedicated app process
        std::string cmd = "\"" + browser_exe + "\" --app=" + app_url + " --user-data-dir=\"" + profile_dir + "\" --window-size=1100,860";

        STARTUPINFOA si;
        PROCESS_INFORMATION pi;
        ZeroMemory(&si, sizeof(si));
        si.cb = sizeof(si);
        ZeroMemory(&pi, sizeof(pi));

        BOOL success = CreateProcessA(NULL, (LPSTR)cmd.c_str(), NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi);
        if (success) {
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            launched = true;
            std::cout << "[+] Standalone window opened!\n";
        }
    }

    if (!launched) {
        std::cout << "[*] Opening in default web browser...\n";
        ShellExecuteA(NULL, "open", app_url.c_str(), NULL, NULL, SW_SHOWNORMAL);
    }

    std::cout << "\n========================================================\n";
    std::cout << "  [SERVER ACTIVE] Playing Prasad Chess Engine           \n";
    std::cout << "  URL: http://127.0.0.1:8099/index.html                 \n";
    std::cout << "========================================================\n";
    std::cout << ">>> DO NOT CLOSE THIS CONSOLE WINDOW WHILE PLAYING! <<<\n";
    std::cout << "Press ENTER in this window to stop the game.\n\n";

    // Keep server running and wait for user Enter key or console close
    std::string line;
    std::getline(std::cin, line);

    g_running.store(false);
    std::cout << "[*] Shutting down Prasad Chess Engine...\n";
    Sleep(300);
    return 0;
}
