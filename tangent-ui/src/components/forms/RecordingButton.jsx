import React, { useRef, useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

export const RecordingButton = ({ 
  onTranscriptionComplete, 
  onRecordingStart,
  onRecordingStop,
  variant = 'default', 
  className = '' 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [tempTranscript, setTempTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorderRef.current.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendToWhisperServer(audioBlob);
      });

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setTempTranscript('');
      onRecordingStart?.();
    } catch (error) {
      console.error('Recording error:', error);
      setError(error.name === 'NotAllowedError' 
        ? 'Please allow microphone access to record audio.'
        : 'Failed to start recording: ' + error.message
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      onRecordingStop?.();
    }
  };

  async function audioBufferToWav(buffer, sampleRate = 16000) {
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.duration * sampleRate,
      sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const resampledBuffer = await offlineContext.startRendering();
    return bufferToWave(resampledBuffer, resampledBuffer.length);
  }

  function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [],
        pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * numOfChan * 2); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < numOfChan; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    let offset = 0;
    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // Convert to 16-bit
        view.setInt16(pos, sample, true); // Write 16-bit sample
        pos += 2;
      }
      offset++; // Next source sample
    }

    // Helper functions to write data
    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  const sendToWhisperServer = async (audioBlob) => {
    try {
      console.log('Processing audio...');
      
      // Decode the WebM audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Resample and encode the audio data as WAV at 16 kHz
      console.log('Converting to WAV...');
      const wavBlob = await audioBufferToWav(audioBuffer, 16000);
      console.log('WAV blob size:', wavBlob.size, 'bytes');

      const formData = new FormData();
      formData.append('file', wavBlob, 'recording.wav');
      formData.append('temperature', '0.0');

      console.log('Sending request to Whisper server...');
      const response = await fetch('http://127.0.0.1:8080/inference', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Whisper response:', data);

      if (data.text?.trim()) {
        setTempTranscript(data.text);
        onTranscriptionComplete?.(data.text);
      } else {
        throw new Error('No transcription text received');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setError('Transcription failed: ' + error.message);
    }
  };

  const buttonStyles = {
    default: `p-3 rounded-xl transition-all duration-300 ${
      isRecording 
        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
        : 'bg-blue-500 hover:bg-blue-600'
    }`,
    branch: `p-2 rounded-full hover:bg-gray-100 transition-colors ${
      isRecording ? 'text-red-500 animate-pulse' : ''
    }`
  };

  return (
    <div className="relative">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!!error}
        className={`${buttonStyles[variant]} ${className}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <MicOff className={`h-5 w-5 ${variant === 'default' ? 'text-white' : ''}`} />
        ) : (
          <Mic className={`h-5 w-5 ${variant === 'default' ? 'text-white' : ''}`} />
        )}
      </button>
      
      {error && (
        <Alert variant="destructive" className="mt-2 absolute bottom-full mb-2 w-64">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isRecording && tempTranscript && variant === 'default' && (
        <div className="mt-2 text-sm text-gray-600 animate-pulse">
          {tempTranscript}
        </div>
      )}
    </div>
  );
};

const Alert = ({ children, variant = "default", className = "" }) => {
  const baseStyles = "relative w-full rounded-lg border px-4 py-3 text-sm";
  const variantStyles = {
    default: "bg-white text-gray-950 border-gray-200",
    destructive: "border-red-500/50 text-red-600 bg-red-50",
    warning: "border-yellow-500/50 text-yellow-700 bg-yellow-50/50",
    info: "border-blue-500/50 text-blue-700 bg-blue-50/50",
    success: "border-green-500/50 text-green-700 bg-green-50/50"
  };

  return (
    <div role="alert" className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
};

const AlertDescription = ({ children, className = "" }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`}>
    {children}
  </div>
);

