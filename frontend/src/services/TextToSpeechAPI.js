import axios from "axios";

const API_URL = "http://localhost:5001";

class TextToSpeechAPIService {
  constructor() {
    this.currentAudio = null;
  }

  // Speak text using backend TTS
  async speak(text, options = {}) {
    const {
      language = 'en-US',
      onEnd = null,
      onStart = null,
      onError = null
    } = options;

    try {
      // Stop any playing audio
      this.stop();

      if (onStart) onStart();

      // Call your backend TTS endpoint
      const response = await axios.post(`${API_URL}/tts`, {
        text,
        language
      });

      const audioBase64 = response.data.audio;
      
      // Create audio element from base64
      this.currentAudio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      
      return new Promise((resolve, reject) => {
        this.currentAudio.onended = () => {
          if (onEnd) onEnd();
          resolve();
        };
        
        this.currentAudio.onerror = (error) => {
          if (onError) onError(error);
          reject(error);
        };
        
        this.currentAudio.play();
      });

    } catch (error) {
      console.error('TTS API error:', error);
      if (onError) onError(error);
      throw error;
    }
  }

  // Stop speaking
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  // Check if currently speaking
  isSpeaking() {
    return this.currentAudio && !this.currentAudio.paused;
  }
}

export default new TextToSpeechAPIService();