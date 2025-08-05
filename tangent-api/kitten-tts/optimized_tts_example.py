#!/usr/bin/env python3
"""
Optimized KittenTTS configuration for realistic speech synthesis.
Based on community feedback and code analysis.
"""

from kittentts import KittenTTS
import numpy as np
import soundfile as sf
import os

# Custom trimming function to avoid cutting off speech
def custom_trim_audio(audio, start_trim=10, end_trim=200):
    """
    Custom audio trimming to avoid aggressive cuts.
    Based on Moria's suggestion from Discord.
    """
    return audio[start_trim:-end_trim]

# Extended KittenTTS class with custom trimming
class OptimizedKittenTTS(KittenTTS):
    def __init__(self, model_name="KittenML/kitten-tts-nano-0.1", cache_dir=None):
        super().__init__(model_name, cache_dir)
        
    def generate_custom(self, text, voice="expr-voice-5-m", speed=1.0, 
                       start_trim=10, end_trim=200):
        """
        Generate audio with custom trimming to avoid cut-offs.
        
        Args:
            text: Input text to synthesize
            voice: Voice to use for synthesis
            speed: Speech speed (1.0 = normal, 1.2-1.5 recommended)
            start_trim: Samples to trim from start (default: 10)
            end_trim: Samples to trim from end (default: 200)
        """
        # Get raw output from model
        onnx_inputs = self.model._prepare_inputs(text, voice, speed)
        outputs = self.model.session.run(None, onnx_inputs)
        
        # Apply custom trimming instead of default aggressive trimming
        audio = outputs[0][start_trim:-end_trim]
        
        return audio
    
    def generate_to_file_custom(self, text, output_path, voice="expr-voice-5-m", 
                               speed=1.0, sample_rate=24000, start_trim=10, end_trim=200):
        """Generate audio with custom trimming and save to file."""
        audio = self.generate_custom(text, voice, speed, start_trim, end_trim)
        sf.write(output_path, audio, sample_rate)
        print(f"Audio saved to {output_path}")


def main():
    # Initialize optimized TTS
    tts = OptimizedKittenTTS("KittenML/kitten-tts-nano-0.1")
    
    # Test text
    TEXT = """Kitten TTS is an open-source series of tiny and expressive Text-to-Speech models 
    for on-device applications. Our smallest model is less than 25 megabytes."""
    
    # Recommended configurations based on community feedback
    configs = [
        # Female voices tend to be clearer
        {"voice": "expr-voice-2-f", "speed": 1.2, "desc": "Female v2, speed 1.2"},
        {"voice": "expr-voice-3-f", "speed": 1.1, "desc": "Female v3, speed 1.1"},
        {"voice": "expr-voice-4-f", "speed": 1.3, "desc": "Female v4, speed 1.3"},
        
        # Male voices with optimal speeds
        {"voice": "expr-voice-2-m", "speed": 1.15, "desc": "Male v2, speed 1.15"},
        {"voice": "expr-voice-3-m", "speed": 1.2, "desc": "Male v3, speed 1.2"},
        {"voice": "expr-voice-4-m", "speed": 1.25, "desc": "Male v4, speed 1.25"},
        
        # Community recommended alternatives to default voice 5
        {"voice": "expr-voice-3-f", "speed": 1.2, "desc": "Best female alternative"},
        {"voice": "expr-voice-4-m", "speed": 1.3, "desc": "Best male alternative"},
    ]
    
    # Create output directory
    os.makedirs("output_samples", exist_ok=True)
    
    print("Generating optimized TTS samples...")
    print("-" * 50)
    
    for config in configs:
        voice = config["voice"]
        speed = config["speed"]
        desc = config["desc"]
        
        output_file = f"kitten-tts/output_samples/{voice}-speed{speed}-optimized.wav"
        print(f"Generating: {desc}")
        
        # Use custom generation with better trimming
        tts.generate_to_file_custom(
            TEXT, 
            output_file, 
            voice=voice, 
            speed=speed,
            start_trim=10,    # Much less aggressive than default 5000
            end_trim=200      # Much less aggressive than default 10000
        )
    
    print("\n" + "="*50)
    print("RECOMMENDATIONS FOR MOST REALISTIC SYNTHESIS:")
    print("="*50)
    print("1. SPEED: Use 1.1-1.3x speed (default 1.0 is too slow)")
    print("2. VOICES: Avoid default voice 5, try voices 2-4")
    print("3. TRIMMING: Use custom trimming (10:-200) instead of default (5000:-10000)")
    print("4. TEXT: Add trailing punctuation to avoid abrupt cutoffs")
    print("5. POST-PROCESSING: Consider adding reverb/room acoustics for naturalness")
    print("\nAll samples saved to 'output_samples/' directory")


if __name__ == "__main__":
    main()