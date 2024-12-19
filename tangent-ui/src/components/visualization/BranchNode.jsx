import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../core/card';
import { Badge } from "../index";
import { ChevronDown, ChevronUp, X, PlusCircle, MessageCircle, Timer, Edit2, Maximize2 } from 'lucide-react';
import { RecordingButton } from '../forms/RecordingButton';
import { cn } from '../../utils/utils';
import { motion, AnimatePresence } from 'framer-motion';

const generateThreadColor = (seed) => {
    const hues = [210, 330, 160, 280, 40, 190];
    const index = Math.abs(Math.floor(Math.sin(seed) * hues.length));
    return `hsl(${hues[index]}, 85%, 45%)`;
};

const calculateMessageOffset = (messages, index) => {
    return messages.slice(0, index + 1).reduce((acc, _, i) => (
        acc + (messages[i].content.length > 150 ? 160 : 120)
    ), 100);
};


const MessageTimestamp = ({ messageIndex, side = 'right' }) => {
    const baseTime = new Date();
    const offsetMinutes = messageIndex * 2;
    baseTime.setMinutes(baseTime.getMinutes() - offsetMinutes);

    const hours = baseTime.getHours().toString().padStart(2, '0');
    const minutes = baseTime.getMinutes().toString().padStart(2, '0');

    return (
        <div
            className={cn(
                "absolute flex items-center px-4 gap-1",
                "text-xs font-mono text-muted-foreground/50 hover:text-muted-foreground",
                "transition-colors duration-200",
                side === 'right'
                    ? "left-[calc(100%+16px)] top-4" // Align to top-right of message
                    : "right-[calc(100%+16px)] top-4"  // Align to top-left of message
            )}
        >
            <Timer className="w-3 h-3" />
            <span>{hours}:{minutes}</span>
        </div>
    );
};


const ExpandButton = ({ isExpanded, onClick }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
);

export const BranchNode = ({
    node,
    nodes,
    isExpanded,
    isSelected,
    onToggleExpand,
    onSelect,
    onDelete,
    onDragStart,
    onCreateBranch,
    selectedModel,
    currentMessageIndex,
    style,
    branchId,
    onUpdateTitle,
    isActiveThread = false
}) => {
    const [isRecording, setIsRecording] = useState(null);
    const [expandedMessage, setExpandedMessage] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [titleInput, setTitleInput] = useState(node.title || '');
    const [showTitlePrompt, setShowTitlePrompt] = useState(!node.title);
    const titleInputRef = useRef(null);
    const [expandedModal, setExpandedModal] = useState(null);


    const getAnimatedBorderStyles = (color) => {
        if (!isActiveThread) return {};

        return {
            position: 'relative',
            '&::before': {
                content: '""',
                position: 'absolute',
                inset: '-2px',
                padding: '2px',
                borderRadius: 'inherit',
                background: `linear-gradient(
                    90deg,
                    ${color} 0%,
                    ${color}50 25%,
                    ${color}90 50%,
                    ${color}50 75%,
                    ${color} 100%
                )`,
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                animation: 'borderAnimation 4s linear infinite',
                zIndex: 0
            }
        };
    };

    const generateTitle = async () => {
        try {
            const messages = node.messages.slice(0, 3); // Use first 3 messages for context
            const prompt = `Based on this conversation, suggest a concise and descriptive title (max 5 words):\n\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')
                }`;

            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    prompt,
                    system: "You are a helpful assistant. Respond only with the title - no explanations or additional text.",
                    stream: false
                })
            });

            const data = await response.json();
            const generatedTitle = data.response.trim();
            handleTitleUpdate(generatedTitle);
        } catch (error) {
            console.error('Error generating title:', error);
        }
    };

    const handleTitleUpdate = (newTitle) => {
        onUpdateTitle(node.id, newTitle);
        setTitleInput(newTitle);
        setIsEditing(false);
        setShowTitlePrompt(false);
    };

    const renderTitle = () => {
        if (isEditing) {
            return (
                <input
                    ref={titleInputRef}
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onBlur={() => handleTitleUpdate(titleInput)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleTitleUpdate(titleInput);
                        }
                    }}
                    className="bg-background px-2 py-1 rounded border border-border focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Enter title..."
                    autoFocus
                />
            );
        }

        return (
            <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">
                    {node.title || "Untitled Thread"}
                </span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className="p-1 rounded-full hover:bg-muted/80 transition-colors"
                >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
        );
    };

    const sendMessageToLLM = async (message) => {
        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [...node.messages, { role: 'user', content: message }],
                    stream: false,
                    options: {}
                })
            });
            const data = await response.json();
            return data.message;
        } catch (error) {
            console.error('Error sending message:', error);
            return null;
        }
    };

    const getThreadInfo = () => {
        let currentNode = node;
        const threadChain = [];

        while (currentNode) {
            threadChain.unshift({
                id: currentNode.id,
                color: generateThreadColor(currentNode.id),
                messageCount: currentNode.messages.length
            });
            currentNode = nodes.find(n => n.id === currentNode.parentId);
        }

        return threadChain;
    };

    const threadInfo = getThreadInfo();
    const mainColor = threadInfo[threadInfo.length - 1].color;
    const nodeKey = `node-${node.id}-${branchId || '0'}`;

    const handleTranscriptionComplete = async (transcript, index) => {
        setIsRecording(null);
        if (!transcript.trim()) return;

        const messages = [
            ...node.messages.slice(0, index + 1),
            { role: 'user', content: transcript }
        ];

        const aiResponse = await sendMessageToLLM(transcript);
        if (aiResponse) {
            messages.push(aiResponse);
        }

        const newPosition = {
            x: node.x + 300,
            y: node.y + calculateMessageOffset(node.messages, index) - 60
        };

        onCreateBranch(node.id, index, {
            ...newPosition,
            initialMessage: transcript,
            messages: messages,
            branchId: `${node.branchId || '0'}.${index}`
        });
    };

    const getMessageStyles = (index, totalMessages) => {
        const threadInfo = getThreadInfo();
        const mainColor = threadInfo[threadInfo.length - 1].color;

        return {
            background: `linear-gradient(to right, ${mainColor}10, ${mainColor}25)`,
            borderLeft: `4px solid ${mainColor}`,
            borderRadius: '0.5rem',
            position: 'relative',
            transition: 'box-shadow 0.3s ease',
            boxShadow: currentMessageIndex === index ? `0 0 10px 2px ${mainColor}` : 'none',
        };
    };

    const MessageModal = ({ message, isOpen, onClose }) => {
        if (!isOpen || !message) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                    className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                    onClick={onClose}
                />
                <div className="w-[80vw] h-[60vh] bg-background rounded-lg shadow-lg z-50 overflow-auto p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/80"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="prose dark:prose-invert max-w-none">
                        <div className="flex items-center gap-2 mb-4">
                            <Badge variant={message.role === 'user' ? 'default' : 'secondary'} className="text-base">
                                {message.role === 'user' ? 'You' : 'AI'}
                            </Badge>
                        </div>
                        {message.content}
                    </div>
                </div>
            </div>
        );
    };

    const renderMessages = () => {

        if (!isExpanded) return null;

        const allMessages = node.streamingContent
            ? [...node.messages, { role: 'assistant', content: node.streamingContent, isStreaming: true }]
            : node.messages;

        return (
            <>
                <div className="space-y-4">
                    {allMessages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "relative group",
                                currentMessageIndex === i && "ring-2 ring-primary"
                            )}
                            style={getMessageStyles(i, allMessages.length)}
                        >
                            <MessageTimestamp messageIndex={i} side={node.type === 'branch' ? 'left' : 'right'} />
                            <div className="p-4 relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={msg.role === 'user' ? 'default' : 'secondary'} className="text-xs">
                                            {msg.role === 'user' ? 'You' : msg.isStreaming ? 'AI Typing...' : 'AI'}
                                        </Badge>
                                        <span className="text-sm font-medium text-muted-foreground">
                                            msg {i + 1} of {allMessages.length}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!msg.isStreaming && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedModal(i);
                                                }}
                                                className="p-1.5 rounded-full hover:bg-muted/80 transition-colors"
                                            >
                                                <Maximize2 className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        )}
                                        {msg.content.length > 150 && !msg.isStreaming && (
                                            <ExpandButton
                                                isExpanded={expandedMessage === i}
                                                onClick={() => setExpandedMessage(expandedMessage === i ? null : i)}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className={cn(
                                    "text-sm text-foreground whitespace-pre-wrap",
                                    !msg.isStreaming && expandedMessage !== i && msg.content.length > 150 && "line-clamp-2"
                                )}>
                                    {msg.content}
                                    {msg.isStreaming && (
                                        <span className="inline-flex items-center gap-1 ml-1">
                                            <span className="w-1 h-1 bg-primary rounded-full animate-ping"></span>
                                            <span className="w-1 h-1 bg-primary rounded-full animate-ping delay-75"></span>
                                            <span className="w-1 h-1 bg-primary rounded-full animate-ping delay-150"></span>
                                        </span>
                                    )}
                                </div>
                                {!msg.isStreaming && (
                                    <div className="mt-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCreateBranch(node.id, i, {
                                                    x: node.x + 300,
                                                    y: node.y + calculateMessageOffset(allMessages, i) - 60
                                                });
                                            }}
                                        >
                                            <PlusCircle className="w-4 h-4" />
                                            Branch from here
                                        </button>
                                        <RecordingButton
                                            variant="branch"
                                            onTranscriptionComplete={(transcript) => handleTranscriptionComplete(transcript, i)}
                                            onRecordingStart={() => setIsRecording(i)}
                                            onRecordingStop={() => setIsRecording(null)}
                                            className={cn(
                                                "transition-colors",
                                                isRecording === i && "text-destructive animate-pulse"
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <AnimatePresence>
                    <MessageModal
                        message={allMessages[expandedModal]}
                        isOpen={expandedModal !== null}
                        onClose={() => setExpandedModal(null)}
                    />
                </AnimatePresence>
            </>
        );
    };

    useEffect(() => {
        // Show title prompt for new nodes
        if (node.messages.length === 0) {
            setShowTitlePrompt(true);
        }
        // Generate title after a few messages if still untitled
        else if (node.messages.length >= 2 && !node.title) {
            generateTitle();
        }
    }, [node.messages.length, node.title]);

    return (
        <div
            className="absolute transition-all z-2 duration-200"
            style={style}
            data-node-id={node.id}
            key={nodeKey}
        >
            <Card
                className={cn(
                    "branch-node relative",
                    "bg-background/25 backdrop-blur supports-[backdrop-filter]:bg-background/20",
                    "hover:shadow-lg transition-all duration-300",
                    isSelected && "ring-2 ring-primary",
                    node.type !== 'main' ? "cursor-move" : "cursor-default",
                    node.streamingContent && "loading" // Add loading class when streaming
                )}
                style={{
                    '--border-color': mainColor,
                    '--border-color-light': `${mainColor}50`,
                    maxWidth: '600px',
                    transform: style?.transform || 'none'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                }}
                onMouseDown={(e) => {
                    if (node.type !== 'main') {
                        e.stopPropagation();
                        onDragStart(e, node);
                    }
                }}
            >
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand();
                                }}
                                className="p-2 rounded-full hover:bg-muted/80 transition-colors"
                            >
                                <ChevronDown
                                    className={cn(
                                        "w-5 h-5 transition-transform duration-200",
                                        !isExpanded && "-rotate-90"
                                    )}
                                    style={{ color: mainColor }}
                                />
                            </button>
                            <div className="flex flex-col">
                                {renderTitle()}
                                {showTitlePrompt && !isEditing && (
                                    <span className="text-xs text-muted-foreground mt-1">
                                        Click the edit icon to set a title, or wait for auto-generation
                                    </span>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        {node.messages.length} messages
                                    </span>
                                </div>
                            </div>
                        </div>
                        {node.type !== 'main' && (
                            <button
                                className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    {renderMessages()}

                    {!isExpanded && node.messages.length > 0 && (
                        <div className="mt-2 text-sm text-muted-foreground">
                            <div className="line-clamp-2">
                                Last message: {
                                    node.streamingContent ||
                                    node.messages[node.messages.length - 1].content
                                }
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default BranchNode;