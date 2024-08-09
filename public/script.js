<<<<<<< Updated upstream
const socket = io();

var userInput;
var microphoneState = document.getElementById('microphone-state');
var audioContext;
var mediaStreamSource;
var micImage = document.getElementById('mic-image');
=======
import { PeerConnectionManager } from './connectionmanager.js';

const socket = io();
let localStream;
let userInput;
let microphoneState = document.getElementById('microphone-state');
let micImage = document.getElementById('mic-image');
const mictoggleaudio = document.getElementById('mic-toggle-button');
let voiceIndicator = document.getElementById('voice-indicator');
let localVideoElement = document.getElementById('local-video'); // Elemento de video local en HTML
let peerManager;

mictoggleaudio.addEventListener('click', toggleMicrophone);
>>>>>>> Stashed changes

window.onload = function () {
    do {
        userInput = prompt("Enter Your name");
        socket.emit("joinedusername", userInput)
    } while (userInput === null || userInput === "");

    socket.username = userInput;

<<<<<<< Updated upstream
    setupAudioStream();
}

async function setupAudioStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.latencyHint = 'interactive'; // or 'playback'

        mediaStreamSource = audioContext.createMediaStreamSource(stream);
=======
    // Enumerar dispositivos de video
    enumerateMediaDevices();
};

// Enumerar las cámaras disponibles y permitir al usuario seleccionar una
async function enumerateMediaDevices() {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.log("enumerateDevices() not supported.");
        } else {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');

            if (videoDevices.length === 0) {
                console.log("No cameras found.");
                alert("No cameras found.");
                return;
            }

            let selectedVideoDeviceId = null;
            let shareScreenOption = "0: Share screen/window";
            let videoOptions = videoDevices.map((device, index) => `${index + 1}: ${device.label || 'Camera ' + (index + 1)}`).join('\n');

            let selectedVideoDeviceIndex;
            do {
                selectedVideoDeviceIndex = parseInt(prompt(`Select a camera or share screen/window:\n${shareScreenOption}\n${videoOptions}`)) - 1;
            } while (isNaN(selectedVideoDeviceIndex) || selectedVideoDeviceIndex < -1 || selectedVideoDeviceIndex >= videoDevices.length);

            if (selectedVideoDeviceIndex === -1) {
                await setupLocalStream(null, true); // Compartir pantalla/ventana
            } else {
                selectedVideoDeviceId = videoDevices[selectedVideoDeviceIndex].deviceId;
                await setupLocalStream(selectedVideoDeviceId, false);
            }
        }
    } catch (error) {
        console.error('Error enumerating devices:', error);
    }
}

// Configurar el flujo de medios local utilizando la cámara seleccionada
async function setupLocalStream(videoDeviceId, shareScreen = false) {
    try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
            console.log("getDisplayMedia() not supported.");
        }

        if (shareScreen) {
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            localStream = await navigator.mediaDevices.getUserMedia({ 
                video: videoDeviceId ? { deviceId: videoDeviceId } : true // Siempre solicitar video
            });

            if (localVideoElement) {
                localVideoElement.srcObject = localStream;
                localVideoElement.play(); // Reproducir video local para verificar que funciona
            }
        }

        console.log('Media stream access granted.');

        peerManager = new PeerConnectionManager(socket, localStream);
        socket.emit('ready', socket.username);

        peerManager.registerMediaCallback('video', (remoteStream, userId) => {
            const remoteVideo = document.createElement('video');
            remoteVideo.className = 'remote-video';
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.controls = true;

            document.body.appendChild(remoteVideo);
            console.log(`Remote video from ${userId} is playing.`);
        });

>>>>>>> Stashed changes
    } catch (error) {
        console.error('Error accessing media stream:', error);
        alert(`Failed to access media stream: ${error.message}`);
    }
}

function toggleMicrophone() {
<<<<<<< Updated upstream
    if (micImage.classList.contains('bi-mic-mute')) {
        micImage.classList.remove('bi-mic-mute');
        micImage.classList.add('bi-mic');
        microphoneState.textContent = "Unmuted";

        // Connect the media stream source to the audio context destination
        //mediaStreamSource.connect(audioContext.destination);

        // Start sending audio data to the server in real-time
        startStreaming();
=======
    const audioTracks = localStream ? localStream.getAudioTracks() : [];

    if (audioTracks.length === 0) {
        console.log('No audio track available.');
        return;
    }

    const isMuted = !audioTracks[0].enabled;

    if (isMuted) {
        audioTracks.forEach(track => track.enabled = true);
        micImage.classList.remove('bi-mic-mute');
        micImage.classList.add('bi-mic');
        microphoneState.textContent = "Unmuted";
        console.log('Microphone unmuted.');
>>>>>>> Stashed changes
    } else {
        micImage.classList.remove('bi-mic');
        micImage.classList.add('bi-mic-mute');
        microphoneState.textContent = "Muted";
<<<<<<< Updated upstream

        // Stop sending audio data to the server
        stopStreaming();
=======
        console.log('Microphone muted.');
>>>>>>> Stashed changes
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

    const typedArray = new Float32Array(data);

    const audioBuffer = audioContext1.createBuffer(1, typedArray.length, audioContext1.sampleRate);

    const channelData = audioBuffer.getChannelData(0);

    channelData.set(typedArray);

    const audioBufferSource = audioContext1.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    audioBufferSource.connect(audioContext1.destination);

    audioBufferSource.start();
});