import React, { useState, useContext, useCallback } from "react";
import {
    Loader2,
    ChevronDown,
    MessageCircle,
    Bot,
    AlertCircle,
    Network,
    Grid
} from "lucide-react";
import { Alert, AlertDescription } from "../core/alert";

export const ChatTypeSelector = ({ chatType, setChatType, onDataUpdate }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchVisualizationData = useCallback(async (type) => {
        const url = `http://127.0.0.1:5001/api/visualization?type=${type}`;
        console.log("Fetching from:", url);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const responseData = await response.json();

            // Validate the response data
            if (!responseData.points || !responseData.clusters || !responseData.titles) {
                throw new Error("Invalid data structure received from server");
            }

            return responseData;
        } catch (error) {
            throw error;
        }
    }, []);

    const handleTypeChange = useCallback(async (newType) => {
        setError(null);
        setIsLoading(true);
        console.log("Changing chat type to:", newType);

        try {
            // First update the chat type state
            setChatType(newType);

            // Then fetch new data
            const responseData = await fetchVisualizationData(newType);
            console.log("Received data:", responseData);

            const chatsWithReflections = new Set(responseData.chats_with_reflections || []);

            // Transform the data
            const chartData = [{
                id: 'points',
                data: responseData.points.map((point, i) => ({
                    x: point[0],
                    y: point[1],
                    cluster: responseData.clusters[i],
                    title: responseData.titles[i],
                    hasReflection: chatsWithReflections.has(responseData.titles[i]),
                    type: newType // Add chat type to each point
                }))
            }];

            // Update visualization with new data
            onDataUpdate({
                chartData,
                topics: responseData.topics,
                currentType: newType // Add current chat type to the data
            });

        } catch (error) {
            console.error('Error changing chat type:', error);
            setError(error.message);
            // Revert chat type on error
            setChatType(chatType);
        } finally {
            setIsLoading(false);
        }
    }, [chatType, setChatType, onDataUpdate, fetchVisualizationData]);

    return (
        <div className="relative">
            <button
                className="flex h-8 w-[90px] items-center justify-between rounded-md border 
                    border-input bg-background px-3 py-2 text-sm ring-offset-background
                    text-foreground hover:bg-accent hover:text-accent-foreground
                    transition-colors disabled:opacity-50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleTypeChange(chatType === 'claude' ? 'chatgpt' : 'claude')}
                disabled={isLoading}
            >
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            {chatType === 'claude' ? (
                                <Bot className="h-4 w-4" />
                            ) : (
                                <MessageCircle className="h-4 w-4" />
                            )}
                            <span className="text-foreground">
                                {chatType === 'claude' ? 'Claude' : 'ChatGPT'}
                            </span>
                        </>
                    )}
                </div>
                <ChevronDown className="h-4 w-4" />
            </button>

            {error && (
                <Alert variant="destructive" className="mt-2 absolute top-full left-0 right-0 z-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};


export const VisualizationTypeSelector = ({ visualizationType, setVisualizationType }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleTypeChange = async (newType) => {
        setError(null);
        setIsLoading(true);

        try {
            setVisualizationType(newType);
        } catch (error) {
            console.error('Error changing visualization type:', error);
            setError(error.message);
            // Revert visualization type on error
            setVisualizationType(visualizationType);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                className="flex h-8 w-[90px] items-center justify-between rounded-md border 
                    border-input bg-background px-3 py-2 text-sm ring-offset-background
                    text-foreground hover:bg-accent hover:text-accent-foreground
                    transition-colors disabled:opacity-50
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleTypeChange(visualizationType === 'star' ? 'islands' : 'star')}
                disabled={isLoading}
            >
                <div className="flex items-center gap-2">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            {visualizationType === 'star' ? (
                                <Network className="h-4 w-4" />
                            ) : (
                                <Grid className="h-4 w-4" />
                            )}
                            <span className="text-foreground">
                                {visualizationType === 'star' ? 'Normal' : 'Islands'}
                            </span>
                        </>
                    )}
                </div>
                <ChevronDown className="h-4 w-4" />
            </button>

            {error && (
                <Alert variant="destructive" className="mt-2 absolute top-full left-0 right-0 z-50">
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};