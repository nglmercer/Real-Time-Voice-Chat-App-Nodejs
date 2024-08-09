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

window.onload = function () {
    do {
        userInput = prompt("Enter Your name");
        socket.emit("joinedusername", userInput);
    } while (userInput === null || userInput === "");

    socket.username = userInput;

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

    } catch (error) {
        console.error('Error accessing media stream:', error);
        alert(`Failed to access media stream: ${error.message}`);
    }
}

function toggleMicrophone() {
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
    } else {
        audioTracks.forEach(track => track.enabled = false);
        micImage.classList.remove('bi-mic');
        micImage.classList.add('bi-mic-mute');
        microphoneState.textContent = "Muted";
        console.log('Microphone muted.');
    }
}
