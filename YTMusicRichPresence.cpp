#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

#include <future>
#include <time.h>
#include <thread>
#include <iostream>
#include <discord-files/discord.h>
#include <rapidjson/document.h>

struct UpdateInfo;
UpdateInfo readUpdate();
const rapidjson::Value* extractInfo(const rapidjson::Document&, const char*);

enum Request
{
    Update, Pause, Quit
};

struct UpdateInfo
{
    bool isNull;

    Request request;
    const char* title;
    const char* artist;
    const char* album;
    discord::Timestamp finishTimestamp;
};

int main(int argc, char const *argv[])
{
    // For Windows only, set the I/O mode to binary
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
#endif
    discord::Core* core{};
    discord::Result result = discord::Core::Create(771612167190872085, DiscordCreateFlags_NoRequireDiscord, &core);

    discord::Activity activity{};
    activity.GetAssets().SetLargeImage("youtube-music-logo-black");
    activity.GetAssets().SetLargeText("YouTube Music");

    std::future<UpdateInfo> future = std::async(std::launch::async, readUpdate);
    while (true) {
        if (future.wait_for(std::chrono::milliseconds(100)) == std::future_status::ready) {
            UpdateInfo info = future.get();

            if (!info.isNull) {

                // std::cerr << "Title: " << info.title << std::endl;
                // std::cerr << "Artist: " << info.artist << std::endl;
                // std::cerr << "Album: " << info.album << std::endl;
                // std::cerr << "Timestamp: " << info.finishTimestamp << std::endl;

                switch (info.request) {
                    case Update: {
                        activity.SetDetails(info.title);

                        char state[4 + strlen(info.artist)] = "By ";
                        strcat(state, info.artist);
                        activity.SetState(state);
                        activity.GetTimestamps().SetEnd(info.finishTimestamp);

                        // Tunner boi
                        if (strstr(info.title, "Fade To Black") != nullptr &&
                            (strstr(info.title, "Metallica") != nullptr || 
                            strstr(info.artist, "Metallica") != nullptr)) 
                        {
                            activity.GetAssets().SetLargeImage("mucikk");
                            activity.GetAssets().SetLargeText("Tubes");
                        } else {
                            activity.GetAssets().SetLargeImage("youtube-music-logo-black");
                            activity.GetAssets().SetLargeText("YouTube Music");
                        }

                        core->ActivityManager().UpdateActivity(activity, nullptr);
                        break;
                    }
                    case Pause: {
                        char details[10 + strlen(activity.GetDetails())] = "Paused - ";
                        strcat(details, activity.GetDetails());
                        activity.SetDetails(details);
                        activity.GetTimestamps().SetEnd(0);

                        core->ActivityManager().UpdateActivity(activity, nullptr);
                        break;
                    }
                    case Quit: {
                        return 0;
                    }
                }
            }

            future = std::async(std::launch::async, readUpdate);
        }
        core->RunCallbacks();
    }

    return 0;
}

UpdateInfo readUpdate()
{
    // Read the first 4 bytes or 32 bits of the message
    // To calculate the message length
    char header[4];
    std::cin.read(header, 4);
    uint32_t messageLength = *(reinterpret_cast<uint32_t*>(header));

    // Use the message length to decode the actual string message
    char message[messageLength + 1];
    std::cin.read(message, messageLength);
    message[messageLength] = '\0';
    
    // Create struct to store our output
    UpdateInfo updateInfo;

    // Parse our JSON string
    rapidjson::Document document;
    document.Parse(message);

    bool successful = false;
    const rapidjson::Value* value = extractInfo(document, "request");
    if (value != nullptr && value->IsString()) {
        const char* request = value->GetString();
        if (strcmp(request, "Update") == 0) {
            updateInfo.request = Request::Update;

            const rapidjson::Value* title = extractInfo(document, "title");
            const rapidjson::Value* artist = extractInfo(document, "artist");
            const rapidjson::Value* album = extractInfo(document, "album");
            const rapidjson::Value* finishTimestamp = extractInfo(document, "finishTimestamp");

            if (title           != nullptr && title->IsString()  &&
                artist          != nullptr && artist->IsString() &&
                album           != nullptr &&  album->IsString() &&
                finishTimestamp != nullptr && finishTimestamp->IsInt64()) 
            {
                updateInfo.title = title->GetString();
                updateInfo.artist = artist->GetString();
                updateInfo.album = album->GetString();
                updateInfo.finishTimestamp = finishTimestamp->GetInt64();
                successful = true;
            }
        } else if (strcmp(request, "Pause") == 0) {
            updateInfo.request = Request::Pause;
            successful = true;
        } else if (strcmp(request, "Quit") == 0) {
            updateInfo.request = Request::Quit;
            successful = true;
        }
    }

    updateInfo.isNull = !successful;
    return updateInfo;
}

const rapidjson::Value* extractInfo(const rapidjson::Document& document, const char* memberName)
{
    rapidjson::Document::ConstMemberIterator iterator = document.FindMember(memberName);
    if (iterator != document.MemberEnd())
        return &iterator->value;

    return nullptr;
}
