var port = chrome.runtime.connect();
port.onMessage.addListener(function(message) {
    if (message.request == "ForceUpdate") {
        updateSongTitle();
        updateAlbumArtist();
        updateFinishTimestamp();
        sendSongInfoUpdate();
    }
});
setInterval(periodic, 2000);

var isPlaying = false
var title = '';
var artist = '';
var album = '';
var finishTimestamp = 0;

var subtitle = '';
var wasSongInfoUpdatedLastLoop = false;

function periodic()
{
    let justStartedPlaying = false;
    // Send an update message if there is new information
    if (updatePlaying()) {
        sendPlayingUpdate();
        justStartedPlaying = isPlaying;
    }

    // No need to update song information if not playing
    if (!isPlaying) {
        wasSongInfoUpdatedLastLoop = false;
        return;
    }

    let wasSongInfoUpdated = updateSongTitle() || updateAlbumArtist() || updateFinishTimestamp();

    // Send an update message if there is any new information which as remained stable
    // since the last loop or if we have just started playing
    if ((!wasSongInfoUpdated && wasSongInfoUpdatedLastLoop) || justStartedPlaying)
        sendSongInfoUpdate();

    wasSongInfoUpdatedLastLoop = wasSongInfoUpdated;
}

// Update the playing/stopped status and return true if it was changed, false otherwise
function updatePlaying()
{
    let button = document.getElementById('play-pause-button');
    if (button !== null) {
        let attribute = button.getAttribute('title');
        let newIsPlaying = (attribute == 'Pause');
        if (newIsPlaying != isPlaying) {
            isPlaying = newIsPlaying;
            return true;
        }
    }

    return false;
}

// Update the song title and return true if it was changed, false otherwise
function updateSongTitle()
{
    let elements = document.getElementsByClassName('title style-scope ytmusic-player-bar');
    if (elements.length > 0) {
        let newTitle = elements[0].getAttribute('title');
        if (newTitle !== null && newTitle != title) {
            title = newTitle;
            return true;
        }
    }

    return false;
}

// Update the album and artist and return true if it was changed, false otherwise
function updateAlbumArtist()
{
    let elements = document.getElementsByClassName('byline style-scope ytmusic-player-bar complex-string');
    if (elements.length > 0) {
        let newSubtitle = elements[0].getAttribute('title');
        // Wait for the ad to finish before updating song information
        if (newSubtitle !== null && newSubtitle != subtitle && newSubtitle != "Video will play after ad") {
            subtitle = newSubtitle;
            let subtitleParts = newSubtitle.split('•');
            if (subtitleParts.length > 0) {
                artist = subtitleParts[0].trim();
                
                if (subtitleParts.length > 1)
                    album = subtitleParts[1].trim();

                return true;
            }
        }
    }

    return false;
}

function updateFinishTimestamp()
{
    let progressBar = document.getElementById('progress-bar');
    if (progressBar != null) {
        let value = progressBar.getAttribute('value');
        let maxValue = progressBar.getAttribute('aria-valuemax');

        if (value != null && maxValue != null) {
            let secondsLeft = maxValue - value;

            let date = new Date();
            let epochSeconds = Math.round(date.getTime() / 1000);

            let newFinishTimestamp = epochSeconds + secondsLeft;
            if (Math.abs(newFinishTimestamp - finishTimestamp) > 2) {
                finishTimestamp = newFinishTimestamp;
                return true;
            }
        }
    }

    return false;
}

function sendPlayingUpdate()
{
    port.postMessage({event: isPlaying ? 'Playing' : 'Stopped'});
}

function sendSongInfoUpdate()
{
    // Never send updates with missing information
    if (title == '' || artist == '')
        return;

    port.postMessage({event: 'Update', title: title, artist: artist, album: album, finishTimestamp: finishTimestamp});
}