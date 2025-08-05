<template>
  <div 
    class="enhanced-infinite-canvas modern-drag-container" 
    :class="[
      'theme-' + currentTheme,
      { 
        'drag-over': isDragOver,
        'drag-active': isDragActive,
        'left-panel-open': sidePanelOpen,
        'right-panel-open': rightPanelOpen,
        'both-panels-open': sidePanelOpen && rightPanelOpen
      }
    ]"
    :style="canvasPositionStyle" 
    @dragenter.prevent="handleDragEnter" 
    @dragover.prevent="handleDragOver" 
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
    ref="canvasRef"
  >



    <!-- Enhanced Loading State -->
    <Transition name="fade" mode="out-in">
      <div v-if="chatStore.isLoading" class="canvas-loading-overlay">
        <div class="loading-container lottie-loading">
          <div class="lottie-wrapper">
            <DotLottieVue 
              :src="'/loading-animation-2.lottie'"
              autoplay 
              loop 
              :style="{ width: '200px', height: '200px' }"
              class="lottie-loader"
            />
            <div class="loading-glow"></div>
          </div>
          <div class="loading-content">
            <h3 class="loading-title">Loading workspaces</h3>
            <div class="loading-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
            <div class="loading-progress-modern">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ loadingProgress }}%</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

      
      <!-- Main Canvas -->
      <div v-if="!chatStore.isLoading" class="workspace-container">
      
      <!-- Grid Layer (always visible behind everything) -->
      <div class="absolute inset-0 overflow-hidden" style="z-index: -1;">
        <canvas
          ref="gridCanvas"
          class="absolute inset-0 w-full h-full"
          :style="gridCanvasStyle"
        />
      </div>
      
      <Transition name="fade">
        <div v-if="notification.visible"
          class="fixed top-16 left-1/2 transform -translate-x-1/2 px-4 py-2 notification-toast rounded-lg shadow-lg z-50">
          {{ notification.message }}
        </div>
      </Transition>

      <!-- Top Drawing Toolbar with zen mode transition -->
      <Transition name="slide-up">
        <TopDocker v-if="!isWorkspaceOverview && !isInZenMode" />
      </Transition>

      <!-- Enhanced Workspace Search Bar -->
      <Transition name="slide-down" appear>
        <WorkspaceSearchBar 
          v-if="isWorkspaceOverview" 
          v-model="searchQuery" 
          :view-mode="viewMode"
          :side-panel-open="sidePanelOpen"
          :right-panel-open="rightPanelOpen"
          :rag-panel-open="appStore.isRAGPanelOpen"
          @toggle-view="handleViewModeToggle" 
          class="workspace-search-bar enhanced-search-bar" 
        />
      </Transition>

      <!-- LOD Lock Indicator -->
      <Transition name="fade">
        <div 
          v-if="isLODLocked" 
          class="fixed top-4 right-4 z-50 bg-primary/90 text-primary-content px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm border border-primary/20"
        >
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
            <span class="text-sm font-medium">LOD Locked: {{ lockedLODLevel.toUpperCase() }}</span>
            <button 
              @click="toggleLODLock"
              class="ml-2 hover:bg-primary-content/10 rounded p-1 transition-colors"
              title="Click to unlock LOD (or press L)"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </Transition>

      
      <!-- Distance Indicator -->
      <Transition name="distance-fade">
        <div 
          v-if="shouldShowDistanceIndicator"
          class="distance-indicator" 
          @click="() => viewportReturn.centerOnContent(canvasRef)"
        >
        <div class="direction-arrows">
          <div 
            class="arrow-container"
            :style="{
              transform: `rotate(${arrowRotation}deg)`
            }"
          >
            <div class="arrow-group">
              <div class="arrow arrow-1">→</div>
              <div class="arrow arrow-2">→</div>
              <div class="arrow arrow-3">→</div>
            </div>
          </div>
        </div>
        
        <div class="distance-info">
          <div class="distance-text">{{ viewportReturn.distanceToContent }}px away</div>
          <div class="return-hint">Click to center content</div>
        </div>
        </div>
      </Transition>

      <!-- Detailed Workspace View (when a workspace is selected) -->
      <div v-if="!isWorkspaceOverview"
        class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-none"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseUp"
        @mousedown="handleCanvasMouseDown" @touchstart="handleTouchStart" @touchmove="handleTouchMove" 
        @touchend="handleTouchEnd" @wheel="handleWheel" @gesturestart="handleGestureStart" 
        @gesturechange="handleGestureChange" @gestureend="handleGestureEnd" tabindex="0"
        @keydown="handleKeyDown">
        

        <!-- Selection Rectangle Overlay -->
        <div
          v-if="selectionRect.isActive"
          class="absolute pointer-events-none border-2 border-primary bg-primary/10 rounded-sm"
          :style="selectionRectStyle"
          style="z-index: 1000;"
        />

        <!-- Canvas Transform Container -->
        <div class="absolute transform-gpu" :style="transformStyle" style="z-index: 2;">
          <!-- SVG Layer for Connections and Drawing -->
          <svg class="absolute overflow-visible" style="z-index: 0;" :style="svgStyle">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
              </marker>
            </defs>
            
            <!-- Drawing Shapes Layer (behind connections) -->
            <g class="drawing-shapes-layer">
              <template v-for="shape in drawingStore.shapes" :key="shape.id">
                <!-- Rectangle -->
                <rect v-if="shape.type === 'rectangle'"
                  :x="shape.x" :y="shape.y" 
                  :width="shape.width" :height="shape.height"
                  :fill="shape.fillColor" 
                  :stroke="shape.strokeColor" 
                  :stroke-width="shape.strokeWidth"
                  :opacity="shape.opacity"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
                
                <!-- Circle -->
                <circle v-else-if="shape.type === 'circle'"
                  :cx="shape.x" :cy="shape.y" 
                  :r="shape.radius"
                  :fill="shape.fillColor" 
                  :stroke="shape.strokeColor" 
                  :stroke-width="shape.strokeWidth"
                  :opacity="shape.opacity"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
                
                <!-- Line -->
                <line v-else-if="shape.type === 'line'"
                  :x1="shape.x" :y1="shape.y" 
                  :x2="shape.x + (shape.width || 0)" :y2="shape.y + (shape.height || 0)"
                  :stroke="shape.strokeColor" 
                  :stroke-width="shape.strokeWidth"
                  :opacity="shape.opacity"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
                
                <!-- Arrow -->
                <g v-else-if="shape.type === 'arrow'">
                  <line :x1="shape.x" :y1="shape.y" 
                    :x2="shape.x + (shape.width || 0)" :y2="shape.y + (shape.height || 0)"
                    :stroke="shape.strokeColor" 
                    :stroke-width="shape.strokeWidth"
                    :opacity="shape.opacity"
                    marker-end="url(#arrowhead)"
                    :class="{ 'selected': shape.isSelected }"
                    @click="handleShapeClick(shape.id, $event)"
                    @mousedown="handleShapeMouseDown(shape.id, $event)"
                    :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
                </g>
                
                <!-- Pen/Freehand -->
                <path v-else-if="shape.type === 'pen' && shape.points"
                  :d="getPathData(shape.points)"
                  :stroke="shape.strokeColor" 
                  :stroke-width="shape.strokeWidth"
                  :opacity="shape.opacity"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
                
                <!-- Text -->
                <text v-else-if="shape.type === 'text'"
                  :x="shape.x" :y="shape.y + (16 / zoom)" 
                  :fill="shape.strokeColor" 
                  :opacity="shape.opacity"
                  font-family="Arial, sans-serif"
                  :font-size="16 / zoom"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @dblclick="handleTextDoubleClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }">
                  {{ shape.text || 'Text' }}
                </text>
                
                <!-- Fill areas -->
                <path v-else-if="shape.type === 'fill' && shape.fillPath"
                  :d="shape.fillPath"
                  :fill="shape.fillColor" 
                  :opacity="shape.opacity"
                  stroke="none"
                  :class="{ 'selected': shape.isSelected }"
                  @click="handleShapeClick(shape.id, $event)"
                  @mousedown="handleShapeMouseDown(shape.id, $event)"
                  :style="{ cursor: drawingStore.currentTool === 'eraser' ? 'crosshair' : shape.isLocked ? 'not-allowed' : 'pointer' }" />
              </template>
              
              <!-- Current drawing shape preview -->
              <g v-if="drawingStore.currentShape && drawingStore.isDrawing" class="current-drawing" style="opacity: 0.7;">
                <rect v-if="drawingStore.currentShape.type === 'rectangle'"
                  :x="drawingStore.currentShape.x" :y="drawingStore.currentShape.y" 
                  :width="drawingStore.currentShape.width" :height="drawingStore.currentShape.height"
                  :fill="drawingStore.currentShape.fillColor" 
                  :stroke="drawingStore.currentShape.strokeColor" 
                  :stroke-width="drawingStore.currentShape.strokeWidth" />
                
                <circle v-else-if="drawingStore.currentShape.type === 'circle'"
                  :cx="drawingStore.currentShape.x" :cy="drawingStore.currentShape.y" 
                  :r="drawingStore.currentShape.radius"
                  :fill="drawingStore.currentShape.fillColor" 
                  :stroke="drawingStore.currentShape.strokeColor" 
                  :stroke-width="drawingStore.currentShape.strokeWidth" />
                
                <line v-else-if="drawingStore.currentShape.type === 'line'"
                  :x1="drawingStore.currentShape.x" :y1="drawingStore.currentShape.y" 
                  :x2="drawingStore.currentShape.x + (drawingStore.currentShape.width || 0)" 
                  :y2="drawingStore.currentShape.y + (drawingStore.currentShape.height || 0)"
                  :stroke="drawingStore.currentShape.strokeColor" 
                  :stroke-width="drawingStore.currentShape.strokeWidth" />
                
                <path v-else-if="drawingStore.currentShape.type === 'pen' && drawingStore.currentShape.points"
                  :d="getPathData(drawingStore.currentShape.points)"
                  :stroke="drawingStore.currentShape.strokeColor" 
                  :stroke-width="drawingStore.currentShape.strokeWidth"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </g>
              
              <!-- Selection Boundary -->
              <rect v-if="drawingStore.selectionBounds && drawingStore.hasSelection && drawingStore.selectedShapeIds.length > 1"
                :x="drawingStore.selectionBounds.x" :y="drawingStore.selectionBounds.y" 
                :width="drawingStore.selectionBounds.width" :height="drawingStore.selectionBounds.height"
                fill="rgba(59, 130, 246, 0.05)" 
                stroke="rgba(59, 130, 246, 0.8)" 
                stroke-width="2"
                stroke-dasharray="5,5"
                class="selection-boundary cursor-move hover:fill-opacity-20 transition-all"
                style="pointer-events: auto;"
                @mousedown="handleSelectionBoundaryMouseDown($event)">
                <animate attributeName="stroke-dashoffset" values="0;10" dur="1s" repeatCount="indefinite" />
              </rect>
              
              <!-- Node Selection Boundary -->
              <g v-if="selectedNodeIds.size > 1" class="node-selection-group">
                <rect
                  :x="nodeSelectionBounds.x" :y="nodeSelectionBounds.y" 
                  :width="nodeSelectionBounds.width" :height="nodeSelectionBounds.height"
                  fill="rgba(34, 197, 94, 0.1)" 
                  stroke="rgba(34, 197, 94, 0.9)" 
                  stroke-width="2"
                  stroke-dasharray="6,3"
                  class="node-selection-boundary cursor-move hover:fill-opacity-20 transition-all"
                  style="pointer-events: auto;"
                  @mousedown="handleNodeSelectionBoundaryMouseDown($event)"
                  @click="(e) => console.log('Boundary clicked!', e)">
                  <animate attributeName="stroke-dashoffset" values="0;9" dur="1s" repeatCount="indefinite" />
                </rect>
                
                <!-- Collapse Button -->
                <g class="collapse-button" :transform="`translate(${nodeSelectionBounds.x + nodeSelectionBounds.width - 30}, ${nodeSelectionBounds.y + 10})`">
                  <circle
                    r="15"
                    fill="rgba(34, 197, 94, 0.9)"
                    stroke="rgba(255, 255, 255, 0.9)"
                    stroke-width="2"
                    class="collapse-btn cursor-pointer hover:fill-opacity-80 transition-all"
                    @click="handleCollapseButtonClick($event)"
                  />
                  <text
                    text-anchor="middle"
                    dy="1"
                    fill="white"
                    font-size="10"
                    font-weight="bold"
                    class="collapse-btn-text cursor-pointer"
                    @click="handleCollapseButtonClick($event)"
                  >
                    ⟐
                  </text>
                  
                  <!-- Tooltip background -->
                  <rect
                    x="-25"
                    y="-35"
                    width="50"
                    height="18"
                    fill="rgba(0, 0, 0, 0.8)"
                    rx="4"
                    class="tooltip-bg opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                  />
                  <text
                    text-anchor="middle"
                    y="-24"
                    fill="white"
                    font-size="10"
                    class="tooltip-text opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                  >
                    Collapse
                  </text>
                </g>
                
                <!-- Selection counter -->
                <text
                  :x="nodeSelectionBounds.x + 10"
                  :y="nodeSelectionBounds.y - 5"
                  fill="rgba(34, 197, 94, 0.9)"
                  font-size="12"
                  font-weight="600"
                  class="selection-counter"
                >
                  {{ selectedNodeIds.size }} nodes selected
                </text>
              </g>
              
              <!-- Resize Handles for Single Selected Shape -->
              <g v-if="drawingStore.hasSelection && drawingStore.selectedShapeIds.length === 1 && drawingStore.currentTool === 'cursor'">
                <template v-for="shape in drawingStore.selectedShapes" :key="`handles-${shape.id}`">
                  <!-- Rectangle/Diamond/Text Resize Handles -->
                  <template v-if="['rectangle', 'diamond', 'text'].includes(shape.type) && shape.width && shape.height">
                    <!-- Corner handles -->
                    <rect :x="shape.x - (8 / zoom)" :y="shape.y - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: nw-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'nw')" />
                    <rect :x="shape.x + shape.width - (8 / zoom)" :y="shape.y - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: ne-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'ne')" />
                    <rect :x="shape.x - (8 / zoom)" :y="shape.y + shape.height - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: sw-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'sw')" />
                    <rect :x="shape.x + shape.width - (8 / zoom)" :y="shape.y + shape.height - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: se-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'se')" />
                    
                    <!-- Edge handles -->
                    <rect :x="shape.x + shape.width/2 - (8 / zoom)" :y="shape.y - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: n-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'n')" />
                    <rect :x="shape.x + shape.width/2 - (8 / zoom)" :y="shape.y + shape.height - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: s-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 's')" />
                    <rect :x="shape.x - (8 / zoom)" :y="shape.y + shape.height/2 - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: w-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'w')" />
                    <rect :x="shape.x + shape.width - (8 / zoom)" :y="shape.y + shape.height/2 - (8 / zoom)" :width="16 / zoom" :height="16 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: e-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'e')" />
                  </template>
                  
                  <!-- Circle Resize Handles -->
                  <template v-if="shape.type === 'circle' && shape.radius">
                    <!-- Four cardinal direction handles -->
                    <circle :cx="shape.x" :cy="shape.y - shape.radius" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: n-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'n')" />
                    <circle :cx="shape.x + shape.radius" :cy="shape.y" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: e-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'e')" />
                    <circle :cx="shape.x" :cy="shape.y + shape.radius" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: s-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 's')" />
                    <circle :cx="shape.x - shape.radius" :cy="shape.y" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: w-resize;"
                      @mousedown="handleResizeStart($event, shape.id, 'w')" />
                  </template>
                  
                  <!-- Line/Arrow Resize Handles -->
                  <template v-if="['line', 'arrow'].includes(shape.type)">
                    <!-- Start and end point handles -->
                    <circle :cx="shape.x" :cy="shape.y" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: move;"
                      @mousedown="handleResizeStart($event, shape.id, 'start')" />
                    <circle :cx="shape.x + (shape.width || 0)" :cy="shape.y + (shape.height || 0)" :r="8 / zoom" 
                      fill="white" stroke="rgba(59, 130, 246, 0.8)" :stroke-width="2 / zoom" 
                      class="resize-handle" style="cursor: move;"
                      @mousedown="handleResizeStart($event, shape.id, 'end')" />
                  </template>
                </template>
              </g>
            </g>
            
            <!-- Connections Layer (above drawing shapes) - Hide at cluster zoom -->
            <!-- Original MainSplineConnector connections -->
            <template v-for="node in visibleNodes" :key="node.id">
              <MainSplineConnector
                v-if="node.parentId && getParentNode(node.parentId) && !store.snappedNodeId"
                :start-node="getParentNode(node.parentId)"
                :end-node="node"
                :zoom-level="zoom"
                :is-source-node-expanded="expandedNodes.has(node.parentId)"
                :card-width="getEffectiveCardDimensions(node).width"
                :card-height="getEffectiveCardDimensions(node).height"
                :start-card-width="getParentNode(node.parentId) ? getEffectiveCardDimensions(getParentNode(node.parentId)).width : 300"
                :start-card-height="getParentNode(node.parentId) ? getEffectiveCardDimensions(getParentNode(node.parentId)).height : 200"
                :end-lod-level="getLODLevel(node.id)"
                :start-lod-level="getLODLevel(node.parentId)"
                :is-active="isConnectionActive(node.parentId, node.id)"
                :is-hovered="isConnectionHovered(node.parentId, node.id)"
                :curvature="curvature"
                :theme="currentTheme"
                :stroke-width="2"
                :connection-label="connectionLabels.get(`${node.parentId}-${node.id}`)"
                @label-update="(label) => setConnectionLabel(node.parentId, node.id, label)"
                @connection-click="() => handleConnectionClick(node.parentId, node.id)"
                @connection-hover="(hovered) => handleConnectionHover(node.parentId, node.id, hovered)"
              />
            </template>

            <!-- Tool Grouping Rectangles (rendered early so they don't block interactive elements) -->
            <g v-if="toolGroups.length > 0" class="tool-grouping-layer">
              <g v-for="group in toolGroups" :key="group.toolName" class="tool-group">
                <rect
                  :x="group.x"
                  :y="group.y" 
                  :width="group.width"
                  :height="group.height"
                  :fill="group.color"
                  :stroke="group.color"
                  stroke-width="2"
                  opacity="0.1"
                  stroke-opacity="0.4"
                  rx="8"
                  class="tool-group-rect hover:opacity-20 transition-opacity cursor-move"
                  @mousedown="handleToolGroupRectMouseDown($event, group)"
                />
                <text
                  :x="group.x + 10"
                  :y="group.y - 5"
                  :fill="group.color"
                  font-size="12"
                  font-weight="600"
                  class="tool-group-label"
                >
                  {{ group.toolName }} ({{ group.nodes.length }})
                </text>
              </g>
            </g>


            <!-- Workspace Overview Dots (visual reference at low zoom) -->
            <g v-if="workspaceOverviewDots.length > 0" class="workspace-overview-layer">
              <g v-for="workspace in workspaceOverviewDots" :key="workspace.id" class="workspace-overview-dot">
                <circle
                  :cx="workspace.x"
                  :cy="workspace.y"
                  :r="Math.max(20, workspace.nodeCount * 3)"
                  fill="#4ECDC4"
                  opacity="0.6"
                  stroke="#4ECDC4"
                  stroke-width="2"
                  class="cursor-pointer hover:opacity-80 transition-opacity"
                  @click="navigateToWorkspace(workspace)"
                />
                <!-- Background for title text -->
                <rect
                  :x="workspace.x - (workspace.title.length * Math.max(12, Math.min(48, 16 / zoom))) / 3"
                  :y="workspace.y + Math.max(35, workspace.nodeCount * 3 + 15) - Math.max(12, Math.min(48, 16 / zoom)) / 2"
                  :width="(workspace.title.length * Math.max(12, Math.min(48, 16 / zoom))) / 1.5"
                  :height="Math.max(12, Math.min(48, 16 / zoom)) + 4"
                  fill="rgba(0, 0, 0, 0.8)"
                  rx="4"
                  class="pointer-events-none"
                  :transform="`rotate(${workspace.rotation || 0} ${workspace.x} ${workspace.y + Math.max(35, workspace.nodeCount * 3 + 15)})`"
                />
                <text
                  :x="workspace.x"
                  :y="workspace.y + Math.max(35, workspace.nodeCount * 3 + 15)"
                  text-anchor="middle"
                  dominant-baseline="middle"
                  fill="white"
                  :font-size="Math.max(12, Math.min(48, 16 / zoom))"
                  :transform="`rotate(${workspace.rotation || 0} ${workspace.x} ${workspace.y + Math.max(35, workspace.nodeCount * 3 + 15)})`"
                  font-weight="700"
                  class="pointer-events-none workspace-title"
                  style="text-shadow: 2px 2px 4px rgba(0,0,0,0.8);"
                >
                  {{ workspace.title }}
                </text>
              </g>
            </g>

            <!-- Selection Box -->
            <rect
              v-if="selectionBoxRect"
              :x="selectionBoxRect.x"
              :y="selectionBoxRect.y"
              :width="selectionBoxRect.width"
              :height="selectionBoxRect.height"
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3B82F6"
              stroke-width="2"
              stroke-dasharray="5,5"
              class="selection-box"
            />

            <!-- Topic Islands Layer (for cluster LOD) - REMOVED: Just show individual workspace nodes -->
            <!-- <TopicIslandView
              :zoom-level="zoom"
              :viewport-bounds="viewportReturn.getViewportBounds(canvasRef)"
              :cluster-data="clusterViewData"
              :is-lod-locked="isLODLocked"
              :locked-lod-level="lockedLODLevel"
              @navigate-to-island="handleNavigateToIsland"
              @zoom-to-overview="handleZoomToOverview"
              @navigate-to-workspace="handleNavigateToWorkspace"
            /> -->
          </svg>

          <!-- Original spline connections restored -->

          <!-- Nodes Layer - Hide at cluster zoom -->
          <div class="absolute" :style="nodesLayerStyle" style="z-index: 1">
            <template v-for="node in visibleNodes" :key="node.id">
              <!-- Branch Node (handles all node types from all workspaces) -->
              <BranchNode v-if="(node.type === 'branch' || node.type === 'main' || node.type === 'media') && (!store.snappedNodeId || store.snappedNodeId === node.id)" :node="node"
                :is-selected="isNodeFocused(node.id)" :is-multi-selected="selectedNodeIds.has(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom" :lod-level="getLODLevel(node.id)"
                :model-registry="modelRegistry" :is-side-panel-open="appStore.isLeftSidebarExpanded"
                :is-right-panel-open="rightPanelOpen" :is-right-sidebar-expanded="rightSidebarExpanded" :supports-vision="isVisionModelSelected"
                :is-potential-drop-target="potentialDropTargets.has(node.id)" :disable-entrance-animation="isMorphingFromInputContainer"
                :is-invalid-drop-target="invalidDropTargets.has(node.id)"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => handleNodeDelete(node.id)"
                @update-messages="(messages) => store.updateNodeMessages(node.id, messages)"
                @connection-start="handleConnectionStart"
                @connection-drag="handleConnectionDrag"
                @connection-end="handleConnectionEnd"
                @reflectionSuggestionClick="handleReflectionSuggestionClick" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Web Node -->
              <WebBranchNode v-else-if="node.type === 'web' && (!store.snappedNodeId || store.snappedNodeId === node.id)" :node="node" :is-selected="isNodeFocused(node.id)"
                :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :modelType="modelType"
                :zoom="zoom" :lod-level="getLODLevel(node.id)" :model-registry="modelRegistry"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => handleNodeDelete(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Tool Call Compact Node -->
              <ToolCallCompactNode v-else-if="node.type === 'tool-call-compact'" 
                :tool-call="node.toolCall" 
                :is-selected="isNodeFocused(node.id)"
                @click="handleToolCallCompactClick"
                @double-click="handleToolCallCompactDoubleClick"
                :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning
                    ? 'transform 0.3s ease-out'
                    : 'none',
                }" />

              <!-- Branch Node -->
              <BranchNode v-else-if="!store.snappedNodeId || store.snappedNodeId === node.id" :node="node" :is-selected="isNodeFocused(node.id)"
                :is-snapped="store.snappedNodeId === node.id" :is-multi-selected="selectedNodeIds.has(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom" :lod-level="getLODLevel(node.id)"
                :model-registry="modelRegistry" :is-side-panel-open="appStore.isLeftSidebarExpanded"
                :is-right-panel-open="rightPanelOpen" :is-right-sidebar-expanded="rightSidebarExpanded" :supports-vision="isVisionModelSelected"
                :disable-entrance-animation="isMorphingFromInputContainer"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => handleNodeDelete(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" @focus-input="handleFocusInput"
                @expansion-change="handleNodeExpansionChange"
                @update-messages="(messages) => store.updateNodeMessages(node.id, messages)"
                @reflectionSuggestionClick="handleReflectionSuggestionClick" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none',
                }" />

              <!-- Branch Index Label -->
              <BranchIndexLabel 
                v-if="!store.snappedNodeId && store.nodeIndices.has(node.id)"
                :node="node"
                :node-index="store.nodeIndices.get(node.id)"
                :zoom="zoom"
                :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none',
                }"
              />
            </template>
            
            <!-- Canvas Input Container (inside canvas coordinate system) -->
            <CanvasInputContainer
              ref="canvasInputRef"
              :zoom="zoom"
              :pan-x="panX"
              :pan-y="panY"
              @workspace-created="handleWorkspaceCreated"
              @transition-start="handleInputTransitionStart"
              @transition-complete="handleInputTransitionComplete"
              @morph-phase-complete="handleMorphPhaseComplete"
              @request-target-position="handleTargetPositionRequest"
            />
            
          </div>

          <!-- Interaction Layer for Splines - Between SVG and Nodes -->
          <svg class="absolute overflow-visible" style="z-index: 0.5; pointer-events: none;" :style="svgStyle">
            <!-- Interaction layer now handled by ConnectionLayer components -->
          </svg>
        </div>
      </div>
    </div>

    <!-- File Drop Overlay -->
    <div v-show="isDraggingFile"
      class="absolute inset-0 file-drop-overlay backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
      <div class="text-2xl font-semibold file-drop-text">
        Drop media to create a new node
      </div>
    </div>

    <!-- Bottom Docker with zen mode transition -->
    <Transition name="slide-down">
      <BottomDocker 
        v-if="!isWorkspaceOverview && !store.snappedNodeId && !isInZenMode"
        :curvature="curvature"
        :zoom="zoom"
        :pan-x="panX"
        :pan-y="panY"
        :mouse-x="mousePosition.x"
        :mouse-y="mousePosition.y"
        :is-pan-mode="drawingStore.currentTool === 'hand'"
        :gesture-mode="gestureMode"
        :is-outside-bounds="isViewportOutsideBounds"
        :is-arranging="isAutoArranging"
        @update:curvature="curvature = $event"
        @fit-to-view="autoFitNodes"
        @toggle-pan-mode="togglePanMode"
        @toggle-gesture-mode="toggleGestureMode"
        @auto-arrange="handleAutoArrange"
      />
    </Transition>

    <!-- Shape Properties Panel -->
    <ShapePropertiesPanel 
      v-if="!isWorkspaceOverview"
    />

  </div>
</template>

<script setup lang="ts">
import {
  ref,
  provide,
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  watch,
  PropType,
} from "vue";
import BranchNode from "./node/BranchNode.vue";
import BranchIndexLabel from "./BranchIndexLabel.vue";
import ToolCallCompactNode from "./node/ToolCallCompactNode.vue";
import emitter from '@/utils/eventBus'
import CanvasInputContainer from "./CanvasInputContainer.vue";
import WorkspaceSearchBar from "../workspace/WorkspaceSearchBar.vue";
import WebBranchNode from "./node/WebBranchNode.vue";
import MainSplineConnector from "./spline/MainSplineConnector.vue";
import TopDocker from "./TopDocker.vue";
import BottomDocker from "./BottomDocker.vue";
import TopicIslandView from "./TopicIslandView.vue";
import ShapePropertiesPanel from "./ShapePropertiesPanel.vue";
import { useCanvasStore } from "@/stores/canvasStore";
import { useChatStore } from "@/stores/chatStore";
import { useToolCallStore } from "@/stores/toolCallStore";
import { useDrawingStore } from "@/stores/drawingStore";
import { useViewportObserver } from "@/composables/useViewportObserver";
import { useViewportReturn } from "@/composables/useViewportReturn";
import { useAppStore } from "@/stores/appStore";
import { useModelStore } from "@/stores/modelStore";
import { useThemeStore } from "@/stores/themeStore";
import type { ModelInfo } from '@/types/model';
import { debounce } from 'lodash-es';
import { Plus, Circle, LayoutGrid, Bot, MessageSquare, Download, Sparkles, Upload, ArrowRight } from "lucide-vue-next";
import { DotLottieVue } from '@lottiefiles/dotlottie-vue';
import { autoArrangeService } from '@/services/autoArrangeService';

// Add near the top with other refs
const modelRegistry = ref(new Map<string, ModelInfo>());

const store = useCanvasStore();
const chatStore = useChatStore();
const drawingStore = useDrawingStore();
const toolCallStore = useToolCallStore();
const modelStore = useModelStore();
const appStore = useAppStore();
const themeStore = useThemeStore();


// Theme computeds
const currentTheme = computed(() => themeStore.currentTheme);
const themeColors = computed(() => themeStore.currentThemeColors);

// Populate model registry with all available models
const updateModelRegistry = () => {
  modelRegistry.value.clear();

  // Add all available models from each provider to the registry
  const allModels = [
    ...modelStore.ollamaModels,
    ...modelStore.openRouterModels,
    ...modelStore.googleModels,
    ...modelStore.anthropicModels,
    ...modelStore.openaiModels
  ];

  allModels.forEach(model => {
    if (model && model.id) {
      modelRegistry.value.set(model.id, model);
    }
  });
};

// View modes and search
const viewMode = ref('grid'); // Only 'grid' mode now
const searchQuery = ref('');

// External workspace controls
const externalViewMode = ref('grid');
const externalSortBy = ref('recent');
const externalCardSize = ref(240);
const gridWorkspaceRef = ref(null);

// RTS perspective constants
const RTS_SCALE_Y = 0.6; // Vertical compression factor for RTS perspective
const perfTestPanel = ref(null);

// Props
const props = defineProps({
  id: {
    type: String,
    required: false,
    default: null,
  },
  selectedModel: {
    type: String,
    required: true,
    default: "",
  },
  openRouterApiKey: {
    type: String,
    required: true,
  },
  modelType: {
    type: String,
    required: true,
    default: "",
  },
  sidePanelOpen: {
    type: Boolean,
    required: true,
  },
  rightPanelOpen: {
    type: Boolean,
    default: false,
  },
  rightSidebarExpanded: {
    type: Boolean,
    default: false,
  },
  autoZoomEnabled: {
    type: Boolean,
    required: true,
  },
  zoom: {
    type: Number,
    required: true,
    default: 1,
  },
  gestureMode: {
    type: String as PropType<"scroll" | "zoom">,
    required: true,
    default: "scroll",
  },
  isHeightLocked: {
    type: Boolean,
    required: true,
    default: false,
  },
  isWelcomeScreen: {
    type: Boolean,
    required: false,
    default: true,
  },
});

// Emits
const emit = defineEmits([
  "update:zoom",
  "update:autoZoomEnabled",
  "update:isHeightLocked",
  "update:gestureMode",
  "update:isWelcomeScreen",
  "update:zenMode",
  "workspace-opened",
  "snap",
  "unsnap",
  "update-filter-state",
  "update-graph-stats",
  "update-3d-support",
  "update-fullscreen",
  "tool-call-selected"
]);

// Modify zoom ref to be computed
const zoom = computed({
  get: () => props.zoom,
  set: (value) => emit("update:zoom", value),
});

const targetZoom = 1.5;

// Watch for autoZoom changes
watch(
  () => props.autoZoomEnabled,
  (newValue) => {
    if (newValue) {
      autoFitNodes();
    }
  }
);

// Watch for zoom changes to clear focused LOD node
watch(
  () => props.zoom,
  (newZoom, oldZoom) => {
    // Clear focused LOD node when user manually zooms
    // but only if the zoom change is significant (not from clicking on the node)
    if (Math.abs(newZoom - oldZoom) > 0.01) {
      // Check if we're still above the full detail threshold
      if (newZoom <= 0.5) {
        // Handle low zoom level
      }
    }
  }
);

// State
const panX = ref(0);
const panY = ref(0);

// Note: viewport return composable and computed properties initialized later after autoFitNodes is declared

// Continuous viewport checking for real-time updates
let continuousCheckInterval: number | null = null;
const startContinuousViewportCheck = () => {
  // Clear any existing interval
  if (continuousCheckInterval) {
    clearInterval(continuousCheckInterval);
  }
  
  // Start checking every 100ms for 2 seconds after scroll
  let checksRemaining = 20; // 20 checks * 100ms = 2 seconds
  // console.log('🔄 STARTING continuous viewport checks');
  continuousCheckInterval = setInterval(() => {
    // console.log('🔄 Continuous check', checksRemaining, 'remaining');
    viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
    checksRemaining--;
    
    if (checksRemaining <= 0) {
      clearInterval(continuousCheckInterval!);
      continuousCheckInterval = null;
      // console.log('🔄 STOPPED continuous checks');
    }
  }, 100) as unknown as number;
};

const connectionLayer = ref(null);
const expandedNodes = ref(new Set());
const connectionLabels = ref(new Map());
const isPanning = ref(false);
const isTransitioning = ref(false);
const curvature = ref(0.5); // Spline curvature (0 = straight, 1 = very curvy)
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);
const mousePosition = ref({ x: 0, y: 0 });
const showFitButton = ref(false);
// Node that's been clicked on for LOD focus

const focusedTopicId = ref<string | null>(null);

// Workspace overview dots (visual reference only at low zoom)
const workspaceOverviewDots = computed(() => {
  if (zoom.value >= 0.20 || allWorkspaceNodes.value.length === 0) {
    return []; // Only show below 20% zoom
  }
  
  // Group workspace nodes by workspaceId to create overview dots
  const workspaceGroups = new Map();
  allWorkspaceNodes.value.forEach(node => {
    if (!node.workspaceId) return;
    if (!workspaceGroups.has(node.workspaceId)) {
      workspaceGroups.set(node.workspaceId, {
        id: node.workspaceId,
        title: node.workspaceTitle || `Workspace ${node.workspaceId}`,
        nodes: []
      });
    }
    workspaceGroups.get(node.workspaceId).nodes.push(node);
  });
  
  // Calculate center position and rotation for each workspace
  const workspaceDots = Array.from(workspaceGroups.values()).map((workspace, index) => {
    let centerX = 0, centerY = 0;
    workspace.nodes.forEach(node => {
      centerX += node.x || 0;
      centerY += node.y || 0;
    });
    centerX /= workspace.nodes.length;
    centerY /= workspace.nodes.length;
    
    // Calculate rotation angle based on spiral position
    // Find the workspace index from the center (0,0)
    const angle = Math.atan2(centerY, centerX);
    const rotationDegrees = (angle * 180 / Math.PI) + 90; // +90 to align with spiral direction
    
    const workspaceInfo = {
      id: workspace.id,
      title: workspace.title,
      x: centerX,
      y: centerY,
      nodeCount: workspace.nodes.length,
      rotation: rotationDegrees
    };
    
    // Update persistent workspace positions for LOD system
    allWorkspacePositions.value.set(workspace.id, {
      id: workspace.id,
      title: workspace.title,
      x: centerX,
      y: centerY,
      nodeCount: workspace.nodes.length
    });
    
    return workspaceInfo;
  });
  
  return workspaceDots;
});

// WASD Panning state
const keysPressed = ref(new Set<string>());
const panVelocity = ref({ x: 0, y: 0 });
const panAcceleration = ref(0.2); // Reduced base acceleration
const panMaxSpeed = ref(8); // Reduced maximum speed cap
const panDecay = ref(0.90); // Faster decay when keys released
let panAnimationFrame: number | null = null;

// Track current focused workspace for island navigation
const currentWorkspaceId = ref<string | null>(null);

// Tool grouping state
const showToolGrouping = ref<boolean>(false);

// Use existing selectionRect for drag selection
const selectionBoxRect = computed(() => {
  if (!selectionRect.value.isActive) return null;
  
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return null;
  
  // Convert screen coordinates to canvas coordinates
  const startX = (selectionRect.value.startX - rect.left - panX.value) / zoom.value;
  const startY = (selectionRect.value.startY - rect.top - panY.value) / zoom.value;
  const currentX = (selectionRect.value.currentX - rect.left - panX.value) / zoom.value;
  const currentY = (selectionRect.value.currentY - rect.top - panY.value) / zoom.value;
  
  const minX = Math.min(startX, currentX);
  const minY = Math.min(startY, currentY);
  const maxX = Math.max(startX, currentX);
  const maxY = Math.max(startY, currentY);
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
});

// Node selection bounds for multi-selected nodes
const nodeSelectionBounds = computed(() => {
  if (selectedNodeIds.value.size < 2) {
    console.log('NodeSelectionBounds: Not enough nodes selected:', selectedNodeIds.value.size);
    return null;
  }
  
  const selectedNodes = Array.from(selectedNodeIds.value)
    .map(id => store.nodes.find(n => n.id === id))
    .filter(node => node);
    
  if (selectedNodes.length < 2) {
    console.log('NodeSelectionBounds: Not enough valid nodes found:', selectedNodes.length);
    return null;
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  selectedNodes.forEach(node => {
    const dimensions = getEffectiveCardDimensions(node);
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + dimensions.width);
    maxY = Math.max(maxY, node.y + dimensions.height);
  });
  
  // Add some padding around the selection
  const padding = 15;
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  
  // Shift left and up by 15%
  const leftShift = width * 0.15;
  const upShift = height * 0.15;
  
  const bounds = {
    x: minX - padding - leftShift,
    y: minY - padding - upShift,
    width: width,
    height: height
  };
  
  console.log('NodeSelectionBounds: Calculated bounds for', selectedNodes.length, 'nodes:', bounds);
  return bounds;
});

// Cached cluster view data to prevent recomputation during pan
const cachedClusterViewData = ref(null);
const lastClusterDataUpdate = ref(0);

// Cache for all nodes from all chats (used in cluster view)
const allNodesCache = ref(new Map());
const lastAllNodesUpdate = ref(0);
// Cache positioned nodes to avoid expensive recalculation during panning
const positionedNodesCache = ref([]);
const lastPositionUpdate = ref(0);

// This function is no longer needed - nodes should stay at their natural positions
// Keeping it for now to avoid breaking references, but it just returns nodes as-is

// Position nodes around their topic islands for cluster view
const positionNodesAroundTopicIslands = (allNodes) => {
  // Get cluster view data to know topic positions
  const clusterData = cachedClusterViewData.value;
  if (!clusterData || clusterData.length === 0) {
    console.log('[DEBUG] No cluster data available for positioning');
    return allNodes;
  }

  // Create a map of chatId to topic island position
  const topicPositions = new Map();
  clusterData.forEach(topic => {
    topic.workspaces.forEach(workspace => {
      topicPositions.set(workspace.id, {
        topicX: topic.x,
        topicY: topic.y,
        workspaceX: workspace.x,
        workspaceY: workspace.y
      });
    });
  });

  console.log(`[DEBUG] Created position map for ${topicPositions.size} workspaces`);

  // Repositioned nodes
  let positionFoundCount = 0;
  let noPositionCount = 0;
  const repositionedNodes = allNodes.map(node => {
    const position = topicPositions.get(node.chatId);
    if (!position) {
      // If we can't find the workspace position, keep original coordinates
      console.log(`[DEBUG] No position found for node ${node.id} in chat ${node.chatId}`);
      noPositionCount++;
      return node;
    }

    positionFoundCount++;
    
    // Calculate relative position of node within its original workspace
    // Assume nodes were originally positioned around 0,0 or find the workspace center
    const originalX = node.x || 0;
    const originalY = node.y || 0;
    
    // Scale down the original layout to fit around the workspace position
    const scale = 0.1; // Make nodes much smaller relative to their island
    const scaledX = originalX * scale;
    const scaledY = originalY * scale;
    
    // Position around the workspace location with some offset to spread them out
    const offsetRadius = 80; // Distance from workspace center
    const angle = Math.random() * 2 * Math.PI; // Random angle for better distribution
    const offsetX = Math.cos(angle) * offsetRadius * Math.random();
    const offsetY = Math.sin(angle) * offsetRadius * Math.random();
    
    const newX = position.workspaceX + scaledX + offsetX;
    const newY = position.workspaceY + scaledY + offsetY;

    return {
      ...node,
      x: newX,
      y: newY,
      // Store original coordinates for potential restoration
      originalX: originalX,
      originalY: originalY
    };
  });

  console.log(`[DEBUG] Repositioned ${repositionedNodes.length} nodes: ${positionFoundCount} positioned, ${noPositionCount} kept original`);
  return repositionedNodes;
};

// Load all nodes from all chats for cluster view
const loadAllNodes = async () => {
  if (Date.now() - lastAllNodesUpdate.value < 1000) return; // Throttle to 1 second
  
  // console.log('[DEBUG] loadAllNodes called');
  try {
    const allWorkspaces = chatStore.chats || [];
    // console.log(`[DEBUG] Found ${allWorkspaces.length} workspaces to load nodes from`);
    // console.log(`[DEBUG] First 3 workspace positions:`, allWorkspaces.slice(0,3).map(w => ({id: w.id, title: w.title, x: w.x, y: w.y})));
    
    const nodePromises = allWorkspaces.map(async (workspace) => {
      try {
        // console.log(`[DEBUG] Loading nodes for workspace ${workspace.id} (${workspace.title})`);
        const response = await fetch(`http://127.0.0.1:5050/chats/${workspace.id}`);
        if (!response.ok) {
          console.warn(`[DEBUG] Failed to load chat data for ${workspace.id}: ${response.status}`);
          return [];
        }
        const chatData = await response.json();
        
        // Extract nodes from the chat data, flattening the hierarchical structure
        const extractNodes = (node) => {
          const nodes = [node];
          if (node.children && Array.isArray(node.children)) {
            node.children.forEach(child => {
              nodes.push(...extractNodes(child));
            });
          }
          return nodes;
        };
        
        // Check if chatData has nodes property and what type it is
        let nodes = [];
        if (chatData.nodes) {
          if (Array.isArray(chatData.nodes)) {
            // If it's an array, flatten all nodes
            nodes = chatData.nodes.flatMap(extractNodes);
          } else if (typeof chatData.nodes === 'object' && chatData.nodes.id) {
            // If it's a single root node object, extract all nodes from it
            nodes = extractNodes(chatData.nodes);
            // console.log(`[DEBUG] Extracted nodes from single root node for ${workspace.id}`);
          } else {
            console.warn(`[DEBUG] Unexpected nodes structure for ${workspace.id}:`, typeof chatData.nodes, chatData.nodes);
          }
        } else {
          console.warn(`[DEBUG] No nodes property found in chatData for ${workspace.id}`, Object.keys(chatData));
        }
        
        // console.log(`[DEBUG] Loaded ${nodes.length} nodes from workspace ${workspace.id}`);
        return nodes;
      } catch (error) {
        console.warn(`Failed to load nodes for workspace ${workspace.id}:`, error);
        return [];
      }
    });
    
    const allNodesArrays = await Promise.all(nodePromises);
    const newCache = new Map();
    let totalNodes = 0;
    
    // Store nodes by chat ID and position them relative to their workspace's grid position
    allWorkspaces.forEach((workspace, index) => {
      const nodes = allNodesArrays[index];
      if (nodes.length > 0) {
        // Find the workspace's actual grid position from allWorkspaceNodes
        const workspaceNode = allWorkspaceNodes.value.find(n => n.workspaceId === workspace.id);
        const workspaceX = workspaceNode?.x || workspace.x || 0;
        const workspaceY = workspaceNode?.y || workspace.y || 0;
        
        console.log(`[DEBUG] Positioning workspace ${workspace.title} at (${workspaceX}, ${workspaceY})`);
        
        // Position nodes relative to their workspace's grid coordinates
        const offsetNodes = nodes.map(node => ({
          ...node,
          x: (node.x || 0) + workspaceX,
          y: (node.y || 0) + workspaceY,
          workspaceId: workspace.id,
          workspaceTitle: workspace.title
        }));
        
        newCache.set(workspace.id, offsetNodes);
        totalNodes += offsetNodes.length;
      }
    });
    
    // console.log(`[DEBUG] Successfully cached ${totalNodes} total nodes from ${newCache.size} workspaces`);
    allNodesCache.value = newCache;
    lastAllNodesUpdate.value = Date.now();
    // Clear positioned nodes cache since we have new data
    positionedNodesCache.value = [];
    lastPositionUpdate.value = 0;
  } catch (error) {
    console.error('Failed to load all nodes for cluster view:', error);
  }
};

// Only update cluster data when necessary (not during pan/zoom)
const updateClusterViewData = () => {
  // Skip if we're not in cluster view
  if (zoom.value > 0.10) {
    cachedClusterViewData.value = null;
    return;
  }
  
  // Skip if panning or data was recently updated
  if (isPanning.value || Date.now() - lastClusterDataUpdate.value < 100) {
    return;
  }
  
  // Get all chats (workspaces)
  const allWorkspaces = chatStore.chats || [];
  
  // Group workspaces by topic (you can enhance this with real topic classification)
  const topicGroups = new Map();
  
  allWorkspaces.forEach((workspace) => {
    // For now, use a simple heuristic to assign topics
    // You can enhance this with proper topic classification
    let topicName = 'General';
    
    // Simple keyword-based topic assignment
    const title = workspace.title.toLowerCase();
    if (title.includes('code') || title.includes('programming') || title.includes('development')) {
      topicName = 'Development';
    } else if (title.includes('design') || title.includes('ui') || title.includes('ux')) {
      topicName = 'Design';
    } else if (title.includes('data') || title.includes('analysis') || title.includes('research')) {
      topicName = 'Research';
    } else if (title.includes('project') || title.includes('management') || title.includes('planning')) {
      topicName = 'Project Management';
    }
    
    if (!topicGroups.has(topicName)) {
      topicGroups.set(topicName, []);
    }
    
    // Get branch count for this workspace
    const workspaceNodes = store.nodes.filter(node => node.chatId === workspace.id);
    const branchCount = workspaceNodes.length;
    
    topicGroups.get(topicName).push({
      id: workspace.id,
      title: workspace.title,
      branchCount,
      nodes: workspaceNodes
    });
  });
  
  // Convert to array with positioning
  const topics = [];
  let topicIndex = 0;
  
  topicGroups.forEach((workspaces, topicName) => {
    // Position topics in a circle
    const angle = (topicIndex / topicGroups.size) * 2 * Math.PI;
    const topicRadius = 800; // Distance from center
    const topicX = Math.cos(angle) * topicRadius;
    const topicY = Math.sin(angle) * topicRadius;
    
    topics.push({
      id: `topic-${topicIndex}`,
      name: topicName,
      x: topicX,
      y: topicY,
      workspaces: workspaces.map((workspace, workspaceIndex) => {
        // Position workspaces around their topic center
        const workspaceAngle = (workspaceIndex / workspaces.length) * 2 * Math.PI;
        const workspaceRadius = 200;
        
        return {
          ...workspace,
          x: topicX + Math.cos(workspaceAngle) * workspaceRadius,
          y: topicY + Math.sin(workspaceAngle) * workspaceRadius
        };
      })
    });
    
    topicIndex++;
  });
  
  // Cache the result
  cachedClusterViewData.value = topics;
  lastClusterDataUpdate.value = Date.now();
};

// Computed property that returns cached data
const clusterViewData = computed(() => {
  // Only show in cluster view
  if (zoom.value > 0.10) return null;
  
  // Update cache if needed (but not during pan)
  if (!cachedClusterViewData.value && !isPanning.value) {
    updateClusterViewData();
  }
  
  return cachedClusterViewData.value;
});

// Load all workspace nodes when chats change
watch(() => chatStore.chats, () => {
  // Simply reload all nodes when workspaces change
  if (!isPanning.value && !isTransitioning.value) {
    allNodesCache.value.clear();
    loadAllNodes();
  }
}, { deep: true });

// Zoom change detection for transition state
watch(() => zoom.value, (newZoom, oldZoom) => {
  // Detect significant zoom changes for transition state
  const significantChange = Math.abs(newZoom - oldZoom) > 0.05;
  if (significantChange) {
    isTransitioning.value = true;
    // Clear transition flag after animation completes
    setTimeout(() => {
      isTransitioning.value = false;
    }, 300);
  }
}, { flush: 'post' });

// Group tool nodes by type
const toolGroups = computed(() => {
  if (!showToolGrouping.value) return [];
  
  const groups = new Map();
  
  visibleNodes.value.forEach(node => {
    // Check if node is a tool call node
    if (node.type === 'tool-call-compact' || node.messages?.some(msg => msg.tool_calls)) {
      // Extract tool name from the node
      let toolName = '';
      
      if (node.messages && node.messages.length > 0) {
        // Find the last message with tool calls
        const toolMessage = node.messages.find(msg => msg.tool_calls && msg.tool_calls.length > 0);
        if (toolMessage && toolMessage.tool_calls && toolMessage.tool_calls[0]) {
          const functionName = toolMessage.tool_calls[0].function?.name || '';
          
          // Map function names to readable tool categories
          switch (functionName) {
            case 'Task':
              toolName = 'Agent Tasks';
              break;
            case 'Read':
            case 'NotebookRead':
              toolName = 'Read Tools';
              break;
            case 'Write':
            case 'MultiEdit':
            case 'Edit':
            case 'NotebookEdit':
              toolName = 'Write & Edit Tools';
              break;
            case 'Bash':
              toolName = 'Bash Commands';
              break;
            case 'WebFetch':
              toolName = 'Web Fetch';
              break;
            case 'WebSearch':
              toolName = 'Web Search';
              break;
            case 'Grep':
              toolName = 'Search (Grep)';
              break;
            case 'Glob':
              toolName = 'File Patterns (Glob)';
              break;
            case 'LS':
              toolName = 'Directory Listing';
              break;
            case 'TodoWrite':
              toolName = 'Task Management';
              break;
            default:
              toolName = functionName ? `${functionName} Tool` : 'Other Tools';
          }
        }
      }
      
      // Also check node title for tool names (fallback)
      if (!toolName && node.title) {
        const title = node.title.toLowerCase();
        if (title.includes('agent task') || title.includes('task tool')) toolName = 'Agent Tasks';
        else if (title.includes('read') && !title.includes('write')) toolName = 'Read Tools';
        else if (title.includes('write') || title.includes('edit') || title.includes('multiedit')) toolName = 'Write & Edit Tools';
        else if (title.includes('bash') || title.includes('command')) toolName = 'Bash Commands';
        else if (title.includes('webfetch') || title.includes('web fetch')) toolName = 'Web Fetch';
        else if (title.includes('websearch') || title.includes('web search')) toolName = 'Web Search';
        else if (title.includes('grep') || title.includes('search')) toolName = 'Search (Grep)';
        else if (title.includes('glob') || title.includes('pattern')) toolName = 'File Patterns (Glob)';
        else if (title.includes('ls') || title.includes('list') || title.includes('directory')) toolName = 'Directory Listing';
        else if (title.includes('todo') || title.includes('task management')) toolName = 'Task Management';
        else toolName = 'Other Tools';
      }
      
      if (!toolName) toolName = 'Other Tools';
      
      if (!groups.has(toolName)) {
        groups.set(toolName, []);
      }
      groups.get(toolName).push(node);
    }
  });
  
  // Convert to array and use fixed positions
  return Array.from(groups.entries()).map(([toolName, nodes]) => {
    if (nodes.length < 2) return null; // Don't group single nodes
    
    // Use fixed group positions if available (prevents movement during drag)
    const fixedPos = fixedGroupPositions.value.get(toolName);
    if (fixedPos) {
      return {
        toolName,
        nodes,
        x: fixedPos.x,
        y: fixedPos.y,
        width: fixedPos.width,
        height: fixedPos.height,
        color: getToolGroupColor(toolName)
      };
    }
    
    // Fallback calculation if no fixed position (initial setup)
    const groupWidth = 1000; // Fixed width for consistency
    const nodesPerRow = Math.min(Math.ceil(Math.sqrt(nodes.length + 1)), 4);
    const rows = Math.ceil(nodes.length / nodesPerRow);
    const nodeSpacing = 200;
    const groupHeight = Math.max(300, rows * (nodeSpacing * 0.6) + 160); // Dynamic height based on content
    
    // Find the main Claude Code session node for positioning reference
    const mainNode = store.nodes.find(node => 
      !node.parentId || 
      node.messages?.some(msg => msg.role === 'user' && !msg.tool_calls)
    );
    
    if (!mainNode) return null;
    
    const mainNodeX = mainNode.x || 0;
    const mainNodeY = mainNode.y || 0;
    
    // Calculate position based on tool type index (for systematic vertical stacking)
    const toolTypes = Array.from(groups.keys());
    const typeIndex = toolTypes.indexOf(toolName);
    
    const rightOffset = 700;
    const groupSpacing = 50;
    const previousGroupsHeight = toolTypes.slice(0, typeIndex).reduce((totalHeight, prevToolName) => {
      const prevNodes = groups.get(prevToolName) || [];
      const prevRows = Math.ceil(prevNodes.length / nodesPerRow);
      const prevHeight = Math.max(300, prevRows * (nodeSpacing * 0.6) + 160);
      return totalHeight + prevHeight + groupSpacing;
    }, 0);
    
    const x = mainNodeX + rightOffset;
    const y = mainNodeY - 100 + previousGroupsHeight;
    
    return {
      toolName,
      nodes,
      x,
      y,
      width: groupWidth,
      height: groupHeight,
      color: getToolGroupColor(toolName)
    };
  }).filter(group => group !== null);
});

// Get color for tool group
const getToolGroupColor = (toolName: string): string => {
  const colors = {
    'Agent Tasks': '#FF6B6B',
    'Read Tools': '#4ECDC4', 
    'Write & Edit Tools': '#45B7D1',
    'Bash Commands': '#FFEAA7',
    'Web Fetch': '#DDA0DD',
    'Web Search': '#98D8C8',
    'Search (Grep)': '#F7DC6F',
    'File Patterns (Glob)': '#BB8FCE',
    'Directory Listing': '#85C1E9',
    'Task Management': '#90EE90',
    'Other Tools': '#C0C0C0'
  };
  
  // Handle dynamic tool names (e.g., "SomeTool Tool")
  if (!colors[toolName] && toolName.endsWith(' Tool')) {
    return '#B19CD9'; // Light purple for unknown specific tools
  }
  
  return colors[toolName] || '#C0C0C0';
};

// Store fixed group positions to prevent recalculation during drag
const fixedGroupPositions = ref(new Map());

// Organize tool nodes to the right based on branch depth/index
const organizeToolNodes = () => {
  if (!showToolGrouping.value) return;
  
  // Find the main Claude Code session node (usually the root/first node)
  const mainNode = store.nodes.find(node => 
    !node.parentId || 
    node.messages?.some(msg => msg.role === 'user' && !msg.tool_calls)
  );
  
  if (!mainNode) return;
  
  const mainNodeX = mainNode.x || 0;
  const mainNodeY = mainNode.y || 0;
  
  // Group tool nodes by their tool type and calculate new positions
  const toolNodesByType = new Map();
  
  store.nodes.forEach(node => {
    // Skip if not a tool node
    if (!node.type?.includes('tool-call') && !node.messages?.some(msg => msg.tool_calls)) {
      return;
    }
    
    // Calculate branch depth (distance from main node)
    const branchDepth = calculateBranchDepth(node, mainNode);
    
    // Extract tool name using the same logic as toolGroups
    let toolName = 'Other Tools';
    
    if (node.messages && node.messages.length > 0) {
      const toolMessage = node.messages.find(msg => msg.tool_calls && msg.tool_calls.length > 0);
      if (toolMessage && toolMessage.tool_calls && toolMessage.tool_calls[0]) {
        const functionName = toolMessage.tool_calls[0].function?.name || '';
        
        switch (functionName) {
          case 'Task':
            toolName = 'Agent Tasks';
            break;
          case 'Read':
          case 'NotebookRead':
            toolName = 'Read Tools';
            break;
          case 'Write':
          case 'MultiEdit':
          case 'Edit':
          case 'NotebookEdit':
            toolName = 'Write & Edit Tools';
            break;
          case 'Bash':
            toolName = 'Bash Commands';
            break;
          case 'WebFetch':
            toolName = 'Web Fetch';
            break;
          case 'WebSearch':
            toolName = 'Web Search';
            break;
          case 'Grep':
            toolName = 'Search (Grep)';
            break;
          case 'Glob':
            toolName = 'File Patterns (Glob)';
            break;
          case 'LS':
            toolName = 'Directory Listing';
            break;
          case 'TodoWrite':
            toolName = 'Task Management';
            break;
          default:
            toolName = functionName ? `${functionName} Tool` : 'Other Tools';
        }
      }
    }
    
    // Fallback to title-based detection
    if (toolName === 'Other Tools' && node.title) {
      const title = node.title.toLowerCase();
      if (title.includes('agent task') || title.includes('task tool')) toolName = 'Agent Tasks';
      else if (title.includes('read') && !title.includes('write')) toolName = 'Read Tools';
      else if (title.includes('write') || title.includes('edit') || title.includes('multiedit')) toolName = 'Write & Edit Tools';
      else if (title.includes('bash') || title.includes('command')) toolName = 'Bash Commands';
      else if (title.includes('webfetch') || title.includes('web fetch')) toolName = 'Web Fetch';
      else if (title.includes('websearch') || title.includes('web search')) toolName = 'Web Search';
      else if (title.includes('grep') || title.includes('search')) toolName = 'Search (Grep)';
      else if (title.includes('glob') || title.includes('pattern')) toolName = 'File Patterns (Glob)';
      else if (title.includes('ls') || title.includes('list') || title.includes('directory')) toolName = 'Directory Listing';
      else if (title.includes('todo') || title.includes('task management')) toolName = 'Task Management';
    }
    
    if (!toolNodesByType.has(toolName)) {
      toolNodesByType.set(toolName, []);
    }
    
    toolNodesByType.get(toolName).push({ node, branchDepth });
  });
  
  // Clear and recalculate fixed group positions
  fixedGroupPositions.value.clear();
  
  // Position tool nodes in organized rectangles
  let currentGroupY = mainNodeY - 100; // Start slightly above main node
  let currentRightOffset = 700; // Distance to the right of main session (will increase for waterfall)
  const groupWidth = 1000; // Width of each tool group rectangle
  const groupHeight = 300; // Base height for each group
  const nodeSpacing = 200; // Space between nodes within group
  const groupSpacing = 50; // Space between different tool groups
  const waterfallHorizontalStep = 150; // How much each group shifts right
  
  let groupIndex = 0;
  toolNodesByType.forEach((toolNodes, toolName) => {
    if (toolNodes.length === 0) return;
    
    // Sort by branch depth for systematic organization
    toolNodes.sort((a, b) => a.branchDepth - b.branchDepth);
    
    // Calculate grid layout within the rectangle with better spacing
    const nodesPerRow = Math.min(Math.ceil(Math.sqrt(toolNodes.length)), 3); // Max 3 per row for better spacing
    const rows = Math.ceil(toolNodes.length / nodesPerRow);
    const nodeWidth = 300; // Approximate node width
    const nodeHeight = 200; // Approximate node height
    const horizontalSpacing = nodeWidth + 80; // Space between node centers horizontally
    const verticalSpacing = nodeHeight + 60; // Space between node centers vertically
    const leftPadding = 60;
    const topPadding = 100; // Space for group label
    
    // Calculate actual group dimensions based on content
    const actualGroupWidth = Math.max(groupWidth, leftPadding * 2 + (nodesPerRow * horizontalSpacing));
    const actualGroupHeight = Math.max(groupHeight, topPadding + (rows * verticalSpacing) + 60);
    
    // Position nodes in a grid within the rectangle (waterfall layout)
    const groupStartX = mainNodeX + currentRightOffset;
    const groupStartY = currentGroupY;
    
    // Store fixed group position
    fixedGroupPositions.value.set(toolName, {
      x: groupStartX,
      y: groupStartY,
      width: actualGroupWidth,
      height: actualGroupHeight
    });
    
    toolNodes.forEach((toolNodeData, index) => {
      const { node } = toolNodeData;
      
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      
      // Calculate systematic position within the group rectangle with proper spacing
      const nodeX = groupStartX + leftPadding + (col * horizontalSpacing);
      const nodeY = groupStartY + topPadding + (row * verticalSpacing);
      
      // Update node position only if not currently being dragged
      if (!store.isDragging && !isMultiDragging.value) {
        node.x = nodeX;
        node.y = nodeY;
      }
    });
    
    // Move to next group position - waterfall layout (diagonal staggering)
    currentGroupY += actualGroupHeight + groupSpacing;
    currentRightOffset += waterfallHorizontalStep; // Each group shifts right for waterfall effect
    groupIndex++;
  });
};

// Calculate branch depth (how far a node is from the main session)
const calculateBranchDepth = (node: any, mainNode: any): number => {
  if (node.id === mainNode.id) return 0;
  
  let depth = 0;
  let currentNode = node;
  const visited = new Set();
  
  while (currentNode && currentNode.parentId && !visited.has(currentNode.id)) {
    visited.add(currentNode.id);
    const parent = store.nodes.find(n => n.id === currentNode.parentId);
    if (!parent) break;
    depth++;
    currentNode = parent;
    if (currentNode.id === mainNode.id) break;
  }
  
  return depth;
};


// Navigate to a workspace overview dot
const navigateToWorkspace = async (workspace: any) => {
  console.log('Navigate to workspace:', workspace);
  
  try {
    // Load the workspace data
    const chatData = await chatStore.loadChat(workspace.id);
    if (!chatData) {
      console.error('Failed to load workspace:', workspace.id);
      return;
    }
    
    // Load the conversation structure into the canvas
    await store.loadChatState(workspace.id);
    
    // Switch out of workspace overview mode
    isWorkspaceOverview.value = false;
    
    // Get the FULL LOD coordinates from fresh chat data (not current summary positions)
    const fullChatData = await chatStore.loadChat(workspace.id);
    if (fullChatData?.nodes) {
      // Find main node in the full chat data structure
      const findMainNodeInFullData = (nodeData: any): any => {
        if (!nodeData) return null;
        if (nodeData.parentId === null || nodeData.parentId === undefined) {
          return nodeData;
        }
        // If it's an array, find the node without parentId
        if (Array.isArray(nodeData)) {
          return nodeData.find(n => n.parentId === null || n.parentId === undefined);
        }
        return null;
      };
      
      const fullMainNode = findMainNodeInFullData(fullChatData.nodes);
      if (fullMainNode) {
        console.log('Centering on full LOD main node:', { x: fullMainNode.x, y: fullMainNode.y });
        const targetZoom = 0.8; // Good zoom level to see conversation detail
        const duration = 800; // Animation duration
        
        centerOnPointWithAnimation(fullMainNode.x, fullMainNode.y, targetZoom, duration);
      } else {
        // Fallback to workspace center
        console.log('No main node found, centering on workspace center');
        const targetZoom = 0.5; 
        const duration = 800;
        centerOnPointWithAnimation(workspace.x, workspace.y, targetZoom, duration);
      }
    } else {
      // Fallback to workspace center
      const targetZoom = 0.5; 
      const duration = 800;
      centerOnPointWithAnimation(workspace.x, workspace.y, targetZoom, duration);
    }
    
    console.log('Successfully navigated to workspace:', workspace.title);
  } catch (error) {
    console.error('Error navigating to workspace:', error);
  }
};

// Export canvas positioning data for debugging
const exportCanvasMetadata = () => {
  const metadata = {
    timestamp: new Date().toISOString(),
    zoom: zoom.value,
    pan: { x: panX.value, y: panY.value },
    workspaces: [],
    workspaceOverviewDots: [],
    branchNodes: [],
    toolNodes: []
  };

  // Export workspace positions from chatStore
  if (chatStore.chats) {
    metadata.workspaces = chatStore.chats.map(workspace => ({
      id: workspace.id,
      title: workspace.title,
      x: workspace.x || 0,
      y: workspace.y || 0,
      nodeCount: workspace.nodeCount || 0
    }));
  }

  // Export workspace overview dots (the ones that show at <15% zoom)
  if (workspaceOverviewDots.value) {
    metadata.workspaceOverviewDots = workspaceOverviewDots.value.map(dot => ({
      id: dot.id,
      title: dot.title,
      x: dot.x,
      y: dot.y,
      nodeCount: dot.nodeCount
    }));
  }

  // Export all cached nodes (branch nodes) with their workspace associations
  allNodesCache.value.forEach((nodes, workspaceId) => {
    const workspace = chatStore.chats?.find(w => w.id === workspaceId);
    nodes.forEach(node => {
      if (node.type === 'tool-call-compact') {
        metadata.toolNodes.push({
          id: node.id,
          workspaceId: workspaceId,
          workspaceTitle: workspace?.title || 'Unknown',
          type: node.type,
          x: node.x || 0,
          y: node.y || 0,
          parentId: node.parentId
        });
      } else {
        metadata.branchNodes.push({
          id: node.id,
          workspaceId: workspaceId,
          workspaceTitle: workspace?.title || 'Unknown',
          type: node.type,
          x: node.x || 0,
          y: node.y || 0,
          parentId: node.parentId,
          isMainNode: node.type === 'main' || !node.parentId
        });
      }
    });
  });

  // Create downloadable JSON
  const jsonString = JSON.stringify(metadata, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `canvas-metadata-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('Canvas metadata exported:', metadata);
  return metadata;
};

const exportViewportElements = () => {
  const viewport = viewportReturn.getViewportBounds(canvasRef.value);
  const metadata = {
    timestamp: new Date().toISOString(),
    zoom: zoom.value,
    pan: { x: panX.value, y: panY.value },
    viewport: viewport ? {
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: viewport.height
    } : null,
    visibleNodes: [],
    visibleConnections: [],
    workspaceDotsVisible: zoom.value < 0.20,
    workspaceDots: [],
    renderingStats: {
      totalNodesInCache: 0,
      visibleNodesRendered: 0,
      totalConnectionsInStore: store.connections.length,
      visibleConnectionsRendered: 0
    }
  };

  // Count total nodes in cache
  allNodesCache.value.forEach((nodes) => {
    metadata.renderingStats.totalNodesInCache += nodes.length;
  });

  // Export visible nodes (currently being rendered)
  if (visibleNodes.value.length > 0) {
    metadata.visibleNodes = visibleNodes.value.map(node => ({
      id: node.id,
      type: node.type,
      x: node.x || 0,
      y: node.y || 0,
      workspaceId: node.workspaceId || node.chatId,
      parentId: node.parentId,
      isInViewport: viewport ? viewportReturn.isNodeInViewport({
        x: node.x || 0,
        y: node.y || 0,
        width: node.type === 'tool-call-compact' ? 120 : 400,
        height: node.type === 'tool-call-compact' ? 40 : 300
      }, canvasRef.value, 500) : false
    }));
    metadata.renderingStats.visibleNodesRendered = visibleNodes.value.length;
  }

  // Export visible connections (currently being rendered)
  if (visibleConnections.value.length > 0) {
    metadata.visibleConnections = visibleConnections.value.map(conn => ({
      id: conn.id,
      parentId: conn.parent.id,
      childId: conn.child.id,
      parentPos: { x: conn.parent.x || 0, y: conn.parent.y || 0 },
      childPos: { x: conn.child.x || 0, y: conn.child.y || 0 }
    }));
    metadata.renderingStats.visibleConnectionsRendered = visibleConnections.value.length;
  }

  // Export workspace dots if they're being shown (below 20% zoom)
  if (zoom.value < 0.20 && workspaceOverviewDots.value) {
    metadata.workspaceDots = workspaceOverviewDots.value.map(dot => ({
      id: dot.id,
      title: dot.title,
      x: dot.x,
      y: dot.y,
      nodeCount: dot.nodeCount,
      isInViewport: viewport ? viewportReturn.isNodeInViewport({
        x: dot.x,
        y: dot.y,
        width: 100,
        height: 100
      }, canvasRef.value, 500) : false
    }));
  }

  // Create downloadable JSON
  const jsonString = JSON.stringify(metadata, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `viewport-elements-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('Viewport elements exported:', metadata);
  console.log(`Rendering ${metadata.renderingStats.visibleNodesRendered} nodes out of ${metadata.renderingStats.totalNodesInCache} total cached nodes`);
  return metadata;
};

// Make export function available globally for testing
window.exportCanvasMetadata = exportCanvasMetadata;
window.exportViewportElements = exportViewportElements;

// Determine which workspace island is currently in focus based on viewport center
const updateCurrentWorkspace = () => {
  if (!canvasRef.value || allWorkspaceNodes.value.length === 0) return;
  
  const viewport = viewportReturn.getViewportBounds(canvasRef.value);
  if (!viewport) return;
  
  const viewportCenterX = viewport.centerX;
  const viewportCenterY = viewport.centerY;
  
  // Find the closest workspace by checking which workspace's nodes are closest to viewport center
  let closestWorkspaceId = null;
  let closestDistance = Infinity;
  
  // Group nodes by workspace
  const workspaceGroups = new Map();
  allWorkspaceNodes.value.forEach(node => {
    if (!node.workspaceId) return;
    if (!workspaceGroups.has(node.workspaceId)) {
      workspaceGroups.set(node.workspaceId, []);
    }
    workspaceGroups.get(node.workspaceId).push(node);
  });
  
  // Find closest workspace center
  workspaceGroups.forEach((nodes, workspaceId) => {
    // Calculate workspace center
    let centerX = 0, centerY = 0;
    nodes.forEach(node => {
      centerX += node.x || 0;
      centerY += node.y || 0;
    });
    centerX /= nodes.length;
    centerY /= nodes.length;
    
    // Calculate distance to viewport center
    const distance = Math.sqrt(
      Math.pow(centerX - viewportCenterX, 2) + 
      Math.pow(centerY - viewportCenterY, 2)
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestWorkspaceId = workspaceId;
    }
  });
  
  // Only update if we found a close workspace (within reasonable distance)
  if (closestDistance < 3000) { // 3000px threshold
    currentWorkspaceId.value = closestWorkspaceId;
  }
};
const isDraggingFile = ref(false);
const isAutoArranging = ref(false);

provide('performanceTestingActive', false);

const lastActivityTimestamp = ref(Date.now());
const autoZoomEnabled = ref(true);
const isAutoZooming = ref(false);
const AUTO_CENTER_DELAY = 30000; // 30 seconds
const inactivityTimer = ref(null);

const isClusterVizFocused = ref(false);
const windowSize = ref({
  width: typeof window !== "undefined" ? window.innerWidth : 1920,
  height: typeof window !== "undefined" ? window.innerHeight : 1080,
});

// Workspace Dragging State
const workspaceDragState = ref({
  isDragging: false,
  activeId: null as string | null,
  offset: { x: 0, y: 0 },
});

const notification = ref({ visible: false, message: '' });

// Portal animation state
const isPortalHovered = ref(false);
const isPortalClicked = ref(false);
const isDragOver = ref(false);
const isDragActive = ref(false);
const loadingProgress = ref(0);
const canvasRef = ref<HTMLElement>();
const canvasInputRef = ref<InstanceType<typeof CanvasInputContainer>>();
const targetWorldPosition = ref<{ x: number, y: number }>({ x: 100, y: 0 });
const gridCanvas = ref<HTMLCanvasElement>();
const connectionDrawer = ref<any>();

// Generate cyclone lines
const cycloneLines = ref([]);
const sparkles = ref([]);

// Initialize portal animations
const initializePortalAnimations = () => {
  // Generate cyclone lines
  cycloneLines.value = Array.from({ length: 12 }, (_, i) => ({
    length: 40 + Math.random() * 20,
    x: 50 + Math.cos((i / 12) * Math.PI * 2) * 30,
    y: 50 + Math.sin((i / 12) * Math.PI * 2) * 30,
    rotation: (i / 12) * 360 + Math.random() * 30,
    delay: i * 100,
    duration: 2000 + Math.random() * 1000
  }));
  
  // Generate sparkles
  sparkles.value = Array.from({ length: 8 }, (_, i) => ({
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60,
    delay: Math.random() * 2000,
    duration: 1500 + Math.random() * 1000
  }));
};

// Zoom constants - Updated for enhanced LOD system
const ZOOM_MIN = 0.02; // 2% minimum zoom to allow cluster view at 10%
const ZOOM_MAX = 2;
const ZOOM_CLUSTER_VIEW = 0.08; // 8% zoom for cluster topic view
const ZOOM_SENSITIVITY = 0.005;
const PAN_SENSITIVITY = 1.0;

// LOD Lock System
const isLODLocked = ref(false);
const lockedLODLevel = ref('full'); // Store the locked LOD level

// Toggle LOD lock
const toggleLODLock = () => {
  if (!isLODLocked.value) {
    // Lock to current LOD level
    const currentLOD = calculateLODLevel(zoom.value);
    lockedLODLevel.value = currentLOD;
    isLODLocked.value = true;
    console.log(`[LOD Lock] Locked to ${currentLOD} LOD`);
  } else {
    // Unlock
    isLODLocked.value = false;
    console.log('[LOD Lock] Unlocked - LOD will change with zoom');
  }
};

// Calculate LOD level based on zoom (separate from locked state)
const calculateLODLevel = (zoomLevel) => {
  if (zoomLevel <= 0.10) return 'cluster';
  if (zoomLevel < LOD_PREVIEW_THRESHOLD) return 'compact';
  if (zoomLevel < LOD_FULL_THRESHOLD) return 'preview';
  return 'full';
};

// Get current LOD level respecting lock state
const getCurrentLODLevel = () => {
  if (isLODLocked.value) {
    return lockedLODLevel.value;
  }
  return calculateLODLevel(zoom.value);
};

// LOD thresholds
const LOD_FULL_THRESHOLD = 0.60; // 60%+ for full detail
const LOD_PREVIEW_THRESHOLD = 0.30; // 30-60% for preview
const LOD_COMPACT_THRESHOLD = 0.05; // 5-30% for compact
const LOD_CLUSTER_THRESHOLD = 0.01; // <1% for cluster view

// Simple Undo/Redo system for deletions and moves
const undoStack = ref([]);
const redoStack = ref([]);
const maxUndoStackSize = 20;
const dragStartPosition = ref(null);

// Multi-select system
const selectedNodeIds = ref(new Set());
const isMultiDragging = ref(false);
const multiDragStartPositions = ref(new Map());
const multiDragShapePositions = ref(new Map());


// Selection rectangle state
const selectionRect = ref({
  isActive: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
});
const isShiftPressed = ref(false);

// Shape dragging state
const shapeDragState = ref({
  isDragging: false,
  activeShapeId: null as string | null,
  startMousePos: { x: 0, y: 0 },
  startShapePositions: new Map<string, { x: number; y: number }>()
});

// Shape resizing state
const resizeState = ref({
  isResizing: false,
  shapeId: null as string | null,
  handle: null as string | null,
  startMousePos: { x: 0, y: 0 },
  originalShape: null as any
});

// Tool group dragging state
const toolGroupDragState = ref({
  isDragging: false,
  activeToolGroup: null as any,
  startMousePos: { x: 0, y: 0 },
  startNodePositions: new Map<string, { x: number; y: number }>(),
  startGroupPosition: { x: 0, y: 0 }
});

// Calculate max node count 
const maxNodeCount = computed(() => {
  if (!workspaces.value.length) return 1;
  return Math.max(...workspaces.value.map(w => w.nodeCount || 0), 1);
});


// Use v-model for isWelcomeScreen to sync with parent App.vue
const isWelcomeScreen = computed({
  get: () => props.isWelcomeScreen,
  set: (value) => emit("update:isWelcomeScreen", value),
});
const isWorkspaceOverview = ref(false);
const expandingWorkspaceId = ref<string | null>(null);

const isCreatingWorkspace = ref(false);

// Zen mode - activate when in new chat area (near input container coordinate)
const isInZenMode = computed(() => {
  if (!isWelcomeScreen.value) return false;
  
  // Check if we're near the input container coordinate (-3000, -3000)
  const NEW_CHAT_X = -3000;
  const NEW_CHAT_Y = -3000;
  
  const currentZoom = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;
  
  // Calculate if input container is near center of viewport
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return false;
  
  const screenCenterX = rect.width / 2;
  const screenCenterY = rect.height / 2;
  
  // Calculate where input container appears on screen
  const inputScreenX = (NEW_CHAT_X * currentZoom) + currentPanX;
  const inputScreenY = (NEW_CHAT_Y * currentZoom) + currentPanY;
  
  // Check if input container is reasonably centered (within 200px of screen center)
  const distanceFromCenter = Math.sqrt(
    Math.pow(inputScreenX - screenCenterX, 2) + 
    Math.pow(inputScreenY - screenCenterY, 2)
  );
  
  return distanceFromCenter < 400; // Activate zen mode when input container is within 400px of center
});

// Watch zen mode and emit changes to parent
watch(isInZenMode, (newValue) => {
  emit('update:zenMode', newValue);
}, { immediate: true });

// Performance testing flag
provide('performanceTestingActive', false);

// Initialize portal animations on component load
initializePortalAnimations();

const features = [
  {
    title: "🌳 Branch & Explore",
    description:
      "Create new conversation branches to explore different ideas and directions while maintaining context.",
  },
  {
    title: "🖼️ Rich Media",
    description:
      "Drag and drop images and files to discuss them with AI models or extract information.",
  },
  {
    title: "🤖 Multiple Models",
    description:
      "Switch between different AI models for varied capabilities and perspectives.",
  },
  {
    title: "💾 Save & Organize",
    description:
      "Create multiple workspaces to keep your projects and conversations organized.",
  },
];

// Workspace data for grid view - memoized for performance with large datasets
const workspaces = computed(() => {
  // Only include essential fields to reduce memory overhead
  return chatStore.chats.map((chat) => ({
    id: chat.id,
    title: chat.title || 'Untitled',
    nodeCount: chat.nodeCount || 0,
    lastUpdated: chat.updatedAt,
    x: chat.x || 0,
    y: chat.y || 0,
    isExpanding: expandingWorkspaceId.value === chat.id,
    tags: chat.tags || [],
    color: chat.color || '#ffffff',
    isFavorite: chat.isFavorite || false,
    status: chat.status || 'active',
    format: chat.format,
    isImported: chat.isImported || false
  }));
});

// Filtered workspaces based on search query
const filteredWorkspaces = computed(() => {
  if (!searchQuery.value) return workspaces.value;

  const query = searchQuery.value.toLowerCase();
  return workspaces.value.filter(workspace => {
    const title = (workspace.title || '').toLowerCase();
    const tags = workspace.tags ? workspace.tags.map(tag => tag.name.toLowerCase()) : [];

    return title.includes(query) || tags.some(tag => tag.includes(query));
  });
});

const isBrowser = typeof window !== "undefined";

const snappedNodeId = ref<string | null>(null);
const nodePositions = ref(new Map<string, { x: number; y: number }>());

const isFocusedMode = ref(true);
const rootNodeId = ref<string | null>(null);

// Helper Functions
const getNodeCenter = (node) => ({
  x: node.x + store.CARD_WIDTH / 2,
  y: node.y + store.CARD_HEIGHT / 2,
});

// Cycle through snapped nodes based on direction
const cycleSnappedNodes = async (direction: string) => {
  const allNodes = store.nodes.filter(node => node.id !== store.snappedNodeId);
  if (allNodes.length === 0) return;
  
  const currentNode = store.nodes.find(node => node.id === store.snappedNodeId);
  if (!currentNode) return;
  
  const currentCenter = getNodeCenter(currentNode);
  let candidates = [];
  
  // Filter nodes based on direction
  if (direction === "ArrowRight") {
    candidates = allNodes.filter(node => getNodeCenter(node).x > currentCenter.x);
    candidates.sort((a, b) => getNodeCenter(a).x - getNodeCenter(b).x);
  } else if (direction === "ArrowLeft") {
    candidates = allNodes.filter(node => getNodeCenter(node).x < currentCenter.x);
    candidates.sort((a, b) => getNodeCenter(b).x - getNodeCenter(a).x);
  } else if (direction === "ArrowUp") {
    candidates = allNodes.filter(node => getNodeCenter(node).y < currentCenter.y);
    candidates.sort((a, b) => getNodeCenter(b).y - getNodeCenter(a).y);
  } else if (direction === "ArrowDown") {
    candidates = allNodes.filter(node => getNodeCenter(node).y > currentCenter.y);
    candidates.sort((a, b) => getNodeCenter(a).y - getNodeCenter(b).y);
  }
  
  // If no candidates in that direction, cycle through all nodes
  if (candidates.length === 0) {
    candidates = allNodes;
  }
  
  // Find the next node to snap to
  const nextNode = candidates[0];
  if (nextNode) {
    await handleNodeSelect(nextNode.id);
  }
};

// Enhanced LOD Level calculation based on zoom thresholds and viewport culling
const getLODLevel = (nodeId: string) => {
  const isNodeSnapped = snappedNodeId.value === nodeId;
  const isNodeFocusedState = focusedNodeId.value === nodeId;
  
  // Always use full detail for snapped nodes
  if (isNodeSnapped) {
    return 'full';
  }
  
  // If LOD is locked, return the locked level (except for snapped nodes)
  if (isLODLocked.value) {
    return lockedLODLevel.value;
  }
  
  const currentZoom = zoom.value;
  
  // Check if node is in viewport first (for performance)
  const node = store.nodes.find(n => n.id === nodeId);
  if (node && canvasRef.value) {
    const nodeBounds = {
      x: node.x || 0,
      y: node.y || 0,
      width: node.type === 'tool-call-compact' ? 120 : 400,
      height: node.type === 'tool-call-compact' ? 40 : 300
    };
    
    // If node is not in viewport, we can return a lighter LOD or skip rendering entirely
    if (!viewportReturn.isNodeInViewport(nodeBounds, canvasRef.value, 500)) {
      // Return lighter LOD for out-of-viewport nodes to reduce processing
      if (currentZoom >= LOD_FULL_THRESHOLD) return 'preview';
      if (currentZoom >= LOD_PREVIEW_THRESHOLD) return 'compact';
      if (currentZoom >= LOD_COMPACT_THRESHOLD) return 'compact';
      return 'cluster';
    }
  }
  
  // Zoom-based LOD for visible nodes
  if (currentZoom >= LOD_FULL_THRESHOLD) {
    return 'full'; // 60%+ zoom
  } else if (currentZoom >= LOD_PREVIEW_THRESHOLD) {
    return 'preview'; // 30-60% zoom
  } else if (currentZoom >= LOD_COMPACT_THRESHOLD) {
    return 'compact'; // 5-30% zoom
  } else if (currentZoom >= LOD_CLUSTER_THRESHOLD) {
    return 'compact'; // 1-5% zoom (still show compact cards)
  } else {
    return 'cluster'; // <1% zoom (cluster view)
  }
};

// Calculate effective card dimensions based on LOD level and node type
const getEffectiveCardDimensions = (node: any) => {
  if (!node) {
    console.log('[getEffectiveCardDimensions] No node provided, using defaults');
    return { width: 300, height: 200, lodLevel: 'full' };
  }
  
  // Handle special node types first (before LOD adjustments)
  if (node.type === 'tool-call-compact') {
    // Tool call compact nodes have fixed small dimensions, ignore LOD
    const dimensions = {
      width: 120,  // Match the CSS min-width
      height: 40,  // Match the CSS height
      lodLevel: 'compact'
    };
    // console.log('[getEffectiveCardDimensions] Compact node dimensions:', { nodeId: node.id, type: node.type, dimensions });
    return dimensions;
  }
  
  const lodLevel = getLODLevel(node.id);
  
  // Base dimensions
  let width = CARD_WIDTH; // 672px
  let height = CARD_HEIGHT; // 400px
  
  // Adjust dimensions based on LOD level
  switch (lodLevel) {
    case 'cluster':
      width = 20;  // Tiny cluster squares
      height = 20;
      break;
    case 'compact':
      width = 100; // Small compact cards
      height = 100;
      break;
    case 'preview':
      width = 480; // Medium preview cards
      height = 120;
      break;
    case 'full':
    default:
      // For full LOD, use custom dimensions if available
      width = node.customWidth || CARD_WIDTH;
      height = node.customHeight || CARD_HEIGHT;
      break;
  }
  
  // Adjust for specific node types
  if (node.type === 'web') {
    // Web nodes might be slightly different
    height *= 0.8;
  }
  
  return {
    width,
    height,
    lodLevel
  };
};

const getMediaUrl = (mediaContent) => {
  if (!mediaContent) return '';
  if (mediaContent.previewUrl) return mediaContent.previewUrl;
  if (mediaContent.media_id) return `http://127.0.0.1:5050/media/${mediaContent.media_id}`;
  return '';
};

// Generate concise title for image using vision model
const generateTitleFromDescription = async (description: string): Promise<string> => {
  try {
    // Use a text model to generate a concise title from the description
    const { routerService } = await import('@/services/routerService');
    const routingResult = await routerService.routeRequest({
      message: `Based on this image description, generate a concise title in 3-5 words: "${description}". Respond with only the title, no additional text.`,
      hasImages: false
    });

    if (!routingResult.model) {
      throw new Error('No text model available for title generation');
    }

    const response = await fetch('http://127.0.0.1:5050/api/ollama-proxy/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: routingResult.model.name || routingResult.model.id,
        prompt: `Based on this image description, generate a concise title in 3-5 words: "${description}". Respond with only the title, no additional text.`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 20
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.status}`);
    }

    const result = await response.json();
    const title = result.response?.trim() || '';

    // Clean up the title - remove quotes and extra punctuation
    const cleanTitle = title.replace(/["']/g, '').replace(/\.$/, '').trim();

    console.log(`[InfiniteCanvas] Generated title: "${cleanTitle}"`);
    return cleanTitle || 'Untitled Image';

  } catch (error) {
    console.error('[InfiniteCanvas] Title generation error:', error);
    return 'Untitled Image'; // Fallback
  }
};

// Convert file to base64
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const processMediaForNode = async (node, file) => {
  try {
    // FIRST: Create thumbnail immediately for instant UI feedback
    const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const previewUrl = URL.createObjectURL(file);

    // Set media content immediately so thumbnail shows
    await store.updateNode(node.id, {
      mediaContent: {
        media_id: mediaId,
        filename: file.name,
        mime_type: file.type,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        analysis: 'Processing...',
        previewUrl
      },
      isProcessingMedia: true
    });

    console.log('[InfiniteCanvas] Media content saved to database');

    // Force a small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 50));

    // Import auto-caption service, agent service, and router service
    const { autoCaptionService } = await import('@/services/autoCaptionService');
    const { agentService } = await import('@/services/agentService');
    const { routerService } = await import('@/services/routerService');

    // Check if we should use auto-captioning for images
    const settings = await autoCaptionService.getSettings();
    const shouldAutoCaption = settings.enabled &&
      file.type.startsWith('image/') &&
      settings.model &&
      settings.model.trim() !== '';

    console.log('[InfiniteCanvas] Processing options:', {
      autoCaptionEnabled: settings.enabled,
      selectedModel: settings.model,
      shouldAutoCaption
    });

    // Use router service to determine the best approach for image handling
    if (file.type.startsWith('image/')) {
      console.log('[InfiniteCanvas] Using router service for image handling');

      const routingResult = await routerService.routeRequest({
        message: 'Analyze this uploaded image',
        hasImages: true
      });

      console.log('[InfiniteCanvas] Router result:', routingResult);

      // If no vision model configured, show agent configurator
      if (!routingResult.model) {
        console.log('[InfiniteCanvas] No vision agent configured, showing configurator');
        await agentService.showAgentConfigurator('agents');

        // Update node with message about configuration needed
        await store.updateNode(node.id, {
          mediaContent: {
            ...node.mediaContent,
            analysis: 'Image uploaded. Configure a vision agent in the settings panel to enable automatic captioning.'
          },
          messages: [
            ...(node.messages || []),
            {
              role: 'assistant',
              content: 'I\'ve uploaded your image, but no vision agent is configured for automatic analysis. Please set up a vision agent in the settings panel (gear icon) to enable automatic image captioning.',
              timestamp: new Date().toISOString()
            }
          ],
          isProcessingMedia: false,
          isGeneratingTitle: false
        });
        return;
      }

      // Update settings to use the router-selected model
      const currentSettings = await autoCaptionService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        enabled: true,
        model: routingResult.model.name || routingResult.model.id
      };

      console.log('[InfiniteCanvas] Using router-selected vision model:', routingResult.model.name);
    }

    if (shouldAutoCaption) {
      console.log('[InfiniteCanvas] Using auto-captioning service');

      // Update status
      node.mediaContent.analysis = 'Generating caption...';

      // Generate caption
      const result = await autoCaptionService.captionFile(file);

      if (result.success && result.caption) {
        // Update with successful caption
        const updatedMediaContent = {
          ...node.mediaContent,
          analysis: result.caption
        };

        const updatedMessages = [
          ...(node.messages || []),
          {
            role: 'assistant',
            content: result.caption,
            timestamp: new Date().toISOString()
          }
        ];

        console.log(`[InfiniteCanvas] Auto-caption generated in ${result.responseTime}ms`);
        console.log('[InfiniteCanvas] Updating node with caption:', result.caption.substring(0, 100) + '...');

        // Generate a concise title from the image description
        let conciseTitle = node.title;
        if (node.isGeneratingTitle) {
          try {
            conciseTitle = await generateTitleFromDescription(result.caption);
            console.log('[InfiniteCanvas] Generated title from description:', conciseTitle);
          } catch (error) {
            console.warn('[InfiniteCanvas] Title generation from description failed:', error);
          }
        }

        // Save updated content to database
        await store.updateNode(node.id, {
          mediaContent: updatedMediaContent,
          messages: updatedMessages,
          isProcessingMedia: false,
          isGeneratingTitle: false,
          title: conciseTitle,
          metadata: {
            ...node.metadata,
            mediaContent: updatedMediaContent
          }
        });
      } else {
        // Handle caption failure
        console.error(`[InfiniteCanvas] Auto-caption failed:`, result.error);

        const updatedMediaContent = {
          ...node.mediaContent,
          analysis: 'Caption generation failed'
        };

        const updatedMessages = [
          ...(node.messages || []),
          {
            role: 'assistant',
            content: `Image uploaded successfully, but automatic captioning failed: ${result.error}. You can still chat about this image.`,
            timestamp: new Date().toISOString()
          }
        ];

        // Save updated content to database
        await store.updateNode(node.id, {
          mediaContent: updatedMediaContent,
          messages: updatedMessages,
          isProcessingMedia: false,
          isGeneratingTitle: false,
          metadata: {
            ...node.metadata,
            mediaContent: updatedMediaContent
          }
        });
      }

      console.log('[InfiniteCanvas] Auto-caption complete, saved to database');
    } else {
      // No auto-captioning, just mark as ready
      await store.updateNode(node.id, {
        mediaContent: {
          ...node.mediaContent,
          analysis: 'Media uploaded successfully'
        },
        isProcessingMedia: false,
        isGeneratingTitle: false
      });
    }

  } catch (error) {
    console.error('[InfiniteCanvas] Media processing error:', error);

    await store.updateNode(node.id, {
      mediaContent: {
        ...node.mediaContent,
        analysis: `Processing failed: ${error.message}`
      },
      isProcessingMedia: false,
      isGeneratingTitle: false
    });
  }
};

// Vision capabilities computed property
const isVisionModelSelected = computed(() => {
  return modelStore.selectedModelCapabilities?.supportsVision || false;
});

// Enhanced computed styles with RTS perspective
const transformStyle = computed(() => {
  if (store.snappedNodeId !== null) {
    return {
      transform: "none",
      transformOrigin: "0 0",
      width: "100%",
      height: "100%",
      transition: "none",
    };
  }

  // Overview mode with RTS perspective adjustments
  if (isWorkspaceOverview.value) {
    return {
      transform: `translate(${panX.value}px, ${panY.value}px)`,
      transformOrigin: "0 0",
      transition: "transform 0.3s ease-out",
    };
  }

  // Regular mode: scale and translate
  return {
    transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
    transformOrigin: "0 0",
    width: "100000px",
    height: "100000px",
    transition: store.isTransitioning ? "transform 0.3s ease-out" : "none",
  };
});

const svgStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  // Remove viewBox to keep SVG coordinates 1:1 with pixel coordinates
}));

const nodesLayerStyle = computed(() => ({
  width: "100000px",
  height: "100000px",
  left: 0,
  top: 0,
  pointerEvents: 'auto', // Allow pointer events for nodes always
}));

// Grid system
const GRID_SIZE = 50; // Base grid size in pixels
const GRID_SUBDIVISIONS = 5; // Minor grid lines every 5th of major grid
const GRID_MAJOR_SIZE = GRID_SIZE * GRID_SUBDIVISIONS; // Major grid lines every 250px

const gridCanvasStyle = computed(() => ({
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
}));

// Canvas positioning - legacy mode uses fixed positioning, dual sidebar mode uses wrapper positioning  
const canvasPositionStyle = computed(() => {
  if (appStore.isDualSidebarMode) {
    // In dual sidebar mode, positioning is handled by the canvas wrapper in App.vue
    return {
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '30',
    };
  } else {
    // Legacy mode - apply the original 40vw positioning
    return {
      left: sidePanelOpen ? '50vw' : '0px',
      right: rightPanelOpen ? '50vw' : '0',
      top: '0',
      bottom: '0',
      zIndex: '30',
    };
  }
});

// Selection rectangle style
const selectionRectStyle = computed(() => {
  const rect = selectionRect.value;
  const left = Math.min(rect.startX, rect.currentX);
  const top = Math.min(rect.startY, rect.currentY);
  const width = Math.abs(rect.currentX - rect.startX);
  const height = Math.abs(rect.currentY - rect.startY);
  
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
});

// Grid rendering function
const renderGrid = () => {
  if (!gridCanvas.value) return;
  
  const canvas = gridCanvas.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Set canvas size to match viewport
  const rect = canvas.getBoundingClientRect();
  
  // Ensure canvas has valid dimensions before rendering
  if (rect.width <= 0 || rect.height <= 0) {
    console.log('[renderGrid] Canvas has invalid dimensions, retrying in 100ms');
    setTimeout(() => renderGrid(), 100);
    return;
  }
  
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  ctx.scale(dpr, dpr);
  
  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  // Get current transform values
  const currentZoom = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;
  
  // Skip grid if zoom is too low (performance optimization)
  if (currentZoom < 0.1) return;
  
  // Calculate grid spacing based on zoom level
  const baseGridSize = GRID_SIZE * currentZoom;
  const majorGridSize = GRID_MAJOR_SIZE * currentZoom;
  
  // Adaptive grid density - show fewer lines when zoomed out
  let gridStep = GRID_SIZE;
  if (currentZoom < 0.3) {
    gridStep = GRID_MAJOR_SIZE; // Only show major grid lines
  } else if (currentZoom < 0.6) {
    gridStep = GRID_SIZE * 2; // Show every 2nd grid line
  }
  
  const effectiveGridSize = gridStep * currentZoom;
  
  // Calculate grid offset based on pan position
  const offsetX = (currentPanX / currentZoom) % gridStep;
  const offsetY = (currentPanY / currentZoom) % gridStep;
  
  // Get theme colors with proper detection for all themes
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  
  // Define grid colors based on specific themes
  let majorGridColor, minorGridColor;
  
  switch (currentTheme) {
    // Light themes - use dark dots with better contrast
    case 'light':
    case 'cupcake':
    case 'bumblebee':
    case 'emerald':
    case 'corporate':
    case 'garden':
    case 'lofi':
    case 'pastel':
    case 'fantasy':
    case 'wireframe':
    case 'lemonade':
      majorGridColor = 'rgba(0, 0, 0, 0.4)';
      minorGridColor = 'rgba(0, 0, 0, 0.25)';
      break;
      
    // Dark themes - use white dots with better contrast
    case 'dark':
    case 'night':
    case 'black':
    case 'synthwave':
    case 'halloween':
    case 'forest':
    case 'aqua':
    case 'luxury':
    case 'dracula':
    case 'business':
    case 'coffee':
      majorGridColor = 'rgba(255, 255, 255, 0.4)';
      minorGridColor = 'rgba(255, 255, 255, 0.25)';
      break;
      
    // Special themes with unique backgrounds - increased contrast
    case 'cmyk':
      majorGridColor = 'rgba(0, 0, 0, 0.5)'; // Black on cyan background
      minorGridColor = 'rgba(0, 0, 0, 0.35)';
      break;
      
    case 'autumn':
      majorGridColor = 'rgba(0, 0, 0, 0.5)'; // Black on brown background
      minorGridColor = 'rgba(0, 0, 0, 0.35)';
      break;
      
    case 'acid':
      majorGridColor = 'rgba(0, 0, 0, 0.6)'; // Black on bright lime background
      minorGridColor = 'rgba(0, 0, 0, 0.4)';
      break;
      
    case 'winter':
      majorGridColor = 'rgba(0, 0, 0, 0.5)'; // Black on light blue background
      minorGridColor = 'rgba(0, 0, 0, 0.35)';
      break;
      
    case 'retro':
      majorGridColor = 'rgba(0, 0, 0, 0.5)'; // Black on brown background
      minorGridColor = 'rgba(0, 0, 0, 0.35)';
      break;
      
    case 'cyberpunk':
      majorGridColor = 'rgba(0, 0, 0, 0.6)'; // Dark dots for better visibility
      minorGridColor = 'rgba(0, 0, 0, 0.4)';
      break;
      
    case 'valentine':
      majorGridColor = 'rgba(0, 0, 0, 0.5)'; // Black on pink background
      minorGridColor = 'rgba(0, 0, 0, 0.35)';
      break;
      
    // Default fallback - better contrast
    default:
      majorGridColor = 'rgba(0, 0, 0, 0.4)';
      minorGridColor = 'rgba(0, 0, 0, 0.25)';
      break;
  }
  
  // Draw grid stars
  ctx.fillStyle = gridStep === GRID_MAJOR_SIZE ? majorGridColor : minorGridColor;
  
  const starSize = Math.max(1, currentZoom * 1.5);
  
  // Helper function to draw a star
  const drawStar = (cx, cy, size) => {
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.4;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2; // Start pointing up
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
  };
  
  for (let x = offsetX * currentZoom; x < rect.width + effectiveGridSize; x += effectiveGridSize) {
    for (let y = offsetY * currentZoom; y < rect.height + effectiveGridSize; y += effectiveGridSize) {
      drawStar(x, y, starSize);
    }
  }
  
  // Draw major grid stars if showing minor grid
  if (gridStep !== GRID_MAJOR_SIZE && currentZoom > 0.3) {
    ctx.fillStyle = majorGridColor;
    const majorStarSize = Math.max(2, currentZoom * 2);
    const majorOffsetX = (currentPanX / currentZoom) % GRID_MAJOR_SIZE;
    const majorOffsetY = (currentPanY / currentZoom) % GRID_MAJOR_SIZE;
    const majorEffectiveSize = GRID_MAJOR_SIZE * currentZoom;
    
    for (let x = majorOffsetX * currentZoom; x < rect.width + majorEffectiveSize; x += majorEffectiveSize) {
      for (let y = majorOffsetY * currentZoom; y < rect.height + majorEffectiveSize; y += majorEffectiveSize) {
        drawStar(x, y, majorStarSize);
      }
    }
  }
};

// Viewport culling for performance optimization
const VIEWPORT_BUFFER = 500; // Buffer zone around viewport in pixels
const CARD_WIDTH = 672; // Standard card width (42rem = 672px)
const CARD_HEIGHT = 400; // Estimated card height

// Initialize viewport observer for enhanced performance
const { observe, unobserve, isElementVisible, getVisibleElementIds } = useViewportObserver({
  rootMargin: `${VIEWPORT_BUFFER}px`,
  threshold: 0,
});

// Enhanced visibility tracking with intersection observer fallback
const intersectionVisibleNodes = ref(new Set<string>());

// Flag for when we're animating workspace creation
const isAnimatingWorkspace = ref(false);

// All workspace nodes (loaded from all workspaces)
const allWorkspaceNodes = ref([]);

// Load all nodes from all workspaces onto the infinite canvas
const loadAllWorkspaces = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5050/chats');
    const data = await response.json();
    
    if (data.chats && data.chats.length > 0) {
      const allNodes = [];
      
      // Load nodes from each workspace
      for (let workspaceIndex = 0; workspaceIndex < data.chats.length; workspaceIndex++) {
        const workspace = data.chats[workspaceIndex];
        
        try {
          // Fetch full chat data with nodes
          const chatResponse = await fetch(`http://127.0.0.1:5050/chats/${workspace.id}`);
          const chatData = await chatResponse.json();
          
          if (chatData.nodes) {
            // Convert single node structure to array for consistency
            const nodes = Array.isArray(chatData.nodes) ? chatData.nodes : [chatData.nodes];
            
            // Position workspaces in a spiral pattern
            const spiralRadius = 4000; // Base radius for spiral
            const spiralSpacing = 800; // Space between spiral turns
            
            let islandCenterX = 0;
            let islandCenterY = 0;
            
            if (workspaceIndex === 0) {
              // First workspace at center
              islandCenterX = 0;
              islandCenterY = 0;
            } else {
              // Calculate spiral position for other workspaces
              const angle = workspaceIndex * 0.5; // Radians per step (controls spiral tightness)
              const radius = spiralRadius + (workspaceIndex * spiralSpacing * 0.3); // Expand outward
              
              islandCenterX = Math.cos(angle) * radius;
              islandCenterY = Math.sin(angle) * radius;
            }
            
            // Add slight randomness to avoid perfect alignment
            islandCenterX += (Math.random() - 0.5) * 400;
            islandCenterY += (Math.random() - 0.5) * 400;
            
            // Offset nodes within each workspace island
            nodes.forEach((node, nodeIndex) => {
              const nodeSpacing = 600; // Space between nodes within workspace
              const nodesPerRow = Math.ceil(Math.sqrt(nodes.length));
              const nodeCol = nodeIndex % nodesPerRow;
              const nodeRow = Math.floor(nodeIndex / nodesPerRow);
              
              const nodeX = islandCenterX + (nodeCol - nodesPerRow/2) * nodeSpacing;
              const nodeY = islandCenterY + (nodeRow - nodesPerRow/2) * nodeSpacing;
              
              allNodes.push({
                ...node,
                x: nodeX,
                y: nodeY,
                workspaceId: workspace.id,
                workspaceTitle: workspace.title
              });
            });
          }
        } catch (nodeError) {
          console.warn(`Could not load nodes for workspace ${workspace.id}:`, nodeError);
        }
      }
      
      allWorkspaceNodes.value = allNodes;
      console.log('Loaded', allNodes.length, 'nodes from', data.chats.length, 'workspaces');
    }
  } catch (error) {
    console.error('Error loading all workspaces:', error);
  }
};

// Persistent workspace positions (independent of zoom level)
const allWorkspacePositions = ref<Map<string, {id: string, title: string, x: number, y: number, nodeCount: number}>>(new Map());

// Get workspace nodes that are in the current viewport (for LOD 20-60% zoom)
const getWorkspaceNodesInViewport = () => {
  if (!canvasRef.value) return [];
  
  // Get viewport bounds
  const viewport = viewportReturn.getViewportBounds(canvasRef.value);
  if (!viewport) return [];
  
  const nodesToRender = [];
  
  // Use persistent workspace positions instead of workspaceOverviewDots
  allWorkspacePositions.value.forEach(workspace => {
    // Very generous detection radius for mid-zoom levels
    const workspaceRadius = Math.max(3000, workspace.nodeCount * 100);
    
    // Check if workspace center is anywhere near viewport (very generous)
    const isInViewport = (
      workspace.x + workspaceRadius >= viewport.left &&
      workspace.x - workspaceRadius <= viewport.right &&
      workspace.y + workspaceRadius >= viewport.top &&
      workspace.y - workspaceRadius <= viewport.bottom
    );
    
    if (isInViewport) {
      // Get cached nodes for this workspace
      const workspaceNodes = allNodesCache.value.get(workspace.id);
      if (workspaceNodes) {
        console.log(`[LOD] Loading ${workspaceNodes.length} nodes for workspace: ${workspace.title}`);
        nodesToRender.push(...workspaceNodes);
      } else {
        // Load workspace nodes if not cached
        console.log(`[LOD] Cache miss - loading workspace: ${workspace.title}`);
        loadWorkspaceNodesIntoCache(workspace.id);
      }
    } else {
      console.log(`[LOD] Workspace ${workspace.title} not in viewport - radius: ${workspaceRadius}, pos: (${workspace.x}, ${workspace.y})`);
    }
  });
  
  console.log(`[LOD] Total nodes to render from workspaces: ${nodesToRender.length}`);
  
  return nodesToRender;
};

// Load workspace nodes into cache for viewport-based LOD
const loadWorkspaceNodesIntoCache = async (workspaceId: string) => {
  if (allNodesCache.value.has(workspaceId)) return; // Already cached
  
  try {
    const response = await fetch(`http://127.0.0.1:5050/chats/${workspaceId}`);
    if (!response.ok) return;
    
    const chatData = await response.json();
    if (!chatData?.nodes) return;
    
    // Convert hierarchical structure to flat array
    const flattenNodes = (nodeData: any, parentId: string | null = null): any[] => {
      if (!nodeData) return [];
      
      const nodes = [];
      const processNode = (node: any, parent: string | null) => {
        const flatNode = {
          id: node.id,
          type: node.type,
          title: node.title,
          x: node.x,
          y: node.y,
          parentId: parent,
          branchMessageIndex: node.branchMessageIndex,
          messages: node.messages || [],
          metadata: node.metadata || {},
          workspaceId: workspaceId
        };
        nodes.push(flatNode);
        
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(child => processNode(child, node.id));
        }
      };
      
      processNode(nodeData, parentId);
      return nodes;
    };
    
    const workspaceNodes = flattenNodes(chatData.nodes);
    allNodesCache.value.set(workspaceId, workspaceNodes);
    
    console.log(`[LOD] Loaded ${workspaceNodes.length} nodes for workspace ${workspaceId}`);
  } catch (error) {
    console.error(`[LOD] Failed to load workspace ${workspaceId}:`, error);
  }
};

// Cached viewport bounds to avoid recalculation
let cachedViewport: any = null;
let lastViewportUpdate = 0;
const VIEWPORT_CACHE_MS = 16; // Cache for ~1 frame (60fps)

const visibleNodes = computed(() => {
  // If snapped node exists, only show that node's children
  if (store.snappedNodeId !== null) {
    return store.nodes.filter(node => node.id === store.snappedNodeId);
  }
  
  // Below 20% zoom: Don't show individual nodes, only workspace dots will be shown
  if (zoom.value < 0.20) {
    return [];
  }
  
  // 20-60% zoom: Show detailed nodes only for workspaces in viewport
  if (zoom.value >= 0.20 && zoom.value < 0.60) {
    const workspaceNodes = getWorkspaceNodesInViewport();
    console.log(`[LOD 20-60%] Showing ${workspaceNodes.length} workspace nodes at ${Math.round(zoom.value * 100)}% zoom`);
    
    // Apply viewport culling but with generous buffer for mid-zoom level
    if (!canvasRef.value || workspaceNodes.length === 0) {
      return workspaceNodes;
    }
    
    const viewport = viewportReturn.getViewportBounds(canvasRef.value);
    if (!viewport) {
      return workspaceNodes;
    }
    
    // More generous buffer for mid-zoom levels
    const GENEROUS_BUFFER = 2000;
    
    const culledNodes = workspaceNodes.filter(node => {
      const nodeBounds = {
        x: node.x || 0,
        y: node.y || 0,
        width: node.type === 'tool-call-compact' ? 120 : 400,
        height: node.type === 'tool-call-compact' ? 40 : 300
      };
      
      return viewportReturn.isNodeInViewport(nodeBounds, canvasRef.value, GENEROUS_BUFFER);
    });
    
    console.log(`[LOD 20-60%] After viewport culling: ${culledNodes.length} nodes (${workspaceNodes.length - culledNodes.length} culled)`);
    return culledNodes;
  }
  
  // Above 60% zoom: Show all nodes from current workspace or all cached nodes
  // PERFORMANCE: Cache the allNodes computation and only rebuild when necessary
  let nodesToRender = [];
  
  // Only rebuild allNodes if cache changed or during non-animation states
  if (!isPanning.value && !isTransitioning.value) {
    const allNodes = [];
    allNodesCache.value.forEach((nodes, chatId) => {
      allNodes.push(...nodes);
    });
    
    nodesToRender = allNodes.length > 0 ? allNodes : store.nodes;
    
    // IMPORTANT: Sync the store.nodes with the rendered nodes so interactions work
    // Only sync when lengths differ to avoid expensive operations
    if (allNodes.length > 0 && store.nodes.length !== allNodes.length) {
      store.nodes.splice(0, store.nodes.length, ...allNodes);
    }
  } else {
    // During animation, use already synced store.nodes to avoid expensive recomputation
    nodesToRender = store.nodes;
  }
  
  // Load all nodes if cache is empty (but don't spam this)
  if (allNodesCache.value.size === 0 && !isPanning.value && !isTransitioning.value) {
    loadAllNodes();
  }
  
  // PERFORMANCE: Skip expensive filtering during pan/zoom animations
  if (isPanning.value || isTransitioning.value) {
    return nodesToRender;
  }
  
  // Filter out tool-call-compact nodes at very low zoom for better performance
  if (zoom.value <= 0.15) {
    nodesToRender = nodesToRender.filter(node => node.type !== 'tool-call-compact');
  }
  
  // Apply viewport culling for performance (only when not animating)
  if (!canvasRef.value || nodesToRender.length === 0) {
    return nodesToRender;
  }
  
  // Use cached viewport if available to avoid expensive recalculation
  const now = Date.now();
  if (now - lastViewportUpdate < VIEWPORT_CACHE_MS && cachedViewport) {
    // Use cached viewport
  } else {
    cachedViewport = viewportReturn.getViewportBounds(canvasRef.value);
    lastViewportUpdate = now;
  }
  
  if (!cachedViewport) {
    return nodesToRender;
  }
  
  // Filter nodes based on viewport + buffer zone
  const VIEWPORT_BUFFER = 500;
  
  return nodesToRender.filter(node => {
    const nodeBounds = {
      x: node.x || 0,
      y: node.y || 0,
      width: node.type === 'tool-call-compact' ? 120 : 400,
      height: node.type === 'tool-call-compact' ? 40 : 300
    };
    
    return viewportReturn.isNodeInViewport(nodeBounds, canvasRef.value, VIEWPORT_BUFFER);
  });
});

// Visible connections (only between visible nodes)
const visibleConnections = computed(() => {
  if (store.snappedNodeId !== null || isWorkspaceOverview.value || isAnimatingWorkspace.value) {
    return store.connections;
  }

  // Below 20% zoom: Don't show connections, only workspace dots
  if (zoom.value < 0.20) {
    return [];
  }

  const visibleNodeIds = new Set(visibleNodes.value.map(node => node.id));
  return store.connections.filter(connection => 
    visibleNodeIds.has(connection.parent.id) || visibleNodeIds.has(connection.child.id)
  );
});

// Update intersection observer when nodes change
// PERFORMANCE: Throttled watcher to prevent excessive DOM queries during zoom
let intersectionUpdatePending = false;
watch(
  () => visibleNodes.value.map(node => node.id).join(','),
  (newVisibleNodeIds, oldVisibleNodeIds) => {
    // Only process if actually changed and not empty
    if (!newVisibleNodeIds || newVisibleNodeIds === oldVisibleNodeIds) return;
    
    // Skip during pan/zoom animations to prevent stuttering
    if (isPanning.value || isTransitioning.value) return;
    
    const currentVisibleNodes = visibleNodes.value;
    if (currentVisibleNodes.length === 0) return;
    
    // Throttle intersection observer updates
    if (!intersectionUpdatePending) {
      intersectionUpdatePending = true;
      requestAnimationFrame(() => {
        nextTick(() => {
          currentVisibleNodes.forEach(node => {
            const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
            if (nodeElement && !intersectionVisibleNodes.value.has(node.id)) {
              observe(nodeElement, node.id);
            }
          });

          // Update visible nodes set from intersection observer
          const visibleIds = getVisibleElementIds();
          intersectionVisibleNodes.value = new Set(visibleIds.filter(id => 
            currentVisibleNodes.some(node => node.id === id)
          ));
          
          intersectionUpdatePending = false;
        });
      });
    }
  }
);

// Coordinate conversion helpers
const screenToWorld = (screenX, screenY) => {
  if (!canvasRef.value) return { x: 0, y: 0 };
  const rect = canvasRef.value.getBoundingClientRect();
  const worldX = (screenX - rect.left - panX.value) / zoom.value;
  const worldY = (screenY - rect.top - panY.value) / zoom.value;
  return { x: worldX, y: worldY };
};

const worldToScreen = (worldX, worldY) => {
  return {
    x: (worldX * zoom.value) + panX.value,
    y: (worldY * zoom.value) + panY.value
  };
};

// Multi-select helper functions
const findNodeAt = (screenX, screenY) => {
  if (!canvasRef.value) return null;

  // Get canvas bounds
  const canvasRect = canvasRef.value.getBoundingClientRect();

  // Convert to canvas coordinates accounting for pan and zoom
  const canvasX = screenX - canvasRect.left;
  const canvasY = screenY - canvasRect.top;

  // Check each node to see if click is within its bounds
  return store.nodes.find(node => {
    const nodeScreenX = (node.x * zoom.value) + panX.value;
    const nodeScreenY = (node.y * zoom.value) + panY.value;
    const nodeScreenWidth = store.CARD_WIDTH * zoom.value;
    const nodeScreenHeight = store.CARD_HEIGHT * zoom.value;

    return canvasX >= nodeScreenX &&
      canvasX <= nodeScreenX + nodeScreenWidth &&
      canvasY >= nodeScreenY &&
      canvasY <= nodeScreenY + nodeScreenHeight;
  });
};






// Undo/Redo Functions
const addToUndoStack = (action) => {
  undoStack.value.push(action);

  // Limit stack size
  if (undoStack.value.length > maxUndoStackSize) {
    undoStack.value.shift();
  }

  // Clear redo stack when new action is performed
  redoStack.value = [];
};

const undo = () => {
  if (undoStack.value.length === 0) {
    showNotification('Nothing to undo');
    return;
  }

  const lastAction = undoStack.value.pop();

  if (lastAction.type === 'delete_nodes') {
    // Restore the deleted nodes
    lastAction.deletedNodes.forEach(nodeData => {
      store.nodes.push(nodeData);
    });

    // Add to redo stack
    redoStack.value.push(lastAction);

    showNotification(`Restored ${lastAction.deletedNodes.length} deleted node(s)`);
  } else if (lastAction.type === 'move_node') {
    // Restore the node's previous position
    const node = store.nodes.find(n => n.id === lastAction.nodeId);
    if (node) {
      // Save current position for redo
      const currentPosition = { x: node.x, y: node.y };

      // Restore previous position
      store.updateNodePosition(lastAction.nodeId, lastAction.previousPosition);

      // Add to redo stack
      redoStack.value.push({
        type: 'move_node',
        nodeId: lastAction.nodeId,
        previousPosition: currentPosition,
        newPosition: lastAction.previousPosition,
        timestamp: Date.now()
      });

      showNotification('Undid node move');
    }
  } else if (lastAction.type === 'move_multiple_nodes') {
    // Restore multiple nodes' previous positions
    const currentPositions = [];

    lastAction.moves.forEach(move => {
      const node = store.nodes.find(n => n.id === move.nodeId);
      if (node) {
        // Save current position for redo
        currentPositions.push({
          nodeId: move.nodeId,
          previousPosition: { x: node.x, y: node.y },
          newPosition: move.previousPosition
        });

        // Restore previous position
        store.updateNodePosition(move.nodeId, move.previousPosition);
      }
    });

    // Add to redo stack
    redoStack.value.push({
      type: 'move_multiple_nodes',
      moves: currentPositions,
      timestamp: Date.now()
    });

    showNotification(`Undid move of ${lastAction.moves.length} nodes`);
  }
};

const redo = () => {
  if (redoStack.value.length === 0) {
    showNotification('Nothing to redo');
    return;
  }

  const actionToRedo = redoStack.value.pop();

  if (actionToRedo.type === 'delete_nodes') {
    // Re-delete the nodes
    actionToRedo.deletedNodes.forEach(nodeData => {
      const index = store.nodes.findIndex(n => n.id === nodeData.id);
      if (index !== -1) {
        store.nodes.splice(index, 1);
      }
    });

    // Add back to undo stack
    undoStack.value.push(actionToRedo);

    showNotification(`Re-deleted ${actionToRedo.deletedNodes.length} node(s)`);
  } else if (actionToRedo.type === 'move_node') {
    // Redo the node move
    const node = store.nodes.find(n => n.id === actionToRedo.nodeId);
    if (node) {
      // Save current position for undo
      const currentPosition = { x: node.x, y: node.y };

      // Move to the redo position
      store.updateNodePosition(actionToRedo.nodeId, actionToRedo.previousPosition);

      // Add back to undo stack
      undoStack.value.push({
        type: 'move_node',
        nodeId: actionToRedo.nodeId,
        previousPosition: currentPosition,
        newPosition: actionToRedo.previousPosition,
        timestamp: Date.now()
      });

      showNotification('Redid node move');
    }
  } else if (actionToRedo.type === 'move_multiple_nodes') {
    // Redo multiple node moves
    const currentPositions = [];

    actionToRedo.moves.forEach(move => {
      const node = store.nodes.find(n => n.id === move.nodeId);
      if (node) {
        // Save current position for undo
        currentPositions.push({
          nodeId: move.nodeId,
          previousPosition: { x: node.x, y: node.y },
          newPosition: move.previousPosition
        });

        // Move to redo position
        store.updateNodePosition(move.nodeId, move.previousPosition);
      }
    });

    // Add back to undo stack
    undoStack.value.push({
      type: 'move_multiple_nodes',
      moves: currentPositions,
      timestamp: Date.now()
    });

    showNotification(`Redid move of ${actionToRedo.moves.length} nodes`);
  }
};

// Node Deletion with Confirmation
const handleNodeDelete = async (nodeId: string) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;

  // Find all descendant nodes that will be deleted
  const getDescendants = (parentId: string): string[] => {
    const children = store.nodes.filter(n => n.parentId === parentId);
    let descendants = children.map(c => c.id);

    for (const child of children) {
      descendants = descendants.concat(getDescendants(child.id));
    }

    return descendants;
  };

  const descendants = getDescendants(nodeId);
  const totalNodesToDelete = descendants.length + 1; // +1 for the node itself

  // Create confirmation message
  let confirmMessage = `Are you sure you want to delete this ${node.type === 'main' ? 'main' : 'branch'} node?`;
  if (descendants.length > 0) {
    confirmMessage += `\n\nThis will also permanently delete ${descendants.length} child branch${descendants.length === 1 ? '' : 'es'}.`;
  }

  // Show confirmation dialog
  if (!confirm(confirmMessage)) {
    return;
  }

  // Save the nodes that will be deleted for undo
  const nodesToDelete = [node, ...descendants.map(id => store.nodes.find(n => n.id === id))].filter(Boolean);
  const deletedNodesData = nodesToDelete.map(n => JSON.parse(JSON.stringify(n)));

  // Add to undo stack before deleting
  addToUndoStack({
    type: 'delete_nodes',
    deletedNodes: deletedNodesData,
    timestamp: Date.now()
  });

  // Delete the node and all its descendants
  store.removeNode(nodeId);

  showNotification(`Deleted ${totalNodesToDelete} node${totalNodesToDelete === 1 ? '' : 's'} (Ctrl/Cmd+Z to undo)`);
};

// Auto-arrange nodes using clustering
const handleAutoArrange = async () => {
  if (isAutoArranging.value) return;
  
  try {
    isAutoArranging.value = true;
    
    // Get current chat ID
    const currentChatId = chatStore.currentChatId;
    if (!currentChatId) {
      showNotification('No active workspace for auto-arrange');
      return;
    }
    
    // Calculate canvas bounds based on current viewport
    const bounds = autoArrangeService.calculateCanvasBounds(
      windowSize.value.width,
      windowSize.value.height,
      zoom.value
    );
    
    // Call the auto-arrange service
    const result = await autoArrangeService.autoArrangeNodes(currentChatId, {
      method: 'kmeans', // Default to k-means clustering
      canvas_bounds: bounds
    });
    
    if (result.success && result.positions) {
      // Enable transitions for smooth movement
      store.isTransitioning = true;
      
      // Update node positions from clustering result
      Object.entries(result.positions).forEach(([nodeId, position]) => {
        store.updateNodePosition(nodeId, position);
      });
      
      // Get cluster stats for notification
      const stats = autoArrangeService.getClusterStats();
      const message = stats 
        ? `Arranged ${stats.totalNodes} nodes into ${stats.numClusters} clusters`
        : 'Nodes auto-arranged successfully';
      
      showNotification(message);
      
      // Fit to view after arranging
      setTimeout(() => {
        autoFitNodes();
        store.isTransitioning = false;
      }, 500);
      
    } else {
      showNotification(`Auto-arrange failed: ${result.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('Error in auto-arrange:', error);
    showNotification('Auto-arrange failed due to an error');
  } finally {
    isAutoArranging.value = false;
  }
};

// Create new workspace - now goes to welcome screen
const handleNewWorkspace = async () => {
  // Trigger portal animation
  isPortalClicked.value = true;
  
  // Reset after animation
  setTimeout(() => {
    isPortalClicked.value = false;
  }, 1000);
  
  if (store.snappedNodeId) {
    store.popSnappedNode()
  }
  await store.clearCurrentWorkspace();

  // Clear workspace and navigate to input container coordinate
  isWorkspaceOverview.value = false;
  isWelcomeScreen.value = true;
  
  // Navigate to the input container coordinate (-3000, -3000) with smooth animation
  await nextTick();
  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    // Calculate correct pan values for 120% zoom to center input container at (-3000, -3000)
    const NEW_CHAT_X = -3000;
    const NEW_CHAT_Y = -3000;
    const targetZoom = 1.2; // 120% zoom (more comfortable)
    
    // Calculate pan values to center the input container coordinate on screen
    const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
    const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
    
    // Animate smoothly to the input container
    viewportReturn.animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 800);
    
    console.log('[InfiniteCanvas] Animating to input container position:', {
      targetZoom,
      targetPanX,
      targetPanY
    });
  }
};

// Center on input container with smooth animation (for initialization)
const centerOnInputContainer = async () => {
  console.log('[centerOnInputContainer] Starting - current state:', {
    panX: panX.value,
    panY: panY.value,
    zoom: zoom.value
  });
  
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) {
    console.log('[centerOnInputContainer] No canvas rect found');
    return;
  }
  
  // Calculate correct pan values for 120% zoom to center input container at (-3000, -3000)
  const NEW_CHAT_X = -3000;
  const NEW_CHAT_Y = -3000;
  const targetZoom = 1.2; // 120% zoom (more comfortable)
  
  // Calculate pan values to center the input container coordinate on screen
  const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
  const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
  
  console.log('[centerOnInputContainer] Using fixed values:', {
    canvasRect: { width: rect.width, height: rect.height },
    targetZoom,
    targetPanX,
    targetPanY
  });
  
  // Animate smoothly to the input container
  viewportReturn.animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 1000);
  
  console.log('[centerOnInputContainer] Animation started');
};

// Get welcome input ref for focus management
const getWelcomeInputRef = () => {
  return canvasInputRef.value;
};

// Handle view mode toggle (simplified for grid-only)
const handleViewModeToggle = (mode) => {
  // Only grid mode supported now
  viewMode.value = 'grid';
};

// Center and snap to a node
const centerAndSnapNode = (nodeId: string) => {
  console.log('[InfiniteCanvas] centerAndSnapNode called for:', nodeId);
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) {
    console.log('[InfiniteCanvas] Node not found:', nodeId);
    return;
  }

  store.isTransitioning = true;

  const center = getNodeCenter(node);
  if (!canvasRef.value) {
    console.warn('[InfiniteCanvas] canvasRef is null, cannot center node');
    store.isTransitioning = false;
    return;
  }
  const rect = canvasRef.value.getBoundingClientRect();

  panX.value = rect.width / 2 - center.x * zoom.value;

  const verticalOffset = Math.min(rect.height * 0.05, 30);
  panY.value = rect.height / 2 - center.y * zoom.value + verticalOffset;

  focusedNodeId.value = nodeId;

  nextTick(() => {
    // Emit snap for all nodes that support snapping (including main nodes for auto-snap)
    emit('snap', { nodeId: node.id, originalPosition: { x: node.x, y: node.y } });

    setTimeout(() => {
      store.isTransitioning = false;
    }, 300);
  });
};

// Center on a specific point with animation
const centerOnPointWithAnimation = async (worldX, worldY, targetZoom = 0.6, duration = 800) => {
  const rect = canvasRef.value.getBoundingClientRect();
  const startPanX = panX.value;
  const startPanY = panY.value;
  const startZoom = zoom.value;
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    const startWorldX = (rect.width / 2 - startPanX) / startZoom;
    const startWorldY = (rect.height / 2 - startPanY) / startZoom;
    const endWorldX = worldX;
    const endWorldY = worldY;
    
    const targetScreenX = rect.width / 2;
    const targetScreenY = rect.height / 2;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 2);
      
      const currentZoom = startZoom + (targetZoom - startZoom) * easeOut;
      const currentWorldX = startWorldX + (endWorldX - startWorldX) * easeOut;
      const currentWorldY = startWorldY + (endWorldY - startWorldY) * easeOut;
      
      panX.value = targetScreenX - currentWorldX * currentZoom;
      panY.value = targetScreenY - currentWorldY * currentZoom;
      zoom.value = currentZoom;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        zoom.value = targetZoom;
        panX.value = targetScreenX - endWorldX * targetZoom;
        panY.value = targetScreenY - endWorldY * targetZoom;
        resolve();
      }
    };
    
    requestAnimationFrame(animate);
  });
};

// Watch for side panel changes
watch(() => props.sidePanelOpen, (isOpen) => {
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300);
}, { immediate: false });

// Watch for right panel changes
watch(() => props.rightPanelOpen, (isOpen) => {
  setTimeout(() => {
    if (props.autoZoomEnabled) {
      autoFitNodes();
    }
  }, 300);
}, { immediate: false });

// Watch for workspace ID changes from route
watch(() => props.id, async (newId) => {
  if (newId) {
    console.log('InfiniteCanvas: Route workspace ID changed to:', newId);
    await handleWorkspaceSelect(newId);
  }
}, { immediate: true });

// Handle height lock for nodes
const handleHeightLock = () => {
  const selectedNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!selectedNode) return;

  const nodeElement = document.querySelector(
    `[data-node-id="${selectedNode.id}"]`
  );
  if (!nodeElement) return;

  const nodeRect = nodeElement.getBoundingClientRect();
  const canvasRect = canvasRef.value?.getBoundingClientRect();
  if (!canvasRect) return;

  const visibleTop = Math.max(0, canvasRect.top - nodeRect.top);
  const visibleBottom = Math.min(
    nodeRect.height,
    canvasRect.bottom - nodeRect.top
  );

  const visibleHeight = (visibleBottom - visibleTop) / zoom.value;
  const paddedHeight = visibleHeight - 32;

  store.setNodeHeightLock(selectedNode.id, paddedHeight);
  emit("update:isHeightLocked", true);
};

const showNotification = (message: string) => {
  notification.value = { visible: true, message };
  setTimeout(() => {
    notification.value.visible = false;
  }, 2000);
};

const handleHeightUnlock = () => {
  if (focusedNodeId.value) {
    store.clearNodeHeightLock(focusedNodeId.value);
  }
  emit("update:isHeightLocked", false);
};

// Handle node snapping
const handleNodeSnap = async ({ nodeId, originalPosition }) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  // Don't trigger any auto-centering
  const prevAutoZoom = autoZoomEnabled.value;
  autoZoomEnabled.value = false;

  store.isTransitioning = true;
  store.snapNode(nodeId);
  nodePositions.value.set(nodeId, originalPosition);

  // Wait for the BranchNode component to handle its own snap animation
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Re-enable auto zoom after snapping is complete
  setTimeout(() => {
    store.isTransitioning = false;
    autoZoomEnabled.value = prevAutoZoom;
  }, 350);
};


// Handle node unsnapping
const handleNodeUnsnap = async ({ nodeId, originalPosition }) => {
  store.unsnapNode(nodeId);

  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;

  const rect = canvasRef.value?.getBoundingClientRect();
  if (rect) {
    const nodeCenter = {
      x: node.x + store.CARD_WIDTH / 2,
      y: node.y + store.CARD_HEIGHT / 2,
    };

    const bounds = calculateNodeBounds(node);
    const newZoom = calculateRequiredZoom(bounds, rect);

    const verticalOffset = rect.height * 0.1;
    panX.value = rect.width / 2 - nodeCenter.x * newZoom;
    panY.value = rect.height / 2 - nodeCenter.y * newZoom + verticalOffset;
    zoom.value = newZoom;
  }

  store.updateNodePosition(nodeId, originalPosition);
  nodePositions.value.delete(nodeId);

  await new Promise((resolve) => setTimeout(resolve, 300));
  store.isTransitioning = false;
};

// Handle focus on a node's input
const handleFocusInput = ({ nodeId }) => {
  const branchNodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!branchNodeEl) return;

  const inputEl = branchNodeEl.querySelector(".message-input");
  if (!inputEl) return;

  const inputRect = inputEl.getBoundingClientRect();
  const canvasRect = canvasRef.value.getBoundingClientRect();


  const inputCenterX = inputRect.left + inputRect.width / 2;
  const inputCenterY = inputRect.top + inputRect.height / 2;
  const canvasCenterX = canvasRect.width / 2;
  const canvasCenterY = canvasRect.height / 2;

  panX.value = canvasCenterX - (inputCenterX - canvasRect.left) * targetZoom;
  panY.value = canvasCenterY - (inputCenterY - canvasRect.top) * targetZoom;
  zoom.value = targetZoom;
};

// Handle reflection suggestions from BranchNode
const handleReflectionSuggestionClick = (suggestion: any) => {
  // Find the SnappedNodeRightSidebar component and call its openReflectionModal method
  const rightSidebar = document.querySelector('.snapped-sidebar.right-sidebar');
  if (rightSidebar) {
    // Find the Vue component instance - this is a simplified approach
    // In a more robust implementation, we'd use refs or store communication
    console.log('Opening reflection modal with suggestion:', suggestion);
    
    // For now, we'll store it and let the sidebar pick it up
    // This could be improved with proper store management
    if (window.__reflectionSidebarHandler) {
      window.__reflectionSidebarHandler(suggestion);
    }
  }
};

// Workspace drag handling
const handleWorkspaceDragStart = (dragData) => {
  workspaceDragState.value.isDragging = true;
  workspaceDragState.value.activeId = dragData.id;
  workspaceDragState.value.offset = dragData.offset;
};

const selectedWorkspaceId = computed(() => {
  if (!isWorkspaceOverview.value) return null;
  return workspaceDragState.value.activeId || null;
});

// Calculate required zoom level for a node
const calculateRequiredZoom = (bounds, containerRect) => {
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  const zoomX = (containerRect.width * 0.85) / contentWidth;
  const zoomY = (containerRect.height * 0.8) / contentHeight;

  return Math.min(Math.max(Math.min(zoomX, zoomY), ZOOM_MIN), ZOOM_MAX);
};

// Handle node selection
const handleNodeSelect = async (nodeId: string) => {
  store.isTransitioning = false;
  
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;

  const bounds = calculateNodeBounds(node);
  const targetZoom = calculateRequiredZoom(bounds, rect);

  await centerOnNodeWithAnimation(nodeId, targetZoom, 600);
  
  store.isTransitioning = false;
};

// Calculate node bounds
const calculateNodeBounds = (node) => {
  if (!node) {
    if (!store.nodes.length) return null;

    return store.nodes.reduce(
      (acc, node) => {
        // Get proper dimensions for the node type
        const dimensions = getEffectiveCardDimensions(node);
        let nodeWidth = dimensions.width;
        let nodeHeight = dimensions.height;

        // Try to get actual DOM dimensions if available, but fallback to calculated dimensions
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
          const nodeRect = nodeElement.getBoundingClientRect();
          // For non-compact nodes, use actual height; for compact nodes, trust our dimensions
          if (node.type !== 'tool-call-compact') {
            nodeHeight = nodeRect.height / zoom.value;
          }
        }

        // Use custom width if available, otherwise use the calculated effective width
        nodeWidth = node.customWidth || nodeWidth;
        
        return {
          minX: Math.min(acc.minX, node.x),
          maxX: Math.max(acc.maxX, node.x + nodeWidth),
          minY: Math.min(acc.minY, node.y),
          maxY: Math.max(acc.maxY, node.y + nodeHeight),
        };
      },
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
      }
    );
  }

  const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
  if (!nodeElement) {
    const nodeWidth = node.customWidth || store.CARD_WIDTH;
    const nodeHeight = node.customHeight || store.CARD_HEIGHT + 100;
    
    return {
      minX: node.x,
      maxX: node.x + nodeWidth,
      minY: node.y,
      maxY: node.y + nodeHeight,
    };
  }

  const nodeRect = nodeElement.getBoundingClientRect();
  const actualHeight = nodeRect.height / zoom.value;
  const nodeWidth = node.customWidth || store.CARD_WIDTH;
  
  return {
    minX: node.x,
    maxX: node.x + nodeWidth,
    minY: node.y,
    maxY: node.y + actualHeight,
  };
};

// Handle node position updates
const handleNodePositionUpdate = (
  nodeId: string,
  position: { x: number; y: number }
) => {
  store.updateNodePosition(nodeId, position);
};

const handleWheel = (e: WheelEvent) => {
  // Check if the wheel event is from a messages scroll container
  const messagesContainer = (e.target as HTMLElement).closest('.messages-scroll-container');
  if (messagesContainer) {
    // Check if this is a canvas gesture (zoom with CMD/Ctrl)
    const isCanvasGesture = e.metaKey || e.ctrlKey;
    if (!isCanvasGesture) {
      // Regular scrolling in messages container - don't handle it
      return;
    }
  }

  if ((e.target as HTMLElement).closest(".branch-node.snapped")) {
    // Allow scrolling within message containers when node is snapped
    const target = e.target as HTMLElement;
    const isMessageScrollContainer = target.closest(".messages-scroll-container");
    const isMessageContainer = target.closest(".message-container");
    const isMessageContent = target.closest(".message-content");
    
    if (isMessageScrollContainer || isMessageContainer || isMessageContent) {
      // Let the message container handle its own scrolling
      return;
    }
    console.log("Snapped node, ignoring wheel event");
    return;
  }

  // Disable zoom/pan/scroll in overview mode
  if (isWorkspaceOverview.value) {
    e.preventDefault();
    return;
  }
  
  // All zoom and pan handled normally now

  e.preventDefault();
  resetInactivityTimer();

  // Using global constants

  const rect = canvasRef.value.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const contentX = (mouseX - panX.value) / zoom.value;
  const contentY = (mouseY - panY.value) / zoom.value;

  // Detect trackpad gesture type based on gestureMode setting and CMD key
  const cmdPressed = e.metaKey || e.ctrlKey; // CMD on Mac, Ctrl on PC

  // When gestureMode is 'zoom': 2-finger = zoom, CMD+2-finger = pan
  // When gestureMode is 'scroll': 2-finger = pan, CMD+2-finger = zoom  
  const shouldZoom = props.gestureMode === 'zoom' ? !cmdPressed : cmdPressed;
  const shouldPan = !shouldZoom && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0);

  if (shouldZoom) {
    // Handle zoom
    const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(
      Math.max(zoom.value * (1 + zoomDelta), ZOOM_MIN),
      ZOOM_MAX
    );

    // Zoom towards mouse cursor
    panX.value = mouseX - contentX * newZoom;
    panY.value = mouseY - contentY * newZoom;
    zoom.value = newZoom;
    
    // Update current workspace context after zoom
    setTimeout(() => updateCurrentWorkspace(), 50);
  } else if (shouldPan) {
    // Handle pan with 2-finger trackpad gesture
    panX.value -= e.deltaX * PAN_SENSITIVITY;
    panY.value -= e.deltaY * PAN_SENSITIVITY;
    
    // No pan constraints needed
  }
  
  // Check viewport return after wheel interaction
  viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
  
  // Also check continuously for a short period after wheel events
  startContinuousViewportCheck();
};

// Pan constraints removed - input container now at fixed coordinate

// Center canvas
const centerCanvas = () => {
  if (!isWorkspaceOverview) {
    zoom.value = 1;
    targetZoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  }
};

const isInitializing = ref(false);

// Cleanup on component unmount
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("dragenter", handleDragEnter);
  window.removeEventListener("dragleave", handleDragLeave);
  window.removeEventListener("resize", () => {
    windowSize.value.width = window.innerWidth;
    windowSize.value.height = window.innerHeight;
  });

  if (canvasRef.value) {
    canvasRef.value.removeEventListener("wheel", handleWheel);
  }
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }
});

// Watch for node changes
watch(
  () => store.nodes.length,
  () => {
    resetInactivityTimer();
  }
);

watch(
  () => store.nodes.length,
  (newLength, oldLength) => {
    if (newLength === 1 && oldLength === 0) {
      rootNodeId.value = store.nodes[0].id;
    }
  }
);


// Watch for window size changes
watch(
  () => [windowSize.value.width, windowSize.value.height],
  () => {
    if (props.autoZoomEnabled && !store.isDragging && !isPanning.value) {
      autoFitNodes();
    }
  },
  { deep: true }
);

// Watch for model changes and update registry
watch(
  () => [
    modelStore.ollamaModels,
    modelStore.openRouterModels,
    modelStore.googleModels,
    modelStore.anthropicModels,
    modelStore.openaiModels
  ],
  () => {
    updateModelRegistry();
  },
  { deep: true }
);

// Watch for pan/zoom changes to update fit button visibility
// PERFORMANCE: Add throttling to prevent excessive distance checks
let distanceCheckPending = false;
watch([panX, panY, zoom], () => {
  if (!distanceCheckPending) {
    distanceCheckPending = true;
    requestAnimationFrame(() => {
      checkDistanceFromNodes();
      distanceCheckPending = false;
    });
  }
}, { immediate: true });

// Also check when nodes change
watch(() => store.nodes, () => {
  checkDistanceFromNodes();
}, { deep: true });

// Handle file drag events
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (!isWorkspaceOverview.value && e.dataTransfer?.items?.length === 1) {
    const item = e.dataTransfer.items[0];
    if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
      isDraggingFile.value = true;
      isDragActive.value = true;
      console.log('Drag enter with media file');
    }
  }
  
  // Handle conversation imports on onboarding
  if (workspaces.value.length === 0) {
    isDragOver.value = true;
    isDragActive.value = true;
  }
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const rect = e.currentTarget?.getBoundingClientRect();
  if (rect) {
    const { clientX, clientY } = e;
    if (clientX <= rect.left || clientX >= rect.right ||
      clientY <= rect.top || clientY >= rect.bottom) {
      isDraggingFile.value = false;
      isDragActive.value = false;
      // Also handle conversation import drag leave
      if (workspaces.value.length === 0) {
        isDragOver.value = false;
      }
    }
  }
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (isWorkspaceOverview.value) {
    return;
  }

  isDraggingFile.value = false;

  // Check if the drop target is a node element (not empty canvas)
  const dropTarget = e.target as HTMLElement;
  const isDropOnNode = dropTarget?.closest('.branch-node') !== null;

  if (isDropOnNode) {
    console.log('Drop on node detected, letting BranchNode handle it');
    return;
  }

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return;
  }

  // Create a new node when dropping on empty canvas
  console.log('Media file dropped on empty canvas - creating new node');

  await nextTick(async () => {
    try {
      const rect = canvasRef.value?.getBoundingClientRect();
      if (!rect) throw new Error("Canvas reference not found");

      const position = {
        x: (e.clientX - rect.left - panX.value) / zoom.value,
        y: (e.clientY - rect.top - panY.value) / zoom.value,
      };

      // Create a new branch node immediately with filename as temporary title
      const newNode = await store.addNode(null, -1, position, {
        type: "branch",
        title: file.name,
        isProcessingMedia: true,
        isGeneratingTitle: true
      });

      // Wait a moment to ensure the node ID has been updated by the database
      await new Promise(resolve => setTimeout(resolve, 200));

      // Process the media using the existing function
      await processMediaForNode(newNode, file);

      centerOnNode(newNode.id);
    } catch (error) {
      console.error("Error handling media drop:", error);
      alert(error instanceof Error ? error.message : "Unknown error occurred");
    }
  });
};

// Cache for parent node lookups to improve performance
const parentNodeCache = new Map();

// Helper functions for MainSplineConnector
const getParentNode = (parentId: string) => {
  // Check cache first
  if (parentNodeCache.has(parentId)) {
    const cached = parentNodeCache.get(parentId);
    // Verify the cached node is still visible
    if (visibleNodes.value.some(n => n.id === cached.id)) {
      return cached;
    }
    // Clear invalid cache entry
    parentNodeCache.delete(parentId);
  }
  
  const parentNode = visibleNodes.value.find(node => node.id === parentId);
  if (parentNode) {
    parentNodeCache.set(parentId, parentNode);
  }
  // Remove console.log to reduce noise during panning
  return parentNode;
};

const isConnectionHovered = (parentId: string, childId: string) => {
  return false; // You can add logic here if needed
};

const handleConnectionClick = (parentId: string, childId: string) => {
  console.log('Connection clicked:', parentId, '->', childId);
};

const handleConnectionHover = (parentId: string, childId: string, hovered: boolean) => {
  console.log('Connection hover:', parentId, '->', childId, hovered);
};

const setConnectionLabel = (parentId: string, childId: string, label: string) => {
  connectionLabels.value.set(`${parentId}-${childId}`, label);
};

const handleConnectionStart = (event: any) => {
  console.log('Connection start:', event);
  // Handle connection start logic here
};

const handleConnectionDrag = (event: any) => {
  console.log('Connection drag:', event);
  // Handle connection drag logic here
};

const handleConnectionEnd = (event: any) => {
  console.log('Connection end:', event);
  // Handle connection end logic here
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "copy";
  }
};

const returnToOverview = async () => {
  console.log("Returning to overview");

  const currentScale = zoom.value;
  const currentPanX = panX.value;
  const currentPanY = panY.value;

  // Remove any existing overlays first
  const existingOverlays = document.querySelectorAll('.overview-transition-overlay');
  existingOverlays.forEach(existing => {
    try {
      if (existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    } catch (error) {
      console.warn('Failed to remove existing overlay:', error);
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'overview-transition-overlay';
  document.body.appendChild(overlay);

  store.isTransitioning = true;

  zoom.value = currentScale * 0.8;

  document.body.classList.add('transition-blur');

  setTimeout(async () => {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
    expandingWorkspaceId.value = null;

    isWorkspaceOverview.value = true;
    store.clearCurrentWorkspace();

    await chatStore.loadChats();
    await nextTick();

    const workspaceElements = document.querySelectorAll('.grid-workspace-card');
    workspaceElements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.8) translateY(20px)';
      el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transitionDelay = `${i * 0.05}s`;

      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1) translateY(0)';
      }, 50);
    });

    resetWorkspacePhysics();

    setTimeout(() => {
      document.body.classList.remove('transition-blur');
      // Safely remove overlay with error handling
      try {
        if (overlay && overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      } catch (error) {
        console.warn('Failed to remove transition overlay:', error);
      }
      store.isTransitioning = false;
    }, 500);
  }, 300);
};

const handleWorkspaceSelect = async (workspaceId: string) => {
  console.log('Selecting workspace:', workspaceId);
  console.log('Before state change - isWelcomeScreen:', isWelcomeScreen.value, 'isWorkspaceOverview:', isWorkspaceOverview.value);

  store.isTransitioning = false;
  expandingWorkspaceId.value = workspaceId;

  const workspaceNode = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
  if (!workspaceNode) {
    console.warn(`Could not find workspace node with id ${workspaceId}`);
    isWelcomeScreen.value = false;
    isWorkspaceOverview.value = false;
    console.log('After state change (no node) - isWelcomeScreen:', isWelcomeScreen.value, 'isWorkspaceOverview:', isWorkspaceOverview.value);
    await store.loadChatState(workspaceId);
    expandedNodes.value = new Set(store.nodes.map(node => node.id));
    await nextTick();

    // Auto-center on loaded nodes (disable transition to prevent slide-in animation)
    console.log('[handleWorkspaceSelect] Auto-centering on loaded nodes (no workspace node case)');
    autoFitNodes(true);
    
    return;
  }

  const rect = workspaceNode.getBoundingClientRect();
  if (!rect) return;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const startPosition = {
    x: panX.value,
    y: panY.value,
    scale: zoom.value
  };

  store.isTransitioning = true;

  isWelcomeScreen.value = false;
  isWorkspaceOverview.value = false;
  console.log('After state change (with node) - isWelcomeScreen:', isWelcomeScreen.value, 'isWorkspaceOverview:', isWorkspaceOverview.value);

  await store.loadChatState(workspaceId);
  expandedNodes.value = new Set(store.nodes.map(node => node.id));

  await nextTick();

  zoom.value = 1;
  panX.value = centerX - rect.width / 2;
  panY.value = centerY - rect.height / 2;

  await nextTick();

  // Disabled auto-snapping - keep nodes at their created positions
  // const autoSnapped = checkAndAutoSnapSingleBranch();

  // Always auto-fit when entering canvas (no auto-snap, no transition to prevent slide-in)
  await nextTick();
  autoFitNodes(true);

  emitter.emit('workspace-opened');

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

const handleWorkspaceFavorite = async (workspaceId: string) => {
  const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
  if (workspace) {
    await chatStore.updateChatMetadata(workspaceId, {
      isFavorite: !workspace.isFavorite
    });
    await chatStore.loadChats();
  }
};

const handleWorkspaceDuplicate = async (workspaceId: string) => {
  await chatStore.duplicateChat(workspaceId);
  await chatStore.loadChats();
  autoFitNodes();
};

const handleWorkspaceArchive = (workspaceId: string) => {
  const workspace = chatStore.chats.find(chat => chat.id === workspaceId);
  if (workspace) {
    const newStatus = workspace.status === 'archived' ? 'active' : 'archived';
    chatStore.updateChatMetadata(workspaceId, { status: newStatus });
  }
};

const handleWorkspaceExport = (workspaceId: string) => {
  alert(`Exporting workspace: ${workspaceId}`);
};

const handleWorkspaceDelete = async (workspaceId: string) => {
  if (confirm("Are you sure you want to delete this workspace?")) {
    await chatStore.deleteChat(workspaceId);
    await chatStore.loadChats();
    autoFitNodes();
  }
};

const handleImportCompleted = async (importResult: { imported: number; skipped: number }) => {
  console.log(`Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped`);
  
  // Refresh the chat list to show newly imported workspaces
  await chatStore.loadChats();
  
  // Show notification
  showNotification(`Successfully imported ${importResult.imported} conversation${importResult.imported !== 1 ? 's' : ''}!`);
  
  // Auto-fit to show all workspaces including new ones
  await nextTick();
  autoFitNodes();
};

const getImportIcon = (format: string) => {
  switch (format) {
    case 'chatgpt': return Bot;
    case 'claude': return MessageSquare;
    default: return Download;
  }
};

const getImportLabel = (format: string) => {
  switch (format) {
    case 'chatgpt': return 'ChatGPT Import';
    case 'claude': return 'Claude Import';
    default: return 'Imported';
  }
};

// Welcome Screen Handlers
const showWorkspaceOverview = () => {
  isWelcomeScreen.value = false;
  isWorkspaceOverview.value = true;
};

const handleImportWorkspace = () => {
  // Create a file input and trigger file selection
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,.zip';
  fileInput.multiple = true;
  
  fileInput.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    
    try {
      const { conversationImportService } = await import('@/services/conversationImportService');
      
      // Set up status monitoring to refresh workspace list when first workspace is imported
      let hasImportedFirstWorkspace = false;
      const statusUnsubscribe = conversationImportService.onStatusUpdate(async (status) => {
        // When the first workspace is imported, immediately refresh the workspace list
        if (!hasImportedFirstWorkspace && status.imported_conversations > 0) {
          hasImportedFirstWorkspace = true;
          console.log('First workspace imported, refreshing workspace list...');
          await chatStore.loadChats();
          // Switch to grid view if we were on welcome screen
          if (isWelcomeScreen.value) {
            isWelcomeScreen.value = false;
            isWorkspaceOverview.value = true;
          }
        }
        
        // When import is completely finished, do a final refresh
        if (!status.is_running && status.imported_conversations > 0) {
          console.log('Import completed, doing final workspace refresh...');
          await chatStore.loadChats();
          statusUnsubscribe(); // Clean up the status listener
          
          console.log('Import and clustering process completed');
        }
      });
      
      for (const file of Array.from(files)) {
        if (file.name.endsWith('.json') || file.name.endsWith('.zip')) {
          console.log('Importing file:', file.name);
          await conversationImportService.importFile(file);
          
          // Show success notification
          showNotification(`Successfully imported ${file.name}`);
        } else {
          showNotification(`Unsupported file type: ${file.name}`, 'error');
        }
      }
    } catch (error) {
      console.error('Import error:', error);
      showNotification('Failed to import files', 'error');
    }
  });
  
  fileInput.click();
};

const handleOpenWorkspace = async (workspaceId: string) => {
  isWelcomeScreen.value = false;
  await handleWorkspaceSelect(workspaceId);
};

// Flag to track morphing transition
const isMorphingFromInputContainer = ref(false);

// Canvas Input Container Handlers (New Canvas-First UX)
const handleWorkspaceCreated = async (message: string, targetPosition?: { x: number, y: number }) => {
  isCreatingWorkspace.value = true;
  isMorphingFromInputContainer.value = true; // Disable entrance animations
  
  try {
    // Create a new workspace with the user's message at the exact input container position
    await handleGenerateWorkspace(message, undefined, undefined, targetPosition || { x: 0, y: 0 });
  } finally {
    isCreatingWorkspace.value = false;
    // Reset morphing flag after a short delay to allow the node to render
    setTimeout(() => {
      isMorphingFromInputContainer.value = false;
    }, 100);
  }
};

const handleInputTransitionStart = () => {
  console.log('Canvas input transition starting...');
  // Optionally start zoom-out animation here
};

const handleInputTransitionComplete = () => {
  console.log('Canvas input transition completed');
  // Input container stays visible at fixed coordinate
  isWelcomeScreen.value = false;
};

// New handlers for enhanced 3-phase transition
const handleMorphPhaseComplete = (phase: string) => {
  console.log(`Canvas input morph phase completed: ${phase}`);
  // Handle different phases if needed (morphing, positioning, materializing)
};

const handleTargetPositionRequest = () => {
  // Store target position for node creation, but keep input container centered
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  // Target position in world coordinates (where the node will be created)
  const worldTargetX = 100; // Offset from center in world space
  const worldTargetY = 0;   // At vertical center
  
  // Store world coordinates for actual node creation
  targetWorldPosition.value = { x: worldTargetX, y: worldTargetY };
  
  // Keep the input container centered - no position offsets
  // The input morphs in place while the node appears at the target position
  canvasInputRef.value?.setMorphTargetPosition({ 
    x: 0, 
    y: 0 
  });
  
  console.log('Target position set for node creation:', targetWorldPosition.value);
};

const handleGenerateWorkspace = async (userInput: string, template?: any, claudeCodeConfig?: any, targetPosition?: { x: number, y: number }) => {
  try {
    
    console.log('DEBUG: handleGenerateWorkspace called with:', { userInput, template, claudeCodeConfig, targetPosition });
    
    // Handle Claude Code sessions differently
    if (claudeCodeConfig?.isClaudeCode) {
      console.log('Creating Claude Code workspace');
      
      const claudeCodeNode = {
        id: '1',
        title: 'Claude Code Session',
        messages: [{
          id: `msg-${Date.now()}`,
          role: 'user',
          content: userInput,
          timestamp: new Date().toISOString()
        }],
        x: targetPosition?.x ?? 400,
        y: targetPosition?.y ?? 300,
        type: 'claude-code',
        metadata: {
          isRoot: true,
          isClaudeCode: true,
          claudeCodeSettings: claudeCodeConfig.claudeCodeSettings
        }
      };
      
      const newChat = await chatStore.createChat('Claude Code Workspace', claudeCodeNode);
      const chatId = typeof newChat === 'string' ? newChat : (newChat?.chatId || newChat?.id);
      
      isWelcomeScreen.value = false;
      isWorkspaceOverview.value = false;
      chatStore.currentChatId = chatId;
      
      await nextTick();
      await store.loadChatState(chatId);
      
      // After loading, create Claude Code instance and send initial message
      const loadedNodes = store.nodes;
      if (loadedNodes.length > 0) {
        const mainNode = loadedNodes[0];
        console.log('Creating Claude Code instance for node:', mainNode.id);
        
        // Create Claude Code instance
        const instanceConfig = {
          initial_prompt: userInput,
          working_dir: claudeCodeConfig.claudeCodeSettings.workingDir,
          allowed_tools: Object.keys(claudeCodeConfig.claudeCodeSettings.tools).filter(
            tool => claudeCodeConfig.claudeCodeSettings.tools[tool]
          ),
          node_id: mainNode.id
        };
        
        const instanceId = await toolCallStore.createClaudeCodeInstance(instanceConfig);
        if (instanceId) {
          console.log('Created Claude Code instance:', instanceId);
          
          // Update node with instance metadata
          await store.updateNode(mainNode.id, {
            ...mainNode,
            metadata: {
              ...mainNode.metadata,
              instance_id: instanceId,
              attached_instance: true
            }
          });
          
          // Send initial message using streaming endpoint
          console.log('Sending initial message to Claude Code...');
          try {
            const response = await fetch('http://127.0.0.1:5050/api/claude-code/send-message', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: userInput,
                node_id: mainNode.id
              })
            });
            
            if (response.ok) {
              console.log('Initial message sent, processing streaming response...');
              
              // Process the streaming response
              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              
              if (reader) {
                let assistantMessage = '';
                let sessionId = null;
                let toolCalls = [];
                let streamingMessageId = `msg-${Date.now()}`;
                let hasCreatedMessage = false;
                
                // Helper function to update the streaming message
                const updateStreamingMessage = async () => {
                  const currentNode = store.nodes.find(n => n.id === mainNode.id);
                  if (!currentNode) return;
                  
                  // Build current response with proper ordering
                  let currentResponse = '';
                  
                  // Add initial assistant message if any
                  if (assistantMessage.trim()) {
                    currentResponse += assistantMessage.trim();
                  }
                  
                  // Add tool calls after the initial message
                  if (toolCalls.length > 0) {
                    if (currentResponse) currentResponse += '\n\n';
                    currentResponse += toolCalls.join('\n\n');
                  }
                  
                  if (currentResponse.trim()) {
                    let updatedMessages;
                    
                    if (!hasCreatedMessage) {
                      // Create new streaming message
                      updatedMessages = [...currentNode.messages, {
                        id: streamingMessageId,
                        role: 'assistant',
                        content: currentResponse.trim(),
                        timestamp: new Date().toISOString(),
                        streaming: true
                      }];
                      hasCreatedMessage = true;
                    } else {
                      // Update existing streaming message
                      updatedMessages = currentNode.messages.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, content: currentResponse.trim() }
                          : msg
                      );
                    }
                    
                    await store.updateNode(mainNode.id, {
                      ...currentNode,
                      messages: updatedMessages,
                      metadata: sessionId ? {
                        ...currentNode.metadata,
                        session_id: sessionId
                      } : currentNode.metadata
                    });
                  }
                };
                
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');
                  
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.slice(6));
                        console.log('Streaming data:', data);
                        
                        if (data.type === 'text') {
                          assistantMessage += data.content;
                          await updateStreamingMessage();
                        } else if (data.type === 'tool_call') {
                          // Add tool call with immediate feedback
                          const toolCallIndex = toolCalls.length;
                          toolCalls.push(`🔧 ${data.tool_name}: [executing...]`);
                          await updateStreamingMessage();
                          
                          // Update with full parameters after showing immediate feedback  
                          setTimeout(async () => {
                            // Format tool call nicely based on tool type
                            let formattedParams = '';
                            const params = data.parameters;
                            
                            switch(data.tool_name) {
                              case 'Write':
                                formattedParams = `Writing to: ${params.file_path}`;
                                if (params.content) {
                                  const contentLength = params.content.length;
                                  formattedParams += `\n📄 Content: ${contentLength} characters`;
                                }
                                break;
                              case 'Read':
                                formattedParams = `Reading: ${params.file_path}`;
                                if (params.limit) formattedParams += ` (limit: ${params.limit} lines)`;
                                break;
                              case 'Edit':
                              case 'MultiEdit':
                                formattedParams = `Editing: ${params.file_path}`;
                                break;
                              case 'Bash':
                                formattedParams = `Command: ${params.command}`;
                                break;
                              case 'LS':
                                formattedParams = `Listing: ${params.path || 'current directory'}`;
                                break;
                              case 'Glob':
                                formattedParams = `Pattern: ${params.pattern}`;
                                if (params.path) formattedParams += ` in ${params.path}`;
                                break;
                              case 'Grep':
                                formattedParams = `Searching: "${params.pattern}"`;
                                if (params.path) formattedParams += ` in ${params.path}`;
                                break;
                              case 'WebFetch':
                                formattedParams = `Fetching: ${params.url}`;
                                break;
                              case 'WebSearch':
                                formattedParams = `Searching: "${params.query}"`;
                                break;
                              case 'TodoWrite':
                                formattedParams = `Managing todos (${params.todos?.length || 0} items)`;
                                break;
                              case 'Task':
                                formattedParams = `${params.description}: ${params.prompt?.substring(0, 100)}...`;
                                break;
                              default:
                                formattedParams = JSON.stringify(params, null, 2);
                            }
                            
                            toolCalls[toolCallIndex] = `🔧 ${data.tool_name}: ${formattedParams}`;
                            await updateStreamingMessage();
                          }, 100);
                        } else if (data.type === 'tool_result') {
                          // Handle tool results if available
                          const lastToolIndex = toolCalls.length - 1;
                          if (lastToolIndex >= 0 && data.result) {
                            toolCalls[lastToolIndex] += `\n✓ Result: ${typeof data.result === 'string' ? data.result : JSON.stringify(data.result)}`;
                            await updateStreamingMessage();
                          }
                        } else if (data.type === 'result') {
                          // Capture session ID and finalize message
                          sessionId = data.session_id;
                          
                          // Final update to remove streaming indicator
                          if (hasCreatedMessage) {
                            const currentNode = store.nodes.find(n => n.id === mainNode.id);
                            if (currentNode) {
                              const updatedMessages = currentNode.messages.map(msg => 
                                msg.id === streamingMessageId 
                                  ? { ...msg, streaming: false }
                                  : msg
                              );
                              
                              await store.updateNode(mainNode.id, {
                                ...currentNode,
                                messages: updatedMessages,
                                metadata: {
                                  ...currentNode.metadata,
                                  session_id: sessionId
                                }
                              });
                            }
                          }
                          
                          console.log('Finalized Claude Code response with session ID:', sessionId);
                        }
                      } catch (e) {
                        console.error('Error parsing streaming data:', e);
                      }
                    }
                  }
                }
              }
            } else {
              console.error('Failed to send initial message:', response.statusText);
            }
          } catch (error) {
            console.error('Error sending initial message:', error);
          }
        } else {
          console.error('Failed to create Claude Code instance');
        }
      }
      return;
    }
    
    // Call backend to generate workspace
    const response = await fetch('http://127.0.0.1:5050/api/generate-workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-cache', // Prevent caching issues
      body: JSON.stringify({
        userInput,
        ...(template?.id && { templateId: template.id }),
        preferences: {}
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const workspaceData = await response.json();
    
    // For simple workspaces, use the backend's single node directly
    const backendNode = workspaceData.nodes[0];
    console.log('DEBUG: Backend node position:', { x: backendNode.x, y: backendNode.y });
    console.log('DEBUG: Target position:', targetPosition);
    
    const initialNode = {
      id: backendNode.id,
      title: backendNode.title,
      messages: backendNode.messages,
      x: targetPosition?.x ?? backendNode.x,
      y: targetPosition?.y ?? backendNode.y,
      type: 'main',
      metadata: {
        isRoot: true,
        templateId: template?.id
      }
    };
    
    console.log('DEBUG: Final initial node position:', { x: initialNode.x, y: initialNode.y });
    
    // Create new chat/workspace with proper initialNode
    const newChat = await chatStore.createChat(workspaceData.title, initialNode);
    
    // Extract chat ID - could be a string ID directly or an object with chatId
    const chatId = typeof newChat === 'string' ? newChat : (newChat?.chatId || newChat?.id);
    if (!chatId) {
      throw new Error('Failed to create chat - no ID returned');
    }
    
    // FIRST: Switch to the canvas workspace immediately
    isWelcomeScreen.value = false;
    isWorkspaceOverview.value = false;
    
    // Set the current chat ID 
    chatStore.currentChatId = chatId;
    
    // Wait for the canvas to be visible before starting animation
    await nextTick();
    
    // THEN: Load the generated workspace structure with animation
    if (workspaceData.nodes && workspaceData.nodes.length > 0) {
      console.log(`Creating ${workspaceData.nodes.length} nodes from template...`);
      
      // DON'T clear workspace - we need to keep the main node that was just created
      // store.clearCurrentWorkspace();
      
      // Wait for the chat to be loaded and get the main node
      await store.loadChatState(chatId);
      await nextTick();
      
      // Handle simple workspaces (single node) differently from templates
      if (!template && workspaceData.nodes.length === 1) {
        console.log('[InfiniteCanvas] Processing single-node workspace through agent routing...');
        
        // Import router service and process the user's message
        const { routerService } = await import('@/services/routerService');
        const routingResult = await routerService.routeRequest({
          message: userInput,
          hasImages: false
        });
        
        console.log('[InfiniteCanvas] Routing result:', routingResult);
        
        // Get the main node from the store
        const mainNode = store.nodes.find(n => n.type === 'main');
        
        // Store routing result in the main node's first message
        if (mainNode && mainNode.messages && mainNode.messages[0]) {
          mainNode.messages[0].routingResult = routingResult;
          // Update the node in the store to persist the routing result
          store.updateNode(mainNode.id, {
            messages: mainNode.messages
          });
        }
        
        // If we have a routed model, send the message to it
        if (routingResult.model && mainNode) {
          console.log(`[InfiniteCanvas] Sending message to ${routingResult.category} agent: ${routingResult.model.name}`);
          
          // Send message to the routed model (don't add user message again - it's already in the node)
          await store.sendMessage(
            mainNode.id,
            userInput,
            routingResult.model,
            '', // API key - will be handled by the store
            false // addUserMessage - don't add again, it's already in the node from backend
          );
        } else {
          console.log(`[InfiniteCanvas] No agent configured for ${routingResult.category}, trying fallback agents...`);
          
          // Try fallback agents in order: code -> text -> any available
          const { useAgentStore } = await import('@/stores/agentStore');
          const agentStore = useAgentStore();
          
          let fallbackModel = null;
          let fallbackCategory = '';
          
          // Try code agent first (most requests can be handled by code agents)
          if (routingResult.category !== 'code') {
            const codeModel = agentStore.getDefaultModel('code');
            if (codeModel) {
              fallbackModel = codeModel;
              fallbackCategory = 'code';
            }
          }
          
          // Try text agent if code agent not available
          if (!fallbackModel) {
            const textModel = agentStore.getDefaultModel('text');
            if (textModel) {
              fallbackModel = textModel;
              fallbackCategory = 'text';
            }
          }
          
          if (fallbackModel) {
            console.log(`[InfiniteCanvas] Using fallback ${fallbackCategory} agent: ${fallbackModel.name}`);
            
            // Update routing result to show fallback was used
            routingResult.model = fallbackModel;
            routingResult.fallbackUsed = true;
            routingResult.reasoning = `${routingResult.reasoning || 'No agent configured'} → fallback to ${fallbackCategory}`;
            
            // Update the stored routing result
            if (mainNode && mainNode.messages && mainNode.messages[0]) {
              mainNode.messages[0].routingResult = routingResult;
              store.updateNode(mainNode.id, {
                messages: mainNode.messages
              });
            }
            
            // Send message to the fallback model
            await store.sendMessage(
              mainNode.id,
              userInput,
              fallbackModel,
              '', // API key - will be handled by the store
              false // addUserMessage - don't add again, it's already in the node from backend
            );
          } else {
            console.log(`[InfiniteCanvas] No agents configured at all, workspace created but message not processed`);
          }
        }
      } else {
        // Handle template workspaces (multi-node)
        const mainNode = store.nodes.find(n => n.type === 'main');
        await createTemplateWorkspace(workspaceData.nodes, workspaceData.connections || [], mainNode);
      }
    }
    
  } catch (error) {
    console.error('Failed to generate workspace:', error);
    // TODO: Show error notification
  }
};

// Simple template workspace creation - spawn all nodes at once with proper spacing
const createTemplateWorkspace = async (nodes, connections, mainNode) => {
  try {
    console.log(`Creating template workspace with ${nodes.length} nodes...`);
    
    // Create map to track template nodes
    const createdNodes = new Map();
    
    // Add main node to map for connections
    if (mainNode) {
      createdNodes.set('main', mainNode);
      createdNodes.set('root', mainNode);
    }
    
    // Create all nodes at once with proper spacing relative to main node
    const nodeSpacing = 1000; // Large space between nodes
    const cols = Math.min(3, Math.ceil(Math.sqrt(nodes.length))); // Max 3 columns for better layout
    
    // Calculate starting position based on main node
    const mainX = mainNode ? mainNode.x : 0;
    const mainY = mainNode ? mainNode.y : 0;
    const startX = mainX + 800; // Start well to the right of main node
    // Ensure nodes are positioned below the main node with positive Y coordinates
    const totalHeight = Math.ceil(nodes.length / cols) * nodeSpacing;
    const startY = Math.max(mainY - totalHeight / 2, 100); // Never go below Y=100
    
    console.log('[InfiniteCanvas] Multi-node layout calculation:', {
      mainNode: { x: mainX, y: mainY },
      nodeCount: nodes.length,
      cols,
      nodeSpacing,
      totalHeight,
      calculatedStartY: mainY - totalHeight / 2,
      adjustedStartY: startY
    })
    
    for (const [index, nodeData] of nodes.entries()) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = startX + col * nodeSpacing;
      const y = startY + row * nodeSpacing;
      
      const newNode = await store.addNode(
        null, // No parent initially
        -1,
        { x, y },
        {
          type: 'branch',
          title: nodeData.title,
          messages: nodeData.messages || [{ 
            role: 'assistant', 
            content: nodeData.messages?.[0]?.content || `Welcome to ${nodeData.title}`,
            timestamp: new Date().toISOString(),
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }]
        }
      );
      
      createdNodes.set(nodeData.title, newNode);
    }
    
    // Connect ALL template nodes to main node initially
    // This ensures every template node has a spline connector to the main branch
    if (mainNode && nodes.length > 0) {
      for (const [index, nodeData] of nodes.entries()) {
        const templateNode = createdNodes.get(nodeData.title);
        if (templateNode) {
          await store.updateNode(templateNode.id, {
            parentId: mainNode.id,
            branchMessageIndex: index // Use index as branch message index for proper spacing
          });
        }
      }
    }
    
    // Establish template connections (these create additional connections between template nodes)
    if (connections && connections.length > 0) {
      for (const conn of connections) {
        const parentNode = createdNodes.get(conn.from);
        const childNode = createdNodes.get(conn.to);
        
        if (parentNode && childNode) {
          // Create a secondary connection while keeping the main node connection
          // This creates the template-specific spline connectors
          
          if (conn.label) {
            store.setConnectionLabel(parentNode.id, childNode.id, conn.label);
          }
        }
      }
    }
    
    // Auto-fit to show all nodes
    await nextTick();
    autoFitNodes();
    
    console.log('Template workspace created successfully!');
  } catch (error) {
    console.error('Error creating template workspace:', error);
  }
};


// in enhanced-infinite-canvas.vue

// Center on a specific node with a smooth, direct (non-curved) animation
const centerOnNodeWithAnimation = async (nodeId, targetZoom = 0.6, duration = 800) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const bounds = calculateNodeBounds(node);
  const nodeCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const nodeCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
  const rect = canvasRef.value.getBoundingClientRect();

  const startPanX = panX.value;
  const startPanY = panY.value;
  const startZoom = zoom.value;
  
  focusedNodeId.value = nodeId;
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    // --- FIX: The core logic change starts here ---

    // 1. Define the start and end points of the animation in WORLD coordinates.
    //    This ensures the camera's focus point travels in a straight line.

    // The world point at the center of the screen at the START of the animation.
    const startWorldX = (rect.width / 2 - startPanX) / startZoom;
    const startWorldY = (rect.height / 2 - startPanY) / startZoom;

    // The world point we want to be at the center of the screen at the END of the animation.
    const endWorldX = nodeCenterX;
    const endWorldY = nodeCenterY;
    
    // The final on-screen position for the target
    const targetScreenX = rect.width / 2;
    const targetScreenY = rect.height / 2;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Apply easing to progress
      const easeOut = 1 - Math.pow(1 - progress, 2);
      
      // 2. Interpolate the zoom level and the viewport's center point in WORLD space.
      // IMPORTANT: Use the same easing for all values to maintain straight path
      const currentZoom = startZoom + (targetZoom - startZoom) * easeOut;
      const currentWorldX = startWorldX + (endWorldX - startWorldX) * easeOut;
      const currentWorldY = startWorldY + (endWorldY - startWorldY) * easeOut;
      
      // 3. Calculate the new pan values for the current frame.
      //    The pan is calculated to place the `currentWorld` point at the `targetScreen` position.
      panX.value = targetScreenX - currentWorldX * currentZoom;
      panY.value = targetScreenY - currentWorldY * currentZoom;
      zoom.value = currentZoom;
      
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // On the final frame, set the exact target values to prevent rounding errors.
        zoom.value = targetZoom;
        panX.value = targetScreenX - endWorldX * targetZoom;
        panY.value = targetScreenY - endWorldY * targetZoom;

        // store.isTransitioning = false; // REMOVED
        resolve();
      }
    };
    
    requestAnimationFrame(animate);
  });
};

// Center on a specific node
const centerOnNode = (nodeId) => {
  console.log('🎯 centerOnNode called for', nodeId);
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  store.isTransitioning = true;
  
  // Use the same bounds calculation as clicking for consistency
  const bounds = calculateNodeBounds(node);
  const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const centerY = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  const rect = canvasRef.value.getBoundingClientRect();

  // If zoom is too low for full detail, zoom in to spotlight the node
  if (zoom.value < 0.5) {
    // Zoom to just above the threshold
    const targetZoom = 0.6;
    panX.value = rect.width / 2 - centerX * targetZoom;
    panY.value = rect.height / 2 - centerY * targetZoom;
    zoom.value = targetZoom;
  } else {
    panX.value = rect.width / 2 - centerX * zoom.value;
    panY.value = rect.height / 2 - centerY * zoom.value;
  }

  focusedNodeId.value = nodeId;

  setTimeout(() => {
    store.isTransitioning = false;
  }, 300);
};

// Check if workspace has only one branch node and auto-snap it
let autoSnapInProgress = false;
const checkAndAutoSnapSingleBranch = () => {
  if (autoSnapInProgress) {
    console.log('[InfiniteCanvas] Auto-snap already in progress, skipping');
    return false;
  }
  
  console.log('[InfiniteCanvas] Checking for auto-snap condition');
  autoSnapInProgress = true;

  if (!store.nodes || store.nodes.length === 0) {
    console.log('[InfiniteCanvas] No nodes found, skipping auto-snap');
    autoSnapInProgress = false;
    return false;
  }

  // Don't auto-snap if something is already snapped
  if (store.snappedNodeId) {
    console.log('[InfiniteCanvas] Node already snapped, skipping auto-snap:', store.snappedNodeId);
    autoSnapInProgress = false;
    return false;
  }

  // Don't auto-snap if we're in overview mode
  if (isWorkspaceOverview.value) {
    console.log('[InfiniteCanvas] In overview mode, skipping auto-snap');
    autoSnapInProgress = false;
    return false;
  }

  console.log('[InfiniteCanvas] Found nodes:', {
    total: store.nodes.length,
    nodeTypes: store.nodes.map(n => ({ id: n.id, type: n.type, parentId: n.parentId }))
  });

  // Only auto-snap if there's exactly one node total
  if (store.nodes.length === 1 && store.nodes[0].type === 'main') {
    const mainNode = store.nodes[0];
    console.log('[InfiniteCanvas] Auto-snapping single main node:', mainNode.id);

    nextTick(() => {
      setTimeout(() => {
        emitter.emit('auto-snap-node', { nodeId: mainNode.id });
        autoSnapInProgress = false;
      }, 500);
    });

    return true;
  }

  // For multi-node workspaces, don't auto-snap
  if (store.nodes.length > 1) {
    console.log('[InfiniteCanvas] Multi-node workspace loaded, no auto-snap');
    autoSnapInProgress = false;
    return false; // Return false so other positioning logic can handle it
  }

  console.log('[InfiniteCanvas] Auto-snap condition not met - found', store.nodes.length, 'total nodes');
  autoSnapInProgress = false;
  return false;
};

// Handle branch creation
const handleCreateBranch = async (
  parentId: string,
  messageIndex: number,
  position: { x: number; y: number },
  initialData: any
) => {
  isFocusedMode.value = false;

  // Step 1: Check if any node is currently snapped and unsnap it first
  if (store.snappedNodeId) {
    console.log('[InfiniteCanvas] Unsnapping current node before creating branch:', store.snappedNodeId);

    // Unsnap the current node using event bus
    emitter.emit('auto-snap-node', { nodeId: store.snappedNodeId });

    // Wait for unsnap animation to complete
    await new Promise(resolve => setTimeout(resolve, 450));
  }

  const parentNode = store.nodes.find((n) => n.id === parentId);
  if (!parentNode) return;

  const existingBranches = store.nodes.filter((n) => n.parentId === parentId);
  const verticalOffset = existingBranches.length * (store.CARD_HEIGHT + 20);

  const adjustedPosition = {
    x: position.x,
    y: parentNode.y + verticalOffset,
  };

  // Extract the first user message for title generation
  // This could be from the initial data or the most recent message
  let firstUserMessage = '';

  if (initialData?.userMessage) {
    firstUserMessage = initialData.userMessage;
  } else if (parentNode.messages && parentNode.messages.length > 0) {
    // Get the user message at the branch point
    const branchMessage = parentNode.messages[messageIndex];
    if (branchMessage && branchMessage.role === 'user') {
      firstUserMessage = branchMessage.content;
    } else {
      // Find the most recent user message
      for (let i = messageIndex; i >= 0; i--) {
        const msg = parentNode.messages[i];
        if (msg && msg.role === 'user') {
          firstUserMessage = msg.content;
          break;
        }
      }
    }
  }

  // Step 2: Create the branch node with title generation enabled
  const newNode = await store.addNode(parentId, messageIndex, adjustedPosition, {
    ...initialData,
    y: adjustedPosition.y,
  }, {
    generateTitle: true,
    firstUserMessage: firstUserMessage
  });

  console.log('[InfiniteCanvas] Created new branch node:', newNode.id, 'at position:', adjustedPosition);

  // Ensure the new node is immediately visible by forcing a visibility update
  intersectionVisibleNodes.value.add(newNode.id);

  // Step 3: Center on the new node immediately with enhanced focusing
  await nextTick(); // Wait for DOM update
  
  console.log('[InfiniteCanvas] Focusing on new branch node:', newNode.id, 'at position:', adjustedPosition);
  
  // Use the same focus behavior as arrow navigation for consistency
  focusedNodeId.value = newNode.id;
  centerOnNodeWithAnimation(newNode.id, zoom.value > 0.5 ? zoom.value : 0.6, 400);

  // Step 4: Snap the new branch node (disabled)
  // setTimeout(() => {
  //   console.log('[InfiniteCanvas] Auto-snapping new branch node:', newNode.id);
  //   emitter.emit('auto-snap-node', { nodeId: newNode.id });
  // }, 600); // Increased timeout to ensure centering completes
};

// Handle resending messages
const handleResend = async (nodeId: string, userMessageIndex: number) => {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node || !node.messages) return;

  // Skip resend for Claude Code nodes - they handle it internally
  if (node.type === 'claude-code' || node.metadata?.isClaudeCode === true) {
    return;
  }

  const userMsg = node.messages[userMessageIndex];
  if (!userMsg || userMsg.role !== "user") return;

  store.removeMessage(nodeId, userMessageIndex + 1);

  const modelInfo: ModelInfo = {
    id: props.selectedModel,
    name: props.selectedModel,
    source: props.modelType as 'ollama' | 'openrouter' | 'google' | 'anthropic' | 'openai'
  };

  await store.sendMessage(
    nodeId,
    userMsg.content,
    modelInfo,
    props.openRouterApiKey,
    false
  );
};

// Shared function to calculate spline path - used by both visual and interaction layers
const calculateSplinePath = (startNode: any, endNode: any, isExpanded: boolean) => {
  // Use exact same variables as MainSplineConnector
  const startNodeX = startNode.x;
  const startNodeY = startNode.y;
  const endNodeX = endNode.x;
  const endNodeY = endNode.y;
  
  const endDimensions = getEffectiveCardDimensions(endNode);
  const startDimensions = getEffectiveCardDimensions(startNode);
  const endCardWidth = endDimensions.width;
  const endCardHeight = endDimensions.height;
  const startCardWidth = startDimensions.width;
  const startCardHeight = startDimensions.height;
  
  const isLeft = endNode.type === 'left-branch';
  const isSourceExpanded = isExpanded;
  
  const idx = endNode.branchMessageIndex ?? 0;
  
  // EXACT yOff calculation as MainSplineConnector
  let yOff;
  switch (startDimensions.lodLevel) {
    case 'block':
      yOff = isSourceExpanded ? Math.min(idx * 15 + 8, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'summary':
      yOff = isSourceExpanded ? Math.min(idx * 30 + 15, startCardHeight / 2) : startCardHeight / 2;
      break;
    case 'full':
    default:
      yOff = isSourceExpanded ? idx * 120 + 40 : 40;
      break;
  }

  // EXACT startPoint and endPoint calculation as MainSplineConnector
  const startPoint = {
    x: isLeft ? startNodeX - 1 : startNodeX + startCardWidth + 1,
    y: startNodeY + Math.min(yOff, startCardHeight - 10)
  };

  const endPoint = {
    x: endNodeX + (isLeft ? endCardWidth - 1 : 1), // Stop 1px before the edge
    y: endNodeY + endCardHeight / 2
  };

  // EXACT pathAndControlPoints calculation as MainSplineConnector
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const dist = Math.hypot(dx, dy);
  
  const cpDist = Math.min(dist * 0.5, 300);
  const vert = Math.min(Math.abs(dy) * 0.2, 60) * (dy < 0 ? -1 : 1);

  const controlPoint1 = {
    x: startPoint.x + (isLeft ? -cpDist : cpDist),
    y: startPoint.y + vert * 0.5
  };
  const controlPoint2 = {
    x: endPoint.x + (isLeft ? cpDist * 0.6 : -cpDist * 0.6),
    y: endPoint.y - vert * 0.5
  };

  return `M${startPoint.x.toFixed(1)},${startPoint.y.toFixed(1)}C${controlPoint1.x.toFixed(1)},${controlPoint1.y.toFixed(1)},${controlPoint2.x.toFixed(1)},${controlPoint2.y.toFixed(1)},${endPoint.x.toFixed(1)},${endPoint.y.toFixed(1)}`;
};

// Use the shared function for interaction layer
const getSplinePath = calculateSplinePath;

// Handle spline double-click from interaction layer - NOW HANDLED BY NEW CONNECTION SYSTEM
const handleSplineDoubleClick = (connection: any) => {
  console.log('Spline double-clicked from interaction layer!', connection);
  // Emit an event that the SplineConnector can listen to
  emitter.emit('spline-double-click', {
    parentId: connection.parent.id,
    childId: connection.child.id
  });
};

// Handle spline hover from interaction layer - NOW HANDLED BY NEW CONNECTION SYSTEM
const handleSplineHover = (connection: any, isHovering: boolean) => {
  // Emit hover event that SplineConnector can listen to
  emitter.emit('spline-hover', {
    parentId: connection.parent.id,
    childId: connection.child.id,
    isHovering: isHovering
  });
};

// Mouse event handlers
const handleMouseUp = (e) => {
  // Check if drawing tool should handle this event
  if (handleDrawingMouseUp(e)) return;
  
  // Handle resize end
  if (resizeState.value.isResizing) {
    handleResizeEnd();
    return;
  }
  
  // Handle shape drag end
  if (shapeDragState.value.isDragging) {
    // Save the shape positions after dragging
    drawingStore.saveToHistory();
    shapeDragState.value.isDragging = false;
    shapeDragState.value.activeShapeId = null;
    shapeDragState.value.startShapePositions.clear();
    return;
  }
  
  // Handle tool group drag end
  if (toolGroupDragState.value.isDragging) {
    const group = toolGroupDragState.value.activeToolGroup;
    
    if (group && chatStore.currentChatId) {
      // Save the node positions to the backend after dragging
      group.nodes.forEach(node => {
        chatStore.updateNode(chatStore.currentChatId, node.id, { 
          x: node.x, 
          y: node.y 
        });
      });
      
      console.log('Tool group drag completed. Saved positions for', group.nodes.length, 'nodes in group:', group.toolName);
    }
    
    // Reset drag state
    toolGroupDragState.value.isDragging = false;
    toolGroupDragState.value.activeToolGroup = null;
    toolGroupDragState.value.startNodePositions.clear();
    return;
  }
  
  if (workspaceDragState.value.isDragging) {
    const { activeId } = workspaceDragState.value;
    if (activeId) {
      const workspace = chatStore.chats.find((chat) => chat.id === activeId);
      if (workspace) {
        chatStore.updateChatMetadata(activeId, {
          x: workspace.x,
          y: workspace.y,
        });
      }
    }
  }

  workspaceDragState.value = {
    isDragging: false,
    activeId: null,
    offset: { x: 0, y: 0 },
  };


  // Handle multi-drag completion
  if (isMultiDragging.value) {
    isMultiDragging.value = false;

    // Save multi-node move to undo stack
    const moveActions = [];
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = multiDragStartPositions.value.get(nodeId);
      if (node && startPos) {
        const finalPosition = { x: node.x, y: node.y };

        // Only save if node actually moved
        if (startPos.x !== finalPosition.x || startPos.y !== finalPosition.y) {
          moveActions.push({
            nodeId,
            previousPosition: startPos,
            newPosition: finalPosition
          });
        }
      }
    });

    if (moveActions.length > 0) {
      addToUndoStack({
        type: 'move_multiple_nodes',
        moves: moveActions,
        timestamp: Date.now()
      });
      
      // Force immediate save for all moved nodes to prevent loss on refresh
      if (chatStore.currentChatId) {
        moveActions.forEach(action => {
          chatStore.updateNode(chatStore.currentChatId, action.nodeId, { 
            x: action.newPosition.x, 
            y: action.newPosition.y 
          });
        });
      }
    }

    multiDragStartPositions.value.clear();
  }

  // Check if a single node was being dragged and save to undo stack
  if (store.isDragging && store.activeNode && dragStartPosition.value) {
    const draggedNode = store.nodes.find(n => n.id === store.activeNode);
    if (draggedNode) {
      const finalPosition = { x: draggedNode.x, y: draggedNode.y };
      const startPosition = { x: dragStartPosition.value.x, y: dragStartPosition.value.y };

      // Only add to undo stack if the node actually moved
      if (startPosition.x !== finalPosition.x || startPosition.y !== finalPosition.y) {
        addToUndoStack({
          type: 'move_node',
          nodeId: store.activeNode,
          previousPosition: startPosition,
          newPosition: finalPosition,
          timestamp: Date.now()
        });
        
        // Force immediate save on drag end to prevent loss on refresh
        if (chatStore.currentChatId) {
          chatStore.updateNode(chatStore.currentChatId, store.activeNode, { 
            x: finalPosition.x, 
            y: finalPosition.y 
          });
        }
      }
    }

    // Clear drag start position
    dragStartPosition.value = null;
  }

  store.isDragging = false;
  store.activeNode = null;
  isPanning.value = false;
  
  // Handle selection rectangle completion
  if (selectionRect.value.isActive) {
    finishSelection();
  }
  
  // Check viewport return after mouse interaction
  viewportReturn.checkNodeVisibility(canvasRef.value);
};

const handleCanvasMouseDown = (e) => {
  if (snappedNodeId.value !== null) return;

  // Check if drawing tool should handle this event
  if (handleDrawingMouseDown(e)) return;

  // Disable panning in overview mode
  if (isWorkspaceOverview.value) return;

  const clickedNode = findNodeAt(e.clientX, e.clientY);

  if (clickedNode) {
    // Clicked on a node - handle selection
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Clear selection if not holding modifier keys
      selectedNodeIds.value.clear();
      // Also clear drawing shape selections when clicking on nodes without modifiers
      drawingStore.clearSelection();
    }

    // Toggle node selection
    if (selectedNodeIds.value.has(clickedNode.id)) {
      selectedNodeIds.value.delete(clickedNode.id);
    } else {
      selectedNodeIds.value.add(clickedNode.id);
    }

    // Start multi-drag if node is selected
    if (selectedNodeIds.value.has(clickedNode.id)) {
      isMultiDragging.value = true;
      multiDragStartPositions.value.clear();
      multiDragShapePositions.value.clear();

      // Save start positions for all selected nodes
      selectedNodeIds.value.forEach(nodeId => {
        const node = store.nodes.find(n => n.id === nodeId);
        if (node) {
          multiDragStartPositions.value.set(nodeId, { x: node.x, y: node.y });
        }
      });
      
      // Save start positions for all selected shapes
      drawingStore.selectedShapes.forEach(shape => {
        if (shape.type === 'pen' && shape.points) {
          // For pen shapes, store the original points
          multiDragShapePositions.value.set(shape.id, {
            x: shape.x,
            y: shape.y,
            points: shape.points.map(p => ({ x: p.x, y: p.y }))
          });
        } else {
          multiDragShapePositions.value.set(shape.id, { x: shape.x, y: shape.y });
        }
      });

      dragStartPosition.value = screenToWorld(e.clientX, e.clientY);
    }
  } else {
    // Clicked on empty canvas
    if (isShiftPressed.value) {
      // Start selection rectangle
      console.log('Starting selection rectangle with shift pressed');
      selectionRect.value.isActive = true;
      selectionRect.value.startX = e.clientX;
      selectionRect.value.startY = e.clientY;
      selectionRect.value.currentX = e.clientX;
      selectionRect.value.currentY = e.clientY;
      
      // Clear existing selection if not holding other modifier keys
      if (!e.ctrlKey && !e.metaKey) {
        selectedNodeIds.value.clear();
        drawingStore.clearSelection();
      }
    } else {
      // Start panning
      isPanning.value = true;
      lastPanPosition.value = {
        x: e.clientX - panX.value,
        y: e.clientY - panY.value,
      };
      
      // Clear selection if not holding modifier keys
      if (!e.ctrlKey && !e.metaKey) {
        selectedNodeIds.value.clear();
        // Also clear drawing shape selections
        drawingStore.clearSelection();
      }
    }
  }
};


// Touch event handlers
const handleTouchMove = (e: TouchEvent) => {
  e.preventDefault();

  // Disable touch interactions in overview mode
  if (isWorkspaceOverview.value) return;

  if (isPanning.value && e.touches.length === 1) {
    const touch = e.touches[0];
    panX.value = touch.clientX - lastPanPosition.value.x;
    panY.value = touch.clientY - lastPanPosition.value.y;
    
    // No pan constraints needed
  } else if (e.touches.length === 2) {
    // Handle pinch zoom normally
    
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];

    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;

    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (!lastPanPosition.value.lastDistance) {
      lastPanPosition.value.lastDistance = distance;
    }

    const deltaDistance = distance - lastPanPosition.value.lastDistance;

    const newZoom = Math.min(
      Math.max(zoom.value + deltaDistance * 0.01, ZOOM_MIN),
      ZOOM_MAX
    );
    zoom.value = newZoom;

    const contentX = (centerX - panX.value) / zoom.value;
    const contentY = (centerY - panY.value) / zoom.value;

    panX.value = centerX - contentX * newZoom;
    panY.value = centerY - contentY * newZoom;

    lastPanPosition.value.lastDistance = distance;
  }
};

const handleTouchStart = (e: TouchEvent) => {
  e.preventDefault();

  // Disable touch interactions in overview mode
  if (isWorkspaceOverview.value) return;

  if (e.touches.length === 1) {
    isPanning.value = true;
    const touch = e.touches[0];
    lastPanPosition.value = {
      x: touch.clientX - panX.value,
      y: touch.clientY - panY.value,
    };
  } else if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    lastPanPosition.value.lastDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  }
  
  // Check viewport return during touch interaction
  viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
};

const handleTouchEnd = (e: TouchEvent) => {
  e.preventDefault();
  isPanning.value = false;
  lastPanPosition.value.lastDistance = null;
  
  // Check viewport return after touch interaction
  viewportReturn.checkNodeVisibility(canvasRef.value);
};

// Prevent browser navigation gestures (macOS trackpad swipes)
const handleGestureStart = (e: any) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleGestureChange = (e: any) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleGestureEnd = (e: any) => {
  e.preventDefault();
  e.stopPropagation();
};

// Find closest node in a direction
const findClosestNodeInDirection = (currentNode, direction) => {
  const currentCenter = getNodeCenter(currentNode);
  const connectedNodes = store.connections
    .filter(
      (conn) =>
        conn.parent.id === currentNode.id || conn.child.id === currentNode.id
    )
    .map((conn) =>
      conn.parent.id === currentNode.id ? conn.child : conn.parent
    );

  let candidates = [];
  if (direction === "up") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).y < currentCenter.y
    );
  } else if (direction === "down") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).y > currentCenter.y
    );
  } else if (direction === "left") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).x < currentCenter.x
    );
  } else if (direction === "right") {
    candidates = connectedNodes.filter(
      (node) => getNodeCenter(node).x > currentCenter.x
    );
  }

  candidates.sort((a, b) => {
    const distA = Math.hypot(
      getNodeCenter(a).x - currentCenter.x,
      getNodeCenter(a).y - currentCenter.y
    );
    const distB = Math.hypot(
      getNodeCenter(b).x - currentCenter.x,
      getNodeCenter(b).y - currentCenter.y
    );
    return distA - distB;
  });

  return candidates[0]?.id;
};

// Handle keyboard navigation
const handleKeyDown = (e: KeyboardEvent) => {
  const activeTag = document.activeElement?.tagName.toLowerCase();
  const isEditing =
    activeTag === 'input' ||
    activeTag === 'textarea' ||
    document.activeElement?.getAttribute('contenteditable') === 'true';
    
  if (isEditing) {
    return; // Don't process any keys when editing
  }

  // Track shift key for multi-select
  if (e.key === 'Shift') {
    isShiftPressed.value = true;
  }

  // WASD Panning
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(key)) {
    e.preventDefault();
    keysPressed.value.add(key);
    startPanAnimation();
    return;
  }

  // LOD Lock toggle (L key)
  if (!isEditing && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    toggleLODLock();
    return;
  }

  if (!isEditing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    alwaysShowPetals.value = !alwaysShowPetals.value;
    localStorage.setItem('alwaysShowPetals', alwaysShowPetals.value.toString());

    showNotification(alwaysShowPetals.value ? 'Petals: Always Visible' : 'Petals: Visible on Hover');
  }

  // Undo/Redo keyboard shortcuts
  if (!isEditing) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;

    // Copy: Ctrl/Cmd + C for drawing shapes
    if (cmdKey && e.key === 'c' && drawingStore.hasSelection) {
      e.preventDefault();
      drawingStore.copySelected();
      showNotification(`Copied ${drawingStore.selectedShapes.length} shape${drawingStore.selectedShapes.length > 1 ? 's' : ''}`);
      return;
    }
    
    // Paste: Ctrl/Cmd + V for drawing shapes
    if (cmdKey && e.key === 'v' && drawingStore.clipboard.length > 0) {
      e.preventDefault();
      drawingStore.pasteShapes();
      showNotification(`Pasted ${drawingStore.clipboard.length} shape${drawingStore.clipboard.length > 1 ? 's' : ''}`);
      return;
    }
    
    // Fit to View: Ctrl/Cmd + 0 (alternative shortcut)
    if (cmdKey && e.key === '0') {
      e.preventDefault();
      autoFitNodes();
      return;
    }
    
    // New Chat/Workspace: Ctrl/Cmd + Enter
    if (cmdKey && e.key === 'Enter') {
      e.preventDefault();
      handleNewWorkspace();
      return;
    }

    // Undo: Ctrl/Cmd + Z (without Shift)
    // Check if we should use drawing undo/redo or canvas undo/redo
    const hasDrawingShapes = drawingStore.shapes.length > 0;
    const hasSelectedShapes = drawingStore.hasSelection;
    const isDrawingTool = !['cursor', 'hand', 'lock'].includes(drawingStore.currentTool);
    
    if (cmdKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (hasDrawingShapes || hasSelectedShapes || isDrawingTool) {
        drawingStore.undo();
      } else {
        undo();
      }
      return;
    }

    // Redo: Ctrl/Cmd + Shift + Z
    if (cmdKey && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      if (hasDrawingShapes || hasSelectedShapes || isDrawingTool) {
        drawingStore.redo();
      } else {
        redo();
      }
      return;
    }

    // Redo alternative: Ctrl/Cmd + Y
    if (cmdKey && e.key === 'y') {
      e.preventDefault();
      if (hasDrawingShapes || hasSelectedShapes || isDrawingTool) {
        drawingStore.redo();
      } else {
        redo();
      }
      return;
    }

    // Select All: Ctrl/Cmd + A for drawing shapes
    if (cmdKey && e.key === 'a') {
      e.preventDefault();
      drawingStore.selectAllShapes();
      return;
    }

    // Delete selected shapes with Delete or Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && drawingStore.hasSelection) {
      e.preventDefault();
      drawingStore.deleteSelected();
      return;
    }
  }

  // if (store.isTransitioning) {
  //   console.log('❌ Keyboard blocked - store is transitioning');
  //   return;
  // }

  if (store.snappedNodeId !== null) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdKey = isMac ? e.metaKey : e.ctrlKey;
    
    // CMD + Arrow keys for cycling through snapped nodes
    if (cmdKey && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      cycleSnappedNodes(e.key);
      return;
    }
    
    // Regular arrow keys for node navigation with proper centering
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      cycleSnappedNodes(e.key);
      return;
    }

    if (e.key === "Escape") {
      const node = store.nodes.find(n => n.id === store.snappedNodeId);
      if (node) {
        const originalPosition = nodePositions.value.get(store.snappedNodeId);
        if (originalPosition) {
          handleNodeUnsnap({ nodeId: store.snappedNodeId, originalPosition });
        }
      }
      e.preventDefault();
      return;
    }
  }

  const currentNode = store.nodes.find((n) => n.id === focusedNodeId.value);
  if (!currentNode) return;

  const parentNode = store.nodes.find((n) => n.id === currentNode.parentId);
  const children = store.nodes
    .filter((n) => n.parentId === currentNode.id)
    .sort((a, b) => a.y - b.y);

  let targetNodeId = null;

  if (e.key === "ArrowRight") {
    if (children.length > 0) {
      targetNodeId = children[0].id;
    } else {
      targetNodeId = findClosestNodeInDirection(currentNode, "right");
    }
  } else if (e.key === "ArrowLeft") {
    if (parentNode) {
      targetNodeId = parentNode.id;
    } else {
      targetNodeId = findClosestNodeInDirection(currentNode, "left");
    }
  } else if (e.key === "ArrowUp") {
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index > 0) {
        targetNodeId = siblings[index - 1].id;
      }
    }
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "up");
    }
  } else if (e.key === "ArrowDown") {
    if (parentNode) {
      const siblings = store.nodes
        .filter((n) => n.parentId === parentNode.id)
        .sort((a, b) => a.y - b.y);
      const index = siblings.findIndex((n) => n.id === currentNode.id);
      if (index >= 0 && index < siblings.length - 1) {
        targetNodeId = siblings[index + 1].id;
      }
    }
    if (!targetNodeId) {
      targetNodeId = findClosestNodeInDirection(currentNode, "down");
    }
  }

  if (targetNodeId) {
    focusedNodeId.value = targetNodeId;
    // Use the same smooth animation as branch creation for consistent experience
    centerOnNodeWithAnimation(targetNodeId, zoom.value > 0.5 ? zoom.value : 0.6, 400);
  }
};

// Handle key release
const handleKeyUp = (e: KeyboardEvent) => {
  // Track shift key release for multi-select
  if (e.key === 'Shift') {
    isShiftPressed.value = false;
    // End selection rectangle if active
    if (selectionRect.value.isActive) {
      finishSelection();
    }
  }

  // WASD Panning key release
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(key)) {
    keysPressed.value.delete(key);
    if (keysPressed.value.size === 0) {
      stopPanAnimation();
    }
  }
};

// WASD Panning Animation Functions
const startPanAnimation = () => {
  if (panAnimationFrame !== null) return; // Already running
  
  const animate = () => {
    updatePanVelocity();
    applyPanning();
    
    if (keysPressed.value.size > 0 || Math.abs(panVelocity.value.x) > 0.1 || Math.abs(panVelocity.value.y) > 0.1) {
      panAnimationFrame = requestAnimationFrame(animate);
    } else {
      panAnimationFrame = null;
    }
  };
  
  panAnimationFrame = requestAnimationFrame(animate);
};

const stopPanAnimation = () => {
  if (panAnimationFrame !== null) {
    cancelAnimationFrame(panAnimationFrame);
    panAnimationFrame = null;
  }
};

const updatePanVelocity = () => {
  let deltaX = 0;
  let deltaY = 0;
  
  // Calculate desired direction based on pressed keys
  // Note: In canvas coordinates, positive Y is down, negative Y is up
  // We want W to move view up (pan down), S to move view down (pan up)
  if (keysPressed.value.has('w')) deltaY += 1;  // W moves view up (pan canvas down)
  if (keysPressed.value.has('s')) deltaY -= 1;  // S moves view down (pan canvas up)
  if (keysPressed.value.has('a')) deltaX += 1;  // A moves view left (pan canvas right)
  if (keysPressed.value.has('d')) deltaX -= 1;  // D moves view right (pan canvas left)
  
  if (keysPressed.value.size > 0) {
    // Accelerate towards desired direction with gentler logarithmic curve
    const currentSpeed = Math.sqrt(panVelocity.value.x ** 2 + panVelocity.value.y ** 2);
    const acceleration = panAcceleration.value * (1 + Math.log(1 + currentSpeed * 0.05)); // Gentler logarithmic acceleration
    
    panVelocity.value.x += deltaX * acceleration;
    panVelocity.value.y += deltaY * acceleration;
    
    // Cap the maximum speed
    const speed = Math.sqrt(panVelocity.value.x ** 2 + panVelocity.value.y ** 2);
    if (speed > panMaxSpeed.value) {
      panVelocity.value.x = (panVelocity.value.x / speed) * panMaxSpeed.value;
      panVelocity.value.y = (panVelocity.value.y / speed) * panMaxSpeed.value;
    }
  } else {
    // Decay velocity when no keys are pressed
    panVelocity.value.x *= panDecay.value;
    panVelocity.value.y *= panDecay.value;
  }
};

// Throttle pullback indicator checks during WASD panning
let lastPullbackCheck = 0;
let lastWorkspaceCheck = 0;
const PULLBACK_CHECK_INTERVAL = 100; // Check every 100ms during panning
const WORKSPACE_CHECK_INTERVAL = 200; // Check current workspace every 200ms

const applyPanning = () => {
  if (Math.abs(panVelocity.value.x) > 0.1 || Math.abs(panVelocity.value.y) > 0.1) {
    // Apply velocity-based panning with zoom compensation
    const zoomFactor = 1 / zoom.value; // Pan faster when zoomed out
    panX.value += panVelocity.value.x * zoomFactor;
    panY.value += panVelocity.value.y * zoomFactor;
    
    const now = performance.now();
    
    // Throttle expensive pullback indicator checks
    if (now - lastPullbackCheck > PULLBACK_CHECK_INTERVAL) {
      viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
      lastPullbackCheck = now;
    }
    
    // Update current workspace context when panning
    if (now - lastWorkspaceCheck > WORKSPACE_CHECK_INTERVAL) {
      updateCurrentWorkspace();
      lastWorkspaceCheck = now;
    }
  }
};

// Unfocus cluster visualization
const unfocusClusterViz = () => {
  store.isTransitioning = true;

  isClusterVizFocused.value = false;
  focusedTopicId.value = null;

  setTimeout(() => {
    store.isTransitioning = false;
    autoFitNodes();
  }, 700);
};

// Enhanced auto-fit for RTS perspective
const togglePanMode = () => {
  if (drawingStore.currentTool === 'hand') {
    drawingStore.setCurrentTool('cursor');
  } else {
    drawingStore.setCurrentTool('hand');
  }
};

const toggleGestureMode = () => {
  emit('update:gestureMode', props.gestureMode === 'zoom' ? 'scroll' : 'zoom');
};

// Calculate combined bounds of all canvas content (nodes + drawings)
const calculateCanvasBounds = () => {
  const nodeBounds = calculateNodeBounds(null);
  const shapes = drawingStore.shapes;
  
  // console.log('[calculateCanvasBounds] Node bounds:', nodeBounds, 'Shapes:', shapes.length);
  
  if (!nodeBounds && shapes.length === 0) {
    console.log('[calculateCanvasBounds] No bounds - no nodes and no shapes');
    return null;
  }
  
  let minX = nodeBounds?.minX ?? Infinity;
  let minY = nodeBounds?.minY ?? Infinity;
  let maxX = nodeBounds?.maxX ?? -Infinity;
  let maxY = nodeBounds?.maxY ?? -Infinity;
  
  // Include drawing shapes in bounds calculation
  shapes.forEach(shape => {
    if (shape.type === 'rectangle' || shape.type === 'diamond' || shape.type === 'circle' || shape.type === 'image' || shape.type === 'text') {
      minX = Math.min(minX, shape.x);
      minY = Math.min(minY, shape.y);
      maxX = Math.max(maxX, shape.x + (shape.width || 0));
      maxY = Math.max(maxY, shape.y + (shape.height || 0));
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      minX = Math.min(minX, shape.x, shape.x + (shape.width || 0));
      minY = Math.min(minY, shape.y, shape.y + (shape.height || 0));
      maxX = Math.max(maxX, shape.x, shape.x + (shape.width || 0));
      maxY = Math.max(maxY, shape.y, shape.y + (shape.height || 0));
    } else if (shape.type === 'pen' && shape.points) {
      shape.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    } else if (shape.type === 'fill') {
      // For fill shapes, estimate bounds from the click point
      minX = Math.min(minX, shape.x - 50);
      minY = Math.min(minY, shape.y - 50);
      maxX = Math.max(maxX, shape.x + 50);
      maxY = Math.max(maxY, shape.y + 50);
    }
  });
  
  if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
    return null;
  }
  
  return { minX, minY, maxX, maxY };
};

// Check if viewport is outside canvas bounds
const isViewportOutsideBounds = computed(() => {
  if (!canvasRef.value) return false;
  
  const bounds = calculateCanvasBounds();
  if (!bounds) return false;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const viewportLeft = -panX.value / zoom.value;
  const viewportTop = -panY.value / zoom.value;
  const viewportRight = (rect.width - panX.value) / zoom.value;
  const viewportBottom = (rect.height - panY.value) / zoom.value;
  
  // Check if viewport is completely outside content bounds with some margin
  const margin = 100; // pixels
  return viewportRight < bounds.minX - margin || 
         viewportLeft > bounds.maxX + margin ||
         viewportBottom < bounds.minY - margin ||
         viewportTop > bounds.maxY + margin;
});

const autoFitNodes = (disableTransition = false) => {
  console.log('[autoFitNodes] Called with conditions:', {
    hasCanvasRef: !!canvasRef.value,
    autoZoomEnabled: autoZoomEnabled.value,
    isDragging: store.isDragging,
    isPanning: isPanning.value,
    workspaceDragging: workspaceDragState.value.isDragging,
    nodeCount: store.nodes.length,
    nodeTypes: store.nodes.map(n => ({ id: n.id, type: n.type })),
    disableTransition
  });
  
  if (
    !canvasRef.value ||
    !autoZoomEnabled.value ||
    store.isDragging ||
    isPanning.value ||
    workspaceDragState.value.isDragging ||
    toolGroupDragState.value.isDragging
  ) {
    console.log('[autoFitNodes] Skipped due to conditions');
    return;
  }

  const bounds = isWorkspaceOverview.value ? calculateWorkspacesBounds() : calculateCanvasBounds();
  if (!bounds) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const padding = isWorkspaceOverview.value ? 120 : 200; // More padding for RTS view

  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;

  // Adjust for RTS perspective - account for vertical compression
  const adjustedContentHeight = contentHeight * RTS_SCALE_Y;

  // Reduce available width when right content panel is open (36vw panel)
  const availableWidth = appStore.isRightContentPanelOpen 
    ? rect.width * 0.64  // Use 64% of width (100% - 36% panel)
    : rect.width;

  const scaleX = availableWidth / contentWidth;
  const scaleY = rect.height / adjustedContentHeight;

  const newZoom = Math.min(scaleX, scaleY, 1);
  
  // Calculate content center position
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Calculate target center position on screen
  let targetCenterX = rect.width / 2;
  if (appStore.isRightContentPanelOpen) {
    // Center in the available 64% space (32% of total viewport width from left edge)
    targetCenterX = rect.width * 0.32; // 64% / 2 = 32%
  }

  isAutoZooming.value = true;
  if (!disableTransition) {
    store.isTransitioning = true;
  }

  zoom.value = newZoom;
  panX.value = targetCenterX - centerX * newZoom;
  panY.value = rect.height / 2 - centerY * newZoom;

  setTimeout(() => {
    isAutoZooming.value = false;
    if (!disableTransition) {
      store.isTransitioning = false;
    }
  }, 300);

  window.autoFitNodes = autoFitNodes;
};

// Initialize viewport return composable after autoFitNodes is declared
const viewportReturn = useViewportReturn(zoom, panX, panY, autoFitNodes, allWorkspaceNodes);

// Computed property for arrow rotation
const arrowRotation = computed(() => {
  const x = viewportReturn.directionToContent.value.x;
  const y = viewportReturn.directionToContent.value.y;
  const angle = Math.atan2(y, x) * 180 / Math.PI;
  return angle;
});

// Single computed property for clean Vue transitions
const shouldShowDistanceIndicator = computed(() => {
  const shouldShow = viewportReturn.showDistanceIndicator.value && 
                   !isWorkspaceOverview.value && 
                   !store.snappedNodeId && 
                   viewportReturn.hasInteracted.value;
  
  return shouldShow;
});

// Check if user is far from visible nodes
const checkDistanceFromNodes = () => {
  if (!canvasRef.value || !store.nodes.length || isWorkspaceOverview.value || isWelcomeScreen.value) {
    showFitButton.value = false;
    return;
  }

  const bounds = calculateNodeBounds(null);
  if (!bounds) {
    showFitButton.value = false;
    return;
  }

  const rect = canvasRef.value.getBoundingClientRect();
  const currentViewport = {
    left: -panX.value / zoom.value,
    top: -panY.value / zoom.value,
    right: (-panX.value + rect.width) / zoom.value,
    bottom: (-panY.value + rect.height) / zoom.value
  };

  const nodesBounds = {
    left: bounds.minX - 300, // Add buffer
    top: bounds.minY - 300,
    right: bounds.maxX + 300,
    bottom: bounds.maxY + 300
  };

  // Check if current viewport has significant overlap with nodes area
  const hasOverlap = !(
    currentViewport.right < nodesBounds.left ||
    currentViewport.left > nodesBounds.right ||
    currentViewport.bottom < nodesBounds.top ||
    currentViewport.top > nodesBounds.bottom
  );

  // Show button if no overlap or if zoomed out too much to see nodes clearly
  const isZoomedOutTooMuch = zoom.value < 0.3;
  showFitButton.value = !hasOverlap || isZoomedOutTooMuch;
};

// Reset workspace physics (placeholder function)
const resetWorkspacePhysics = () => {
  // Reset any physics-related state for workspaces
  // This can be expanded later if needed
  console.log('Workspace physics reset');
};

// Enhanced bounds calculation for RTS
const calculateWorkspacesBounds = () => {
  if (!chatStore.chats.length) return null;

  return chatStore.chats.reduce(
    (acc, workspace) => {
      // Adjust bounds for RTS perspective
      const adjustedY = workspace.y * RTS_SCALE_Y;

      return {
        minX: Math.min(acc.minX, workspace.x),
        maxX: Math.max(acc.maxX, workspace.x + 300),
        minY: Math.min(acc.minY, adjustedY),
        maxY: Math.max(acc.maxY, adjustedY + 200 * RTS_SCALE_Y),
      };
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    }
  );
};

// Workspace control methods
const updateWorkspaceViewMode = (mode: string) => {
  externalViewMode.value = mode;
};

const updateWorkspaceSortBy = (sortBy: string) => {
  externalSortBy.value = sortBy;
};

const updateWorkspaceCardSize = (size: number) => {
  externalCardSize.value = size;
};

const toggleWorkspaceFilters = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleFilters?.();
  }
};

const handleFilterStateUpdate = (hasFilters: boolean, count: number) => {
  // This will be passed back to App.vue to update the dock controls
  emit('update-filter-state', { hasFilters, count });
};

const handleGraphStatsUpdate = (stats: { topics: number; workspaces: number }) => {
  // Pass graph stats to App.vue for the unified controls dock
  emit('update-graph-stats', stats);
};

const handle3DSupportUpdate = (supported: boolean) => {
  emit('update-3d-support', supported);
};

const handleFullscreenUpdate = (fullscreen: boolean) => {
  emit('update-fullscreen', fullscreen);
};

// Graph control methods
const updateGraphLayout = (layout: string) => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.updateGraphLayout?.(layout);
  }
};

const toggleGraphControls = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleGraphControls?.();
  }
};

const resetGraph = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.resetGraph?.();
  }
};

const toggleFullscreen = () => {
  if (gridWorkspaceRef.value) {
    gridWorkspaceRef.value.toggleFullscreen?.();
  }
};

// Expose methods to parent component
defineExpose({
  autoFitNodes,
  isWorkspaceOverview,
  isWelcomeScreen,
  returnToOverview,
  showWorkspaceOverview,
  handleHeightLock,
  handleHeightUnlock,
  centerAndSnapNode,
  handleWorkspaceSelect,
  checkAndAutoSnapSingleBranch,
  handleNewWorkspace,
  getWelcomeInputRef,
  runPerformanceTest: () => perfTestPanel.value?.generateMockFlowers(),
  clearPerformanceTest: () => perfTestPanel.value?.clearMockFlowers(),
  updateWorkspaceViewMode,
  updateWorkspaceSortBy,
  updateWorkspaceCardSize,
  toggleWorkspaceFilters,
  updateGraphLayout,
  toggleGraphControls,
  resetGraph,
  toggleFullscreen
});

// Reset inactivity timer
const resetInactivityTimer = () => {
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }

  lastActivityTimestamp.value = Date.now();

  inactivityTimer.value = setTimeout(() => {
    if (Date.now() - lastActivityTimestamp.value >= AUTO_CENTER_DELAY) {
      autoFitNodes();
    }
  }, AUTO_CENTER_DELAY);
};

// Handle mouse movement
const handleMouseMove = (e) => {
  // Always check viewport return if panning, regardless of other conditions
  if (isPanning.value && lastPanPosition.value) {
    panX.value = e.clientX - lastPanPosition.value.x;
    panY.value = e.clientY - lastPanPosition.value.y;
    
    // No pan constraints needed
    
    viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
  }
  
  if (snappedNodeId.value !== null) return;
  if (isClusterVizFocused.value) return;
  
  // Check if drawing tool should handle this event
  if (handleDrawingMouseMove(e)) return;
  
  resetInactivityTimer();

  // Update mouse position for coordinate system display
  mousePosition.value = { x: e.clientX, y: e.clientY };

  const worldMousePos = getCanvasPosition(e);
  
  // Handle shape resizing
  if (resizeState.value.isResizing) {
    handleResizeMove(e);
    return;
  }

  // Handle shape dragging (and unified node+shape dragging)
  if (shapeDragState.value.isDragging) {
    const canvasPos = getCanvasPosition(e);
    const deltaX = canvasPos.x - shapeDragState.value.startMousePos.x;
    const deltaY = canvasPos.y - shapeDragState.value.startMousePos.y;
    
    // Update positions of all selected shapes
    drawingStore.selectedShapes.forEach(shape => {
      if (!shape.isLocked) {
        const startPos = shapeDragState.value.startShapePositions.get(shape.id);
        if (startPos) {
          shape.x = startPos.x + deltaX;
          shape.y = startPos.y + deltaY;
          
          // Update pen shape points if needed
          if (shape.type === 'pen' && shape.points && startPos.points) {
            shape.points = startPos.points.map(point => ({
              x: point.x + deltaX,
              y: point.y + deltaY
            }));
          }
        }
      }
    });
    
    // Also update positions of selected nodes when dragging shapes
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = shapeDragState.value.startNodePositions?.get(nodeId);
      if (node && startPos) {
        node.x = startPos.x + deltaX;
        node.y = startPos.y + deltaY;
      }
    });
    
    return;
  }

  // Handle tool group dragging
  if (toolGroupDragState.value.isDragging && toolGroupDragState.value.activeToolGroup) {
    const canvasPos = getCanvasPosition(e);
    const deltaX = canvasPos.x - toolGroupDragState.value.startMousePos.x;
    const deltaY = canvasPos.y - toolGroupDragState.value.startMousePos.y;
    
    const group = toolGroupDragState.value.activeToolGroup;
    
    // Update the group position
    const newGroupX = toolGroupDragState.value.startGroupPosition.x + deltaX;
    const newGroupY = toolGroupDragState.value.startGroupPosition.y + deltaY;
    
    // Update the fixed group position
    fixedGroupPositions.value.set(group.toolName, {
      x: newGroupX,
      y: newGroupY,
      width: group.width,
      height: group.height
    });
    
    // Move all nodes in the tool group
    group.nodes.forEach(node => {
      const startPos = toolGroupDragState.value.startNodePositions.get(node.id);
      if (startPos) {
        const newX = startPos.x + deltaX;
        const newY = startPos.y + deltaY;
        store.updateNodePosition(node.id, { x: newX, y: newY });
      }
    });
    
    return;
  }

  if (isMultiDragging.value && dragStartPosition.value) {
    console.log('Multi-dragging active, delta:', worldMousePos.x - dragStartPosition.value.x, worldMousePos.y - dragStartPosition.value.y);
    // Handle multi-node dragging (and unified node+shape dragging)
    const deltaX = worldMousePos.x - dragStartPosition.value.x;
    const deltaY = worldMousePos.y - dragStartPosition.value.y;

    // Apply delta to all selected nodes
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = multiDragStartPositions.value.get(nodeId);
      if (node && startPos) {
        store.updateNodePosition(nodeId, {
          x: startPos.x + deltaX,
          y: startPos.y + deltaY
        });
      }
    });
    
    // Also move selected shapes when dragging nodes
    drawingStore.selectedShapes.forEach(shape => {
      if (!shape.isLocked) {
        const startPos = multiDragShapePositions.value?.get(shape.id);
        if (startPos) {
          shape.x = startPos.x + deltaX;
          shape.y = startPos.y + deltaY;
          
          // Update pen shape points if needed
          if (shape.type === 'pen' && shape.points && startPos.points) {
            shape.points = startPos.points.map(point => ({
              x: point.x + deltaX,
              y: point.y + deltaY
            }));
          }
        }
      }
    });
  } else if (workspaceDragState.value.isDragging) {
    const { activeId, offset } = workspaceDragState.value;
    if (!activeId) return;

    const canvasRect = canvasRef.value.getBoundingClientRect();

    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    const workspace = workspaces.value.find(w => w.id === activeId);
    if (workspace) {
      workspace.x = canvasX - offset.x;
      workspace.y = canvasY - offset.y;
    }

  } else if (store.isDragging && store.activeNode) {
    const canvasRect = canvasRef.value.getBoundingClientRect();

    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    store.updateNodePosition(store.activeNode, {
      x: canvasX - store.dragOffset.x,
      y: canvasY - store.dragOffset.y,
    });
  } else if (selectionRect.value.isActive) {
    // Handle selection rectangle
    selectionRect.value.currentX = e.clientX;
    selectionRect.value.currentY = e.clientY;
    
    // Update selection in real-time
    updateSelectionFromRect();
  }
  
  // Check viewport return during any drag operations (non-panning, since panning is handled at the top)
  if (store.isDragging || isMultiDragging.value || shapeDragState.value.isDragging || workspaceDragState.value.isDragging || toolGroupDragState.value.isDragging) {
    viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
  }
};

// Selection rectangle functions
const updateSelectionFromRect = () => {
  if (!selectionRect.value.isActive) return;
  
  const rect = selectionRect.value;
  const left = Math.min(rect.startX, rect.currentX);
  const top = Math.min(rect.startY, rect.currentY);
  const right = Math.max(rect.startX, rect.currentX);
  const bottom = Math.max(rect.startY, rect.currentY);
  
  // Convert screen coordinates to world coordinates
  const topLeft = screenToWorld(left, top);
  const bottomRight = screenToWorld(right, bottom);
  
  // Approximate node dimensions (you may need to adjust these)
  const NODE_WIDTH = 672; // Standard card width
  const NODE_HEIGHT = 400; // Approximate card height
  
  // Find nodes whose bounding boxes intersect with the selection rectangle
  const nodesInRect = store.nodes.filter(node => {
    const nodeLeft = node.x;
    const nodeTop = node.y;
    const nodeRight = node.x + NODE_WIDTH;
    const nodeBottom = node.y + NODE_HEIGHT;
    
    // Check if rectangles intersect
    const intersects = !(nodeRight < topLeft.x || 
                        nodeLeft > bottomRight.x || 
                        nodeBottom < topLeft.y || 
                        nodeTop > bottomRight.y);
    
    return intersects;
  });
  
  // Update node selection
  console.log('Found', nodesInRect.length, 'nodes in selection rect');
  selectedNodeIds.value.clear();
  nodesInRect.forEach(node => {
    selectedNodeIds.value.add(node.id);
    console.log('Selected node:', node.id, node.title);
  });
  
  // Find drawing shapes that intersect with the selection rectangle
  const shapesInRect = drawingStore.shapes.filter(shape => {
    let shapeLeft = shape.x;
    let shapeTop = shape.y;
    let shapeRight = shape.x;
    let shapeBottom = shape.y;
    
    // Calculate bounding box based on shape type
    if (shape.type === 'rectangle' || shape.type === 'diamond' || shape.type === 'text' || shape.type === 'image') {
      shapeRight = shape.x + (shape.width || 0);
      shapeBottom = shape.y + (shape.height || 0);
    } else if (shape.type === 'circle') {
      const radius = shape.radius || 0;
      shapeLeft = shape.x - radius;
      shapeTop = shape.y - radius;
      shapeRight = shape.x + radius;
      shapeBottom = shape.y + radius;
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      shapeRight = shape.x + (shape.width || 0);
      shapeBottom = shape.y + (shape.height || 0);
      // Handle negative dimensions
      if (shape.width && shape.width < 0) {
        shapeLeft = shape.x + shape.width;
        shapeRight = shape.x;
      }
      if (shape.height && shape.height < 0) {
        shapeTop = shape.y + shape.height;
        shapeBottom = shape.y;
      }
    } else if (shape.type === 'pen' && shape.points) {
      // Get bounding box from all points
      const xs = shape.points.map(p => p.x);
      const ys = shape.points.map(p => p.y);
      shapeLeft = Math.min(...xs);
      shapeTop = Math.min(...ys);
      shapeRight = Math.max(...xs);
      shapeBottom = Math.max(...ys);
    } else if (shape.type === 'fill') {
      // For fill shapes, use estimated bounds
      shapeLeft = shape.x - 50;
      shapeTop = shape.y - 50;
      shapeRight = shape.x + 50;
      shapeBottom = shape.y + 50;
    }
    
    // Check if rectangles intersect
    const intersects = !(shapeRight < topLeft.x || 
                        shapeLeft > bottomRight.x || 
                        shapeBottom < topLeft.y || 
                        shapeTop > bottomRight.y);
    
    return intersects;
  });
  
  // Update shape selection
  drawingStore.clearSelection();
  shapesInRect.forEach(shape => {
    drawingStore.selectShape(shape.id, true); // true = add to selection
  });
};

const finishSelection = () => {
  if (selectionRect.value.isActive) {
    updateSelectionFromRect();
    selectionRect.value.isActive = false;
  }
};

const handleNodeExpansionChange = ({ nodeId, isExpanded }) => {
  if (isExpanded) {
    expandedNodes.value.add(nodeId);
  } else {
    expandedNodes.value.delete(nodeId);
  }
};

// Handle drag start for nodes
const handleDragStart = (e, node) => {
  // Check if this node is part of a multi-selection
  if (selectedNodeIds.value.has(node.id) && selectedNodeIds.value.size > 1) {
    // Start multi-drag
    isMultiDragging.value = true;
    multiDragStartPositions.value.clear();
    multiDragShapePositions.value.clear();
    
    // Save start positions for all selected nodes
    selectedNodeIds.value.forEach(nodeId => {
      const selectedNode = store.nodes.find(n => n.id === nodeId);
      if (selectedNode) {
        multiDragStartPositions.value.set(nodeId, { x: selectedNode.x, y: selectedNode.y });
      }
    });
    
    // Save start positions for all selected shapes
    drawingStore.selectedShapes.forEach(shape => {
      if (shape.type === 'pen' && shape.points) {
        // For pen shapes, store the original points
        multiDragShapePositions.value.set(shape.id, {
          x: shape.x,
          y: shape.y,
          points: shape.points.map(p => ({ x: p.x, y: p.y }))
        });
      } else {
        multiDragShapePositions.value.set(shape.id, { x: shape.x, y: shape.y });
      }
    });
    
    // Save drag start position in world coordinates
    const canvasRect = canvasRef.value.getBoundingClientRect();
    const worldX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const worldY = (e.clientY - canvasRect.top - panY.value) / zoom.value;
    dragStartPosition.value = { x: worldX, y: worldY };
  } else {
    // Single node drag
    store.isDragging = true;
    store.activeNode = node.id;

    // Save the initial position for undo
    dragStartPosition.value = {
      nodeId: node.id,
      x: node.x,
      y: node.y
    };

    const canvasRect = canvasRef.value.getBoundingClientRect();

    const canvasX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
    const canvasY = (e.clientY - canvasRect.top - panY.value) / zoom.value;

    store.dragOffset = {
      x: canvasX - node.x,
      y: canvasY - node.y,
    };
  }
};

// Handle topic selection
const handleTopicSelect = (topicId: string) => {
  focusedTopicId.value = topicId;
  centerOnNode(topicId);
};

// Combined drag handlers removed - using the ones at lines 1644+ which handle both media and conversation imports

// Active state checks
const isNodeFocused = (nodeId) => focusedNodeId.value === nodeId;

const isConnectionActive = (parentId, childId) => {
  // Always return true to make the glow effect default for all splines
  return true;
};

// Canvas zoom entry animation for smooth transition from welcome screen
const startCanvasZoomEntryAnimation = async () => {
  if (!store.nodes || store.nodes.length === 0) return;
  
  console.log('[InfiniteCanvas] Starting canvas zoom entry animation');
  
  // Calculate bounds of all nodes
  const padding = 100;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  store.nodes.forEach(node => {
    const nodeWidth = 400; // Approximate node width
    const nodeHeight = 300; // Approximate node height
    
    minX = Math.min(minX, node.x - nodeWidth / 2);
    maxX = Math.max(maxX, node.x + nodeWidth / 2);
    minY = Math.min(minY, node.y - nodeHeight / 2);
    maxY = Math.max(maxY, node.y + nodeHeight / 2);
  });
  
  // Calculate optimal zoom and center position
  const sidePanelWidth = props.sidePanelOpen ? windowSize.value.width * 0.5 : 0;
  const containerWidth = windowSize.value.width - sidePanelWidth;
  const containerHeight = windowSize.value.height;
  
  const contentWidth = maxX - minX + padding * 2;
  const contentHeight = maxY - minY + padding * 2;
  
  const optimalZoom = Math.min(
    containerWidth / contentWidth,
    containerHeight / contentHeight,
    1.0 // Don't zoom in beyond 100%
  );
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Start animation from maximum zoom at center
  const startZoom = 3.0; // Start very zoomed in
  const startX = centerX;
  const startY = centerY;
  
  // Set initial state
  viewport.value.zoom = startZoom;
  viewport.value.x = -startX * startZoom + containerWidth / 2;
  viewport.value.y = -startY * startZoom + containerHeight / 2;
  
  // Calculate target position
  const targetX = -centerX * optimalZoom + containerWidth / 2;
  const targetY = -centerY * optimalZoom + containerHeight / 2;
  
  // Animate to optimal zoom and position
  const duration = 1500; // 1.5 seconds
  const startTime = Date.now();
  
  const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutExpo(progress);
    
    // Interpolate zoom and position
    viewport.value.zoom = startZoom + (optimalZoom - startZoom) * easedProgress;
    viewport.value.x = viewport.value.x + (targetX - viewport.value.x) * easedProgress * 0.1;
    viewport.value.y = viewport.value.y + (targetY - viewport.value.y) * easedProgress * 0.1;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Final position
      viewport.value.zoom = optimalZoom;
      viewport.value.x = targetX;
      viewport.value.y = targetY;
      
      console.log('[InfiniteCanvas] Zoom entry animation completed');
      
      // Disabled auto-snap - keep nodes at their created positions
      // setTimeout(() => {
      //   const autoSnapped = checkAndAutoSnapSingleBranch();
      //   if (!autoSnapped && store.nodes.length > 0) {
      //     // Animation already positioned optimally, no need for additional auto-fit
      //   }
      // }, 100);
    }
  };
  
  requestAnimationFrame(animate);
};

// Listen for external workspace loads (from WorkspaceMenu, etc.)
emitter.on('workspace-loaded-external', () => {
  console.log('[InfiniteCanvas] External workspace load detected');
  // Disabled auto-snap - keep nodes at their created positions
  // nextTick(() => {
  //   setTimeout(() => {
  //     checkAndAutoSnapSingleBranch();
  //   }, 100); // Small delay to ensure nodes are loaded
  // });
});

// Listen for workspace loads from canvas store (from ChatHistoryFeature, etc.)
emitter.on('workspace-loaded', (data: { chatId: string; nodeCount: number }) => {
  console.log(`[InfiniteCanvas] Workspace loaded from store: ${data.chatId} (${data.nodeCount} nodes)`);
  
  // Only transition if we're still on welcome screen (avoid double transitions)
  if (isWelcomeScreen.value) {
    console.log(`[InfiniteCanvas] Transitioning from welcome screen with zoom animation`);
    isWelcomeScreen.value = false;
    
    // Start canvas zoom entry animation
    nextTick(() => {
      setTimeout(() => {
        startCanvasZoomEntryAnimation();
      }, 300); // Start zoom animation while exit animation is happening
    });
  } else {
    // Normal workspace loading without zoom animation
    nextTick(() => {
      setTimeout(() => {
        // Disabled auto-snap - just auto-fit to show all nodes
        // const autoSnapped = checkAndAutoSnapSingleBranch();
        // console.log(`[InfiniteCanvas] Auto-snap result: ${autoSnapped}`);
        
        // Always auto-fit nodes after workspace load (no auto-snap, no transition to prevent slide-in)
        if (store.nodes.length > 0) {
          console.log('[InfiniteCanvas] Calling autoFitNodes after workspace load');
          autoFitNodes(true);
        }
      }, 100);
    });
  }
});

// Listen for node detach/attach events
const potentialDropTargets = ref(new Set<string>());
const invalidDropTargets = ref(new Set<string>());

emitter.on('node-detach-start', (data: { nodeId: string; parentId: string }) => {
  // Get valid drop targets
  fetch(`/chats/${store.currentChatId}/nodes/${data.nodeId}/valid-parents`)
    .then(res => res.json())
    .then(result => {
      potentialDropTargets.value.clear();
      invalidDropTargets.value.clear();
      
      // Mark all nodes as either valid or invalid
      store.nodes.forEach(node => {
        const isValid = result.valid_parents.some((vp: any) => vp.id === node.id);
        if (isValid) {
          potentialDropTargets.value.add(node.id);
        } else if (node.id !== data.nodeId) {
          invalidDropTargets.value.add(node.id);
        }
      });
    });
});

emitter.on('node-detach-move', (data: { nodeId: string; position: { x: number; y: number } }) => {
  // Could add proximity highlighting here
});

emitter.on('node-detach-end', () => {
  potentialDropTargets.value.clear();
  invalidDropTargets.value.clear();
});

// Component lifecycle
onMounted(async () => {
  if (isBrowser) {
    // Load all workspaces as nodes on the infinite canvas
    await loadAllWorkspaces();

    store.nodes.forEach(node => {
      expandedNodes.value.add(node.id);
    });

    // Migrate existing connections to new system
    store.migrateConnectionsToNewSystem();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    if (canvasRef.value) {
      canvasRef.value.addEventListener("wheel", handleWheel, {
        passive: false,
      });
    }

    window.autoFitNodes = autoFitNodes;
    window.resetWorkspacePhysics = resetWorkspacePhysics;

    window.addEventListener("resize", () => {
      windowSize.value.width = window.innerWidth;
      windowSize.value.height = window.innerHeight;
      // Re-render grid on window resize
      nextTick(() => renderGrid());
    });

    // Initialize grid rendering
    nextTick(() => renderGrid());
    
    // Ensure grid renders after canvas is properly sized
    setTimeout(() => {
      console.log('[InfiniteCanvas] Delayed grid render to ensure canvas dimensions');
      renderGrid();
    }, 500);
    
    // Input container now positioned at fixed coordinate, no special centering needed

    // Setup theme watcher for grid
    setupThemeWatcher();
    
    // Listen for tool grouping toggle
    const handleToolGroupingChange = (e: CustomEvent) => {
      showToolGrouping.value = e.detail.showToolGrouping;
      if (showToolGrouping.value) {
        // Organize tool nodes when grouping is enabled
        setTimeout(() => organizeToolNodes(), 100);
      }
    };
    document.addEventListener('tool-grouping-changed', handleToolGroupingChange);

    // Initialize model registry
    updateModelRegistry();

    // Simulate loading progress for modern UI
    const interval = setInterval(() => {
      loadingProgress.value += Math.random() * 10;
      if (loadingProgress.value >= 100) {
        loadingProgress.value = 100;
        clearInterval(interval);
      }
    }, 100);

    if (isBrowser && !isInitializing.value) {
      isInitializing.value = true;
      try {
        await chatStore.loadChats();

        if (isWorkspaceOverview.value) {
          // Grid view setup complete
          if (store.nodes.length) {
            centerCanvas();
          }
        } else if (isWelcomeScreen.value) {
          // Always center on input container when in welcome screen mode
          console.log('[onMounted] Centering on input container for welcome screen', {
            currentPanX: panX.value,
            currentPanY: panY.value,
            currentZoom: zoom.value,
            isWelcomeScreen: isWelcomeScreen.value,
            nodeCount: store.nodes.length
          });
          
          // First set the zoom and pan directly for immediate positioning
          const rect = canvasRef.value?.getBoundingClientRect();
          if (rect) {
            // Calculate correct pan values for 120% zoom to center input container at (-3000, -3000)
            const NEW_CHAT_X = -3000;
            const NEW_CHAT_Y = -3000;
            const targetZoom = 1.2; // 120% zoom (much more comfortable)
            
            // Calculate pan values to center the input container coordinate on screen
            const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
            const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
            
            // Set values directly first
            zoom.value = targetZoom;
            panX.value = targetPanX;
            panY.value = targetPanY;
            
            console.log('[onMounted] Set initial position directly:', {
              zoom: zoom.value,
              panX: panX.value,
              panY: panY.value
            });
          }
          
          await nextTick();
          // Still call centerOnInputContainer for any additional smoothing
          await centerOnInputContainer();
        } else if (store.nodes.length) {
          // Auto-center on nodes when workspace loads (not in welcome screen)
          console.log('[onMounted] Auto-centering on existing nodes');
          await nextTick();
          autoFitNodes(true);
        } else {
          // No nodes and not in workspace overview - should be in welcome screen mode
          console.log('[onMounted] No nodes found, forcing welcome screen mode', {
            isWorkspaceOverview: isWorkspaceOverview.value,
            isWelcomeScreen: isWelcomeScreen.value,
            nodeCount: store.nodes.length
          });
          
          // Force welcome screen mode when there are no nodes
          if (!isWelcomeScreen.value) {
            isWelcomeScreen.value = true;
          }
          
          // Set the same values as welcome screen mode
          const rect = canvasRef.value?.getBoundingClientRect();
          if (rect) {
            // Calculate correct pan values for 120% zoom to center input container at (-3000, -3000)
            const NEW_CHAT_X = -3000;
            const NEW_CHAT_Y = -3000;
            const targetZoom = 1.2; // 120% zoom (much more comfortable)
            
            // Calculate pan values to center the input container coordinate on screen
            const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
            const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
            
            // Set values directly
            zoom.value = targetZoom;
            panX.value = targetPanX;
            panY.value = targetPanY;
            
            console.log('[onMounted] Set default input container position:', {
              zoom: zoom.value,
              panX: panX.value,
              panY: panY.value
            });
          }
        }

        resetInactivityTimer();
      } finally {
        isInitializing.value = false;
      }
    }
  }
});

// Watch for zoom and pan changes to re-render grid
// PERFORMANCE: Add throttling to prevent excessive grid re-renders
let gridRenderPending = false;
watch([() => zoom.value, () => panX.value, () => panY.value], () => {
  if (!gridRenderPending) {
    gridRenderPending = true;
    requestAnimationFrame(() => {
      renderGrid();
      gridRenderPending = false;
    });
  }
}, { flush: 'post' });

// Watch for theme changes to re-render grid with new colors
let themeObserver: MutationObserver | null = null;

const setupThemeWatcher = () => {
  themeObserver = new MutationObserver(() => {
    requestAnimationFrame(() => renderGrid());
  });
  
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  });
};

// Theme watcher is now setup in the main onMounted hook above

// Debug: Watch selectedNodeIds changes
watch(() => selectedNodeIds.value.size, (newSize, oldSize) => {
  console.log(`Selected nodes changed: ${oldSize} -> ${newSize}`, Array.from(selectedNodeIds.value));
  if (newSize > 1) {
    console.log('Should show selection boundary for', newSize, 'nodes');
    console.log('nodeSelectionBounds computed:', nodeSelectionBounds.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  
  // Clean up WASD panning animation
  stopPanAnimation();
  
  // Clean up theme observer
  if (themeObserver) {
    themeObserver.disconnect();
  }
  // Clean up event listeners
  emitter.off('workspace-loaded-external');
  
  // Clean up intersection observer
  store.nodes.forEach(node => {
    unobserve(node.id);
  });

  // Clean up any stuck transition overlays
  const stuckOverlays = document.querySelectorAll('.overview-transition-overlay');
  stuckOverlays.forEach(overlay => {
    try {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    } catch (error) {
      console.warn('Failed to remove stuck overlay:', error);
    }
  });
  
  // Clean up body classes
  document.body.classList.remove('transition-blur');
});

// Tool Call Node Functions - REMOVED: Now using compact nodes from database instead


// Position calculation functions - REMOVED: Using database compact nodes instead

// Event handlers for old node types - REMOVED: Using compact nodes instead

// Compact tool call handlers
function handleToolCallCompactClick(toolCall) {
  console.log('Compact tool call clicked:', toolCall)
  // Open the Claude Code feature panel with tool details
  emit('tool-call-selected', toolCall)
}

function handleToolCallCompactDoubleClick(toolCall) {
  console.log('Compact tool call double clicked:', toolCall)
  // Show detailed information in Claude Code panel
  emit('tool-call-selected', toolCall)
}

// Old file and execution node handlers - REMOVED: Using compact nodes instead

// Execution node rerun handler - REMOVED: Using compact nodes instead


// Load tool call data when nodes become visible - debounced to prevent excessive API calls
const debouncedFetchToolCallData = debounce((newNodes) => {
  // Skip if transitioning to prevent API bombardment during zoom animations
  if (isTransitioning.value) {
    return;
  }
  
  newNodes.forEach(node => {
    // Only fetch if we haven't already fetched for this node
    const hasToolCalls = toolCallStore.toolCalls.has(node.id);
    const hasFileNodes = toolCallStore.fileNodes.has(node.id);
    const hasExecutionNodes = toolCallStore.executionNodes.has(node.id);
    
    // Only fetch if we haven't fetched any data for this node yet
    if (!hasToolCalls && !hasFileNodes && !hasExecutionNodes) {
      toolCallStore.fetchAllForNode(node.id)
    }
  })
}, 1000); // 1000ms debounce for better performance during rapid changes

// Clean up debounced function on unmount
onBeforeUnmount(() => {
  debouncedFetchToolCallData.cancel();
});

// Optimized watcher - only clear cache and fetch when node IDs actually change
watch(
  () => visibleNodes.value.length > 0 ? visibleNodes.value.map(n => n.id).sort().join(',') : '',
  (newNodeIds, oldNodeIds) => {
    // Only process if node IDs actually changed
    if (!newNodeIds || newNodeIds === oldNodeIds) return;
    
    // Clear parent node cache when visible nodes change
    parentNodeCache.clear();
    
    // Only fetch when not dragging, panning, or transitioning to avoid spamming API
    if (!store.isDragging && !isPanning.value && !isTransitioning.value) {
      debouncedFetchToolCallData(visibleNodes.value);
    }
  }
);

// Drawing functionality
const getCanvasPosition = (e: MouseEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  
  // Convert screen coordinates to canvas coordinates
  const x = (e.clientX - rect.left - panX.value) / zoom.value;
  const y = (e.clientY - rect.top - panY.value) / zoom.value;
  
  return { x, y };
};

const getPathData = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
};

const handleShapeClick = (shapeId: string, event?: MouseEvent) => {
  event?.stopPropagation(); // Prevent event from bubbling up to canvas
  
  if (drawingStore.currentTool === 'cursor') {
    const addToSelection = event?.shiftKey || event?.ctrlKey || event?.metaKey;
    drawingStore.selectShape(shapeId, addToSelection);
  } else if (drawingStore.currentTool === 'eraser') {
    // Delete the shape immediately when eraser tool is active
    drawingStore.deleteShape(shapeId);
  }
};

const handleShapeMouseDown = (shapeId: string, event: MouseEvent) => {
  event.stopPropagation();
  
  if (drawingStore.currentTool !== 'cursor') {
    return;
  }
  
  // Select the shape if not already selected
  if (!drawingStore.selectedShapeIds.includes(shapeId)) {
    const addToSelection = event.shiftKey || event.ctrlKey || event.metaKey;
    drawingStore.selectShape(shapeId, addToSelection);
  }
  
  startShapeDragging(event);
};

const handleSelectionBoundaryMouseDown = (event: MouseEvent) => {
  event.stopPropagation();
  
  if (drawingStore.currentTool !== 'cursor') {
    return;
  }
  
  startShapeDragging(event);
};

// Node selection boundary handler
const handleNodeSelectionBoundaryMouseDown = (event: MouseEvent) => {
  event.stopPropagation();
  
  console.log('Node selection boundary clicked! Selected nodes:', selectedNodeIds.value.size);
  
  // Start multi-node dragging
  if (selectedNodeIds.value.size > 1) {
    isMultiDragging.value = true;
    multiDragStartPositions.value.clear();
    multiDragShapePositions.value.clear();
    
    // Store starting positions for all selected nodes
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      if (node) {
        multiDragStartPositions.value.set(nodeId, { x: node.x, y: node.y });
      }
    });
    
    // Store starting positions for all selected shapes too (unified dragging)
    drawingStore.selectedShapes.forEach(shape => {
      if (shape.type === 'pen' && shape.points) {
        multiDragShapePositions.value.set(shape.id, {
          x: shape.x,
          y: shape.y,
          points: shape.points.map(p => ({ x: p.x, y: p.y }))
        });
      } else {
        multiDragShapePositions.value.set(shape.id, { x: shape.x, y: shape.y });
      }
    });

    // This is crucial - set the drag start position for mouse move calculations
    const canvasPos = getCanvasPosition(event);
    dragStartPosition.value = { x: canvasPos.x, y: canvasPos.y };
    console.log('Started multi-node drag from position:', dragStartPosition.value);
  }
};

// Handle double-click on node selection boundary to collapse into collection
const handleNodeSelectionBoundaryDoubleClick = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
  
  if (selectedNodeIds.value.size < 2) return;
  
  console.log('Double-clicked boundary, collapsing', selectedNodeIds.value.size, 'nodes');
  
  // Calculate center position of selected nodes
  const selectedNodes = Array.from(selectedNodeIds.value)
    .map(id => store.nodes.find(n => n.id === id))
    .filter(node => node);
    
  if (selectedNodes.length < 2) return;
  
  let centerX = 0, centerY = 0;
  selectedNodes.forEach(node => {
    centerX += node.x + 150; // Approximate center of node
    centerY += node.y + 100;
  });
  centerX /= selectedNodes.length;
  centerY /= selectedNodes.length;
  
  // Create collapsed collection
  const collectionId = nextCollectionId.value++;
  collapsedCollections.value.set(collectionId, {
    nodeIds: new Set(selectedNodeIds.value),
    position: { x: centerX, y: centerY },
    currentIndex: 0,
    title: `Collection (${selectedNodes.length} nodes)`
  });
  
  // Hide selected nodes (make them invisible but keep in store)
  selectedNodeIds.value.forEach(nodeId => {
    const node = store.nodes.find(n => n.id === nodeId);
    if (node) {
      node.isCollapsed = true; // Add a flag to track collapsed state
    }
  });
  
  // Clear selection
  selectedNodeIds.value.clear();
  
  console.log('Created collection', collectionId, 'at position', centerX, centerY);
};

// Handle tool group rectangle mouse down for dragging
const handleToolGroupRectMouseDown = (event: MouseEvent, group: any) => {
  event.stopPropagation();
  
  console.log('Tool group rectangle clicked for dragging:', group.toolName);
  
  // Start dragging the tool group and its nodes
  const canvasPos = getCanvasPosition(event);
  toolGroupDragState.value.isDragging = true;
  toolGroupDragState.value.activeToolGroup = group;
  toolGroupDragState.value.startMousePos = { x: canvasPos.x, y: canvasPos.y };
  toolGroupDragState.value.startGroupPosition = { x: group.x, y: group.y };
  
  // Store starting positions of all nodes in this tool group
  toolGroupDragState.value.startNodePositions.clear();
  group.nodes.forEach(node => {
    toolGroupDragState.value.startNodePositions.set(node.id, { x: node.x, y: node.y });
  });
};



const startShapeDragging = (event: MouseEvent) => {
  // Start dragging
  const canvasPos = getCanvasPosition(event);
  shapeDragState.value.isDragging = true;
  shapeDragState.value.activeShapeId = null; // No specific shape when dragging boundary
  shapeDragState.value.startMousePos = { x: canvasPos.x, y: canvasPos.y };
  
  // Store starting positions of all selected shapes
  shapeDragState.value.startShapePositions.clear();
  drawingStore.selectedShapes.forEach(shape => {
    if (shape.type === 'pen' && shape.points) {
      // For pen shapes, store the original points
      shapeDragState.value.startShapePositions.set(shape.id, {
        x: shape.x,
        y: shape.y,
        points: shape.points.map(p => ({ x: p.x, y: p.y }))
      });
    } else {
      shapeDragState.value.startShapePositions.set(shape.id, { x: shape.x, y: shape.y });
    }
  });
  
  // Store starting positions of all selected nodes for unified dragging
  if (!shapeDragState.value.startNodePositions) {
    shapeDragState.value.startNodePositions = new Map();
  }
  shapeDragState.value.startNodePositions.clear();
  selectedNodeIds.value.forEach(nodeId => {
    const node = store.nodes.find(n => n.id === nodeId);
    if (node) {
      shapeDragState.value.startNodePositions.set(nodeId, { x: node.x, y: node.y });
    }
  });
};

// Tool group drag handlers
const handleToolGroupMouseDown = (event: MouseEvent, group: any) => {
  // Only handle tool group dragging if not using selection functionality
  if (isShiftPressed.value) {
    // Let the canvas handle selection rectangle
    return;
  }
  
  event.stopPropagation();
  
  // Start dragging the tool group and its nodes
  const canvasPos = getCanvasPosition(event);
  toolGroupDragState.value.isDragging = true;
  toolGroupDragState.value.activeToolGroup = group;
  toolGroupDragState.value.startMousePos = { x: canvasPos.x, y: canvasPos.y };
  toolGroupDragState.value.startGroupPosition = { x: group.x, y: group.y };
  
  // Store starting positions of all nodes in this tool group
  toolGroupDragState.value.startNodePositions.clear();
  group.nodes.forEach(node => {
    toolGroupDragState.value.startNodePositions.set(node.id, { x: node.x, y: node.y });
  });
  
  console.log('Started dragging tool group:', group.toolName, 'with', group.nodes.length, 'nodes');
};

// Shape resize handlers
const handleResizeStart = (event: MouseEvent, shapeId: string, handle: string) => {
  event.stopPropagation();
  
  if (drawingStore.currentTool !== 'cursor') {
    return;
  }
  
  const shape = drawingStore.shapes.find(s => s.id === shapeId);
  if (!shape) return;
  
  const canvasPos = getCanvasPosition(event);
  resizeState.value.isResizing = true;
  resizeState.value.shapeId = shapeId;
  resizeState.value.handle = handle;
  resizeState.value.startMousePos = { x: canvasPos.x, y: canvasPos.y };
  resizeState.value.originalShape = { ...shape };
  
  // Clone points for pen shapes
  if (shape.type === 'pen' && shape.points) {
    resizeState.value.originalShape.points = shape.points.map(p => ({ x: p.x, y: p.y }));
  }
};

const handleResizeMove = (event: MouseEvent) => {
  if (!resizeState.value.isResizing || !resizeState.value.shapeId) return;
  
  const shape = drawingStore.shapes.find(s => s.id === resizeState.value.shapeId);
  if (!shape || !resizeState.value.originalShape) return;
  
  const canvasPos = getCanvasPosition(event);
  const deltaX = canvasPos.x - resizeState.value.startMousePos.x;
  const deltaY = canvasPos.y - resizeState.value.startMousePos.y;
  const handle = resizeState.value.handle;
  const original = resizeState.value.originalShape;
  
  if (shape.type === 'rectangle' || shape.type === 'diamond') {
    // Handle rectangle/diamond resizing
    switch (handle) {
      case 'nw':
        shape.x = original.x + deltaX;
        shape.y = original.y + deltaY;
        shape.width = Math.max(10, original.width - deltaX);
        shape.height = Math.max(10, original.height - deltaY);
        break;
      case 'ne':
        shape.y = original.y + deltaY;
        shape.width = Math.max(10, original.width + deltaX);
        shape.height = Math.max(10, original.height - deltaY);
        break;
      case 'sw':
        shape.x = original.x + deltaX;
        shape.width = Math.max(10, original.width - deltaX);
        shape.height = Math.max(10, original.height + deltaY);
        break;
      case 'se':
        shape.width = Math.max(10, original.width + deltaX);
        shape.height = Math.max(10, original.height + deltaY);
        break;
      case 'n':
        shape.y = original.y + deltaY;
        shape.height = Math.max(10, original.height - deltaY);
        break;
      case 's':
        shape.height = Math.max(10, original.height + deltaY);
        break;
      case 'w':
        shape.x = original.x + deltaX;
        shape.width = Math.max(10, original.width - deltaX);
        break;
      case 'e':
        shape.width = Math.max(10, original.width + deltaX);
        break;
    }
  } else if (shape.type === 'circle') {
    // Handle circle resizing
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const isExpanding = (handle === 'e' && deltaX > 0) || (handle === 'w' && deltaX < 0) || 
                      (handle === 'n' && deltaY < 0) || (handle === 's' && deltaY > 0);
    
    if (isExpanding) {
      shape.radius = Math.max(5, original.radius + distance);
    } else {
      shape.radius = Math.max(5, original.radius - distance);
    }
  } else if (shape.type === 'line' || shape.type === 'arrow') {
    // Handle line/arrow resizing
    if (handle === 'start') {
      const endX = original.x + (original.width || 0);
      const endY = original.y + (original.height || 0);
      shape.x = original.x + deltaX;
      shape.y = original.y + deltaY;
      shape.width = endX - shape.x;
      shape.height = endY - shape.y;
    } else if (handle === 'end') {
      shape.width = (original.width || 0) + deltaX;
      shape.height = (original.height || 0) + deltaY;
    }
  }
};

const handleResizeEnd = () => {
  if (resizeState.value.isResizing) {
    drawingStore.saveToHistory();
    resizeState.value.isResizing = false;
    resizeState.value.shapeId = null;
    resizeState.value.handle = null;
    resizeState.value.originalShape = null;
  }
};

// Text shape creation
const createTextShape = (x: number, y: number) => {
  const newShape = {
    id: `shape-${Date.now()}-${Math.random()}`,
    type: 'text' as const,
    x,
    y,
    width: 100,
    height: 20,
    text: 'Double click to edit',
    strokeColor: drawingStore.strokeColor,
    fillColor: drawingStore.fillColor,
    strokeWidth: drawingStore.strokeWidth,
    opacity: drawingStore.opacity,
    rotation: 0,
    isSelected: false,
    isLocked: false,
    zIndex: drawingStore.shapes.length
  };
  
  drawingStore.shapes.push(newShape);
  drawingStore.saveToHistory();
  
  // Auto-select the new text shape and switch to cursor tool
  drawingStore.clearSelection();
  drawingStore.selectShape(newShape.id);
  drawingStore.setCurrentTool('cursor');
  
  // Start editing the text
  nextTick(() => {
    startTextEditing(newShape.id);
  });
};

// Text editing state
const textEditState = ref({
  isEditing: false,
  shapeId: null as string | null,
  inputElement: null as HTMLInputElement | null
});

const startTextEditing = (shapeId: string) => {
  const shape = drawingStore.shapes.find(s => s.id === shapeId);
  if (!shape || shape.type !== 'text') return;
  
  textEditState.value.isEditing = true;
  textEditState.value.shapeId = shapeId;
  
  // Create a temporary input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = shape.text || '';
  input.style.position = 'absolute';
  input.style.left = `${shape.x * zoom.value + panX.value}px`;
  input.style.top = `${shape.y * zoom.value + panY.value}px`;
  input.style.fontSize = `${16 * zoom.value}px`;
  input.style.border = '2px solid rgba(59, 130, 246, 0.8)';
  input.style.background = 'white';
  input.style.zIndex = '1000';
  input.style.fontFamily = 'Arial, sans-serif';
  
  document.body.appendChild(input);
  textEditState.value.inputElement = input;
  
  input.focus();
  input.select();
  
  const finishEdit = () => {
    if (textEditState.value.isEditing && textEditState.value.shapeId) {
      const editShape = drawingStore.shapes.find(s => s.id === textEditState.value.shapeId);
      if (editShape && editShape.type === 'text') {
        editShape.text = input.value || 'Text';
        // Update shape width based on text length (rough estimate)
        editShape.width = Math.max(50, input.value.length * 10);
        drawingStore.saveToHistory();
      }
    }
    
    if (textEditState.value.inputElement) {
      document.body.removeChild(textEditState.value.inputElement);
    }
    
    textEditState.value.isEditing = false;
    textEditState.value.shapeId = null;
    textEditState.value.inputElement = null;
  };
  
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      finishEdit();
    }
    e.stopPropagation(); // Prevent canvas key handlers
  });
};

// Text double-click handler
const handleTextDoubleClick = (shapeId: string, event: MouseEvent) => {
  event.stopPropagation();
  
  if (drawingStore.currentTool === 'cursor') {
    startTextEditing(shapeId);
  }
};

// Drawing event handlers - integrate with existing canvas events
const handleDrawingMouseDown = (e: MouseEvent) => {
  if (drawingStore.currentTool === 'cursor' || drawingStore.currentTool === 'hand') {
    return false; // Let original canvas handle it
  }
  
  // Drawing tool is active
  e.preventDefault();
  e.stopPropagation();
  
  const pos = getCanvasPosition(e);
  
  // Handle fill tool specially - perform flood fill
  if (drawingStore.currentTool === 'fill') {
    performFloodFillOnCanvas(pos.x, pos.y);
    return true;
  }
  
  // Handle text tool specially - create text immediately
  if (drawingStore.currentTool === 'text') {
    createTextShape(pos.x, pos.y);
    return true;
  }
  
  drawingStore.startDrawing(pos.x, pos.y);
  return true; // Handled by drawing
};

const handleDrawingMouseMove = (e: MouseEvent) => {
  if (drawingStore.isDrawing) {
    const pos = getCanvasPosition(e);
    drawingStore.updateDrawing(pos.x, pos.y);
    return true; // Handled by drawing
  }
  return false; // Let original canvas handle it
};

const handleDrawingMouseUp = (e: MouseEvent) => {
  if (drawingStore.isDrawing) {
    drawingStore.finishDrawing();
    return true; // Handled by drawing
  }
  return false; // Let original canvas handle it
};

// Flood fill helper function that creates a virtual canvas for the algorithm
const performFloodFillOnCanvas = (x: number, y: number) => {
  console.log('performFloodFillOnCanvas called with coordinates:', x, y);
  console.log('Current shapes:', drawingStore.shapes.length);
  
  // Create a virtual canvas for flood fill processing
  const canvas = document.createElement('canvas');
  
  // Set a reasonable canvas size
  canvas.width = 2000;
  canvas.height = 2000;
  
  console.log('Canvas size:', canvas.width, 'x', canvas.height);
  
  try {
    const success = drawingStore.performFloodFill(x, y, canvas);
    if (success) {
      console.log('Flood fill completed successfully');
    } else {
      console.log('No enclosed area found to fill');
    }
  } catch (error) {
    console.error('Error performing flood fill:', error);
  }
};

// TopicIslandView event handlers
const handleNavigateToIsland = async (island: any) => {
  try {
    // Zoom to the island with smooth animation
    const targetZoom = 0.3 // Zoom to show the island clearly
    const targetPanX = (canvasRef.value?.clientWidth || 800) / 2 - island.x * targetZoom
    const targetPanY = (canvasRef.value?.clientHeight || 600) / 2 - island.y * targetZoom
    
    // Use the smooth animation function
    viewportReturn.animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 800)
    
  } catch (error) {
    console.error('Error navigating to island:', error)
  }
}

const handleZoomToOverview = () => {
  try {
    // Zoom out to show all content
    if (autoFitNodes) {
      autoFitNodes()
    }
  } catch (error) {
    console.error('Error zooming to overview:', error)
  }
}

const handleNavigateToWorkspace = (workspaceId: string) => {
  console.log('Navigating to workspace:', workspaceId);
  // Navigate to the workspace
  router.push(`/chat/${workspaceId}`);
};
</script>

<style scoped>
/* Prevent browser navigation gestures */
.enhanced-infinite-canvas {
  touch-action: none;
  overscroll-behavior: none;
  overscroll-behavior-x: none;
  overscroll-behavior-y: none;
  -webkit-overscroll-behavior: none;
  -webkit-overscroll-behavior-x: none;
  -webkit-overscroll-behavior-y: none;
}

/* Onboarding drag state */
.onboarding-drag-active {
  background: oklch(from oklch(var(--p)) l c h / 0.05) !important;
  border: 2px dashed oklch(var(--p)) !important;
}

.onboarding-drag-active .drop-zone {
  background: oklch(from oklch(var(--p)) l c h / 0.1) !important;
  border-color: oklch(var(--p)) !important;
  transform: scale(1.02);
}

.onboarding-drag-active .drop-zone-inner {
  background: oklch(from oklch(var(--p)) l c h / 0.05) !important;
}
</style>

<style scoped>
/* Workspace Import Badge for Detail View */
.workspace-import-badge {
  @apply fixed bottom-4 left-20 z-50 flex items-center gap-2 px-3 py-2 rounded-lg;
  @apply backdrop-blur-sm transition-all duration-200 font-medium text-sm;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  box-shadow: 0 4px 12px oklch(from oklch(var(--bc)) l c h / 0.1);
  transition: all 0.2s ease, background 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

.workspace-import-badge.import-chatgpt {
  background: oklch(from oklch(var(--in)) l c h / 0.1);
  border-color: oklch(from oklch(var(--in)) l c h / 0.3);
  color: oklch(var(--in));
}

.workspace-import-badge.import-claude {
  background: oklch(from oklch(var(--wa)) l c h / 0.1);
  border-color: oklch(from oklch(var(--wa)) l c h / 0.3);
  color: oklch(var(--wa));
}

/* Container Styles - Theme Aware Background */
.canvas-background {
  /* Default seamless gradient background matching GridWorkspaceView */
  background: linear-gradient(180deg,
      oklch(var(--b1)),
      oklch(var(--b1)),
      oklch(from oklch(var(--b2)) l c h / 0.3));
  transition: background 0.3s ease;
}

/* Cyberpunk theme specific gradient */
[data-theme="cyberpunk"] .canvas-background {
  background: linear-gradient(32deg, oklch(0.9 0.18 176.5), oklch(0.81 0.16 172.13), oklch(0.71 0.19 3.12));
}

/* Synthwave theme specific gradient */
[data-theme="synthwave"] .canvas-background {
  background: linear-gradient(41deg, oklch(0.78 0.12 226.65), oklch(0.72 0.18 339.2 / 0.62), oklch(0.76 0.19 111.62 / 0));
}

.workspace-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* Ensure container is transparent to show parent background */
  background: transparent;
}

.grid-view {
  overflow-y: auto;
  padding-top: 4rem;
  /* Remove any background to allow seamless transition */
  background: transparent;
}

.workspace-search-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
}

/* Enhanced GPU Acceleration */
.transform-gpu {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  will-change: transform;
}

/* Enhanced transitions */
.transition-transform {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

.transition-transform-overview {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 500ms;
}

/* Animation States */
.enter-active,
.leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.enter-from,
.leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Fade transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Waterfall transitions */
.waterfall-enter-active,
.waterfall-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.waterfall-enter-from,
.waterfall-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.waterfall-move {
  transition: transform 0.3s;
}

.waterfall-enter-active {
  transition-delay: 0.3s;
}

/* Welcome Screen Theme-Aware Styling */
.welcome-content {
  color: oklch(from oklch(var(--bc)) l c h / 0.8);
}

.welcome-subtitle {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
}

.welcome-feature-card {
  background: linear-gradient(135deg,
      oklch(from oklch(var(--b1)) l c h / 0.8),
      oklch(from oklch(var(--b2)) l c h / 0.5));
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.1);
  backdrop-filter: blur(8px);
}

/* Spline hitbox hover effect */
.spline-hitbox:hover {
  stroke-opacity: 1 !important;
}

.welcome-feature-card:hover {
  background: linear-gradient(135deg,
      oklch(from oklch(var(--p)) l c h / 0.05),
      oklch(from oklch(var(--b1)) l c h / 0.9),
      oklch(from oklch(var(--b2)) l c h / 0.6));
  border-color: oklch(from oklch(var(--p)) l c h / 0.2);
  box-shadow:
    0 12px 32px oklch(from oklch(var(--p)) l c h / 0.15),
    0 0 0 1px oklch(from oklch(var(--p)) l c h / 0.1);
  transform: translateY(-4px);
  transition: all 0.2s ease;
}

.notification-toast {
  background: oklch(from oklch(var(--p)) l c h / 0.9);
  color: oklch(var(--pc));
  backdrop-filter: blur(8px);
}

.file-drop-overlay {
  background: oklch(from oklch(var(--p)) l c h / 0.2);
}

.file-drop-text {
  color: oklch(var(--p));
  text-shadow: 0 2px 4px oklch(from oklch(var(--p)) l c h / 0.3);
}

/* Media drop overlay */
.media-drop-overlay {
  pointer-events: none;
  z-index: 100;
}

/* Clean Onboarding Styles */
.drop-zone {
  @apply p-8 rounded-2xl border-2 border-dashed border-base-content/10 transition-all duration-300 cursor-pointer;
}

.drop-zone:hover {
  @apply border-base-content/20 bg-base-200/30;
}

.drop-zone-active {
  @apply border-primary bg-primary/5 scale-[1.02];
}

.drop-zone-inner {
  @apply text-center;
}


/* Loading State */
.loading-container {
  @apply text-center;
}

.lottie-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  animation: fadeInUp 0.8s ease-out;
}

.lottie-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lottie-loader {
  filter: 
    drop-shadow(0 8px 32px rgba(var(--primary-rgb), 0.3))
    brightness(1.1);
  animation: float 3s ease-in-out infinite;
  z-index: 2;
  position: relative;
}

.loading-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 240px;
  height: 240px;
  background: radial-gradient(circle, rgba(var(--primary-rgb), 0.1) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
  z-index: 1;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  animation: slideInUp 0.8s ease-out 0.2s both;
}

.loading-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: hsl(var(--bc));
  margin: 0;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, 
    hsl(var(--p)), 
    hsl(var(--s)));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.loading-dots {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(var(--p));
  animation: bounce 1.4s ease-in-out infinite both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

.loading-progress-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 200px;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: hsl(var(--b3));
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, hsl(var(--p)), hsl(var(--s)));
  border-radius: 2px;
  transition: width 0.3s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--bc) / 0.7);
  min-width: 40px;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes lottieGlow {
  0% {
    filter: 
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
  100% {
    filter: 
      hue-rotate(var(--lottie-hue, 0deg))
      saturate(var(--lottie-saturation, 1))
      brightness(var(--lottie-brightness, 1));
  }
}

/* Theme-specific Lottie customizations */
[data-theme="light"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.2;
  --lottie-brightness: 0.9;
}

[data-theme="dark"] .lottie-loader {
  --lottie-hue: 0deg;
  --lottie-saturation: 1.1;
  --lottie-brightness: 1.1;
}

[data-theme="cyberpunk"] .lottie-loader {
  --lottie-hue: 180deg;
  --lottie-saturation: 1.5;
  --lottie-brightness: 1.2;
}

[data-theme="synthwave"] .lottie-loader {
  --lottie-hue: 300deg;
  --lottie-saturation: 1.4;
  --lottie-brightness: 1.1;
}

/* UI Element Entrance Animations */
.animate-slide-down {
  animation: slideDown 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Enhanced Modern Canvas Animations */
.enhanced-infinite-canvas {
  @apply absolute overflow-hidden;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, 
    oklch(from oklch(var(--b1)) l c h / 0.98) 0%, 
    oklch(from oklch(var(--p)) l c h / 0.95) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
              background 0.3s ease;
  position: relative;
}

/* Theme-adaptive dotted grid background with gradient-aware contrast */
.enhanced-infinite-canvas::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Create adaptive dots using mix-blend-mode for better contrast */
  background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0;
  pointer-events: none;
  z-index: 1;
  /* Use mix-blend-mode for automatic contrast */
  mix-blend-mode: soft-light;
  opacity: 0.5;
  color: oklch(50% 0 0);
}

/* Enhanced contrast for specific themes */
.enhanced-infinite-canvas::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Additional layer for better visibility */
  background-image: 
    radial-gradient(circle at 1px 1px, 
      oklch(from oklch(var(--bc)) calc(l * 0.5) c h / 0.15) 1px, 
      transparent 1px);
  background-size: 20px 20px;
  background-position: 10px 10px;
  pointer-events: none;
  z-index: 1;
  mix-blend-mode: multiply;
}

/* Light themes - enhanced contrast dots */
.theme-light .enhanced-infinite-canvas::before,
.theme-cupcake .enhanced-infinite-canvas::before,
.theme-bumblebee .enhanced-infinite-canvas::before,
.theme-emerald .enhanced-infinite-canvas::before,
.theme-corporate .enhanced-infinite-canvas::before,
.theme-garden .enhanced-infinite-canvas::before,
.theme-lofi .enhanced-infinite-canvas::before,
.theme-pastel .enhanced-infinite-canvas::before,
.theme-fantasy .enhanced-infinite-canvas::before,
.theme-wireframe .enhanced-infinite-canvas::before,
.theme-cmyk .enhanced-infinite-canvas::before,
.theme-autumn .enhanced-infinite-canvas::before,
.theme-valentine .enhanced-infinite-canvas::before,
.theme-retro .enhanced-infinite-canvas::before,
.theme-cyberpunk .enhanced-infinite-canvas::before,
.theme-lemonade .enhanced-infinite-canvas::before,
.theme-winter .enhanced-infinite-canvas::before,
.theme-watermelon .enhanced-infinite-canvas::before {
  color: oklch(20% 0 0);
  opacity: 0.6;
}

.theme-light .enhanced-infinite-canvas::after,
.theme-cupcake .enhanced-infinite-canvas::after,
.theme-bumblebee .enhanced-infinite-canvas::after,
.theme-emerald .enhanced-infinite-canvas::after,
.theme-corporate .enhanced-infinite-canvas::after,
.theme-garden .enhanced-infinite-canvas::after,
.theme-lofi .enhanced-infinite-canvas::after,
.theme-pastel .enhanced-infinite-canvas::after,
.theme-fantasy .enhanced-infinite-canvas::after,
.theme-wireframe .enhanced-infinite-canvas::after,
.theme-cmyk .enhanced-infinite-canvas::after,
.theme-autumn .enhanced-infinite-canvas::after,
.theme-valentine .enhanced-infinite-canvas::after,
.theme-retro .enhanced-infinite-canvas::after,
.theme-cyberpunk .enhanced-infinite-canvas::after,
.theme-lemonade .enhanced-infinite-canvas::after,
.theme-winter .enhanced-infinite-canvas::after,
.theme-watermelon .enhanced-infinite-canvas::after {
  mix-blend-mode: multiply;
  opacity: 0.3;
}

/* Override canvas background for watermelon theme */
.theme-watermelon .enhanced-infinite-canvas {
  background: linear-gradient(180deg, 
    color-mix(in srgb, #FF1493 20%, transparent) 0%, 
    color-mix(in srgb, #00CC66 25%, transparent) 100%) !important;
}

/* Special adjustments for high-contrast themes */
.theme-cyberpunk .enhanced-infinite-canvas::before {
  color: oklch(10% 0 0);
  opacity: 0.8;
}

.theme-synthwave .enhanced-infinite-canvas::before,
.theme-halloween .enhanced-infinite-canvas::before {
  color: oklch(90% 0 0);
  opacity: 0.5;
}

/* Ensure dots are visible on gradient backgrounds */
@supports (background: oklch(from red l c h)) {
  .enhanced-infinite-canvas::before {
    background-image: 
      radial-gradient(circle at 1px 1px, 
        oklch(from oklch(var(--bc)) calc(50% + (l - 50%) * -0.5) c h / 0.4) 1px, 
        transparent 1px);
    mix-blend-mode: normal;
    opacity: 1;
  }
  
  .enhanced-infinite-canvas::after {
    display: none;
  }
}

/* Dark themes - enhanced contrast dots */
.theme-dark .enhanced-infinite-canvas::before,
.theme-synthwave .enhanced-infinite-canvas::before,
.theme-halloween .enhanced-infinite-canvas::before,
.theme-forest .enhanced-infinite-canvas::before,
.theme-aqua .enhanced-infinite-canvas::before,
.theme-black .enhanced-infinite-canvas::before,
.theme-luxury .enhanced-infinite-canvas::before,
.theme-dracula .enhanced-infinite-canvas::before,
.theme-business .enhanced-infinite-canvas::before,
.theme-acid .enhanced-infinite-canvas::before,
.theme-night .enhanced-infinite-canvas::before,
.theme-coffee .enhanced-infinite-canvas::before,
.theme-dim .enhanced-infinite-canvas::before,
.theme-nord .enhanced-infinite-canvas::before,
.theme-sunset .enhanced-infinite-canvas::before {
  color: oklch(80% 0 0);
  opacity: 0.4;
}

.theme-dark .enhanced-infinite-canvas::after,
.theme-synthwave .enhanced-infinite-canvas::after,
.theme-halloween .enhanced-infinite-canvas::after,
.theme-forest .enhanced-infinite-canvas::after,
.theme-aqua .enhanced-infinite-canvas::after,
.theme-black .enhanced-infinite-canvas::after,
.theme-luxury .enhanced-infinite-canvas::after,
.theme-dracula .enhanced-infinite-canvas::after,
.theme-business .enhanced-infinite-canvas::after,
.theme-acid .enhanced-infinite-canvas::after,
.theme-night .enhanced-infinite-canvas::after,
.theme-coffee .enhanced-infinite-canvas::after,
.theme-dim .enhanced-infinite-canvas::after,
.theme-nord .enhanced-infinite-canvas::after,
.theme-sunset .enhanced-infinite-canvas::after {
  mix-blend-mode: screen;
  opacity: 0.2;
}

.enhanced-infinite-canvas.drag-over {
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--p)) l c h / 0.1) 0%, 
    oklch(from oklch(var(--s)) l c h / 0.05) 100%);
  transform: scale(1.01);
}

/* Enhanced Search Bar */
.enhanced-search-bar {
  left: 50%;
  z-index: 50;
  --tw-translate-x: -50%;
  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-radius: 24px;
}

/* Ultra Modern Loading */
.canvas-loading-overlay {
  @apply absolute inset-0 flex items-center justify-center z-50;
  background: linear-gradient(135deg, 
    oklch(from oklch(var(--b1)) l c h / 0.98) 0%, 
    oklch(from oklch(var(--b2)) l c h / 0.95) 100%);
  backdrop-filter: blur(24px);
  transition: background 0.3s ease;
}

.modern-loading {
  @apply text-center max-w-md;
}

.ultra-modern {
  @apply w-16 h-16 mx-auto mb-6 rounded-full relative;
  background: conic-gradient(from 0deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)), 
    oklch(var(--p)));
  animation: ultraSpin 2s linear infinite;
  transition: background 0.3s ease;
}

.ultra-modern::before {
  @apply absolute inset-2 rounded-full;
  content: '';
  background: oklch(var(--b1));
  transition: background 0.3s ease;
}

.ultra-modern::after {
  @apply absolute inset-4 rounded-full;
  content: '';
  background: conic-gradient(from 0deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)), 
    oklch(var(--p)));
  animation: ultraSpin 1s linear infinite reverse;
  transition: background 0.3s ease;
}

.loading-title {
  @apply text-2xl font-bold mb-2;
  color: oklch(var(--bc));
  animation: titlePulse 2s ease-in-out infinite alternate;
  transition: color 0.3s ease;
}

.loading-subtitle {
  @apply text-base opacity-70 mb-6;
  color: oklch(from oklch(var(--bc)) l c h / 0.7);
  transition: color 0.3s ease;
}

.loading-progress {
  @apply w-full h-1 rounded-full overflow-hidden;
  background: oklch(from oklch(var(--bc)) l c h / 0.1);
  transition: background 0.3s ease;
}

.progress-line {
  @apply h-full rounded-full;
  background: linear-gradient(90deg, 
    oklch(var(--p)), 
    oklch(var(--s)), 
    oklch(var(--a)));
  transition: width 0.3s ease, background 0.3s ease;
  animation: progressFlow 2s ease-in-out infinite;
}




/* Enhanced Animations */
@keyframes ultraSpin {
  to { transform: rotate(360deg); }
}


/* Transition Classes */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-30px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

.zoom-fade-enter-active,
.zoom-fade-leave-active {
  transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
}

.zoom-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.zoom-fade-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Drawing shapes styles */
.drawing-shapes-layer .selected {
  stroke-dasharray: 5,5;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 4px rgba(var(--p), 0.5));
}

.current-drawing {
  pointer-events: none;
}

/* Fit to View Button Animation */
.fit-button-enter-active,
.fit-button-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fit-button-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.8);
}

.fit-button-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px) scale(0.8);
}

.fit-button-enter-to,
.fit-button-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

/* Curvature Slider Styling */
.slider {
  background: linear-gradient(to right, #60a5fa 0%, #3b82f6 100%);
  outline: none;
  border-radius: 4px;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  background: #f8fafc;
  border-color: #1d4ed8;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #ffffff;
  border: 2px solid #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.slider::-moz-range-thumb:hover {
  background: #f8fafc;
  border-color: #1d4ed8;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* Distance Indicator Styles - Neutral base styles */
.distance-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  z-index: 200;
  cursor: pointer;
  user-select: none;
  /* No opacity, transform, or pointer-events - let transitions handle these */
}

/* Vue transition classes - Higher specificity and complete styles */
.distance-fade-enter-active.distance-indicator,
.distance-fade-leave-active.distance-indicator {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out !important;
}

.distance-fade-enter-from.distance-indicator {
  opacity: 0 !important;
  transform: translate(-50%, -50%) scale(0.8) !important;
  pointer-events: none !important;
}

.distance-fade-enter-to.distance-indicator {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
  pointer-events: auto !important;
}

.distance-fade-leave-from.distance-indicator {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
  pointer-events: auto !important;
}

.distance-fade-leave-to.distance-indicator {
  opacity: 0 !important;
  transform: translate(-50%, -50%) scale(0.8) !important;
  pointer-events: none !important;
}


.direction-arrows {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-container {
  position: absolute;
  width: 100%;
  height: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.arrow {
  font-size: 20px;
  color: #3b82f6;
  font-weight: bold;
  text-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.arrow-1 {
  animation: pulseArrow 1.5s ease-in-out infinite;
  animation-delay: 0s;
}

.arrow-2 {
  animation: pulseArrow 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

.arrow-3 {
  animation: pulseArrow 1.5s ease-in-out infinite;
  animation-delay: 0.4s;
}

@keyframes pulseArrow {
  0%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.distance-info {
  text-align: center;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 12px 20px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.distance-text {
  font-size: 18px;
  font-weight: 600;
  color: oklch(var(--bc));
  margin-bottom: 4px;
  font-family: monospace;
}

.return-hint {
  font-size: 12px;
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
  font-weight: 500;
}

/* Dark theme adjustments for distance indicator */
@media (prefers-color-scheme: dark) {
  .distance-info {
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}

/* Accessibility - Reduce motion */
@media (prefers-reduced-motion: reduce) {
  .transform-gpu {
    transform: none !important;
  }

  * {
    transition: none !important;
    animation: none !important;
  }
}

/* Drawing shapes styles */
.drawing-shapes-layer .selected {
  filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
}

.selection-boundary {
  /* pointer-events controlled by inline styles */
}
</style>