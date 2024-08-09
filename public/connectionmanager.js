export class PeerConnectionManager {
    constructor(socket) {
        this.socket = socket;
        this.localStream = null;
        this.peerConnections = {};
        this.remoteStreams = {};
        this.remoteIndicators = {};
        this.initializeSocketEvents();
    }

    async setupLocalStream(audioDeviceId, videoDeviceId = null) {
        const constraints = {
            audio: audioDeviceId ? { deviceId: audioDeviceId } : true,
            video: videoDeviceId ? { deviceId: videoDeviceId } : false
        };

        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Local stream created:', this.localStream);
            this.addLocalStreamToPeers();
            return this.localStream;
        } catch (error) {
            console.error('Error creating local stream:', error);
        }
    }

    addLocalStreamToPeers() {
        Object.values(this.peerConnections).forEach(peerConnection => {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        });
    }

    createPeerConnection(userId) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
            }
        };

        peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event.streams[0]);
            this.handleRemoteStream(userId, event.streams[0]);
        };

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream));
        }

        this.peerConnections[userId] = peerConnection;
        return peerConnection;
    }

    handleRemoteStream(userId, stream) {
        this.remoteStreams[userId] = stream;
        this.setupRemoteAudio(userId, stream);
        this.setupRemoteIndicator(userId, stream);
        // Aquí se podría añadir la lógica para manejar video en el futuro
    }

    setupRemoteAudio(userId, stream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(error => console.error('Error playing remote audio:', error));
    }

    setupRemoteIndicator(userId, stream) {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        indicator.dataset.userId = userId;
        document.body.appendChild(indicator);

        const updateRemoteIndicator = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            const color = average > 50 ? 'green' : 'red';
            indicator.style.backgroundColor = color;
            requestAnimationFrame(updateRemoteIndicator);
        };

        updateRemoteIndicator();
        this.remoteIndicators[userId] = indicator;
    }

    async createOffer(userId) {
        const peerConnection = this.peerConnections[userId];
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            this.socket.emit('offer', { offer, to: userId });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    async handleOffer(offer, fromUserId) {
        const peerConnection = this.createPeerConnection(fromUserId);
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            this.socket.emit('answer', { answer, to: fromUserId });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(answer, fromUserId) {
        const peerConnection = this.peerConnections[fromUserId];
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidate, fromUserId) {
        const peerConnection = this.peerConnections[fromUserId];
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding received ice candidate:', error);
        }
    }

    initializeSocketEvents() {
        this.socket.on('user-joined', (userId) => {
            if (userId !== this.socket.id) {
                this.createPeerConnection(userId);
                this.createOffer(userId);
            }
        });

        this.socket.on('offer', ({ offer, from }) => this.handleOffer(offer, from));
        this.socket.on('answer', ({ answer, from }) => this.handleAnswer(answer, from));
        this.socket.on('ice-candidate', ({ candidate, from }) => this.handleIceCandidate(candidate, from));

        this.socket.on('user-left', (userId) => {
            if (this.peerConnections[userId]) {
                this.peerConnections[userId].close();
                delete this.peerConnections[userId];
            }
            if (this.remoteStreams[userId]) {
                delete this.remoteStreams[userId];
            }
            if (this.remoteIndicators[userId]) {
                this.remoteIndicators[userId].remove();
                delete this.remoteIndicators[userId];
            }
        });
    }

    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }

    // Método para futura implementación de video
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }

    // Método para futura implementación de chat de texto
    sendTextMessage(message) {
        // Implementar lógica para enviar mensajes de texto
        this.socket.emit('text-message', { message });
    }
}