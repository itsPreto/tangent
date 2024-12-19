// VisualizationProvider.js
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useFPSMonitor } from '../../utils/utils'

const VisualizationContext = createContext(null);

export default function VisualizationProvider({ children }) {
  const [view, setView] = useState('clusters'); // 'clusters' or 'conversation'
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedNodePosition, setSelectedNodePosition] = useState(null);
  const [viewportDimensions, setViewportDimensions] = useState({ width: 0, height: 0 });
  const mainDashboardRef = useRef(null);
  const tangentChatRef = useRef(null);

  // Graph State
  const [graphData, setGraphData] = useState(null);
  const [isGraphLoading, setIsGraphLoading] = useState(true);

  // Existing States...
  const [transform, setTransform] = useState({
    scale: 1,
    translate: { x: 0, y: 0 }
  });

  // Smart Rendering States
  const [clusterPercentage, setClusterPercentage] = useState(1); // Start with 1%
  const [filteredData, setFilteredData] = useState(null);
  
  // FPS Monitoring
  const fps = useFPSMonitor();
  const TARGET_FPS = 45;

  // Handle refresh logic (implement as needed)
  const handleRefresh = () => {
    // Implement your refresh logic here, e.g., re-fetch data
    console.log('Refresh triggered');
  };

  // Theme state management
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

  // Smart Rendering Effect
  useEffect(() => {
    if (!graphData) return;

    const totalClusters = Object.keys(graphData.topics).length;
    let currentPercentage = 1;

    const adjustRendering = () => {
      // Calculate the number of clusters to display
      const numClustersToShow = Math.ceil((currentPercentage / 100) * totalClusters);
      const clustersToShow = Object.keys(graphData.topics).slice(0, numClustersToShow);

      // Filter the data based on clusters to show
      const newFilteredData = {
        ...graphData,
        chartData: graphData.chartData.map(dataset => ({
          ...dataset,
          data: dataset.data.filter(d => clustersToShow.includes(d.cluster.toString()))
        })),
        topics: clustersToShow.reduce((acc, clusterId) => {
          acc[clusterId] = graphData.topics[clusterId];
          return acc;
        }, {})
      };

      setFilteredData(newFilteredData);
    };

    // Adjust cluster percentage based on FPS
    if (fps < TARGET_FPS && clusterPercentage < 100) {
      currentPercentage = clusterPercentage + 1;
      setClusterPercentage(currentPercentage);
    } else if (fps > TARGET_FPS + 10 && clusterPercentage > 1) { // Adding a buffer
      currentPercentage = clusterPercentage - 1;
      setClusterPercentage(currentPercentage);
    }

    adjustRendering();
  }, [fps, clusterPercentage, graphData]);

  const value = {
    view,
    setView,
    selectedConversation,
    setSelectedConversation,
    selectedNodePosition,
    setSelectedNodePosition,
    transform,
    setTransform,
    viewportDimensions,
    setViewportDimensions,
    mainDashboardRef,
    tangentChatRef,
    handleRefresh,
    theme,
    setTheme,
    graphData,
    setGraphData,
    isGraphLoading,
    setIsGraphLoading,
    clusterPercentage, // Expose clusterPercentage
    filteredData, // Expose filteredData
  };

  return (
    <VisualizationContext.Provider value={value}>
      {children}
    </VisualizationContext.Provider>
  );
}

export function useVisualization() {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error('useVisualization must be used within VisualizationProvider');
  }
  return context;
}
