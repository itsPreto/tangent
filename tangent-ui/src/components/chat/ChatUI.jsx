import React, {
    useState,
} from "react";
import {
    ArrowLeft,
} from "lucide-react";
import {
    Button,
    Input,
} from "../index";




const ChatUI = ({ topic, model, onBack }) => {
    const [messages, setMessages] = useState([
        { role: "system", content: `You are now discussing: ${topic}` },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const newMessages = [...messages, { role: "user", content: input }];
        setMessages(newMessages);
        setInput("");
        setLoading(true);

        try {
            const response = await fetch("http://localhost:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model || "qwen2.5-coder:7b",
                    messages: newMessages,
                    stream: false,
                }),
            });
            const data = await response.json();
            if (data.message?.content) {
                setMessages([
                    ...newMessages,
                    { role: "assistant", content: data.message.content },
                ]);
            }
        } catch (error) {
            console.error("Error during chat:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{topic}</h2>
                <Button variant="ghost" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                    Back
                </Button>
            </div>
            <div className="border rounded-lg p-4 h-96 overflow-y-auto">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"
                            }`}
                    >
                        <div
                            className={`inline-block px-4 py-2 rounded-lg ${msg.role === "user"
                                ? "bg-primary text-white"
                                : "bg-gray-200 text-black"
                                }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="text-left">
                        <div className="inline-block px-4 py-2 rounded-lg bg-gray-200 text-black">
                            Typing...
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => {
                        if (e.key === "Enter") {
                            sendMessage();
                        }
                    }}
                />
                <Button onClick={sendMessage} disabled={loading}>
                    Send
                </Button>
            </div>
        </div>
    );
};


export default ChatUI;