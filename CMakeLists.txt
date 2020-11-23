cmake_minimum_required(VERSION 3.18)

project(YTMusicRichPresenceProject VERSION 1.0 LANGUAGES CXX)

file(GLOB include_files "include/discord-files/*.h" "include/rapidjson/*.h")
file(GLOB discord_files "src/discord-files/*.cpp")

add_executable(YTMusicRichPresence ${include_files} ${discord_files} src/YTMusicRichPresence.cpp)
target_include_directories(YTMusicRichPresence PRIVATE include)
target_link_directories(YTMusicRichPresence PRIVATE lib)
target_link_libraries(YTMusicRichPresence PRIVATE discord_game_sdk)
