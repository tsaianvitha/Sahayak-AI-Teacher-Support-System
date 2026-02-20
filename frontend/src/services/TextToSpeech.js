// src/services/TextToSpeech.js
// Hybrid: Browser TTS + Google Translate TTS fallback

class TextToSpeechService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentUtterance = null;
    this.currentAudio = null;
    this.voices = [];
    this.isLoaded = false;
  }

  // Load available voices
  async loadVoices() {
    return new Promise((resolve) => {
      const loadVoicesWhenAvailable = () => {
        this.voices = this.synth.getVoices();
        if (this.voices.length > 0) {
          this.isLoaded = true;
          resolve(this.voices);
        }
      };

      loadVoicesWhenAvailable();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = loadVoicesWhenAvailable;
      }
    });
  }

  // Get voices for a specific language
  getVoicesForLanguage(languageCode) {
    return this.voices.filter(voice => 
      voice.lang.startsWith(languageCode.split('-')[0])
    );
  }

  // Check if browser has native support for the language
  hasNativeSupport(languageCode) {
    const voices = this.getVoicesForLanguage(languageCode);
    return voices.length > 0;
  }

  // Get best voice for language
  getBestVoice(languageCode) {
    const voices = this.getVoicesForLanguage(languageCode);
    
    if (voices.length === 0) {
      return null;
    }

    // Prefer Google/Microsoft voices, then local
    const preferred = voices.find(v => 
      v.name.includes('Google') || v.name.includes('Microsoft')
    );
    
    return preferred || voices[0];
  }

  // ✅ NEW: Use Google Translate TTS as fallback
  async speakWithGoogleTTS(text, languageCode) {
    try {
      // Stop any playing audio
      this.stop();

      // Google Translate TTS endpoint (FREE, no API key needed)
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${languageCode}&client=tw-ob`;
      
      this.currentAudio = new Audio(url);
      
      return new Promise((resolve, reject) => {
        this.currentAudio.onended = resolve;
        this.currentAudio.onerror = reject;
        this.currentAudio.play();
      });
    } catch (error) {
      console.error('Google TTS error:', error);
      throw error;
    }
  }

  // Main speak function with automatic fallback
  async speak(text, options = {}) {
    const {
      language = 'en-US',
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0,
      onEnd = null,
      onStart = null,
      onError = null
    } = options;

    // Extract language code (e.g., 'te' from 'te-IN')
    const langCode = language.split('-')[0];

    // ✅ Check if browser has native support for this language
    const hasNative = this.hasNativeSupport(language);

    if (!hasNative || langCode === 'te' || langCode === 'ta' || langCode === 'kn' || langCode === 'ml') {
      // Use Google TTS for Indian languages (more reliable)
      console.log(`Using Google TTS for ${language}`);
      try {
        if (onStart) onStart();
        await this.speakWithGoogleTTS(text, langCode);
        if (onEnd) onEnd();
      } catch (error) {
        if (onError) onError(error);
        console.error('TTS error:', error);
      }
    } else {
      // Use browser native TTS
      console.log(`Using native TTS for ${language}`);
      this.speakWithBrowserTTS(text, {
        language,
        rate,
        pitch,
        volume,
        onEnd,
        onStart,
        onError
      });
    }
  }

  // Browser native TTS
  speakWithBrowserTTS(text, options = {}) {
    const {
      language = 'en-US',
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0,
      onEnd = null,
      onStart = null,
      onError = null
    } = options;

    // Stop any ongoing speech
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    const voice = this.getBestVoice(language);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = language;
    
    // Set properties
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Event handlers
    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  // Stop speaking
  stop() {
    // Stop browser TTS
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    
    // Stop Google TTS audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  // Check if currently speaking
  isSpeaking() {
    return this.synth.speaking || (this.currentAudio && !this.currentAudio.paused);
  }

  // Check if supported
  isSupported() {
    return 'speechSynthesis' in window;
  }
}

export default new TextToSpeechService();