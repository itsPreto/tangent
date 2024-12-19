import {
    motion,
    AnimatePresence,
} from "framer-motion";
import React, {
    useState,
    useRef,
    useContext,
} from "react";
import {
    Loader2,
    Mic,
    MicOff,
    Search,
    ArrowRight,
    AlertTriangle,
    Brain,
} from "lucide-react";
import {
    Card,
    CardContent,
    Button,
    ScrollArea,
    Badge,
} from "../index";
import { Alert, AlertDescription } from "../core/alert";
import ChatUI from "../chat/ChatUI";
import AudioVisualizer from "../visualization/AudioVisualizer";

import { cn } from "../../utils/utils";



const ExploreTab = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [processing, setProcessing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [relatedChats, setRelatedChats] = useState([]);
    const [error, setError] = useState(null);
    const audioContextRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [isChatting, setIsChatting] = useState(false);
    const [selectedTopic, setSelectedTopic] = useState("");
    const [selectedModel, setSelectedModel] = useState(null);

    const startListening = async () => {
        try {
            setError(null);
            audioChunksRef.current = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            audioContextRef.current = new (window.AudioContext ||
                window.webkitAudioContext)();
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
                audioChunksRef.current.push(event.data);
            });

            mediaRecorderRef.current.addEventListener("stop", async () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: "audio/webm",
                });
                await sendToWhisperServer(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            });

            mediaRecorderRef.current.start(1000);
            setIsListening(true);
        } catch (error) {
            setError("Could not access microphone. Please check permissions.");
            console.error("Error starting recording:", error);
        }
    };

    const stopListening = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
            setIsListening(false);
            setProcessing(true);
        }
    };

    const sendToWhisperServer = async (audioBlob) => {
        const url = `http://127.0.0.1:8080/inference`;
        try {
            // Decode the WebM audio data
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(
                arrayBuffer
            );

            // Resample and encode the audio data as WAV at 16 kHz
            const wavBlob = await audioBufferToWav(audioBuffer, 16000);

            // Prepare the form data
            const formData = new FormData();
            formData.append("file", wavBlob, "recording.wav");
            formData.append("temperature", "0.0");

            // Send the WAV file to the server
            const response = await fetch(url, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (data.text?.trim()) {
                setTranscript(data.text);
                await processTranscript(data.text);
            }
        } catch (error) {
            setError("Failed to process audio. Please try again.");
            console.error("Transcription error:", error);
        } finally {
            setProcessing(false);
        }
    };

    async function audioBufferToWav(buffer, sampleRate = 16000) {
        // Create an OfflineAudioContext with the desired sample rate
        const offlineContext = new OfflineAudioContext(
            buffer.numberOfChannels,
            buffer.duration * sampleRate,
            sampleRate
        );

        // Create a buffer source for the original audio
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;

        // Connect the source to the destination
        source.connect(offlineContext.destination);

        // Start the source
        source.start(0);

        // Render the audio
        const resampledBuffer = await offlineContext.startRendering();

        // Convert the resampled buffer to WAV
        return bufferToWave(resampledBuffer, resampledBuffer.length);
    }

    function bufferToWave(abuffer, len) {
        let numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [],
            i,
            sample,
            offset = 0,
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
        for (i = 0; i < numOfChan; i++) {
            channels.push(abuffer.getChannelData(i));
        }

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // Convert to 16-bit PCM
                view.setInt16(pos, sample, true); // Write 16-bit sample
                pos += 2;
            }
            offset++; // Next source sample
        }

        // Create Blob
        return new Blob([buffer], { type: "audio/wav" });

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }

    const handleSuggestionClick = async (suggestion) => {
        setSelectedTopic(suggestion.description);
        setIsChatting(true);
    };

    const url_reflect = `http://127.0.0.1:5001/api/get-reflection`;
    const url_chat = `http://localhost:11434/api/chat`;

    const processTranscript = async (text) => {
        try {
            const [reflectionsResponse, suggestResponse] = await Promise.all([
                fetch(url_reflect, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ context: text }),
                }),
                fetch(url_chat, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "qwen2.5-coder:7b",
                        messages: [
                            {
                                role: "user",
                                content: `Give 3 relevant exploration directions based on: "${text}". Return ONLY a JSON array of clear, actionable suggestions.`,
                            },
                        ],
                        stream: false,
                    }),
                }),
            ]);

            const [reflectionsData, suggestData] = await Promise.all([
                reflectionsResponse.json(),
                suggestResponse.json(),
            ]);


            setRelatedChats(reflectionsData.reflections || []);

            if (suggestData.message?.content) {
                try {
                    const cleanContent = suggestData.message.content
                        .replace(/```json\s*|\s*```/g, "")
                        .trim();
                    const suggestions = JSON.parse(cleanContent);
                    setSuggestions(Array.isArray(suggestions) ? suggestions : []);
                } catch (e) {
                    console.error("Error parsing suggestions:", e);
                    setSuggestions([]);
                }
            }
        } catch (error) {
            setError("Failed to process input. Please try again.");
            console.error("Error processing transcript:", error);
            setSuggestions([]);
            setRelatedChats([]);
        }
    };

    return (
        <div className="relative h-full flex flex-col items-center justify-center p-8">
            {!isChatting ? (
                <div className="max-w h-full w-full space-y-20">
                    {/* Audio Visualization */}
                    <AnimatePresence>
                        {isListening && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full h-full"
                            >
                                <AudioVisualizer
                                    isRecording={isListening}
                                    audioContext={audioContextRef.current}
                                    stream={streamRef.current}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-20 text-center"
                    >
                        {!transcript && !processing && (
                            <motion.h2
                                className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                What would you like to explore today?
                            </motion.h2>
                        )}

                        {/* Error Alert */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Microphone Button */}
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                className={cn(
                                    "gap-2 transition-all duration-300",
                                    isListening && "bg-red-500 hover:bg-red-600"
                                )}
                                onClick={isListening ? stopListening : startListening}
                            >
                                {isListening ? (
                                    <>
                                        <MicOff className="h-5 w-5" />
                                        Stop Recording
                                    </>
                                ) : (
                                    <>
                                        <Mic className="h-5 w-5" />
                                        Start Speaking
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Processing State */}
                        <AnimatePresence>
                            {processing && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex flex-col items-center gap-4"
                                >
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-lg text-muted-foreground">
                                        Processing your request...
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Results */}
                        <AnimatePresence>
                            {transcript && !processing && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-8"
                                >
                                    {/* Transcript */}
                                    <Card>
                                        <CardContent className="p-6">
                                            <p className="text-lg">{transcript}</p>
                                        </CardContent>
                                    </Card>

                                    {/* Suggestions */}
                                    {suggestions.length > 0 && (
                                        <motion.div
                                            className="space-y-4"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                        >
                                            <h3 className="text-xl font-semibold">
                                                Suggested Directions
                                            </h3>
                                            <div className="grid gap-4">
                                                {suggestions.map((suggestion, index) => (
                                                    <motion.div
                                                        key={index}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.1 }}
                                                    >
                                                        <Button
                                                            variant="outline"
                                                            className="w-full flex items-center justify-between p-6 h-auto hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
                                                            onClick={() => handleSuggestionClick(suggestion)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <Brain className="h-5 w-5 text-primary" />
                                                                <span className="text-left">
                                                                    {suggestion.description}
                                                                </span>{" "}
                                                                {/* Updated */}
                                                            </div>
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Related Chats */}
                                    {relatedChats.length > 0 && (
                                        <motion.div
                                            className="space-y-4"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                        >
                                            <h3 className="text-xl font-semibold">
                                                Related Past Conversations
                                            </h3>
                                            <ScrollArea className="h-[300px]">
                                                <div className="grid gap-4 pr-4">
                                                    {relatedChats.map((chat, index) => (
                                                        <motion.div
                                                            key={index}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.1 }}
                                                        >
                                                            <Card className="hover:shadow-lg transition-all duration-300">
                                                                <CardContent className="p-6">
                                                                    <div className="flex items-start gap-4">
                                                                        <Search className="h-5 w-5 mt-1 text-primary" />
                                                                        <div className="flex-1">
                                                                            <Badge
                                                                                variant="secondary"
                                                                                className="mb-2"
                                                                            >
                                                                                Previous Discussion
                                                                            </Badge>
                                                                            <p className="text-sm leading-relaxed">
                                                                                {chat}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            ) : (
                <ChatUI
                    topic={selectedTopic}
                    model={selectedModel}
                    onBack={() => setIsChatting(false)}
                />
            )}
        </div>
    );
};


export default ExploreTab;