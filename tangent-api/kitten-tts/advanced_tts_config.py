#!/usr/bin/env python3
"""
Advanced configuration guide for KittenTTS with post-processing options.
Includes voice modulation and audio enhancement techniques.
"""

import numpy as np
from scipy import signal
from kittentts import KittenTTS
import soundfile as sf
import os

class AdvancedTTS:
    def __init__(self, model_name="KittenML/kitten-tts-nano-0.1"):
        self.tts = KittenTTS(model_name)
        
    def add_room_acoustics(self, audio, room_size=0.3, damping=0.5):
        """
        Add simple room acoustics/reverb for more natural sound.
        
        Args:
            audio: Input audio array
            room_size: Room size parameter (0.0-1.0)
            damping: Damping factor (0.0-1.0)
        """
        # Simple reverb using delayed feedback
        delay_samples = int(room_size * 0.05 * 24000)  # Assuming 24kHz
        decay = 1 - damping
        
        reverb = np.zeros_like(audio)
        for i in range(len(audio)):
            if i < delay_samples:
                reverb[i] = audio[i]
            else:
                reverb[i] = audio[i] + decay * reverb[i - delay_samples] * 0.3
                
        return reverb
    
    def apply_eq(self, audio, sample_rate=24000):
        """
        Apply EQ to enhance speech clarity.
        Boosts mid-range frequencies where speech is most intelligible.
        """
        # Design a bandpass filter for speech frequencies (300-3400 Hz)
        nyquist = sample_rate / 2
        low = 300 / nyquist
        high = 3400 / nyquist
        
        # Create filter
        b, a = signal.butter(4, [low, high], btype='band')
        
        # Apply filter
        filtered = signal.filtfilt(b, a, audio)
        
        # Mix with original (50/50) to maintain some original character
        return 0.5 * audio + 0.5 * filtered
    
    def normalize_audio(self, audio, target_db=-20):
        """
        Normalize audio to target dB level for consistent volume.
        """
        # Calculate current RMS
        rms = np.sqrt(np.mean(audio**2))
        
        # Calculate target RMS from dB
        target_rms = 10**(target_db / 20)
        
        # Calculate scaling factor
        if rms > 0:
            scale = target_rms / rms
            return audio * scale
        return audio
    
    def generate_enhanced(self, text, voice="expr-voice-3-f", speed=1.2,
                         add_reverb=True, apply_eq_filter=True, normalize=True):
        """
        Generate speech with all enhancements applied.
        """
        # Get base audio with custom trimming
        onnx_inputs = self.tts.model._prepare_inputs(text, voice, speed)
        outputs = self.tts.model.session.run(None, onnx_inputs)
        
        # Use less aggressive trimming
        audio = outputs[0][10:-200]
        
        # Apply enhancements
        if apply_eq_filter:
            audio = self.apply_eq(audio)
            
        if add_reverb:
            audio = self.add_room_acoustics(audio, room_size=0.1, damping=0.7)
            
        if normalize:
            audio = self.normalize_audio(audio)
            
        return audio


def voice_characteristics():
    """
    Voice characteristics analysis based on community testing.
    """
    return {
        "expr-voice-2-f": {
            "description": "Clear female voice, good articulation",
            "optimal_speed": 1.2,
            "characteristics": "Bright, clear, slightly higher pitch"
        },
        "expr-voice-2-m": {
            "description": "Deep male voice",
            "optimal_speed": 1.15,
            "characteristics": "Deep, authoritative, good for narration"
        },
        "expr-voice-3-f": {
            "description": "Natural female voice",
            "optimal_speed": 1.1,
            "characteristics": "Most natural sounding female voice"
        },
        "expr-voice-3-m": {
            "description": "Balanced male voice",
            "optimal_speed": 1.2,
            "characteristics": "Good balance of clarity and depth"
        },
        "expr-voice-4-f": {
            "description": "Young female voice",
            "optimal_speed": 1.3,
            "characteristics": "Lighter, more energetic"
        },
        "expr-voice-4-m": {
            "description": "Clear male voice",
            "optimal_speed": 1.25,
            "characteristics": "Clear articulation, good for fast speech"
        },
        "expr-voice-5-f": {
            "description": "Default female (slow)",
            "optimal_speed": 1.5,
            "characteristics": "Requires higher speed setting"
        },
        "expr-voice-5-m": {
            "description": "Default male (slow)",
            "optimal_speed": 1.5,
            "characteristics": "Requires higher speed setting"
        }
    }


def main():
    # Initialize advanced TTS
    tts = AdvancedTTS()
    
    # Test different text types
    test_texts = {
        "short": "Hello, this is a test of KittenTTS.",
        "medium": "KittenTTS provides high-quality speech synthesis in a tiny package, perfect for edge devices.",
        "long": """The quick brown fox jumps over the lazy dog. This pangram sentence contains every letter 
                   of the alphabet and is commonly used for testing text rendering and speech synthesis systems."""
    }
    
    # Create output directory
    os.makedirs("enhanced_output", exist_ok=True)
    
    print("Generating enhanced TTS samples with post-processing...")
    print("="*60)
    
    # Get voice info
    voices = voice_characteristics()
    
    # Test best configurations
    best_configs = [
        ("expr-voice-3-f", 1.2, "Natural female"),
        ("expr-voice-4-m", 1.25, "Clear male"),
        ("expr-voice-2-f", 1.2, "Bright female"),
        ("expr-voice-3-m", 1.2, "Balanced male")
    ]
    
    for voice, speed, desc in best_configs:
        for text_type, text in test_texts.items():
            # Generate with enhancements
            enhanced_audio = tts.generate_enhanced(
                text, 
                voice=voice, 
                speed=speed,
                add_reverb=True,
                apply_eq_filter=True,
                normalize=True
            )
            
            # Save enhanced version
            output_file = f"enhanced_output/{voice}-{text_type}-enhanced.wav"
            sf.write(output_file, enhanced_audio, 24000)
            
            # Also generate raw version for comparison
            raw_audio = tts.tts.generate(text, voice=voice, speed=speed)
            raw_file = f"enhanced_output/{voice}-{text_type}-raw.wav"
            sf.write(raw_file, raw_audio, 24000)
            
            print(f"Generated: {desc} - {text_type} text")
    
    print("\n" + "="*60)
    print("OPTIMAL CONFIGURATION SUMMARY:")
    print("="*60)
    print("\n1. BEST OVERALL VOICES:")
    print("   - Female: expr-voice-3-f @ 1.2x speed")
    print("   - Male: expr-voice-4-m @ 1.25x speed")
    print("\n2. CRITICAL FIXES:")
    print("   - Change trimming from [5000:-10000] to [10:-200]")
    print("   - Always use speed 1.1-1.3x (never 1.0)")
    print("   - Add trailing punctuation to text")
    print("\n3. ENHANCEMENT OPTIONS:")
    print("   - Light reverb (room_size=0.1) for naturalness")
    print("   - EQ boost for speech frequencies (300-3400 Hz)")
    print("   - Normalize to -20dB for consistent volume")
    print("\n4. TEXT PREPARATION:")
    print("   - Clean text of emojis/special chars")
    print("   - Add pauses with commas and periods")
    print("   - Use quotes for emphasis")
    
    # Generate voice comparison report
    print("\n" + "="*60)
    print("VOICE CHARACTERISTICS:")
    print("="*60)
    for voice_id, info in voices.items():
        print(f"\n{voice_id}:")
        print(f"  Description: {info['description']}")
        print(f"  Optimal Speed: {info['optimal_speed']}x")
        print(f"  Character: {info['characteristics']}")


if __name__ == "__main__":
    main()