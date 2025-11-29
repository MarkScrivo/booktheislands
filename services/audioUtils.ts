/**
 * Audio utilities for Gemini Live Audio
 * Handles PCM audio recording and playback
 */

// Audio format constants for Gemini Live API
export const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,  // 16kHz for input
  OUTPUT_SAMPLE_RATE: 24000, // 24kHz for output
  CHANNELS: 1,               // Mono
  BIT_DEPTH: 16,            // 16-bit PCM
};

/**
 * Audio Recorder class
 * Captures microphone input and converts to 16-bit PCM at 16kHz
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onDataCallback: ((data: Int16Array) => void) | null = null;

  /**
   * Initialize the audio recorder
   */
  async initialize(onData: (data: Int16Array) => void): Promise<void> {
    this.onDataCallback = onData;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
          channelCount: AUDIO_CONFIG.CHANNELS,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.INPUT_SAMPLE_RATE,
      });

      // Create source from microphone stream
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create processor for PCM conversion
      await this.setupAudioProcessor();

    } catch (error) {
      console.error('Failed to initialize audio recorder:', error);
      throw error;
    }
  }

  /**
   * Set up audio processor using ScriptProcessorNode
   * (AudioWorklet is preferred but ScriptProcessor is more compatible)
   */
  private async setupAudioProcessor(): Promise<void> {
    if (!this.audioContext || !this.source) {
      throw new Error('Audio context not initialized');
    }

    // Use ScriptProcessorNode for compatibility
    // Buffer size: 256 samples (matching audio-orb for real-time streaming)
    const processor = this.audioContext.createScriptProcessor(256, 1, 1);

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
      const pcmData = this.floatTo16BitPCM(inputData);

      if (this.onDataCallback) {
        this.onDataCallback(pcmData);
      }
    };

    this.source.connect(processor);
    processor.connect(this.audioContext.destination);
    this.workletNode = processor as any; // Store for cleanup
  }

  /**
   * Convert Float32Array to 16-bit PCM Int16Array
   */
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Convert float32 -1 to 1 to int16 -32768 to 32767
      // Using 32768 for both positive and negative (matching audio-orb)
      int16Array[i] = float32Array[i] * 32768;
    }
    return int16Array;
  }

  /**
   * Stop recording and cleanup resources
   */
  async stop(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.onDataCallback = null;
  }
}

/**
 * Audio Player class
 * Plays 16-bit PCM audio at 24kHz
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;

  /**
   * Initialize the audio player
   */
  async initialize(): Promise<void> {
    try {
      this.audioContext = new AudioContext({
        sampleRate: AUDIO_CONFIG.OUTPUT_SAMPLE_RATE,
      });
      this.nextStartTime = this.audioContext.currentTime;
      this.isPlaying = true;
    } catch (error) {
      console.error('Failed to initialize audio player:', error);
      throw error;
    }
  }

  /**
   * Play a chunk of 16-bit PCM audio
   */
  async play(pcmData: Int16Array): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio player not initialized');
    }

    // Convert Int16Array to Float32Array
    const float32Array = this.pcm16ToFloat32(pcmData);

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      AUDIO_CONFIG.CHANNELS,
      float32Array.length,
      AUDIO_CONFIG.OUTPUT_SAMPLE_RATE
    );

    // Copy data to buffer
    audioBuffer.copyToChannel(float32Array, 0);

    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Schedule playback
    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);

    // Update next start time for seamless playback
    this.nextStartTime = startTime + audioBuffer.duration;

    // Clean up after playback
    source.onended = () => {
      const index = this.audioQueue.indexOf(source);
      if (index > -1) {
        this.audioQueue.splice(index, 1);
      }
    };

    this.audioQueue.push(source);
  }

  /**
   * Convert 16-bit PCM Int16Array to Float32Array
   */
  private pcm16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      // Convert from 16-bit range to [-1, 1] float range
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }
    return float32Array;
  }

  /**
   * Stop playback and cleanup resources
   */
  async stop(): Promise<void> {
    // Stop all queued audio
    this.audioQueue.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Source might already be stopped
      }
    });
    this.audioQueue = [];

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying && this.audioQueue.length > 0;
  }
}

/**
 * Check if browser supports required audio APIs
 */
export function checkAudioSupport(): {
  supported: boolean;
  missingFeatures: string[];
} {
  const missingFeatures: string[] = [];

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    missingFeatures.push('MediaDevices API');
  }

  if (!window.AudioContext && !(window as any).webkitAudioContext) {
    missingFeatures.push('Web Audio API');
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures,
  };
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}
