import React, {
    useEffect,
    useState,
    useRef,
    useContext,
} from "react";
import {
    Loader2,
    AlertTriangle,
    Upload,
    CheckCircle2,
    File,
} from "lucide-react";
import {
    Button,
    DialogFooter,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Progress,
} from "../index";
import { Alert, AlertDescription } from "../core/alert";
import { cn } from "../../utils/utils";


export default function FileUploader({ onProcessingComplete, buttonProps = {} }) {
    const [isOpen, setIsOpen] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const pollInterval = useRef(null);


    const resetState = () => {
        setTaskId(null);
        setStatus(null);
        setError(null);
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, []);

    const startPolling = (taskId) => {
        if (pollInterval.current) {
            clearInterval(pollInterval.current);
        }

        const url = `http://127.0.0.1:5001/api/process/status/${taskId}`;

        const poll = async () => {
            try {
                const response = await fetch(url);

                const data = await response.json();

                if (data.error) {
                    setError(data.error);
                    clearInterval(pollInterval.current);
                    return;
                }

                setStatus(data);

                if (data.completed || data.status === "failed") {
                    clearInterval(pollInterval.current);
                    if (data.completed) {
                        // Wait a short moment before refreshing to ensure all files are written
                        setTimeout(() => {
                            if (onProcessingComplete) {
                                onProcessingComplete();
                            }
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error("Error polling status:", error);
                setError("Failed to check processing status");
                clearInterval(pollInterval.current);
            }
        };

        poll(); // Initial poll
        pollInterval.current = setInterval(poll, 1000);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsOpen(true);
        resetState();
        setError(null);

        const formData = new FormData();
        formData.append("file", file);

        const url = `http://127.0.0.1:5001/api/process`;
        try {
            const response = await fetch(url, {
                method: "POST",
                body: formData,
            });


            const data = await response.json();

            if (data.error) {
                setError(data.error);
                return;
            }

            setTaskId(data.task_id);
            startPolling(data.task_id);
        } catch (err) {
            setError(err.message);
        }
    };

    const getStatusDisplay = () => {
        if (!status) return null;

        const steps = [
            {
                key: "uploading",
                title: "Uploading Data",
                description: "Uploading your conversations file...",
            },
            {
                key: "analyzing_chats",
                title: "Analyzing Conversations",
                description: "Processing chat data and identifying patterns...",
            },
            {
                key: "processing",
                title: "Processing Data",
                description: "Generating topics and analyzing relationships...",
            },
        ];

        return steps.map((step, index) => (
            <div
                key={step.key}
                className={`flex items-center gap-3 ${status.status === step.key
                    ? "text-primary"
                    : index < steps.findIndex((s) => s.key === status.status)
                        ? "text-muted-foreground line-through"
                        : "text-muted-foreground"
                    }`}
            >
                {status.status === step.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : index < steps.findIndex((s) => s.key === status.status) ? (
                    <CheckCircle2 className="h-4 w-4" />
                ) : (
                    <File className="h-4 w-4" />
                )}
                <div className="flex-1">
                    <div className="text-sm font-medium">{step.title}</div>
                    <div className="text-xs">{step.description}</div>
                </div>
            </div>
        ));
    };


    return (
        <>
            <div className="flex items-center">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="conversation-upload"
                />
                <Button
                    {...buttonProps}
                    variant={buttonProps.variant || "outline"}
                    size={buttonProps.size || "icon"}
                    className={cn(
                        "h-9 w-9",
                        // Add theme-specific text colors
                        "text-foreground",
                        "dark:text-slate-100",
                        "hextech-nordic:text-[hsl(183,100%,95%)]",
                        "singed-theme:text-[hsl(120,20%,95%)]",
                        "celestial-theme:text-[hsl(280,100%,95%)]",
                        "void-theme:text-[hsl(240,20%,98%)]",
                        buttonProps.className
                    )}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload className="h-4 w-4" />
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Processing Data</DialogTitle>
                        <DialogDescription>
                            Analyzing your conversation data to generate insights
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <Progress value={status?.progress || 0} className="w-full" />
                                <div className="space-y-4">{getStatusDisplay()}</div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        {(status?.completed || error) && (
                            <Button
                                onClick={() => {
                                    setIsOpen(false);
                                    resetState();
                                }}
                            >
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}