# KittenTTS Optimization Guide for Realistic Speech Synthesis

## Overview
This guide provides optimal configuration settings and code modifications for KittenTTS to achieve the most realistic sounding speech synthesis, based on community feedback and code analysis.

## Critical Issues and Solutions

### 1. Audio Trimming Problem
**Issue**: Default trimming cuts off speech beginnings and endings
- Current: `audio = outputs[0][5000:-10000]` (line 105 in `kittentts/onnx_model.py`)
- **Solution**: Change to `audio = outputs[0][10:-200]`

### 2. Speech Speed
**Issue**: Default speed (1.0) is too slow and unnatural
- **Solution**: Use speed between 1.1-1.3x

### 3. Voice Selection
**Issue**: Default voice 5 has poor speed characteristics
- **Solution**: Use voices 2-4 for better quality

## Optimal Configuration Settings

### Best Voice Configurations

| Voice | Optimal Speed | Description | Use Case |
|-------|--------------|-------------|----------|
| `expr-voice-3-f` | 1.2x | Natural female voice | General purpose, most natural |
| `expr-voice-4-m` | 1.25x | Clear male voice | Clear articulation, documentation |
| `expr-voice-2-f` | 1.2x | Bright female voice | Energetic content |
| `expr-voice-3-m` | 1.2x | Balanced male voice | Narration |

### Voice Characteristics

- **expr-voice-2-f**: Clear, bright, slightly higher pitch
- **expr-voice-2-m**: Deep, authoritative, good for narration
- **expr-voice-3-f**: Most natural sounding female voice
- **expr-voice-3-m**: Good balance of clarity and depth
- **expr-voice-4-f**: Lighter, more energetic
- **expr-voice-4-m**: Clear articulation, good for fast speech
- **expr-voice-5-f/m**: Default voices - require 1.5x speed minimum

## Implementation Code

### Basic Optimized Implementation

```python
from kittentts import KittenTTS
import numpy as np
import soundfile as sf

class OptimizedKittenTTS(KittenTTS):
    def generate_custom(self, text, voice="expr-voice-3-f", speed=1.2, 
                       start_trim=10, end_trim=200):
        """Generate audio with custom trimming to avoid cut-offs."""
        # Get raw output from model
        onnx_inputs = self.model._prepare_inputs(text, voice, speed)
        outputs = self.model.session.run(None, onnx_inputs)
        
        # Apply custom trimming instead of default aggressive trimming
        audio = outputs[0][start_trim:-end_trim]
        
        return audio
    
    def generate_to_file_custom(self, text, output_path, voice="expr-voice-3-f", 
                               speed=1.2, sample_rate=24000, start_trim=10, end_trim=200):
        """Generate audio with custom trimming and save to file."""
        audio = self.generate_custom(text, voice, speed, start_trim, end_trim)
        sf.write(output_path, audio, sample_rate)

# Usage
tts = OptimizedKittenTTS("KittenML/kitten-tts-nano-0.1")
tts.generate_to_file_custom(
    "Your text here.", 
    "output.wav", 
    voice="expr-voice-3-f", 
    speed=1.2
)
```

### Advanced Implementation with Post-Processing

```python
import numpy as np
from scipy import signal

class AdvancedTTS:
    def __init__(self, model_name="KittenML/kitten-tts-nano-0.1"):
        self.tts = KittenTTS(model_name)
        
    def add_room_acoustics(self, audio, room_size=0.1, damping=0.7):
        """Add subtle reverb for natural sound."""
        delay_samples = int(room_size * 0.05 * 24000)
        decay = 1 - damping
        
        reverb = np.zeros_like(audio)
        for i in range(len(audio)):
            if i < delay_samples:
                reverb[i] = audio[i]
            else:
                reverb[i] = audio[i] + decay * reverb[i - delay_samples] * 0.3
                
        return reverb
    
    def apply_eq(self, audio, sample_rate=24000):
        """Enhance speech clarity with EQ."""
        nyquist = sample_rate / 2
        low = 300 / nyquist
        high = 3400 / nyquist
        
        b, a = signal.butter(4, [low, high], btype='band')
        filtered = signal.filtfilt(b, a, audio)
        
        return 0.5 * audio + 0.5 * filtered
    
    def normalize_audio(self, audio, target_db=-20):
        """Normalize volume to consistent level."""
        rms = np.sqrt(np.mean(audio**2))
        if rms > 0:
            target_rms = 10**(target_db / 20)
            scale = target_rms / rms
            return audio * scale
        return audio
```

## Recommended Settings Summary

### Essential Parameters
- **Speed**: 1.1-1.3x (never use default 1.0)
- **Trimming**: `[10:-200]` instead of `[5000:-10000]`
- **Voice**: Avoid voice 5, use voices 2-4
- **Sample Rate**: Keep at 24000 Hz

### Text Preparation
- Add trailing punctuation to prevent cutoffs
- Remove emojis and special characters
- Use punctuation for natural pauses
- Add quotes for emphasis

### Post-Processing Options (Optional)
1. **Light Reverb**: room_size=0.1, damping=0.7
2. **EQ Boost**: 300-3400 Hz for speech clarity
3. **Normalization**: -20dB for consistent volume

## Quick Start Example

```python
from kittentts import KittenTTS

# Initialize
tts = KittenTTS("KittenML/kitten-tts-nano-0.1")

# Best female voice
tts.generate_to_file(
    "Hello, this is optimized KittenTTS.", 
    "output_female.wav",
    voice="expr-voice-3-f",
    speed=1.2
)

# Best male voice  
tts.generate_to_file(
    "Hello, this is optimized KittenTTS.",
    "output_male.wav", 
    voice="expr-voice-4-m",
    speed=1.25
)
```

## Performance Comparison

| Configuration | Quality | Speed | Naturalness |
|--------------|---------|-------|-------------|
| Default (voice-5, 1.0x) | Poor | Too slow | Robotic |
| Optimized (voice-3, 1.2x) | Good | Natural | Much better |
| Enhanced (with post-proc) | Best | Natural | Most realistic |

## Notes
- The model is only 25MB, so some limitations are expected
- Post-processing adds minimal latency but significant quality improvement
- Different voices work better for different content types
- Always test with your specific use case