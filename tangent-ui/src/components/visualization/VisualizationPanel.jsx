import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import * as d3 from "d3";
import { Button } from '../core/button';
import { RefreshCw, Plus, Minus, Search, Maximize2, Minimize2 } from 'lucide-react';
import { ChatTypeSelector, VisualizationTypeSelector } from '../shared/TypeSelector';
import { Input } from '../core/input';
import { Badge } from '../index';

const VisualizationPanel = ({
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
  data,
  visualizationType,
  setVisualizationType,
  sortBy,
  setSortBy,
  selectedCluster,
  handleTopicSelect,
  getColor
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Function to fit content to container
  const fitToContainer = useCallback(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const padding = 40;

    let bounds;
    if (visualizationType === 'islands') {
      // For islands visualization
      const clusters = svg.selectAll('.cluster');
      const clusterBounds = [];
      
      clusters.each(function() {
        const bbox = this.getBBox();
        const transform = d3.select(this).attr('transform');
        const translate = transform ? transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/) : null;
        if (translate) {
          const x = parseFloat(translate[1]);
          const y = parseFloat(translate[2]);
          clusterBounds.push({
            x1: x,
            y1: y,
            x2: x + bbox.width,
            y2: y + bbox.height
          });
        }
      });

      if (clusterBounds.length) {
        bounds = {
          x1: d3.min(clusterBounds, d => d.x1),
          y1: d3.min(clusterBounds, d => d.y1),
          x2: d3.max(clusterBounds, d => d.x2),
          y2: d3.max(clusterBounds, d => d.y2)
        };
      }
    } else {
      // For star visualization
      const nodes = svg.selectAll('.node');
      const nodePositions = [];
      nodes.each(function(d) {
        const transform = d3.select(this).attr('transform');
        if (transform) {
          const translate = transform.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
          if (translate) {
            nodePositions.push([parseFloat(translate[1]), parseFloat(translate[2])]);
          }
        }
      });

      if (nodePositions.length) {
        bounds = {
          x1: d3.min(nodePositions, d => d[0]),
          y1: d3.min(nodePositions, d => d[1]),
          x2: d3.max(nodePositions, d => d[0]),
          y2: d3.max(nodePositions, d => d[1])
        };
      }
    }

    if (!bounds) return;

    const boundsWidth = bounds.x2 - bounds.x1;
    const boundsHeight = bounds.y2 - bounds.y1;

    // Calculate the scale needed to fit the graph with padding
    const scale = Math.min(
      (width - padding * 2) / boundsWidth,
      (height - padding * 2) / boundsHeight
    ) * 0.9; // 90% of available space

    // Calculate translation to center the graph
    const translate = [
      width / 2 - ((bounds.x1 + boundsWidth / 2) * scale),
      height / 2 - ((bounds.y1 + boundsHeight / 2) * scale)
    ];

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 8])
      .on("zoom", event => {
        svg.select('g').attr("transform", event.transform);
      });

    svg.call(zoom);

    // Apply transform with animation
    svg.transition()
      .duration(750)
      .call(
        zoom.transform,
        d3.zoomIdentity
          .translate(translate[0], translate[1])
          .scale(scale)
      );
  }, [data, visualizationType]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const newFullscreenState = !!document.fullscreenElement;
      setIsFullscreen(newFullscreenState);
      
      // Wait for the fullscreen transition to complete
      setTimeout(() => {
        fitToContainer();
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [fitToContainer]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen) {
        fitToContainer();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen, fitToContainer]);

  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  // Search handler
  const handleSearch = useCallback((term) => {
    if (!data || !svgRef.current || !term) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Find matching node
    const allNodes = svg.selectAll('.node, .cluster');
    let matchingNode = null;

    allNodes.each(function(d) {
      const nodeData = d3.select(this).datum();
      if (nodeData && (
        (nodeData.title && nodeData.title.toLowerCase().includes(term.toLowerCase())) ||
        (nodeData.name && nodeData.name.toLowerCase().includes(term.toLowerCase()))
      )) {
        matchingNode = this;
      }
    });

    if (matchingNode) {
      const transform = d3.zoomTransform(matchingNode);
      const scale = 2;

      svg.transition()
        .duration(750)
        .call(
          d3.zoom().transform,
          d3.zoomIdentity
            .translate(width / 2 - transform.x * scale, height / 2 - transform.y * scale)
            .scale(scale)
        );
    }
  }, [data, svgRef]);

  const nodeStats = useMemo(() => {
    if (!data?.chartData?.[0]?.data) return { total: 0, clusters: 0, conversations: 0 };

    const conversations = data.chartData[0].data.length;
    const clusters = Object.keys(data.topics || {}).length;

    return {
      total: conversations + clusters,
      clusters,
      conversations
    };
  }, [data]);

  return (
    <div 
      ref={containerRef}
      className={`h-[85vh] w-full flex flex-col rounded-lg border border-border bg-background ${
        isFullscreen ? 'h-screen rounded-none border-none' : ''
      }`}
    >
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchTerm);
              }
            }}
            className="pl-8"
            placeholder="Search conversations and topics..."
          />
        </div>
      </div>

      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        />
        <div className="absolute left-1/2 top-4 flex gap-2 z-10 -translate-x-1/2">
          <Badge variant="outline" className="h-6 bg-background/80 backdrop-blur">
            <span className="px-2 w-[100px] text-xs text-muted-foreground">Chats: {nodeStats.total}</span>
          </Badge>
          <Badge variant="outline" className="h-6 bg-background/80 backdrop-blur">
            <span className="px-2 w-[100px] text-xs text-muted-foreground">Topics: {nodeStats.clusters}</span>
          </Badge>
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-3 bg-background">
        <div className="flex items-center justify-between gap-2">
          <VisualizationTypeSelector
            visualizationType={visualizationType}
            setVisualizationType={setVisualizationType}
          />
          <ChatTypeSelector
            chatType={chatType}
            setChatType={setChatType}
            onDataUpdate={handleDataUpdate}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" className="gap-2 flex-1" onClick={handleRefresh}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={handleZoomOut}>
              <Minus className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="secondary" onClick={handleZoomIn}>
              <Plus className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="secondary" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualizationPanel;