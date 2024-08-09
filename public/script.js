const socket = io();

var userInput;
var microphoneState = document.getElementById('microphone-state');
var audioContext;
var mediaStreamSource;
var micImage = document.getElementById('mic-image');
var voiceIndicator = document.getElementById('voice-indicator'); // Indicador de voz

window.onload = function () {
    do {
        userInput = prompt("Enter Your name");
        socket.emit("joinedusername", userInput);
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

        await audioContext.audioWorklet.addModule('processor.js'); // Cargar el módulo del procesador de audio
    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
}

function toggleMicrophone() {
    if (micImage.classList.contains('bi-mic-mute')) {
        micImage.classList.remove('bi-mic-mute');
        micImage.classList.add('bi-mic');
        microphoneState.textContent = "Unmuted";

        // Iniciar transmisión de datos de audio al servidor
        startStreaming();
    } else {
        micImage.classList.remove('bi-mic');
        micImage.classList.add('bi-mic-mute');
        microphoneState.textContent = "Muted";

        // Detener transmisión de datos de audio al servidor
        stopStreaming();
    }
}

function startStreaming() {
    const node = new AudioWorkletNode(audioContext, 'audio-processor');

    node.port.onmessage = (event) => {
        const audioData = event.data;

        // Indicador de voz según nivel de audio
        const maxLevel = Math.max(...audioData);
        if (maxLevel > 0.01) { // Umbral para indicar que se está hablando
            voiceIndicator.style.backgroundColor = "green";
        } else {
            voiceIndicator.style.backgroundColor = "red";
        }

        // Enviar los datos de audio al servidor
        if (!micImage.classList.contains('bi-mic-mute')) {
            socket.emit("audio", audioData);
        }
    };

    mediaStreamSource.connect(node);
    // No conectamos el node a audioContext.destination para evitar escucharte a ti mismo
}

function stopStreaming() {
    // Desconectar mediaStreamSource de cualquier nodo
    mediaStreamSource.disconnect();
    voiceIndicator.style.backgroundColor = "red"; // Indicador de que no se está transmitiendo
}

// Código restante igual
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
let mediaSource;
let sourceBuffer;
let queue = []; // Cola para almacenar los ArrayBuffers que llegan

socket.on("audio1", (data) => {
    if (!mediaSource) {
        mediaSource = new MediaSource();
        audioElement = document.createElement('audio');
        audioElement.src = URL.createObjectURL(mediaSource);
        audioElement.controls = true;
        document.body.appendChild(audioElement);

        mediaSource.addEventListener('sourceopen', () => {
            sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="vorbis"');
            
            // Procesar la cola si hay datos almacenados
            processQueue();
            
            sourceBuffer.addEventListener('updateend', () => {
                // Revisa si hay más datos en la cola para agregar al buffer
                if (queue.length > 0) {
                    processQueue();
                } else {
                    mediaSource.endOfStream(); // Finaliza el stream si no hay más datos
                    audioElement.play(); // Inicia la reproducción
                }
            });

            sourceBuffer.addEventListener('error', (e) => {
                console.error('Error in SourceBuffer:', e);
                audioElement.pause();
                audioElement.currentTime = 0; // Reinicia el audio en caso de error
            });
        });
    }

    // Agrega los datos entrantes a la cola
    queue.push(data);

    // Si el sourceBuffer ya está abierto y no está ocupado, procesa la cola inmediatamente
    if (sourceBuffer && !sourceBuffer.updating) {
        processQueue();
    }
});

function processQueue() {
    if (queue.length > 0 && sourceBuffer && !sourceBuffer.updating) {
        const data = queue.shift();
        try {
            sourceBuffer.appendBuffer(data);
        } catch (e) {
            console.error('Error appending buffer:', e);
            queue.unshift(data); // Reintroduce el buffer en la cola en caso de error
        }
    }
}
