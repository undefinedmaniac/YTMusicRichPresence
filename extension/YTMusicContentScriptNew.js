var playButtonElement = null;
var playButtonInterval = null;

var contentWrapper = null;
var progressBarElement = null;
var songInfoInterval = null;

var isPlaying = false;
var playingTimeout = null;

var title = 'Unknown';
var subtitle = '';
var finishTimestamp = 0;
var songInfoTimeout = null;

var port = chrome.runtime.connect();
port.onMessage.addListener(function(message) {
    if (message.request == "ForceUpdate")
        forceUpdate();
});

playButtonInterval = setInterval(locatePlayButton, 500);

// Locate the play button on the DOM and setup tracking
function locatePlayButton() 
{
    playButtonElement = document.getElementById('play-pause-button');

    if (playButtonElement !== null) {
        clearInterval(playButtonInterval);

        const observer = new MutationObserver(startPlayingUpdate);
        const options = {
            attributes: true,
            attributeFilter: ['title']
        };
        observer.observe(playButtonElement, options);

        startPlayingUpdate();
    }
}

// Starts a playing update by reading the current playing value and then
// scheduling a future call to finishPlayingUpdate
function startPlayingUpdate(records = null, observer = null, overrideTimeout = false)
{
    let attribute = playButtonElement.getAttribute('title');
    let isCurrentlyPlaying = (attribute === 'Pause');

    clearTimeout(playingTimeout);

    // Leave if the value isn't different than our previous value
    if (isPlaying === isCurrentlyPlaying)
        return;

    // This timeout serves to ensure that several quick changes to the playing
    // value only result in a single update
    if (!overrideTimeout) {
        playingTimeout = setTimeout(finishPlayingUpdate, 500, isCurrentlyPlaying);
    } else {
        finishPlayingUpdate(isCurrentlyPlaying);
    }
}

// Finish the update by ensuring that the final value is actually different from the
// stored value and then issuing an update message to the background script
function finishPlayingUpdate(isCurrentlyPlaying)
{
    isPlaying = isCurrentlyPlaying;

    // Notify the background script of the new playing value
    port.postMessage({event: isPlaying ? 'Playing' : 'Stopped'});

    // If we have not found the song info elements yet
    if (songInfoInterval === null)
        songInfoInterval = setInterval(locateSongInfoElements, 500);

    // Force update after playing is started
    if (isPlaying)
        forceUpdate();
}

// Locate all the song info elements and setup tracking
function locateSongInfoElements()
{
    // Locate elemenets on the DOM
    let elements = document.getElementsByClassName('content-info-wrapper style-scope ytmusic-player-bar');
    contentWrapper = elements.length > 0 ? elements[0] : null;

    progressBarElement = document.getElementById('progress-bar');

    // If the elements were found, bind mutation observers and force an update
    if (contentWrapper !== null && progressBarElement !== null) {
        clearInterval(songInfoInterval);

        const contentObserver = new MutationObserver(startSongInfoUpdate);
        const contentObserverOptions = {
            subtree: true,
            attributes: true,
            attributeFilter: ['title']
        };
        contentObserver.observe(contentWrapper, contentObserverOptions);

        const progressBarObserver = new MutationObserver(startSongInfoUpdate);
        const progressBarOptions = {
            attributes: true,
            attributeFilter: ['value', 'aria-valuemax']
        };
        progressBarObserver.observe(progressBarElement, progressBarOptions);
        
        startSongInfoUpdate();
    }
}

// Starts a song info update by reading the current song info values and then
// scheduling a future call to finishSongInfoUpdate
function startSongInfoUpdate(records = null, observer = null, overrideTimeout = false)
{
    // Find the title and subtitle elements every time so they state accurate
    let elements = contentWrapper.getElementsByClassName('title style-scope ytmusic-player-bar');
    let titleElement = elements.length > 0 ? elements[0] : null;
    
    elements = contentWrapper.getElementsByClassName('byline style-scope ytmusic-player-bar complex-string');
    let subtitleElement = elements.length > 0 ? elements[0] : null;

    let newTitle = titleElement !== null ? titleElement.getAttribute('title') : '';
    let newSubtitle = subtitleElement !== null ? subtitleElement.getAttribute('title') : '';

    let newValue = progressBarElement.getAttribute('value');
    let newMaxValue = progressBarElement.getAttribute('aria-valuemax');

    // Compute the new timestamp
    let secondsLeft = newMaxValue - newValue;

    let date = new Date();
    let epochSeconds = Math.round(date.getTime() / 1000);

    let newFinishTimestamp = epochSeconds + secondsLeft;

    clearTimeout(songInfoTimeout);

    // Leave if no song information actually changed or this is an advertisement
    if ((title === newTitle && 
        subtitle === newSubtitle &&
        Math.abs(newFinishTimestamp - finishTimestamp) <= 2) || 
        newSubtitle === 'Video will play after ad') 
        return;

    if (!overrideTimeout) {
        songInfoTimeout = setTimeout(finishSongInfoUpdate, 500, newTitle, newSubtitle, newFinishTimestamp);
    } else {
        finishSongInfoUpdate(newTitle, newSubtitle, newFinishTimestamp);
    }
}

// Finish the update by ensuring that the final values are actually different from the
// stored values and then issuing an update message to the background script
function finishSongInfoUpdate(newTitle, newSubtitle, newFinishTimestamp)
{
    // Update the stored song information
    title = newTitle;
    subtitle = newSubtitle;
    finishTimestamp = newFinishTimestamp;

    // Extract the artist and album from the subtitle
    let artist = 'Unknown';
    let album = 'Unknown';
    let subtitleParts = subtitle.split('•');
    if (subtitleParts.length > 0) {
        artist = subtitleParts[0].trim();
        
        if (subtitleParts.length > 1)
            album = subtitleParts[1].trim();
    }

    // Notify the background script of the new song information
    port.postMessage({event: 'Update', title: title, artist: artist, album: album, finishTimestamp: finishTimestamp});
}

function forceUpdate()
{
    if (contentWrapper !== null && progressBarElement !== null) {
        title = '';
        subtitle = '';
        finishTimestamp = 0;

        startSongInfoUpdate(null, null, true);
    }
}