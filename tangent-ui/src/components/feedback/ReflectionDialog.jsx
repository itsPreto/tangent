import ReactMarkdown from "react-markdown";
import React, {
    useEffect,
    useState,
} from "react";
import {
    Lightbulb,
    Loader2,
    ScrollText,
    MessageCircle,
} from "lucide-react";
import {
    Button,
    DialogFooter,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    ScrollArea,
} from "../index";
import { cn } from "../../utils/utils";
import { Tabs, TabsContent, TabsTrigger, TabsList } from '../core/tabs'

const ReflectionDialog = ({ open, onOpenChange, conversation, reflection }) => {
    const [activeTab, setActiveTab] = useState(
        reflection ? "reflection" : "conversation"
    );

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    // Update activeTab when reflection availability changes
    useEffect(() => {
        if (!reflection && activeTab === "reflection") {
            setActiveTab("conversation");
        }
    }, [reflection, activeTab]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Lightbulb className="h-5 w-5 text-amber-500" />
                        {conversation?.title || "Conversation"}
                    </DialogTitle>
                </DialogHeader>

                {/* Make sure the value prop matches the activeTab state */}
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex-1 overflow-hidden"
                >
                    <div className="flex items-center justify-between">
                        <TabsList>
                            <TabsTrigger value="conversation" className="gap-2">
                                <MessageCircle className="h-4 w-4" />
                                Conversation
                            </TabsTrigger>
                            {reflection && (
                                <TabsTrigger value="reflection" className="gap-2">
                                    <ScrollText className="h-4 w-4" />
                                    Reflection
                                </TabsTrigger>
                            )}
                        </TabsList>
                        {/* Add timestamp if available */}
                        {conversation?.messages?.[0]?.timestamp && (
                            <span className="text-xs text-muted-foreground px-4">
                                {formatDate(conversation.messages[0].timestamp)}
                            </span>
                        )}
                    </div>

                    {/* Conversation Tab Content */}
                    <TabsContent
                        value="conversation"
                        className="flex-1 overflow-hidden mt-4"
                    >
                        <ScrollArea className="h-[500px] pr-4">
                            {conversation?.messages ? (
                                <div className="space-y-4">
                                    {conversation.messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "flex flex-col gap-2 rounded-lg p-4",
                                                message.sender === "human"
                                                    ? "bg-muted/50"
                                                    : "bg-primary/5 border border-primary/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={cn(
                                                        "text-xs font-medium",
                                                        message.sender === "human"
                                                            ? "text-muted-foreground"
                                                            : "text-primary"
                                                    )}
                                                >
                                                    {message.sender === "human" ? "You" : "Assistant"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(message.timestamp)}
                                                </span>
                                            </div>
                                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                                {message.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                    <p>Loading conversation...</p>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>

                    {/* Reflection Tab Content */}
                    {reflection && (
                        <TabsContent
                            value="reflection"
                            className="flex-1 overflow-hidden mt-4"
                        >
                            <ScrollArea className="h-[500px] pr-4">
                                <div className="prose prose-sm dark:prose-invert">
                                    <div className="bg-muted/50 rounded-lg p-6 border border-muted-foreground/20">
                                        <ReactMarkdown
                                            components={{
                                                h1: ({ children }) => (
                                                    <h1 className="text-xl font-bold mt-4 mb-2">
                                                        {children}
                                                    </h1>
                                                ),
                                                h2: ({ children }) => (
                                                    <h2 className="text-lg font-bold mt-3 mb-2">
                                                        {children}
                                                    </h2>
                                                ),
                                                h3: ({ children }) => (
                                                    <h3 className="text-base font-bold mt-2 mb-1">
                                                        {children}
                                                    </h3>
                                                ),
                                                p: ({ children }) => (
                                                    <p className="mb-4 leading-relaxed">{children}</p>
                                                ),
                                                ul: ({ children }) => (
                                                    <ul className="list-disc pl-4 mb-4">{children}</ul>
                                                ),
                                                ol: ({ children }) => (
                                                    <ol className="list-decimal pl-4 mb-4">{children}</ol>
                                                ),
                                                li: ({ children }) => (
                                                    <li className="mb-1">{children}</li>
                                                ),
                                                code: ({ children }) => (
                                                    <code className="bg-muted px-1.5 py-0.5 rounded-md text-sm">
                                                        {children}
                                                    </code>
                                                ),
                                                pre: ({ children }) => (
                                                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">
                                                        {children}
                                                    </pre>
                                                ),
                                            }}
                                        >
                                            {reflection}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    )}
                </Tabs>

                <div className="pt-4 border-t">
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};


export default ReflectionDialog;