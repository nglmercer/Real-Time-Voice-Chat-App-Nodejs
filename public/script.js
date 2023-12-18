const socket = io();

var userInput;
var microphoneState = document.getElementById('microphone-state');
var audioContext;
var mediaStreamSource;
var micImage = document.getElementById('mic-image');

window.onload = function () {
    do {
        userInput = prompt("Enter Your name");
        socket.emit("joinedusername",userInput)
    } while (userInput === null || userInput === "");

    socket.username = userInput;

    setupAudioStream();
}

async function setupAudioStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.latencyHint = 'interactive'; // or 'playback'

        mediaStreamSource = audioContext.createMediaStreamSource(stream);
    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
}

function toggleMicrophone() {
    if (micImage.classList.contains('bi-mic-mute')) {
        micImage.classList.remove('bi-mic-mute');
        micImage.classList.add('bi-mic');
        microphoneState.textContent = "Unmuted";

        // Connect the media stream source to the audio context destination
        //mediaStreamSource.connect(audioContext.destination);

        // Start sending audio data to the server in real-time
        startStreaming();
    } else {
        micImage.classList.remove('bi-mic');
        micImage.classList.add('bi-mic-mute');
        microphoneState.textContent = "Muted";

        // Stop sending audio data to the server
        stopStreaming();
    }
}

function startStreaming() {
    const bufferSize = 2048;
    const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

    scriptNode.onaudioprocess = function (audioProcessingEvent) {
        const inputBuffer = audioProcessingEvent.inputBuffer;
        const audioData = inputBuffer.getChannelData(0);

        // Send the audio data to the server
        if (!micImage.classList.contains('bi-mic-mute')) {
            socket.emit("audio", audioData);
        }
    };

    mediaStreamSource.connect(scriptNode);
    scriptNode.connect(audioContext.destination);
}

function stopStreaming() {
    // Disconnect the script node from the audio context
    mediaStreamSource.disconnect();
}

socket.on("allonlineusers", (myArray) => {
    const fixedDiv = document.querySelector(".fixed");

    fixedDiv.innerHTML = "";

    myArray.forEach((user) => {
        const joinedUserDiv = document.createElement("div");
        joinedUserDiv.className = "joineduser";

        const h2Element = document.createElement("h2");

        const userSpan = document.createElement("span");
        userSpan.textContent = user;

        h2Element.appendChild(userSpan);

        joinedUserDiv.appendChild(h2Element);

        fixedDiv.appendChild(joinedUserDiv);
    });
});

socket.on("audio1", (data) => {
    var audioContext1 = new (window.AudioContext || window.webkitAudioContext)();

    // Assuming the data is in the range [-1, 1]
    const typedArray = new Float32Array(data);

    // Create an audio buffer with a single channel
    const audioBuffer = audioContext1.createBuffer(1, typedArray.length, audioContext1.sampleRate);

    // Get the channel data from the audio buffer
    const channelData = audioBuffer.getChannelData(0);

    // Copy the data from the typed array to the channel data
    channelData.set(typedArray);

    // Create an audio buffer source and connect it to the destination
    const audioBufferSource = audioContext1.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    audioBufferSource.connect(audioContext1.destination);

    // Start playing the audio
    audioBufferSource.start();
});