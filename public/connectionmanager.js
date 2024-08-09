export class PeerConnectionManager {
    constructor(socket, localStream) {
        this.socket = socket; // Socket utilizado para comunicarse con el servidor y otros peers.
        this.localStream = localStream; // Flujo local de medios (audio/video) que se enviará a otros peers.
        this.peerConnections = {}; // Almacena las conexiones P2P activas, con la clave siendo el userId del peer.
        this.remoteIndicators = {}; // Almacena los indicadores de actividad de audio de los peers remotos.
        this.mediaCallbacks = {}; // Diccionario para almacenar callbacks específicos para cada tipo de medios.
        this.initializeSocketEvents(); // Configura los eventos del socket.
    }

    // Método para registrar callbacks para diferentes tipos de medios (audio/video).
    registerMediaCallback(mediaType, callback) {
        console.log("Registering media callback for type:", mediaType);
        this.mediaCallbacks[mediaType] = callback;
    }
    createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection();

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
                console.log('ICE candidate sent:', event.candidate);
            }
        };

        // Modificar el evento ontrack para manejar diferentes tipos de medios.
        peerConnection.ontrack = (event) => {
            console.log("Remote event received:", event);
            console.log('Remote track received:', event.streams[0]);
        
            event.streams[0].getTracks().forEach(track => {
                if (track.kind in this.mediaCallbacks) {
                    // Llamar al callback registrado para este tipo de medio (audio/video).
                    this.mediaCallbacks[track.kind](event.streams[0], userId);
                } else {
                    console.log(`No callback registered for media type: ${track.kind}`);
                }
            });
        };
        

        this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream));
        this.peerConnections[userId] = peerConnection;
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
        indicator.className = 'voice-indicator-user';
        document.body.appendChild(indicator);

        const updateRemoteIndicator = () => {
            analyser.getByteFrequencyData(dataArray); // Obtiene los datos de frecuencia actuales.
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const color = average > 10 ? 'green' : 'red'; // Cambia el color del indicador basado en la actividad de audio.
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