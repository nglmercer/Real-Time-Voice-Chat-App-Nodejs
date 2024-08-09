class PeerConnectionManager {
    constructor(socket, localStream) {
        this.socket = socket;
        this.localStream = localStream;
        this.peerConnections = {};
        this.remoteIndicators = {};
        this.initializeSocketEvents();
    }

    createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection();

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
                console.log('ICE candidate sent:', event.candidate);
            }
        };

        peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.streams[0]);
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play().then(() => {
                console.log('Remote audio is playing.');
                this.setupRemoteIndicator(event.streams[0]);
            }).catch(error => {
                console.error('Error playing remote audio:', error);
            });
        };

        this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream));
        this.peerConnections[userId] = peerConnection;
        return peerConnection;
    }

    handleOffer(offer, userId) {
        const peerConnection = this.createPeerConnection(userId);
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => peerConnection.createAnswer())
            .then(answer => {
                peerConnection.setLocalDescription(answer);
                this.socket.emit('answer', { answer, to: userId });
                console.log('Answer sent:', answer);
            })
            .catch(error => console.error('Error handling offer:', error));
    }

    handleAnswer(answer, userId) {
        const peerConnection = this.peerConnections[userId];
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
            .catch(error => console.error('Error handling answer:', error));
    }

    handleIceCandidate(candidate, userId) {
        const peerConnection = this.peerConnections[userId];
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error('Error adding received ice candidate:', error));
    }

    setupRemoteIndicator(remoteStream) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(remoteStream);
        microphone.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        document.body.appendChild(indicator);

        const updateRemoteIndicator = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const color = average > 50 ? 'green' : 'red';
            indicator.style.backgroundColor = color;
            requestAnimationFrame(updateRemoteIndicator);
        };

        updateRemoteIndicator();
        this.remoteIndicators[remoteStream.id] = indicator;
    }

    initializeSocketEvents() {
        this.socket.on('ready', (userId) => {
            if (userId !== this.socket.id && !this.peerConnections[userId]) {
                const peerConnection = this.createPeerConnection(userId);

                peerConnection.createOffer()
                    .then(offer => peerConnection.setLocalDescription(offer))
                    .then(() => {
                        this.socket.emit('offer', { offer: peerConnection.localDescription, to: userId });
                        console.log('Offer sent:', peerConnection.localDescription);
                    })
                    .catch(error => console.error('Error creating offer:', error));
            }
        });

        this.socket.on('offer', ({ offer, from }) => {
            this.handleOffer(offer, from);
        });

        this.socket.on('answer', ({ answer, from }) => {
            this.handleAnswer(answer, from);
        });

        this.socket.on('ice-candidate', ({ candidate, from }) => {
            this.handleIceCandidate(candidate, from);
        });
    }

    getUserInfo(userId) {
        return {
            userId: userId,
            peerConnection: this.peerConnections[userId],
        };
    }

    getAllUsersInfo() {
        return Object.keys(this.peerConnections).map(userId => this.getUserInfo(userId));
    }
}
const socket = io();
let localStream;
let userInput;
let microphoneState = document.getElementById('microphone-state');
let micImage = document.getElementById('mic-image');
const mictoggleaudio = document.getElementById('mic-toggle-button');
let voiceIndicator = document.getElementById('voice-indicator');
let peerManager;
mictoggleaudio.addEventListener('click', toggleMicrophone);
window.onload = function () {
    do {
        userInput = prompt("Enter Your name");
        socket.emit("joinedusername", userInput);
    } while (userInput === null || userInput === "");

    socket.username = userInput;

    // Enumerar dispositivos de audio
    enumerateMicrophones();
};

// Enumerar los micrófonos disponibles y permitir al usuario seleccionar uno
async function enumerateMicrophones() {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.log("enumerateDevices() not supported.");
          } else{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');

        if (audioDevices.length > 0) {
            let options = audioDevices.map((device, index) => `${index + 1}: ${device.label || 'Microphone ' + (index + 1)}`).join('\n');
            let selectedDeviceIndex;

            do {
                selectedDeviceIndex = parseInt(prompt(`Select a microphone:\n${options}`)) - 1;
            } while (isNaN(selectedDeviceIndex) || selectedDeviceIndex < 0 || selectedDeviceIndex >= audioDevices.length);

            const selectedDeviceId = audioDevices[selectedDeviceIndex].deviceId;
            await setupLocalStream(selectedDeviceId);
        } else {
            alert('No microphones found.');
        }
          }
    } catch (error) {
        console.error('Error enumerating devices:', error);
    }
}

// Configurar el flujo de medios local utilizando el micrófono seleccionado
async function setupLocalStream(deviceId) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId } });
        console.log('Microphone access granted.');

        peerManager = new PeerConnectionManager(socket, localStream);
        socket.emit('ready', socket.username);
        setupLocalIndicator();
    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
}

function setupLocalIndicator() {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(localStream);
    microphone.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function updateIndicator() {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const color = average > 50 ? 'green' : 'red';
        voiceIndicator.style.backgroundColor = color;
        requestAnimationFrame(updateIndicator);
    }

    updateIndicator();
}

function toggleMicrophone() {
    const audioTracks = localStream.getAudioTracks();

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
