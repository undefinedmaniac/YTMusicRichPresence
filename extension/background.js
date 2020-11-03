var ports = {}
var pauseTimeout;

var playingTabs = {
    tabs: [],

    getActiveTab: function() {
        return this.tabs[0];
    },

    addTab: function(tabId) {
        this.tabs.unshift(tabId);
        clearTimeout(pauseTimeout);
    },

    removeTab: function(tabId) {
        // Remove the tab if it is present
        let index = this.tabs.indexOf(tabId);
        if (index != -1) {
            this.tabs.splice(index, 1);

            if (this.tabs.length <= 0) {
                // There are no more playing tabs, check if the tab
                // we just removed is still open (it will not be in ports)
                // if it was completely closed
                if (tabId in ports) {
                    // Set the paused state, prepare to close Rich Presence
                    // in 5 minutes if no other tabs start playing
                    console.log("Set Pause!");
                    pauseTimeout = setTimeout(closeRichPresence, 60000);//300000);
                    sendMessageToNativeApp({request: "Pause"});
                } else {
                    // The tab was closed, there are no more playing or paused tabs,
                    // shutdown Rich Presence
                    closeRichPresence();
                }
            } else if (this.tabs.length > 0 && index == 0) {
                // The current playing tab was removed, but there is another available
                // Make the next available tab force an update
                ports[this.tabs[0]].postMessage({request: "ForceUpdate"});
            }
        }
    }
};

var nativeApp = null;

// Listen for connections from content sctipts running on YT Music
chrome.runtime.onConnect.addListener(function(port) {
    // Leave if the ID value we want does not exist
    if (typeof port.sender != 'object' || 
        typeof port.sender.tab != 'object' ||
        typeof port.sender.tab.id != 'number')
        return;

    // Add the port to the ports dictionary
    ports[port.sender.tab.id] = port;

    // Register handlers
    port.onMessage.addListener(handleMessage);
    port.onDisconnect.addListener(handleDisconnect);
    console.log(`Tab Connected: ${port.sender.tab.id}`);
});

// Handles a message received by a content script
// Valid message events: Playing, Stopped, and Update
function handleMessage(message, port)
{
    let tabId = port.sender.tab.id;

    switch (message.event) {
        case "Playing": {
            playingTabs.addTab(tabId);
            console.log(`Tab ${tabId} is now playing`);
            break;
        }
        case "Stopped": {
            playingTabs.removeTab(tabId);
            console.log(`Tab ${tabId} is now stopped`);
            break;
        }
        case "Update": {
            if (tabId != playingTabs.getActiveTab())
                return;

            // Send update to Rich Presence
            sendMessageToNativeApp({request: "Update", title: message.title, artist: message.artist, album: message.album, finishTimestamp: message.finishTimestamp});
            console.log(`Tab ${tabId} Update: ${message.title}, ${message.artist}, ${message.album} , ${message.finishTimestamp}`)
            break;
        }
    }
}

// Handles a disconnection from a content script
function handleDisconnect(port)
{
    // Remove the port from the ports dictionary
    delete ports[port.sender.tab.id];

    // Remove from playing tabs if necessary
    playingTabs.removeTab(port.sender.tab.id);

    console.log(`Tab Disconnected: ${port.sender.tab.id}`);
}

function sendMessageToNativeApp(message)
{
    if (nativeApp == null) {
        nativeApp = chrome.runtime.connectNative('undefinedsoftware.ytmusicrichpresence');
        nativeApp.onDisconnect.addListener(nativeAppDisconnected);
    }

    nativeApp.postMessage(message);
}

function closeRichPresence()
{
    console.log("Shutdown Rich Presence!");
    if (nativeApp != null)
        nativeApp.postMessage({request: "Quit"});
}

function nativeAppDisconnected()
{
    console.log("Native App Disconnected!");
    nativeApp = null;

    // Check the value to prevent errors
    chrome.runtime.lastError;
}