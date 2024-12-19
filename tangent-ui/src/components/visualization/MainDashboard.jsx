import * as d3 from "d3";
import axios from "axios";
import React, {
    useEffect,
    useState,
    useRef,
    useCallback,
    useContext,
} from "react";
import { Search, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { debounce } from 'lodash';

// Updated component imports with new paths
import ReflectionDialog from '../feedback/ReflectionDialog';
import VisualizationPanel from '../visualization/VisualizationPanel';
import TopicsPanel from '../visualization/TopicsPanel';
import HoverTooltip from '../feedback/HoverTooltip';

// Updated UI component imports
import { Card, CardHeader, CardTitle, CardContent } from '../core/card';
import { Input } from '../core/input';


// Utility function for getting colors (moved outside component)
function getColor(index) {
    const colors = [
        "#60A5FA",
        "#F87171",
        "#34D399",
        "#FBBF24",
        "#A78BFA",
        "#F472B6",
        "#FB923C",
        "#2DD4BF",
        "#4ADE80",
        "#A3E635",
        "#38BDF8",
        "#FB7185",
        "#818CF8",
        "#C084FC",
        "#E879F9",
        "#22D3EE",
        "#F43F5E",
        "#10B981",
        "#6366F1",
        "#8B5CF6",
    ];
    return colors[index % colors.length];
}

const getThemeColors = (theme) => ({
    text: theme === "dark" ? "#fff" : "#000",
    mutedText: theme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
    link: theme === "dark" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
    starOutline: theme === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
    branchPattern: theme === "dark" ? "#ffffff33" : "#00000033"
});



const MainDashboard = ({ onConversationSelect }) => {  // Add this prop
    const [isTreeView, setIsTreeView] = useState(false);
    const [activeTab, setActiveTab] = useState("map");
    const [selectedChat, setSelectedChat] = useState(null);
    const [data, setData] = useState(null);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [insights, setInsights] = useState(null);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [showReflectionDialog, setShowReflectionDialog] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [sortBy, setSortBy] = useState("relevance"); // 'relevance', 'size', 'coherence'
    const svgRef = useRef();
    const zoomRef = useRef(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const cardRef = useRef(null);
    const nodesDataRef = useRef(null);
    const [innerWidth, setInnerWidth] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentState, setCurrentState] = useState(null);
    const [, setAvailableStates] = useState([]);
    const [isLoadingState, setIsLoadingState] = useState(false);
    const [chatType, setChatType] = useState('claude');
    const [delayedCluster, setDelayedCluster] = useState(null);
    const [visualizationType, setVisualizationType] = useState('star'); // 'star' or 'islands'
    const [filterText, setFilterText] = useState('');
    const [filteredData, setFilteredData] = useState(null);

    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("theme") || "light";
        }
        return "light";
    });

    useEffect(() => {
        document.documentElement.classList.remove('light', 'dark', 'hextech-nordic');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);


    useEffect(() => {
        const handleResize = () => setInnerWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, []);


    const fetchMessages = async (title, chatType) => {
        const encodedTitle = encodeURIComponent(title);
        try {
            const response = await axios.get(
                `http://127.0.0.1:5001/api/messages/${encodedTitle}?type=${chatType}`,
                {
                    validateStatus: function (status) {
                        return status < 500; // Handle 404s without throwing
                    }
                }
            );
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching with ${chatType}:`, error);
            return null;
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            if (svgRef.current) {
                // Clear existing visualization
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }

            try {
                const response = await fetch(`http://127.0.0.1:5001/api/visualization?type=${chatType}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const responseData = await response.json();
                const chatsWithReflections = new Set(responseData.chats_with_reflections);

                const chartData = [{
                    id: 'points',
                    data: responseData.points.map((point, i) => ({
                        x: point[0],
                        y: point[1],
                        cluster: responseData.clusters[i],
                        title: responseData.titles[i],
                        hasReflection: chatsWithReflections.has(responseData.titles[i])
                    }))
                }];

                setData({
                    chartData,
                    topics: responseData.topics
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [chatType]);

    const url_visualization = "http://127.0.0.1:5001/api/visualization";

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                setSelectedCluster(null);
                setShowReflectionDialog(false);
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    // Debounced filter function
    const debouncedFilter = useRef(
        debounce((searchText) => {
            if (!data) return;

            const filtered = {
                ...data,
                chartData: [{
                    ...data.chartData[0],
                    data: data.chartData[0].data.filter(item =>
                        item.title.toLowerCase().includes(searchText.toLowerCase())
                    )
                }],
                topics: Object.fromEntries(
                    Object.entries(data.topics).filter(([_, topic]) =>
                        topic.topic.toLowerCase().includes(searchText.toLowerCase())
                    )
                )
            };

            setFilteredData(filtered);
        }, 2000)
    ).current;

    // Update filter on text change
    useEffect(() => {
        if (filterText) {
            debouncedFilter(filterText);
        } else {
            setFilteredData(null);
        }
    }, [filterText]);

    // Use filtered or original data for visualization
    const visualizationData = filteredData || data;

    const handleRefresh = async () => {
        setIsLoading(true);
        const url = `http://127.0.0.1:5001/api/visualization?type=${chatType}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            // Validate the response data has the expected structure
            if (
                !responseData.points ||
                !responseData.clusters ||
                !responseData.titles ||
                !responseData.topics
            ) {
                throw new Error("Invalid data structure received from server");
            }

            const chatsWithReflections = new Set(
                responseData.chats_with_reflections || []
            );

            const chartData = [
                {
                    id: "points",
                    data: responseData.points.map((point, i) => ({
                        x: point[0],
                        y: point[1],
                        cluster: responseData.clusters[i],
                        title: responseData.titles[i],
                        hasReflection: chatsWithReflections.has(responseData.titles[i]),
                    })),
                },
            ];

            setData({
                chartData,
                topics: responseData.topics,
            });

            // Only reset visualization state after successful data update
            setSelectedCluster(null);
            setSelectedPoints([]);
            setHoveredPoint(null);

            // Reset zoom after a short delay to ensure data is updated
            setTimeout(() => {
                if (zoomRef.current && svgRef.current) {
                    const width = svgRef.current.clientWidth;
                    const height = svgRef.current.clientHeight;
                    const padding = 40;
                    const visWidth = width - padding;
                    const visHeight = height - padding;
                    const initialScale = 0.08;
                    const initialTransform = d3.zoomIdentity
                        .translate(visWidth / 2, visHeight / 2)
                        .scale(initialScale)
                        .translate(-width / 2, -height / 2);

                    d3.select(svgRef.current)
                        .transition()
                        .duration(750)
                        .call(zoomRef.current.transform, initialTransform);
                }
            }, 100);
        } catch (error) {
            console.error("Error refreshing data:", error);
            // Optionally show an error message to the user
            // You might want to add a toast or alert component for this
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFullscreen = () => {
        if (!cardRef.current) return;

        if (!document.fullscreenElement) {
            cardRef.current.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [])


    useEffect(() => {
        const handleClusterSelection = async () => {
            if (selectedCluster !== null) {
                let nodeData;

                if (visualizationType === 'star') {
                    // For star visualization, find the node in nodesDataRef
                    nodeData = nodesDataRef.current?.find(
                        node => node.size && node.id === selectedCluster
                    );
                } else {
                    // For islands visualization, construct node data from the cluster
                    const clusterData = data.topics[selectedCluster];
                    if (clusterData) {
                        // Find all conversations in this cluster
                        const conversations = data.chartData[0].data.filter(
                            d => d.cluster === selectedCluster
                        );

                        nodeData = {
                            id: selectedCluster,
                            topic: clusterData.topic,
                            width: Math.max(300, conversations.length * 30), // Estimate width based on content
                            height: Math.max(100, conversations.length * 30 + 60), // Estimate height based on content
                        };
                    }
                }

                if (nodeData) {
                    setDelayedCluster(null);
                    await centerOnNode(nodeData);
                    setTimeout(() => {
                        setDelayedCluster(selectedCluster);
                    }, 200);
                }
            } else {
                setDelayedCluster(null);
            }
        };

        handleClusterSelection();
    }, [selectedCluster, visualizationType, data]);

    const handleZoomIn = () => {
        if (!zoomRef.current || !svgRef.current) return;
        const currentScale = d3.zoomTransform(svgRef.current).k;
        const maxScale = visualizationType === 'star' ? 8 : 0.08;

        // Don't zoom in beyond max scale
        if (currentScale * 1.7 <= maxScale) {
            d3.select(svgRef.current)
                .transition()
                .duration(300)
                .call(zoomRef.current.scaleBy, 1.7);
        }
    };

    // Update handleZoomOut function to allow for more dramatic zoom out

    const handleZoomOut = () => {
        if (!zoomRef.current || !svgRef.current) return;
        const currentScale = d3.zoomTransform(svgRef.current).k;
        const minScale = visualizationType === 'star' ? 0.2 : 0.05;

        // Don't zoom out beyond min scale
        if (currentScale * 0.25 >= minScale) {
            d3.select(svgRef.current)
                .transition()
                .duration(300)
                .call(zoomRef.current.scaleBy, 0.25);
        }
    };

    useEffect(() => {
        if (selectedCluster !== null && nodesDataRef.current) {
            const topicNode = nodesDataRef.current.find(
                (node) => node.size && node.id === selectedCluster
            );
            if (topicNode) {
                centerOnNode(topicNode);
            }
        }
    }, [selectedCluster]);

    // Function to center on a node with animation

    const centerOnNode = (nodeData) => {
        return new Promise((resolve) => {
            if (!zoomRef.current || !svgRef.current) {
                resolve();
                return;
            }

            const width = svgRef.current.clientWidth;
            const height = svgRef.current.clientHeight;

            // Handle different node data structures based on visualization type
            let x, y, scale;

            if (visualizationType === 'star') {
                // Star visualization - nodes have x, y coordinates directly
                scale = 2;
                x = width / 2 - nodeData.x * scale;
                y = height / 2 - nodeData.y * scale;
            } else {
                // Islands visualization - nodes are transformed groups
                // Find the cluster group by ID
                const clusterGroup = d3.select(svgRef.current)
                    .select(`.cluster:nth-child(${parseInt(nodeData.id) + 1})`);

                if (!clusterGroup.empty()) {
                    // Get the transform attribute values
                    const transform = clusterGroup.attr("transform");
                    const match = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);

                    if (match) {
                        const clusterX = parseFloat(match[1]);
                        const clusterY = parseFloat(match[2]);

                        // Calculate center position including cluster dimensions
                        scale = 1;
                        x = width / 2 - (clusterX + nodeData.width / 2) * scale;
                        y = height / 2 - (clusterY + nodeData.height / 2) * scale;
                    } else {
                        // Fallback if transform not found
                        scale = 1.5;
                        x = width / 2;
                        y = height / 2;
                    }
                } else {
                    // Fallback if cluster not found
                    scale = 1.5;
                    x = width / 2;
                    y = height / 2;
                }
            }

            // Apply the transform with animation
            d3.select(svgRef.current)
                .transition()
                .duration(750)
                .call(
                    zoomRef.current.transform,
                    d3.zoomIdentity.translate(x, y).scale(scale)
                )
                .on("end", resolve);
        });
    };

    useEffect(() => {
        document.documentElement.classList.remove(
            "light",
            "dark",
            "hextech-nordic"
        );
        document.documentElement.classList.add(theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    const url_states = "http://127.0.0.1:5001/api/states";

    useEffect(() => {
        const fetchStates = async () => {
            try {
                const response = await fetch(`${url_states}?type=${chatType}`);
                const data = await response.json();
                setAvailableStates(data.states);
            } catch (error) {
                console.error("Error fetching states:", error);
            }
        };

        fetchStates();
    }, [chatType]);


    function createIslandsVisualization() {
        // Clear existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const padding = 100;

        // Helper function to measure text width
        const measureTextWidth = (text, fontSize) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontSize}px sans-serif`;
            return context.measureText(text).width;
        };

        // Process and group clusters by category with optimized sizing
        const clusters = Object.entries(data.topics).map(([id, topic]) => {
            const conversations = data.chartData[0].data.filter(d => d.cluster === parseInt(id));

            // Calculate maximum text width among all conversation titles
            let maxConversationWidth = 0;
            conversations.forEach(conv => {
                const baseTitle = conv.title.replace(/ \(Branch \d+\)$/, '');
                const hasBranches = conversations.filter(c =>
                    c.title.replace(/ \(Branch \d+\)$/, '') === baseTitle
                ).length > 1;
                const textWidth = measureTextWidth(conv.title, 14);
                const totalWidth = textWidth + (hasBranches ? 55 : 35);
                maxConversationWidth = Math.max(maxConversationWidth, totalWidth);
            });

            // Calculate title width
            const titleWidth = measureTextWidth(topic.topic, 16) + 40;

            // Use the larger of title width or conversation width, plus minimal padding
            const clusterWidth = Math.max(titleWidth, maxConversationWidth) + 20;

            // Calculate height based on number of conversations
            const clusterHeight = Math.max(100, conversations.length * 30 + 60);

            return {
                id: parseInt(id),
                name: topic.topic,
                size: topic.size,
                coherence: topic.coherence,
                conversations: conversations,
                width: clusterWidth,
                height: clusterHeight
            };
        });

        // Enhanced force simulation with adjusted spacing
        const simulation = d3.forceSimulation(clusters)
            .force("charge", d3.forceManyBody().strength(-2000))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(d => {
                return Math.sqrt((d.width * d.width + d.height * d.height) / 4) + 30;
            }))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1));

        // Create main group
        const g = svg.append("g");

        // Create cluster groups
        const clusterGroups = g.selectAll(".cluster")
            .data(clusters)
            .join("g")
            .attr("class", "cluster")
            .style("cursor", "pointer");

        // Add cluster backgrounds
        clusterGroups.append("rect")
            .attr("rx", 15)
            .attr("ry", 15)
            .attr("class", "cluster-bg")
            .attr("fill", d => `${getColor(d.id)}22`)
            .attr("stroke", d => getColor(d.id))
            .attr("stroke-width", 2)
            .attr("width", d => d.width)
            .attr("height", d => d.height);

        // Add cluster titles with theme-aware color
        clusterGroups.append("text")
            .attr("class", "cluster-title")
            .attr("x", 20)
            .attr("y", 30)
            .attr("fill", theme === "light" ? "#000" : "#fff")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .text(d => d.name);

        // Create conversation nodes
        clusterGroups.each(function (cluster) {
            const group = d3.select(this);
            const conversationGroup = group.append("g")
                .attr("class", "conversations")
                .attr("transform", "translate(20, 50)");

            // Count branches for each conversation
            const branchCounts = new Map();
            cluster.conversations.forEach(conv => {
                const baseTitle = conv.title.replace(/ \(Branch \d+\)$/, '');
                branchCounts.set(baseTitle, (branchCounts.get(baseTitle) || 0) + 1);
            });

            cluster.conversations.forEach((conv, i) => {
                const baseTitle = conv.title.replace(/ \(Branch \d+\)$/, '');
                const hasBranches = branchCounts.get(baseTitle) > 1;
                const branchCount = branchCounts.get(baseTitle) || 1;

                const convGroup = conversationGroup.append("g")
                    .attr("transform", `translate(0, ${i * 30})`)
                    .style("cursor", "pointer");

                // Main conversation circle
                convGroup.append("circle")
                    .attr("r", 6)
                    .attr("fill", getColor(cluster.id))
                    .attr("opacity", 0.8);

                if (hasBranches) {
                    // Add clear branch indicator
                    convGroup.append("circle")
                        .attr("r", 14)
                        .attr("fill", "none")
                        .attr("stroke", getColor(cluster.id))
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "3,3")
                        .attr("opacity", 0.8);

                    // Add branch count badge
                    convGroup.append("circle")
                        .attr("cx", 20)
                        .attr("cy", -8)
                        .attr("r", 8)
                        .attr("fill", getColor(cluster.id))
                        .attr("opacity", 0.9);

                    convGroup.append("text")
                        .attr("x", 20)
                        .attr("y", -8)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .attr("fill", "#fff")
                        .attr("font-size", "10px")
                        .text(branchCount);
                }

                // Conversation title with theme-aware color
                convGroup.append("text")
                    .attr("x", hasBranches ? 35 : 15)
                    .attr("y", 4)
                    .attr("fill", theme === "light" ? "#000" : "#fff")
                    .attr("font-size", "14px")
                    .text(conv.title);

                convGroup.on("click", (event) => {
                    event.stopPropagation();
                    handleConversationClick({
                        title: baseTitle,
                        cluster: cluster.id,
                        hasReflection: conv.hasReflection,
                        branchCount: branchCount
                    }, event);
                });
            });
        });

        // Update positions from force simulation
        simulation.on("tick", () => {
            clusterGroups.attr("transform", d => {
                const x = d.x - d.width / 2;
                const y = d.y - d.height / 2;
                return `translate(${x},${y})`;
            });
        });

        const zoom = d3.zoom()
            .scaleExtent([0.02, 8])
            .on("zoom", (event) => g.attr("transform", event.transform));

        svg.call(zoom);
        zoomRef.current = zoom;

        // Calculate initial bounds
        const bounds = {
            width: d3.max(clusters, d => d.x + d.width / 2) - d3.min(clusters, d => d.x - d.width / 2),
            height: d3.max(clusters, d => d.y + d.height / 2) - d3.min(clusters, d => d.y - d.height / 2)
        };

        const initialScale = 0.02;
        const initialTransform = d3.zoomIdentity
            .translate(
                width / 2 - (bounds.width * initialScale) / 2,
                height / 2 - (bounds.height * initialScale) / 2
            )
            .scale(initialScale);

        svg.call(zoom.transform, initialTransform);
    }

    function createStarVisualization() {
        // Clear any existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Add SVG defs for glow filter and patterns
        const defs = svg.append("defs");

        // Add glow filter
        const filter = defs.append("filter")
            .attr("id", "glow")
            .attr("x", "-50%")
            .attr("y", "-50%")
            .attr("width", "200%")
            .attr("height", "200%");

        filter.append("feGaussianBlur")
            .attr("stdDeviation", "3")
            .attr("result", "coloredBlur");

        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");

        // Add branch indicator pattern
        defs.append("pattern")
            .attr("id", "branchPattern")
            .attr("patternUnits", "userSpaceOnUse")
            .attr("width", "4")
            .attr("height", "4")
            .append("path")
            .attr("d", "M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2")
            .attr("stroke", getThemeColors(theme).branchPattern)
            .attr("stroke-width", "1");

        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;

        // Star layout parameters
        const numPoints = 5;
        const outerRadius = Math.min(width, height) / 6;
        const innerRadius = outerRadius * 0.382;
        const nodeRadius = outerRadius * 1.5;

        // Generate star points
        const starPoints = [];
        for (let i = 0; i < numPoints * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / numPoints - Math.PI / 2;
            starPoints.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            });
        }

        // Analyze branches for each conversation
        const branchCounts = new Map();
        data.chartData[0].data.forEach(chat => {
            const baseTitle = chat.title.replace(/ \(Branch \d+\)$/, '');
            branchCounts.set(baseTitle, (branchCounts.get(baseTitle) || 0) + 1);
        });

        // Distribute topics around the star
        const topics = Object.entries(data.topics).map(([id, topic], index) => {
            const pointIndex = (index % numPoints) * 2;
            const angle = (pointIndex * Math.PI) / numPoints - Math.PI / 2;
            return {
                id: parseInt(id),
                name: topic.topic,
                size: topic.size,
                coherence: topic.coherence,
                x: centerX + nodeRadius * Math.cos(angle),
                y: centerY + nodeRadius * Math.sin(angle),
                angle: angle,
            };
        });

        // Position chat nodes
        const chats = data.chartData[0].data.map((d, i) => {
            const topic = topics.find((t) => t.id === d.cluster);
            const angle = topic.angle;
            const spreadDistance = nodeRadius * 0.4;
            const randomAngle = angle + ((Math.random() - 0.5) * Math.PI) / 6;
            const randomRadius = nodeRadius + (Math.random() - 0.5) * spreadDistance;

            return {
                ...d,
                id: `chat-${i}`,
                topicId: d.cluster,
                x: centerX + randomRadius * Math.cos(randomAngle),
                y: centerY + randomRadius * Math.sin(randomAngle),
            };
        });

        // Combine all nodes and store in ref
        const nodes = [...topics, ...chats];
        nodesDataRef.current = nodes;

        // Create links between topics and their chats
        const links = chats.map((chat) => ({
            source: topics.find((topic) => topic.id === chat.topicId),
            target: chat,
        }));

        // Create the main container group
        const g = svg.append("g").attr("class", "clusters");

        // Draw star shape outline
        const starPath = g
            .append("path")
            .attr(
                "d",
                (() => {
                    let path = `M ${starPoints[0].x} ${starPoints[0].y}`;
                    for (let i = 1; i < starPoints.length; i++) {
                        path += ` L ${starPoints[i].x} ${starPoints[i].y}`;
                    }
                    path += " Z";
                    return path;
                })()
            )
            .attr("stroke", getThemeColors(theme).starOutline)
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .style("filter", "none")
            .style("opacity", 0.3);

        // Create links
        const link = g
            .append("g")
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", getThemeColors(theme).link)
            .attr("stroke-opacity", 0.3)
            .attr("stroke-width", 0.5);

        // Create nodes group
        const node = g
            .append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x},${d.y})`);

        // Base circle for all nodes
        node.append("circle")
            .attr("r", d => d.size ? 18 : 10)
            .attr("fill", d => {
                if (d.size) {
                    return getColor(d.id);
                } else if (d.hasReflection) {
                    return "#FFD700";
                } else {
                    return getColor(d.topicId);
                }
            })
            .attr("stroke", d => d.hasReflection ? "#FFD700" : null)
            .attr("stroke-width", d => d.hasReflection ? 1.5 : 0)
            .attr("fill-opacity", d => d.size ? 1 : 0.6);

        // Add branch indicators
        node.each(function (d) {
            if (!d.size) {
                const element = d3.select(this);
                const baseTitle = d.title?.replace(/ \(Branch \d+\)$/, '');
                const hasBranches = branchCounts.get(baseTitle) > 1;

                if (hasBranches) {
                    element.append("circle")
                        .attr("r", 14)
                        .attr("fill", "none")
                        .attr("stroke", getColor(d.topicId))
                        .attr("stroke-width", 2)
                        .attr("stroke-dasharray", "3,3")
                        .attr("class", "branch-indicator")
                        .style("opacity", 0.7);

                    const branchPaths = [
                        "M -6,-6 L 0,-12 L 6,-6",
                        "M -6,6 L 0,12 L 6,6"
                    ];

                    element.selectAll(".branch-path")
                        .data(branchPaths)
                        .enter()
                        .append("path")
                        .attr("d", d => d)
                        .attr("stroke", getColor(d.topicId))
                        .attr("stroke-width", 1)
                        .attr("fill", "none")
                        .attr("class", "branch-path")
                        .style("opacity", 0.7);
                }
            }
        });

        // Add labels for topic nodes with theme-aware color
        node.filter(d => d.size)
            .append("text")
            .attr("dy", "-1.5em")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", theme === "light" ? "#000" : "#fff")
            .attr("opacity", 0.8)
            .text(d => d.name);

        // Add event handlers
        node
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                const baseTitle = d.title?.replace(/ \(Branch \d+\)$/, '');
                const branchCount = !d.size ? branchCounts.get(baseTitle) || 1 : null;

                setHoveredPoint({
                    x: event.pageX,
                    y: event.pageY,
                    topic: d.size ? data.topics[d.id].topic : data.topics[d.topicId].topic,
                    title: d.title || d.name,
                    hasReflection: d.hasReflection,
                    branchCount: branchCount > 1 ? `${branchCount} branches` : 'Single thread',
                    coherence: d.size ? data.topics[d.id].coherence : null,
                });
            })
            .on("mouseout", () => setHoveredPoint(null))
            .on("click", (event, d) => {
                event.stopPropagation();
                if (d.size) {
                    setSelectedCluster(d.id);
                    centerOnNode(d);
                } else {
                    handleConversationClick(
                        {
                            title: d.title,
                            cluster: d.topicId,
                            hasReflection: d.hasReflection
                        },
                        event
                    );
                }
            });

        // Force simulation setup
        const simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(links)
                    .id((d) => d.id)
                    .distance(30)
                    .strength(0.3)
            )
            .force(
                "charge",
                d3.forceManyBody().strength((d) => (d.size ? -300 : -30))
            )
            .force(
                "collide",
                d3
                    .forceCollide()
                    .radius((d) => (d.size ? 30 : hasBranches(d) ? 18 : 12))
                    .strength(0.8)
            )
            .force("star", (alpha) => {
                nodes.forEach((node) => {
                    if (node.size) {
                        const angle = (topics.findIndex((t) => t.id === node.id) * 2 * Math.PI) / numPoints - Math.PI / 2;
                        const targetX = centerX + nodeRadius * Math.cos(angle);
                        const targetY = centerY + nodeRadius * Math.sin(angle);
                        node.vx += (targetX - node.x) * alpha * 0.3;
                        node.vy += (targetY - node.y) * alpha * 0.3;
                    }
                });
            })
            .on("tick", () => {
                link
                    .attr("x1", (d) => d.source.x)
                    .attr("y1", (d) => d.source.y)
                    .attr("x2", (d) => d.target.x)
                    .attr("y2", (d) => d.target.y);

                node.attr("transform", d => `translate(${d.x},${d.y})`);
            });

        function hasBranches(d) {
            if (d.size) return false;
            const baseTitle = d.title?.replace(/ \(Branch \d+\)$/, '');
            return branchCounts.get(baseTitle) > 1;
        }

        const zoom = d3
            .zoom()
            .scaleExtent([0.08, 8])
            .on("zoom", (event) => g.attr("transform", event.transform));

        svg.call(zoom);
        zoomRef.current = zoom;

        const initialScale = 0.08;
        const padding = 40;
        const visWidth = width - padding;
        const visHeight = height - padding;

        const initialTransform = d3.zoomIdentity
            .translate(visWidth / 2, visHeight / 2)
            .scale(initialScale)
            .translate(-centerX, -centerY);

        svg.call(zoom.transform, initialTransform);

        // Cleanup function
        return () => {
            simulation.stop();
            zoomRef.current = null;
            nodesDataRef.current = null;
        };
    }


    const handleConversationClick = async (point, event) => {
        try {
          const baseTitle = point.title.replace(/ \(Branch \d+\)$/, '');

          // Get the branched data
          const messageData = await fetchAllMessages(baseTitle, chatType);

          if (!messageData || !messageData.branches) {
            console.error('Failed to fetch conversation data');
            return;
          }

          // Build nodes structure for TangentChat
          const nodes = buildConversationNodes(messageData, baseTitle);
          console.log("Processed nodes:", nodes);

          if (!nodes || nodes.length === 0) {
            console.error('No valid nodes created from message data');
            return;
          }

          // Get click position or use window center
          const clickPosition = {
            x: event?.clientX || window.innerWidth / 2,
            y: event?.clientY || window.innerHeight / 2
          };

          // Update the parent component's state through props
          window.dispatchEvent(new CustomEvent('openConversation', {
            detail: {
              nodes,
              position: clickPosition
            }
          }));

        } catch (error) {
          console.error('Error in conversation click handler:', error);
        }
      };

    async function fetchAndProcessBranchedConversation(title, chatType) {
        try {
            // Fetch all messages including branch information
            const response = await fetch(
                `http://127.0.0.1:5001/api/messages_all/${encodeURIComponent(title)}?type=${chatType}`
            );
            const data = await response.json();

            if (!data.branches) {
                console.error('No branches data found');
                return null;
            }

            // Create nodes structure for TangentChat
            const nodes = [];
            const messageToNodeMap = new Map();
            let nodeCounter = 1;

            // First, create the main thread node (branch '0')
            const mainBranch = data.branches['0'];
            if (mainBranch) {
                const mainNode = {
                    id: nodeCounter++,
                    type: 'main',
                    title: title,
                    messages: mainBranch.map(msg => ({
                        role: msg.sender === 'human' ? 'user' : 'assistant',
                        content: msg.text,
                        messageId: msg.message_id
                    })),
                    branchId: '0',
                    x: 0,
                    y: 0
                };
                nodes.push(mainNode);

                // Map each message ID to this node
                mainBranch.forEach(msg => {
                    messageToNodeMap.set(msg.message_id, mainNode.id);
                });
            }

            // Then create all branch nodes
            Object.entries(data.branches).forEach(([branchId, messages]) => {
                if (branchId === '0') return; // Skip main thread as it's already processed

                const firstMessage = messages[0];
                if (!firstMessage || !firstMessage.parent_message_id) return;

                // Find parent node via message map
                const parentNodeId = messageToNodeMap.get(firstMessage.parent_message_id);
                const parentNode = nodes.find(n => n.id === parentNodeId);

                if (!parentNode) {
                    console.warn(`Parent node not found for branch ${branchId}`);
                    return;
                }

                // Find index of parent message in parent node
                const parentMessageIndex = parentNode.messages.findIndex(
                    msg => msg.messageId === firstMessage.parent_message_id
                );

                // Create branch node
                const branchNode = {
                    id: nodeCounter++,
                    type: 'branch',
                    title: `${title} (Branch ${branchId})`,
                    messages: messages.map(msg => ({
                        role: msg.sender === 'human' ? 'user' : 'assistant',
                        content: msg.text,
                        messageId: msg.message_id
                    })),
                    parentId: parentNodeId,
                    parentMessageIndex: parentMessageIndex,
                    branchId: branchId,
                    // Get full context including parent messages
                    contextMessages: parentNode.messages.slice(0, parentMessageIndex + 1).concat(
                        messages.map(msg => ({
                            role: msg.sender === 'human' ? 'user' : 'assistant',
                            content: msg.text,
                            messageId: msg.message_id
                        }))
                    ),
                    x: parentNode.x + 300, // Position relative to parent
                    y: parentNode.y + (parentMessageIndex * 50) // Stack vertically based on branch point
                };
                nodes.push(branchNode);

                // Map all messages in this branch to the branch node
                messages.forEach(msg => {
                    messageToNodeMap.set(msg.message_id, branchNode.id);
                });
            });

            console.log('Processed nodes structure:', nodes);
            return nodes;

        } catch (error) {
            console.error('Error processing branched conversation:', error);
            return null;
        }
    }

    // Then, enhance the visualization of branched conversations in MainDashboard
    function createBranchIndicator(group, x, y, color, branchCount) {
        // Main dot
        group.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', 6)
            .attr('fill', color)
            .attr('opacity', 0.8);

        if (branchCount > 1) {
            // Outer ring for branches
            group.append('circle')
                .attr('cx', x)
                .attr('cy', y)
                .attr('r', 12)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '3,3')
                .attr('opacity', 0.6);

            // Branch count indicator
            group.append('text')
                .attr('x', x + 16)
                .attr('y', y)
                .attr('dy', '0.3em')
                .attr('fill', getThemeColors(theme).text)
                .attr('font-size', '12px')
                .text(`${branchCount} branches`);

            // Small branch indicators
            const angleStep = (2 * Math.PI) / branchCount;
            for (let i = 0; i < branchCount; i++) {
                const angle = i * angleStep;
                const bx = x + Math.cos(angle) * 12;
                const by = y + Math.sin(angle) * 12;

                group.append('circle')
                    .attr('cx', bx)
                    .attr('cy', by)
                    .attr('r', 3)
                    .attr('fill', color)
                    .attr('opacity', 0.4);
            }
        }
    }

    const buildConversationNodes = (responseData, chatTitle) => {
        if (!responseData || !responseData.branches) {
            console.error('Invalid response data structure');
            return [];
        }

        const nodes = [];
        const messageToNodeMap = new Map();
        let nodeIdCounter = 1;

        // First create the main thread (branch '0')
        const mainBranch = responseData.branches['0'];
        if (mainBranch) {
            const mainNode = {
                id: nodeIdCounter++,
                title: chatTitle,
                messages: mainBranch.map(msg => ({
                    role: msg.sender === 'human' ? 'user' : 'assistant',
                    content: msg.text,
                    messageId: msg.message_id
                })),
                type: 'main',
                branchId: '0'
            };
            nodes.push(mainNode);
            mainBranch.forEach(msg => messageToNodeMap.set(msg.message_id, mainNode.id));
        }

        // Then create all branch nodes
        Object.entries(responseData.branches).forEach(([branchId, messages]) => {
            if (branchId === '0') return; // Skip main thread

            const firstMessage = messages[0];
            if (!firstMessage?.parent_message_id) return;

            const parentNodeId = messageToNodeMap.get(firstMessage.parent_message_id);
            const parentNode = nodes.find(n => n.id === parentNodeId);

            if (!parentNode) {
                console.warn(`Parent node not found for branch ${branchId}`);
                return;
            }

            const parentMessageIndex = parentNode.messages.findIndex(
                msg => msg.messageId === firstMessage.parent_message_id
            );

            const branchNode = {
                id: nodeIdCounter++,
                title: chatTitle,
                messages: messages.map(msg => ({
                    role: msg.sender === 'human' ? 'user' : 'assistant',
                    content: msg.text,
                    messageId: msg.message_id
                })),
                type: 'branch',
                parentId: parentNodeId,
                parentMessageIndex: parentMessageIndex >= 0 ? parentMessageIndex : 0,
                branchId: branchId
            };

            nodes.push(branchNode);
            messages.forEach(msg => messageToNodeMap.set(msg.message_id, branchNode.id));
        });

        console.log("Built nodes:", nodes); // Debug output
        return nodes;
    };

    // Helper function to truncate text
    function truncateText(text, maxWidth, font) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = font;

        if (context.measureText(text).width <= maxWidth) {
            return text;
        }

        let truncated = text;
        while (context.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
    }

    // Helper function to calculate bounds of all clusters
    function calculateBounds(clusters) {
        const positions = clusters.map(d => ({
            left: d.x - d.width / 2,
            right: d.x + d.width / 2,
            top: d.y - d.height / 2,
            bottom: d.y + d.height / 2
        }));

        return {
            x: d3.min(positions, d => d.left),
            y: d3.min(positions, d => d.top),
            width: d3.max(positions, d => d.right) - d3.min(positions, d => d.left),
            height: d3.max(positions, d => d.bottom) - d3.min(positions, d => d.top)
        };
    }

    // Helper function to validate message data structure
    const isValidMessageData = (data) => {
        return data &&
            typeof data === 'object' &&
            data.branches &&
            Object.keys(data.branches).length > 0;
    };
    const createVisualization = useCallback(() => {
        if (!data || !svgRef.current) return;

        // Clear existing visualization
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Force layout recalculation by updating dimensions
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        svg
            .attr("width", width)
            .attr("height", height);

        if (visualizationType === 'star') {
            createStarVisualization();
        } else if (visualizationType === 'islands') {
            createIslandsVisualization();
        }
    }, [data, theme, selectedPoints, visualizationType, chatType]);

    const handleTopicSelect = (clusterId) => {
        setSelectedCluster(parseInt(clusterId));
    };

    const handleTabChange = (value) => {
        setActiveTab(value);
        // Allow DOM to update before recreating visualization
        if (value === "map" && data) {
            setTimeout(() => {
                createVisualization();
            }, 0);
        }
    };

    const handleDataUpdate = (newData) => {
        console.log("Updating data with:", newData);
        setData(newData);

        // Trigger visualization refresh
        if (activeTab === "map") {
            setTimeout(() => {
                createVisualization();
            }, 0);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(url_visualization);
                const responseData = await response.json();
                const chatsWithReflections = new Set(
                    responseData.chats_with_reflections
                );

                const chartData = [
                    {
                        id: "points",
                        data: responseData.points.map((point, i) => ({
                            x: point[0],
                            y: point[1],
                            cluster: responseData.clusters[i],
                            title: responseData.titles[i],
                            hasReflection: chatsWithReflections.has(responseData.titles[i]),
                        })),
                    },
                ];

                setData({
                    chartData,
                    topics: responseData.topics,
                });
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (activeTab === "map" && data) {
            // Clear previous visualization
            if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }

            createVisualization();
        }

        return () => {
            if (svgRef.current) {
                const svg = d3.select(svgRef.current);
                svg.selectAll("*").remove();
            }
        };
    }, [activeTab, data, chatType, createVisualization, visualizationType, theme]);


    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            </div>
        );
    }



    // Ensure this function fetches all messages, including branches
    const fetchAllMessages = async (title, chatType = 'claude') => {
        const encodedTitle = encodeURIComponent(title);
        try {
            const response = await axios.get(
                `http://127.0.0.1:5001/api/messages_all/${encodedTitle}?type=${chatType}`,
                {
                    validateStatus: function (status) {
                        return status < 500;
                    },
                }
            );
            if (response.status === 200) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error(`Error fetching all messages:`, error);
            return null;
        }
    };


    const getReflectionForChat = (chat) => {
        if (!chat || !data) return null;
        const clusterId = chat.cluster.toString();
        const reflection = data.topics[clusterId]?.reflection;
        return reflection?.replace(/<\/?antArtifact[^>]*>/g, "") || null;
    };


    return (
        <div className="h-screen flex flex-col">
            <main className="flex-1 relative">
                <VisualizationPanel {...{
                    activeTab,
                    handleTabChange,
                    chatType,
                    setChatType,
                    handleDataUpdate,
                    handleRefresh,
                    handleZoomIn,
                    handleZoomOut,
                    svgRef,
                    createVisualization,
                    data: visualizationData,
                    visualizationType,
                    setVisualizationType,
                    sortBy,
                    setSortBy,
                    selectedCluster,
                    handleTopicSelect,
                    getColor
                }} />
            </main>

            {showReflectionDialog && <ReflectionDialog
                open={showReflectionDialog}
                onOpenChange={setShowReflectionDialog}
                conversation={selectedConversation}
                reflection={selectedConversation ? getReflectionForChat(selectedConversation) : null}
            />}
            <HoverTooltip hoveredPoint={hoveredPoint} />
        </div>
    );

};

export default MainDashboard;

