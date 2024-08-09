class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        for (let channel = 0; channel < input.length; ++channel) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            for (let i = 0; i < inputChannel.length; ++i) {
                outputChannel[i] = inputChannel[i]; // Simple pass-through for now
            }

            // Send the audio data to the main thread
            this.port.postMessage(inputChannel);
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
