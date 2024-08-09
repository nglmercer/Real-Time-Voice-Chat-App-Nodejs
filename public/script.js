class PeerConnectionManager {
    constructor(socket, localStream) {
        this.socket = socket; // Socket utilizado para comunicarse con el servidor y otros peers.
        this.localStream = localStream; // Flujo local de medios (audio/video) que se enviará a otros peers.
        this.peerConnections = {}; // Almacena las conexiones P2P activas, con la clave siendo el userId del peer.
        this.remoteIndicators = {}; // Almacena los indicadores de actividad de audio de los peers remotos.
        this.initializeSocketEvents(); // Configura los eventos del socket.
    }

    createPeerConnection(userId) {
        // Crea una nueva conexión P2P para un usuario dado.
        const peerConnection = new RTCPeerConnection();

        // Evento para manejar el intercambio de ICE candidates.
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Envía el ICE candidate al peer remoto a través del servidor.
                this.socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
                console.log('ICE candidate sent:', event.candidate);
            }
        };

        // Evento para manejar la recepción de flujos de medios remotos.
        peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.streams[0]);
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play().then(() => {
                console.log('Remote audio is playing.');
                this.setupRemoteIndicator(event.streams[0]); // Configura el indicador visual para el audio del peer remoto.
            }).catch(error => {
                console.error('Error playing remote audio:', error);
            });
        };

        // Añade todas las pistas (audio/video) del flujo local a la conexión P2P.
        this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream));
        this.peerConnections[userId] = peerConnection; // Guarda la conexión P2P en el diccionario.
        return peerConnection;
    }

    handleOffer(offer, userId) {
        // Maneja una oferta SDP recibida de otro peer.
        const peerConnection = this.createPeerConnection(userId);
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => peerConnection.createAnswer()) // Crea una respuesta SDP.
            .then(answer => {
                peerConnection.setLocalDescription(answer); // Establece la descripción local con la respuesta.
                this.socket.emit('answer', { answer, to: userId }); // Envía la respuesta al peer remoto.
                console.log('Answer sent:', answer);
            })
            .catch(error => console.error('Error handling offer:', error));
    }

    handleAnswer(answer, userId) {
        // Maneja la respuesta SDP de un peer remoto.
        const peerConnection = this.peerConnections[userId];
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
            .catch(error => console.error('Error handling answer:', error));
    }

    handleIceCandidate(candidate, userId) {
        // Maneja la recepción de un ICE candidate de otro peer.
        const peerConnection = this.peerConnections[userId];
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error('Error adding received ice candidate:', error));
    }

    setupRemoteIndicator(remoteStream) {
        // Configura un indicador visual que muestre la actividad de audio del stream remoto.
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(remoteStream);
        microphone.connect(analyser);
        analyser.fftSize = 256; // Establece el tamaño de la ventana FFT para el análisis de frecuencias.
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        document.body.appendChild(indicator);

        const updateRemoteIndicator = () => {
            analyser.getByteFrequencyData(dataArray); // Obtiene los datos de frecuencia actuales.
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const color = average > 50 ? 'green' : 'red'; // Cambia el color del indicador basado en la actividad de audio.
            indicator.style.backgroundColor = color;
            requestAnimationFrame(updateRemoteIndicator); // Actualiza el indicador continuamente.
        };

        updateRemoteIndicator();
        this.remoteIndicators[remoteStream.id] = indicator; // Guarda el indicador en el diccionario.
    }

    initializeSocketEvents() {
        // Configura los eventos del socket para manejar las interacciones entre peers.
        this.socket.on('ready', (userId) => {
            if (userId !== this.socket.id && !this.peerConnections[userId]) {
                const peerConnection = this.createPeerConnection(userId);

                // Crea una oferta SDP cuando un nuevo peer está listo para conectarse.
                peerConnection.createOffer()
                    .then(offer => peerConnection.setLocalDescription(offer))
                    .then(() => {
                        this.socket.emit('offer', { offer: peerConnection.localDescription, to: userId });
                        console.log('Offer sent:', peerConnection.localDescription);
                    })
                    .catch(error => console.error('Error creating offer:', error));
            }
        });

        // Escucha ofertas SDP entrantes de otros peers.
        this.socket.on('offer', ({ offer, from }) => {
            this.handleOffer(offer, from);
        });

        // Escucha respuestas SDP entrantes de otros peers.
        this.socket.on('answer', ({ answer, from }) => {
            this.handleAnswer(answer, from);
        });

        // Escucha ICE candidates entrantes de otros peers.
        this.socket.on('ice-candidate', ({ candidate, from }) => {
            this.handleIceCandidate(candidate, from);
        });
    }

    // Método para obtener información de un usuario específico.
    getUserInfo(userId) {
        return {
            userId: userId,
            peerConnection: this.peerConnections[userId], // Devuelve la conexión P2P del usuario.
        };
    }

    // Método para obtener información de todos los usuarios conectados.
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
        const color = average > 10 ? 'green' : 'red';
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

    const nomuted = !audioTracks[0].enabled;

    if (nomuted) {
        audioTracks.forEach(track => track.enabled = true);
        micImage.classList.remove('bi-mic-mute');
        micImage.classList.add('bi-mic');
        microphoneState.textContent = "muted";
        console.log('Microphone muted.');
    } else {
        audioTracks.forEach(track => track.enabled = false);
        micImage.classList.remove('bi-mic');
        micImage.classList.add('bi-mic-mute');
        microphoneState.textContent = "Unmuted";
        console.log('Microphone unmuted.');
    }
}
