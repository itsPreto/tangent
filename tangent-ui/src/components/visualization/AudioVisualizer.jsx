import React, {
    useRef,
} from "react";


const AudioVisualizer = ({ isRecording, audioContext, stream }) => {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);
    const audioSourceRef = useRef(null);
    const analyzerRef = useRef(null);

    React.useEffect(() => {
        if (!isRecording || !stream || !audioContext) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        analyzerRef.current = audioContext.createAnalyser();
        analyzerRef.current.fftSize = 256;
        audioSourceRef.current = audioContext.createMediaStreamSource(stream);
        audioSourceRef.current.connect(analyzerRef.current);

        const bufferLength = analyzerRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording) return;
            animationFrameRef.current = requestAnimationFrame(draw);
            analyzerRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();

            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, "#60a5fa");
            gradient.addColorStop(0.5, "#3b82f6");
            gradient.addColorStop(1, "#60a5fa");

            for (let i = 0; i < bufferLength; i++) {
                const x = (i / bufferLength) * canvas.width;
                const amplitude = dataArray[i] * 0.5;
                const y = canvas.height / 2 + Math.sin(i * 0.1) * amplitude;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.stroke();
        };

        draw();

        return () => {
            if (animationFrameRef.current)
                cancelAnimationFrame(animationFrameRef.current);
            if (audioSourceRef.current) audioSourceRef.current.disconnect();
        };
    }, [isRecording, stream, audioContext]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-32 bg-background/50 backdrop-blur-sm rounded-lg border border-border/50"
            width={500}
            height={128}
        />
    );
};


export default AudioVisualizer;