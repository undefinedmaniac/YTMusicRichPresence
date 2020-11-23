#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

#include <future>
#include <time.h>
#include <thread>
#include <iostream>

#include <discord.h>
#include <rapidjson/document.h>

struct UpdateInfo;
bool handleUpdate(const UpdateInfo&);
std::unique_ptr<UpdateInfo> readUpdate();
const rapidjson::Value* extractInfo(const rapidjson::Document&, const char*);

enum Request
{
    Update, Pause, Quit
};

struct UpdateInfo
{
    bool isNull;

    Request request;
    discord::Timestamp finishTimestamp;

    std::string title;
    std::string artist;
    std::string album;
};

// Discord API
discord::Core* core{};
discord::Activity activity{};

UpdateInfo info;
std::string state_str = "";
std::string details_str = "";

int main(int argc, char const *argv[])
{
    // For Windows only, set the I/O mode to binary
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
#endif

    // Create the discord core 
    discord::Result result = discord::Core::Create(771612167190872085, DiscordCreateFlags_Default, &core);
    if (result != discord::Result::Ok)
        return 1;

    activity.GetAssets().SetLargeImage("youtube-music-logo-black");
    activity.GetAssets().SetLargeText("YouTube Music");

    std::future<std::unique_ptr<UpdateInfo>> future = std::async(std::launch::async, readUpdate);
    while (true) {
        bool isValid = future.valid();
        bool isReady = false;
        // Make sure that the future is still valid
        if (isValid) {
            // Check if the read operation from stdin is ready
            isReady = (future.wait_for(std::chrono::milliseconds(100)) == std::future_status::ready);
            if (isReady) {
                // Exit if handleUpdate returns true
                bool shouldExit = handleUpdate(*future.get());
                if (shouldExit)
                    break;
            }
        }

        core->RunCallbacks();

        if (!isValid || isReady)
            future = std::async(std::launch::async, readUpdate);
    }

    return 0;
}

// Handles an update and then returns false if the program should continue running
// and true if it should quit 
bool handleUpdate(const UpdateInfo& info)
{
    // Make sure the message is not null
    if (info.isNull)
        return false;

    switch (info.request) {
        case Update: {
            // Setup the Discord activity object
            details_str = info.title;
            activity.SetDetails(details_str.c_str());

            state_str = "by " + info.artist + " on " + info.album;
            activity.SetState(state_str.c_str());
            activity.GetTimestamps().SetEnd(info.finishTimestamp);

            // ******************************** START FUN ********************************
#ifndef NO_FUN
            // Tunner boi
            if (info.title.find("Fade To Black") != std::string::npos &&
                (info.title.find("Metallica") != std::string::npos || 
                info.artist.find("Metallica") != std::string::npos))
            {
                activity.GetAssets().SetLargeImage("mucikk");
                activity.GetAssets().SetLargeText("Tubes");
            } else {
                activity.GetAssets().SetLargeImage("youtube-music-logo-black");
                activity.GetAssets().SetLargeText("YouTube Music");
            }
#endif
            // ********************************* END FUN *********************************

            core->ActivityManager().UpdateActivity(activity, nullptr);
            break;
        }
        case Pause: {
            // Stick 'Paused - ' on the last thing that was playing
            if (!details_str.empty()) {
                details_str = "Paused - " + details_str;

                activity.SetDetails(details_str.c_str());
                activity.GetTimestamps().SetEnd(0);

                core->ActivityManager().UpdateActivity(activity, nullptr);
            }
            break;
        }
        case Quit: {
            return true;
        }
    }

    return false;
}

std::unique_ptr<UpdateInfo> readUpdate()
{
    // Make sure std::cin is still available
    // i.e. no EOF or other failure
    if (!std::cin) {
        // Cause the program to exit if there is I/O failure
        std::unique_ptr<UpdateInfo> updateInfo = std::make_unique<UpdateInfo>();
        updateInfo->isNull = false;
        updateInfo->request = Request::Quit;
        return std::move(updateInfo);
    }

    // Read the first 4 bytes or 32 bits of the message
    // To calculate the message length
    char header[4];
    std::cin.read(header, 4);
    const uint32_t& messageLength = reinterpret_cast<uint32_t&>(header);

    // Use the message length to decode the actual string message
    std::unique_ptr<char[]> message = std::make_unique<char[]>(messageLength + 1);
    std::cin.read(message.get(), messageLength);
    message[messageLength] = '\0';
    
    // Create struct to store our output
    std::unique_ptr<UpdateInfo> updateInfo = std::make_unique<UpdateInfo>();

    // Parse our JSON string
    rapidjson::Document document;
    document.Parse(message.get());

    // Extract information from the JSON string and put it into the UpdateInfo struct
    bool successful = false;
    const rapidjson::Value* value = extractInfo(document, "request");
    if (value != nullptr && value->IsString()) {
        const char* request = value->GetString();
        if (strcmp(request, "Update") == 0) {
            updateInfo->request = Request::Update;

            const rapidjson::Value* title = extractInfo(document, "title");
            const rapidjson::Value* artist = extractInfo(document, "artist");
            const rapidjson::Value* album = extractInfo(document, "album");
            const rapidjson::Value* finishTimestamp = extractInfo(document, "finishTimestamp");

            if (title           != nullptr && title->IsString()  &&
                artist          != nullptr && artist->IsString() &&
                album           != nullptr && album->IsString()  &&
                finishTimestamp != nullptr && finishTimestamp->IsInt64()) 
            {
                updateInfo->title = std::string(title->GetString());
                updateInfo->artist = std::string(artist->GetString());
                updateInfo->album = std::string(album->GetString());
                updateInfo->finishTimestamp = finishTimestamp->GetInt64();
                successful = true;
            }
        } else if (strcmp(request, "Pause") == 0) {
            updateInfo->request = Request::Pause;
            successful = true;
        } else if (strcmp(request, "Quit") == 0) {
            updateInfo->request = Request::Quit;
            successful = true;
        }
    }

    updateInfo->isNull = !successful;
    return std::move(updateInfo);
}

const rapidjson::Value* extractInfo(const rapidjson::Document& document, const char* memberName)
{
    rapidjson::Document::ConstMemberIterator iterator = document.FindMember(memberName);
    if (iterator != document.MemberEnd())
        return &iterator->value;

    return nullptr;
}
