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
        'both-panels-open': sidePanelOpen && rightPanelOpen,
        'clustering-mode': isClusteringMode
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

    <!-- Clustering Loading Overlay -->
    <Transition name="fade" mode="out-in">
      <div v-if="isLoadingClustering" class="canvas-loading-overlay clustering-load">
        <div class="loading-container lottie-loading">
          <div class="lottie-wrapper">
            <DotLottieVue 
              :src="'/loading-animation-2.lottie'"
              autoplay 
              loop 
              :style="{ width: '180px', height: '180px' }"
              class="lottie-loader"
            />
            <div class="loading-glow"></div>
          </div>
          <div class="loading-content">
            <h3 class="loading-title">Discovering Topic Clusters</h3>
            <p class="loading-subtitle">Analyzing workspace relationships...</p>
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

      
      <!-- Distance Indicator -->
      <!-- <Transition name="distance-fade">
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
      </Transition> -->

      <!-- Detailed Workspace View (when a workspace is selected) -->
      <div v-if="!isWorkspaceOverview"
        class="absolute inset-0 transition-transform duration-500 ease-in-out overscroll-none touch-none"
        :style="{ cursor: shouldShowCrosshair ? 'none' : currentCursorType }"
        @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseLeave" @mouseenter="handleMouseEnter"
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

        <!-- LOD Indicator Toaster -->
        <div class="absolute bottom-4 left-4 pointer-events-none" style="z-index: 1500;">
          <div class="lod-toaster bg-black/80 text-white px-3 py-2 rounded-lg backdrop-blur-sm border border-white/20 text-sm font-medium">
            <div class="flex items-center gap-2">
              <div class="lod-dot" :class="lodDotClass"></div>
              <span>{{ lodDisplayText }}</span>
            </div>
          </div>
        </div>
        
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
                class="selection-boundary"
                :style="{ 
                  pointerEvents: drawingStore.currentTool === 'cursor' ? 'auto' : 'none',
                  cursor: drawingStore.currentTool === 'cursor' ? 'move' : 'default'
                }"
                @mousedown="handleSelectionBoundaryMouseDown($event)">
                <animate attributeName="stroke-dashoffset" values="0;10" dur="1s" repeatCount="indefinite" />
              </rect>
              
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
            
            <!-- Connections Layer (above drawing shapes) -->
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
                :stroke-width="getLODLevel(node.id) === 'dot' || getLODLevel(node.parentId) === 'dot' ? 0.5 : 2"
                :connection-label="''"
                @label-update="(label) => setConnectionLabel(node.parentId, node.id, label)"
                @connection-click="() => handleConnectionClick(node.parentId, node.id)"
                @connection-hover="(hovered) => handleConnectionHover(node.parentId, node.id, hovered)"
              />
            </template>

            <!-- Dot LOD nodes rendering -->
            <template v-for="node in visibleNodes" :key="`dot-${node.id}`">
              <circle 
                v-if="getLODLevel(node.id) === 'dot'" 
                :cx="node.x + 25"
                :cy="node.y + 25"
                :r="25"
                :fill="isNodeFocused(node.id) ? 'oklch(var(--p))' : 'oklch(from oklch(var(--bc)) l c h / 0.6)'"
                :stroke="isNodeFocused(node.id) ? 'oklch(from oklch(var(--p)) calc(l - 0.1) c h)' : 'oklch(from oklch(var(--bc)) l c h / 0.4)'"
                :stroke-width="4"
                class="node-dot"
                style="cursor: pointer;"
                @click="(e) => handleDotClick(e, node.id)"
                @mousedown="(e) => handleDotMouseDown(e, node)"
              />
            </template>

          </svg>

          <!-- Original spline connections restored -->

          <!-- Nodes Layer -->
          <div class="absolute nodes-layer" :style="nodesLayerStyle" style="z-index: 1">
            <template v-for="node in visibleNodes" :key="node.id">
              <!-- Branch Node (handles all node types from all workspaces) -->
              <BranchNode v-if="(node.type === 'branch' || node.type === 'main' || node.type === 'media') && (!store.snappedNodeId || store.snappedNodeId === node.id) && getLODLevel(node.id) !== 'dot'" :node="node"
                :is-selected="isNodeFocused(node.id)" :is-multi-selected="selectedNodeIds.has(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom" :lod-level="getLODLevel(node.id)"
                :model-registry="modelRegistry" :is-side-panel-open="appStore.isLeftSidebarExpanded" :is-panning="isPanning"
                :is-right-panel-open="rightPanelOpen" :is-right-sidebar-expanded="rightSidebarExpanded" :supports-vision="isVisionModelSelected"
                :is-potential-drop-target="potentialDropTargets.has(node.id)" :disable-entrance-animation="isMorphingFromInputContainer"
                :is-invalid-drop-target="invalidDropTargets.has(node.id)" :is-zooming="isZooming" :is-global-dragging="store.isDragging"
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
                  opacity: (!node.parentId && isClusteringMode) ? workspaceFadeFactor : 1,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'opacity 0.3s ease-out',
                }" />

              <!-- Web Node -->
              <WebBranchNode v-else-if="node.type === 'web' && (!store.snappedNodeId || store.snappedNodeId === node.id) && getLODLevel(node.id) !== 'dot'" :node="node" :is-selected="isNodeFocused(node.id)"
                :selected-model="selectedModel" :open-router-api-key="openRouterApiKey" :modelType="modelType"
                :zoom="zoom" :lod-level="getLODLevel(node.id)" :model-registry="modelRegistry"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle" @resend="(userMessageIndex) =>
                  handleResend(node.id, userMessageIndex)
                " @delete="() => handleNodeDelete(node.id)" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  opacity: (!node.parentId && isClusteringMode) ? workspaceFadeFactor : 1,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'opacity 0.3s ease-out',
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
              <BranchNode v-else-if="(!store.snappedNodeId || store.snappedNodeId === node.id) && getLODLevel(node.id) !== 'dot'" :node="node" :is-selected="isNodeFocused(node.id)"
                :is-snapped="store.snappedNodeId === node.id" :is-multi-selected="selectedNodeIds.has(node.id)" :selected-model="selectedModel"
                :open-router-api-key="openRouterApiKey" :modelType="modelType" :zoom="zoom" :lod-level="getLODLevel(node.id)"
                :model-registry="modelRegistry" :is-side-panel-open="appStore.isLeftSidebarExpanded"
                :is-right-panel-open="rightPanelOpen" :is-right-sidebar-expanded="rightSidebarExpanded" :supports-vision="isVisionModelSelected"
                :disable-entrance-animation="isMorphingFromInputContainer" :is-zooming="isZooming" :is-panning="isPanning" :is-global-dragging="store.isDragging"
                @select="handleNodeSelect(node.id)" @drag-start="handleDragStart" @create-branch="handleCreateBranch"
                @update-title="store.updateNodeTitle"
                @resend="(userMessageIndex) => handleResend(node.id, userMessageIndex)"
                @delete="() => handleNodeDelete(node.id)" @update-position="handleNodePositionUpdate"
                @snap="handleNodeSnap" @unsnap="handleNodeUnsnap" @focus-input="handleFocusInput"
                @expansion-change="handleNodeExpansionChange"
                @update-messages="(messages) => store.updateNodeMessages(node.id, messages)"
                @reflectionSuggestionClick="handleReflectionSuggestionClick" :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  opacity: (!node.parentId && isClusteringMode) ? workspaceFadeFactor : 1,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'opacity 0.3s ease-out',
                }" />

              <!-- Branch Index Label -->
              <BranchIndexLabel 
                v-if="getLODLevel(node.id) !== 'dot' && !store.snappedNodeId && store.nodeIndices.has(node.id)"
                :node="node"
                :node-index="store.nodeIndices.get(node.id)"
                :zoom="zoom"
                :style="{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: store.isTransitioning ? 'transform 0.3s ease-out' : 'none',
                }"
              />
            </template>

            <!-- Topic Connections SVG Layer (only visible in clustering mode) -->
            <svg 
              v-if="isClusteringMode && topicConnections.length > 0"
              class="absolute inset-0 w-full h-full pointer-events-none"
              style="z-index: 0; overflow: visible;"
              :style="svgStyle"
            >
              <g v-for="connection in topicConnections" :key="connection.id">
                <line
                  :x1="connection.from.x"
                  :y1="connection.from.y"
                  :x2="connection.to.x"
                  :y2="connection.to.y"
                  :stroke="`oklch(65% 0.15 ${(connection.topicId * 73) % 360})`"
                  :stroke-width="Math.max(1, 8 / zoom)"
                  stroke-dasharray="20,10"
                  :opacity="topicConnectionOpacity"
                  stroke-linecap="round"
                />
              </g>
            </svg>

            <!-- Topic Cluster Labels (only visible in clustering mode) -->
            <template v-if="isClusteringMode">
              <TopicClusterLabel
                v-for="topicLabel in topicLabels"
                :key="`topic-${topicLabel.id}`"
                :topic="topicLabel"
                :position="topicLabel.position"
                :scale="topicLabelScaleFactor"
                :visible="true"
                :show-connector="false"
                :style="{
                  transition: isClusteringTransition ? 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
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
              @focus-container="handleContainerFocus"
            />

            <!-- Tangent Logo positioned at center hub above input container -->
            <div 
              class="tangent-logo-canvas"
              :style="{ 
                position: 'absolute', 
                left: '0px', 
                top: '-100px',
                transform: 'translateX(-50%)',
                zIndex: 500
              }"
            >
              <TangentLogo class="w-16 h-16 opacity-70 hover:opacity-100 transition-opacity duration-300" />
            </div>

            
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

    <!-- Full Viewport Crosshair Guidelines -->
    <div v-show="shouldShowCrosshair" class="viewport-crosshair">
      <!-- Horizontal line across full viewport -->
      <div 
        class="crosshair-line-h"
        :style="{ top: crosshairPosition.y + 'px' }"
      ></div>
      <!-- Vertical line across full viewport -->
      <div 
        class="crosshair-line-v"
        :style="{ left: crosshairPosition.x + 'px' }"
      ></div>
      <!-- Center dot at intersection -->
      <div 
        class="crosshair-dot"
        :style="{ left: crosshairPosition.x + 'px', top: crosshairPosition.y + 'px' }"
      ></div>
      <!-- Coordinates display -->
      <div 
        class="crosshair-coordinates"
        ref="coordinatesRef"
        :style="{ left: (crosshairPosition.x + 15) + 'px', top: (crosshairPosition.y + 15) + 'px' }"
      >
        <span>X:</span> {{ canvasCoordinates.x }} <span>Y:</span> {{ canvasCoordinates.y }}
      </div>
    </div>

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
import TopicClusterLabel from "./TopicClusterLabel.vue";
import emitter from '@/utils/eventBus'
import CanvasInputContainer from "./CanvasInputContainer.vue";
import WorkspaceSearchBar from "../workspace/WorkspaceSearchBar.vue";
import WebBranchNode from "./node/WebBranchNode.vue";
import MainSplineConnector from "./spline/MainSplineConnector.vue";
import TopDocker from "./TopDocker.vue";
import BottomDocker from "./BottomDocker.vue";
import TangentLogo from "@/components/logo/TangentLogo.vue";
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
import { forceLayoutService } from '@/services/forceLayoutService';
import type { Node as ForceNode } from '@/services/forceLayoutService';
import { dragOptimizer } from '@/services/dragOptimizationService';
import { animationService, smoothZoomTo } from '@/services/animationService';
import { performanceMode } from '@/services/performanceMode';

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

// Crosshair cursor state
const showCrosshair = ref(false); // Start false, set to true on mouse enter
const crosshairRef = ref(null);
const coordinatesRef = ref(null);
const crosshairPosition = ref({ x: 0, y: 0 });
const canvasCoordinates = ref({ x: 0, y: 0 });

// Clustering state
const isClusteringMode = ref(false);
const clusteringData = ref(null);
const topicLabels = ref([]);
const isClusteringTransition = ref(false);
const isLoadingClustering = ref(false);

// Computed property for topic connections
const topicConnections = computed(() => {
  if (!isClusteringMode.value || !clusteringData.value) {
    return [];
  }
  
  const connections = [];
  const rootNodes = store.nodes.filter(node => !node.parentId);
  
  // Create connections from each root node to its topic center
  // CRITICAL: chatStore.chats is in REVERSE order (newest first) but 
  // workspace_positions uses creation order (oldest first)
  rootNodes.forEach((node) => {
    // Find the workspace index in frontend chat list (reverse order)
    const frontendIndex = chatStore.chats.findIndex(chat => chat.id === node.chatId);
    if (frontendIndex >= 0) {
      // Convert to clustering API index (creation order) by reversing
      const clusteringIndex = chatStore.chats.length - 1 - frontendIndex;
      const workspacePos = clusteringData.value.workspace_positions?.[clusteringIndex];
      if (workspacePos) {
        const topicPos = clusteringData.value.topic_positions?.[workspacePos.topic_id];
        if (topicPos) {
          connections.push({
            id: `topic-connection-${node.id}`,
            from: {
              x: node.x,
              y: node.y
            },
            to: {
              x: topicPos.x,
              y: topicPos.y
            },
            topicId: workspacePos.topic_id
          });
        }
      }
    }
  });
  
  return connections;
});

// Computed cursor type based on current interaction state
const currentCursorType = computed(() => {
  // If dragging nodes or workspace
  if (store.isDragging || isMultiDragging.value || workspaceDragState.value.isDragging) {
    return 'grabbing';
  }
  
  // If resizing shapes
  if (resizeState.value.isResizing) {
    return 'resizing';
  }
  
  // If shape dragging
  if (shapeDragState.value.isDragging) {
    return 'grabbing';
  }
  
  // If panning the canvas
  if (isPanning.value) {
    return 'grabbing';
  }
  
  // If in snapped node mode, use default cursor (no crosshair for node placement)
  if (store.snappedNodeId) {
    return 'default';
  }
  
  // Based on drawing tool
  if (drawingStore.currentTool === 'hand') {
    return 'grab';
  } else if (drawingStore.currentTool === 'pen' || drawingStore.currentTool === 'brush') {
    return 'crosshair';
  } else if (drawingStore.currentTool === 'eraser') {
    return 'crosshair';
  } else if (drawingStore.currentTool === 'text') {
    return 'text';
  } else if (drawingStore.currentTool === 'cursor') {
    return 'move';
  }
  
  // Default to crosshair for precision positioning when no active tool or general navigation
  return 'crosshair';
});

// Show custom crosshair whenever mouse is over canvas (but not in snapped mode)
const shouldShowCrosshair = computed(() => {
  return !isWorkspaceOverview.value && showCrosshair.value && !store.snappedNodeId;
});

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
const wasJustDragging = ref(false); // Flag to prevent immediate re-selection after dragging
const dragAnimationFrameId = ref(null); // For throttling drag updates
const curvature = ref(0.5); // Spline curvature (0 = straight, 1 = very curvy)
const lastPanPosition = ref({ x: 0, y: 0 });
const focusedNodeId = ref(null);
const mousePosition = ref({ x: 0, y: 0 });
const showFitButton = ref(false);
// Node that's been clicked on for LOD focus

const focusedTopicId = ref<string | null>(null);

// Workspace overview dots (visual reference only at low zoom)
const getWorkspaceRootNode = (workspaceId: string) => {
  return store.nodes.find(node =>
    node.workspaceId === workspaceId &&
    node.type === 'main' &&
    node.metadata?.isRoot === true
  );
};

// Computed property for topic nodes at very low zoom - performance mode aware
const topicNodesCache = ref<any[]>([]);
const topicNodesPaused = ref(false);

const topicNodes = computed(() => {
  // Skip expensive computation during performance mode
  if (performanceMode.isInPerformanceMode() || topicNodesPaused.value) {
    return topicNodesCache.value;
  }
  
  const nodes: any[] = [];
  const topicMap = new Map<string, { rootNodeIds: Set<string>, sumX: number, sumY: number, count: number, titles: Set<string> }>();

  // 1. Identify all workspace root nodes and group them by a simulated topic
  chatStore.chats.value.forEach(chat => {
    const rootNode = getWorkspaceRootNode(chat.id);
    if (rootNode) {
      // Simulate topic assignment: group by first word of workspace title
      const topicKey = chat.title?.split(' ')[0]?.toLowerCase() || 'untitled';
      
      if (!topicMap.has(topicKey)) {
        topicMap.set(topicKey, { rootNodeIds: new Set(), sumX: 0, sumY: 0, count: 0, titles: new Set() });
      }
      const topicData = topicMap.get(topicKey)!;
      topicData.rootNodeIds.add(rootNode.id);
      topicData.sumX += rootNode.x;
      topicData.sumY += rootNode.y;
      topicData.count++;
      topicData.titles.add(topicKey.charAt(0).toUpperCase() + topicKey.slice(1)); // Capitalize first letter
    }
  });

  // 2. Create a "topic" node for each group
  topicMap.forEach((data, topicKey) => {
    const centerX = data.sumX / data.count;
    const centerY = data.sumY / data.count;
    const topicTitle = Array.from(data.titles).join(' / '); // Combine titles if multiple
    
    nodes.push({
      id: `topic-${topicKey}`,
      type: 'topic', // Custom type for topic nodes
      x: centerX,
      y: centerY,
      title: topicTitle,
      nodeCount: data.rootNodeIds.size, // Number of workspaces in this topic
    });
  });

  // Cache the result
  topicNodesCache.value = nodes;
  return nodes;
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

// Zoom constants
const ZOOM_MIN = 0.0099; // Cap zoom to minimum 0.99%
const ZOOM_MAX = 2;
const ZOOM_SENSITIVITY = 0.005;
const PAN_SENSITIVITY = 1.0;

// LOD thresholds
const LOD_FULL_THRESHOLD = 0.80; // 80%+ for full detail
const LOD_PREVIEW_THRESHOLD = 0.50; // 50-80% for preview
const LOD_COMPACT_THRESHOLD = 0.15; // 15%+ for compact

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
    handleNodeSelect(nextNode.id);
  }
};

// Performance state tracking
const isAnimating = ref(false);
let animationTimeout: number | null = null;
const isZooming = ref(false);
let zoomTimeout: number | null = null;
let panTimeout: number | null = null;
const lastDragEndTime = ref<number | null>(null);

// Simplified high-performance LOD calculation
const getLODLevel = (nodeId: string): string => {
  const isNodeSnapped = snappedNodeId.value === nodeId;
  
  // Always use full detail for snapped nodes regardless of zoom level
  // This prevents LOD changes during auto-center or zoom changes
  if (isNodeSnapped) {
    return 'full';
  }
  
  const currentZoom = zoom.value;
  
  // Simple zoom-based LOD (no expensive viewport checking during zoom)
  if (currentZoom >= LOD_FULL_THRESHOLD) {
    return 'full';
  } else if (currentZoom >= LOD_PREVIEW_THRESHOLD) {
    return 'preview';
  } else if (currentZoom >= LOD_COMPACT_THRESHOLD) {
    return 'compact';
  } else {
    return 'dot';
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
  
  // Handle dot LOD with very small dimensions
  if (lodLevel === 'dot') {
    return {
      width: 50,
      height: 50,
      lodLevel: 'dot'
    };
  }
  
  // Adjust dimensions based on LOD level
  switch (lodLevel) {
    case 'hidden':
      width = 0;
      height = 0;
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

// Enhanced computed styles with hardware acceleration and performance optimizations
const transformStyle = computed(() => {
  if (store.snappedNodeId !== null) {
    return {
      transform: "translate3d(0,0,0)", // Force hardware acceleration
      transformOrigin: "0 0",
      width: "100%",
      height: "100%",
      transition: "none",
      willChange: "auto", // Reset will-change when not animating
    };
  }

  // Overview mode with RTS perspective adjustments
  if (isWorkspaceOverview.value) {
    return {
      transform: `translate3d(${panX.value}px, ${panY.value}px, 0)`, // Hardware accelerated
      transformOrigin: "0 0",
      transition: "transform 0.3s ease-out",
      willChange: "transform", // Hint for optimization during transitions
    };
  }

  // Regular mode: scale and translate with hardware acceleration
  return {
    transform: `scale(${zoom.value}) translate3d(${panX.value / zoom.value}px, ${panY.value / zoom.value}px, 0)`,
    transformOrigin: "0 0",
    width: "100000px",
    height: "100000px",
    transition: store.isTransitioning ? "transform 0.3s ease-out" : "none",
    willChange: "auto", // Keep simple
    backfaceVisibility: "hidden", // Prevent flickering during transforms
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

// LOD indicator computed properties
const lodDisplayText = computed(() => {
  const currentZoom = zoom.value;
  
  if (currentZoom >= 0.80) {
    return 'Full LOD (Hover to expand)';
  } else if (currentZoom >= 0.50) {
    return 'Preview LOD (Last message)';
  } else if (currentZoom >= 0.30) {
    return 'Compact LOD (Labels visible)';
  } else if (currentZoom >= 0.15) {
    return 'Compact LOD';
  } else {
    return 'Dot LOD';
  }
});

const lodDotClass = computed(() => {
  const currentZoom = zoom.value;
  
  if (currentZoom >= 0.80) {
    return 'bg-green-500'; // Full LOD
  } else if (currentZoom >= 0.50) {
    return 'bg-blue-500'; // Preview LOD
  } else if (currentZoom >= 0.30) {
    return 'bg-yellow-500'; // Compact with labels
  } else if (currentZoom >= 0.15) {
    return 'bg-orange-500'; // Compact LOD
  } else {
    return 'bg-red-500'; // Dot LOD
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
  
  // Skip grid only at extremely low zoom (allow grid in clustering mode)
  if (currentZoom < 0.001) return;
  
  // Calculate grid spacing based on zoom level
  const baseGridSize = GRID_SIZE * currentZoom;
  const majorGridSize = GRID_MAJOR_SIZE * currentZoom;
  
  // Adaptive grid density - MASSIVE distillation for performance
  let gridStep = GRID_SIZE;
  if (currentZoom < 0.01) {
    gridStep = GRID_MAJOR_SIZE * 50; // Ultra-sparse grid for clustering mode
  } else if (currentZoom < 0.05) {
    gridStep = GRID_MAJOR_SIZE * 10; // Very sparse grid 
  } else if (currentZoom < 0.1) {
    gridStep = GRID_MAJOR_SIZE * 5; // Sparse grid
  } else if (currentZoom < 0.3) {
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
  
  // CLUSTERING MODE: Increase opacity for better visibility at ultra-low zoom
  if (currentZoom < 0.1) {
    // Extract and increase alpha values for clustering mode
    majorGridColor = majorGridColor.replace(/0\.\d+\)$/, '0.8)'); // Increase to 0.8
    minorGridColor = minorGridColor.replace(/0\.\d+\)$/, '0.6)'); // Increase to 0.6
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
            
            // Position workspaces in a more organic grid pattern (not circular)
            const gridSize = Math.ceil(Math.sqrt(data.chats.length));
            const col = workspaceIndex % gridSize;
            const row = Math.floor(workspaceIndex / gridSize);
            
            // Spread them out with some randomness
            const baseSpacing = 1200;
            const islandCenterX = (col - gridSize/2) * baseSpacing + (Math.random() - 0.5) * 400;
            const islandCenterY = (row - gridSize/2) * baseSpacing + (Math.random() - 0.5) * 400;
            
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
      
      // CRITICAL: Set the canvas store nodes to show all workspace nodes
      store.nodes = allNodes;
      console.log('Loaded', allNodes.length, 'nodes from', data.chats.length, 'workspaces');
      console.log('[loadAllWorkspaces] Set store.nodes to', store.nodes.length, 'nodes');
    }
  } catch (error) {
    console.error('Error loading all workspaces:', error);
  }
};

// Simple, fast visibleNodes without complex caching
const visibleNodes = computed(() => {
  // If snapped node exists, only show that node
  if (store.snappedNodeId !== null) {
    return store.nodes.filter(node => node.id === store.snappedNodeId);
  }
  
  // In clustering mode, show root nodes with fade-out effect
  if (isClusteringMode.value) {
    const rootNodes = store.nodes.filter(node => !node.parentId);
    return rootNodes;
  }
  
  // For small numbers of nodes, just return all nodes
  if (store.nodes.length <= 50) {
    return store.nodes;
  }
  
  // Manual viewport culling - fast and reliable
  if (!canvasRef.value) {
    return [];
  }
  
  const viewport = viewportReturn.getViewportBounds(canvasRef.value);
  if (!viewport) {
    return [];
  }
  
  // Simple manual viewport culling - O(n) but fast for reasonable node counts
  const BUFFER = 500;
  const visibleNodes = store.nodes.filter(node => {
    // Node bounds
    const nodeLeft = node.x;
    const nodeRight = node.x + 400; // Approximate node width
    const nodeTop = node.y;  
    const nodeBottom = node.y + 300; // Approximate node height
    
    // Viewport bounds with buffer
    const viewLeft = viewport.left - BUFFER;
    const viewRight = viewport.right + BUFFER;
    const viewTop = viewport.top - BUFFER;
    const viewBottom = viewport.bottom + BUFFER;
    
    // Check intersection
    return !(nodeRight < viewLeft || nodeLeft > viewRight || 
             nodeBottom < viewTop || nodeTop > viewBottom);
  });
  
  return visibleNodes;
});

// Visible connections - optimized with memoization and performance mode aware
const visibleNodeIdsCache = ref(new Set<string>());
const visibleConnectionsCache = ref<any[]>([]);
const lastVisibleNodesLength = ref(0);
const connectionsUpdatePaused = ref(false);

const visibleConnections = computed(() => {
  // Hide all connections in clustering mode
  if (isClusteringMode.value) {
    return [];
  }
  
  if (store.snappedNodeId !== null || isWorkspaceOverview.value || isAnimatingWorkspace.value) {
    return store.connections;
  }

  // Skip expensive computation during performance mode
  if (performanceMode.isInPerformanceMode() || connectionsUpdatePaused.value) {
    return visibleConnectionsCache.value;
  }

  // Check if we need to update the cache
  if (visibleNodes.value.length !== lastVisibleNodesLength.value) {
    visibleNodeIdsCache.value = new Set(visibleNodes.value.map(node => node.id));
    lastVisibleNodesLength.value = visibleNodes.value.length;
    
    // Update connections cache
    visibleConnectionsCache.value = store.connections.filter(connection => 
      visibleNodeIdsCache.value.has(connection.parent.id) || 
      visibleNodeIdsCache.value.has(connection.child.id)
    );
  }
  
  return visibleConnectionsCache.value;
});

// Update intersection observer - performance mode aware
const intersectionUpdatePaused = ref(false);
const updateIntersectionObserver = debounce(() => {
  // Skip during performance mode
  if (performanceMode.isInPerformanceMode() || intersectionUpdatePaused.value || !visibleNodes.value.length) return;
  
  nextTick(() => {
    // Only observe visible nodes for performance
    visibleNodes.value.forEach(node => {
      const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
      if (nodeElement && !intersectionVisibleNodes.value.has(node.id)) {
        observe(nodeElement, node.id);
      }
    });

    // Update visible nodes set from intersection observer
    const visibleIds = getVisibleElementIds();
    intersectionVisibleNodes.value = new Set(visibleIds.filter(id => 
      visibleNodes.value.some(node => node.id === id)
    ));
  });
}, 100);

// Watch only node count changes and visible nodes changes - not deep!
watch(
  () => [store.nodes.length, visibleNodes.value.length],
  updateIntersectionObserver,
  { immediate: true }
);

// Register heavy operations with performance mode service
onMounted(() => {
  // Register intersection observer updates
  performanceMode.registerHeavyOperation(
    'intersectionObserver',
    () => { intersectionUpdatePaused.value = true; },
    () => { intersectionUpdatePaused.value = false; }
  );
  
  // Register connections computation
  performanceMode.registerHeavyOperation(
    'visibleConnections',
    () => { connectionsUpdatePaused.value = true; },
    () => { connectionsUpdatePaused.value = false; }
  );
  
  // Register viewport observer if it exists
  if (viewportReturn?.pauseObserver && viewportReturn?.resumeObserver) {
    performanceMode.registerHeavyOperation(
      'viewportObserver',
      () => viewportReturn.pauseObserver(),
      () => viewportReturn.resumeObserver()
    );
  }
  
  // Register topic nodes computation
  performanceMode.registerHeavyOperation(
    'topicNodes',
    () => { topicNodesPaused.value = true; },
    () => { topicNodesPaused.value = false; }
  );
  
  // Register force layout service if available
  if (forceLayoutService?.pause && forceLayoutService?.resume) {
    performanceMode.registerHeavyOperation(
      'forceLayout',
      () => forceLayoutService.pause(),
      () => forceLayoutService.resume()
    );
  }
  
  // Register auto arrange service if available
  if (autoArrangeService?.pause && autoArrangeService?.resume) {
    performanceMode.registerHeavyOperation(
      'autoArrange',
      () => autoArrangeService.pause(),
      () => autoArrangeService.resume()
    );
  }
});

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

// Crosshair cursor function
const updateCrosshair = (screenX, screenY) => {
  if (!canvasRef.value) return;
  
  const rect = canvasRef.value.getBoundingClientRect();
  crosshairPosition.value = {
    x: screenX - rect.left,
    y: screenY - rect.top
  };
  
  const worldPos = screenToWorld(screenX, screenY);
  canvasCoordinates.value = {
    x: Math.round(worldPos.x),
    y: Math.round(worldPos.y)
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
  
  // Clear any snapped node state before creating new workspace
  if (store.snappedNodeId) {
    store.unsnapNode(store.snappedNodeId);
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
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  
  // Calculate correct pan values for 120% zoom to center input container at (-3000, -3000)
  const NEW_CHAT_X = -3000;
  const NEW_CHAT_Y = -3000;
  const targetZoom = 1.2;
  
  // Calculate pan values to center the input container coordinate on screen
  const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
  const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
  
  // Animate smoothly to the input container
  viewportReturn.animateToPositionWithZoom(targetPanX, targetPanY, targetZoom, 1000);
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
const handleNodeSelect = (nodeId: string) => {
  console.log('[CLICK DEBUG] ==============================================');
  console.log('[CLICK DEBUG] Starting handleNodeSelect for node:', nodeId);
  console.time('[CLICK DEBUG] Total handleNodeSelect time');
  
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) {
    console.log('[CLICK DEBUG] Node not found');
    return;
  }

  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) {
    console.log('[CLICK DEBUG] No canvas rect');  
    return;
  }

  console.log('[CLICK DEBUG] BEFORE setting values - zoom:', zoom.value);
  console.log('[CLICK DEBUG] BEFORE setting values - panX:', panX.value);
  console.log('[CLICK DEBUG] BEFORE setting values - panY:', panY.value);
  
  // INSTANT centering - no animation, no bullshit
  const targetZoom = 0.8;
  // CRITICAL: Stop any momentum panning that might be interfering
  console.log('[CLICK DEBUG] Clearing pan velocity - before:', panVelocity.value);
  panVelocity.value.x = 0;
  panVelocity.value.y = 0;
  console.log('[CLICK DEBUG] Clearing pan velocity - after:', panVelocity.value);
  
  console.log('[CLICK DEBUG] About to set panX...');
  panX.value = rect.width / 2 - node.x * targetZoom;
  console.log('[CLICK DEBUG] About to set panY...');
  panY.value = rect.height / 2 - node.y * targetZoom;
  console.log('[CLICK DEBUG] About to set zoom...');
  zoom.value = targetZoom;
  
  console.log('[CLICK DEBUG] AFTER setting values - zoom:', zoom.value);
  console.log('[CLICK DEBUG] AFTER setting values - panX:', panX.value);
  console.log('[CLICK DEBUG] AFTER setting values - panY:', panY.value);
  console.timeEnd('[CLICK DEBUG] Total handleNodeSelect time');
  
  // Debug: Let's see what's getting triggered immediately after
  setTimeout(() => {
    console.log('[CLICK DEBUG] 50ms AFTER CLICK - State check:');
    console.log('  - isAnimating:', isAnimating.value);
    console.log('  - isZooming:', isZooming.value); 
    console.log('  - store.isTransitioning:', store.isTransitioning);
    console.log('  - focusedNodeId:', focusedNodeId.value);
    console.log('  - isPanning:', isPanning.value);
  }, 50);
  
  setTimeout(() => {
    console.log('[CLICK DEBUG] 200ms AFTER CLICK - Final state check:');
    console.log('  - isAnimating:', isAnimating.value);
    console.log('  - isZooming:', isZooming.value);
    console.log('  - store.isTransitioning:', store.isTransitioning);
    console.log('  - focusedNodeId:', focusedNodeId.value);
    console.log('  - isPanning:', isPanning.value);
    console.log('[CLICK DEBUG] ==============================================');
  }, 200);
};

// Calculate node bounds
const calculateNodeBounds = (node) => {
  if (!node) {
    if (!store.nodes.length) return null;

    return store.nodes.reduce(
      (acc, node) => {
        // For centering purposes, use full card dimensions regardless of LOD
        // This ensures dot LOD nodes can still be centered properly
        let nodeWidth = CARD_WIDTH;
        let nodeHeight = CARD_HEIGHT;
        
        // Handle special node types
        if (node.type === 'tool-call-compact') {
          nodeWidth = 120;
          nodeHeight = 40;
        }

        // Skip expensive DOM queries - use reasonable defaults
        // The DOM query + getBoundingClientRect was causing lag

        // Use custom width if available, otherwise use the calculated full width
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

  // Fast bounds calculation without expensive DOM queries
  let nodeWidth = CARD_WIDTH;
  let nodeHeight = CARD_HEIGHT + 100; // Add padding for content
  
  // Handle special node types
  if (node.type === 'tool-call-compact') {
    nodeWidth = 120;
    nodeHeight = 40;
  }
  
  // Use custom dimensions if available
  nodeWidth = node.customWidth || nodeWidth;
  nodeHeight = node.customHeight || nodeHeight;
  
  return {
    minX: node.x,
    maxX: node.x + nodeWidth,
    minY: node.y,
    maxY: node.y + nodeHeight,
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
    // console.log("Snapped node, ignoring wheel event");
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
  
  // Simple performance optimization

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
    
    // Set zooming flag to disable transitions
    isZooming.value = true;
    if (zoomTimeout) clearTimeout(zoomTimeout);
    zoomTimeout = setTimeout(() => {
      isZooming.value = false;
    }, 100); // Keep flag active for 100ms after last zoom event
    
    zoom.value = newZoom;
    
    // DISABLED: This was killing performance after clicks
    // setTimeout(() => updateCurrentWorkspace(), 50);
  } else if (shouldPan) {
    // Set panning flag to disable node style recalculations
    isPanning.value = true;
    if (panTimeout) clearTimeout(panTimeout);
    panTimeout = setTimeout(() => {
      isPanning.value = false;
    }, 100); // Keep flag active for 100ms after last pan event
    
    // Throttle pan updates to animation frame for smoother performance
    if (!panFrame) {
      panFrame = requestAnimationFrame(() => {
        // Handle pan with 2-finger trackpad gesture
        panX.value -= e.deltaX * PAN_SENSITIVITY;
        panY.value -= e.deltaY * PAN_SENSITIVITY;
        panFrame = null;
      });
    }
    
    // No pan constraints needed
  }
  
  // DISABLED: These viewport checks were causing lag
  // if (!shouldPan && !shouldZoom) {
  //   viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
  //   startContinuousViewportCheck();
  // }
  
  // Performance monitoring removed - use browser DevTools Performance tab for detailed profiling
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
// PERFORMANCE: Skip during animations to prevent lag
// DISABLED: This was causing lag after clicks
// let distanceCheckPending = false;
// watch([panX, panY, zoom], () => {
//   // Skip expensive operations during node focus animations or zoom operations
//   if (isAnimating.value || isZooming.value) return;
//   
//   if (!distanceCheckPending) {
//     distanceCheckPending = true;
//     requestAnimationFrame(() => {
//       checkDistanceFromNodes();
//       distanceCheckPending = false;
//     });
//   }
// }, { immediate: true });

// Only check when node count changes, not deep properties
watch(() => store.nodes.length, () => {
  checkDistanceFromNodes();
});

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

      const dropPosition = {
        x: (e.clientX - rect.left - panX.value) / zoom.value,
        y: (e.clientY - rect.top - panY.value) / zoom.value,
      };

      // Find non-overlapping position using collision detection
      const position = findNonOverlappingPosition(dropPosition.x, dropPosition.y);

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

// Helper functions for MainSplineConnector
const getParentNode = (parentId: string) => {
  // First try to find in visible nodes for performance
  let parentNode = visibleNodes.value.find(node => node.id === parentId);
  
  // If not found in visible nodes, check all nodes in the store
  if (!parentNode) {
    parentNode = store.nodes.find(node => node.id === parentId);
    if (!parentNode) {
      console.log('[getParentNode] Could not find parent node:', { 
        parentId, 
        visibleNodeIds: visibleNodes.value.map(n => n.id),
        allNodeIds: store.nodes.map(n => n.id) 
      });
    }
  }
  
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
  console.log('[WORKSPACE DEBUG] ==========================================');
  console.log('[WORKSPACE DEBUG] Selecting workspace:', workspaceId);
  console.log('[WORKSPACE DEBUG] Before state change - isWelcomeScreen:', isWelcomeScreen.value, 'isWorkspaceOverview:', isWorkspaceOverview.value);
  console.log('[WORKSPACE DEBUG] Current store.nodes before load:', store.nodes.length);

  store.isTransitioning = false;
  expandingWorkspaceId.value = workspaceId;

  const workspaceNode = document.querySelector(`[data-workspace-id="${workspaceId}"]`);
  if (!workspaceNode) {
    console.log('[WORKSPACE DEBUG] Could not find workspace node with id', workspaceId, '- loading directly from store');
    isWelcomeScreen.value = false;
    isWorkspaceOverview.value = false;
    console.log('[WORKSPACE DEBUG] After state change (no node) - isWelcomeScreen:', isWelcomeScreen.value, 'isWorkspaceOverview:', isWorkspaceOverview.value);
    
    // Clear any snapped node state before loading new workspace
    if (store.snappedNodeId) {
      console.log('[WORKSPACE DEBUG] Clearing snapped node:', store.snappedNodeId);
      store.unsnapNode(store.snappedNodeId);
    }
    
    console.log('[WORKSPACE DEBUG] About to call store.loadChatState...');
    await store.loadChatState(workspaceId);
    console.log('[WORKSPACE DEBUG] After loadChatState - store.nodes:', store.nodes.length);
    console.log('[WORKSPACE DEBUG] Nodes loaded:', store.nodes.map(n => ({id: n.id.slice(0,8), x: n.x, y: n.y, type: n.type})));
    
    expandedNodes.value = new Set(store.nodes.map(node => node.id));
    await nextTick();
    
    console.log('[WORKSPACE DEBUG] After nextTick - about to call autoFitNodes');
    // Auto-center on loaded nodes (disable transition to prevent slide-in animation)
    console.log('[WORKSPACE DEBUG] Auto-centering on loaded nodes (no workspace node case)');
    autoFitNodes(true, true); // disableTransition=true, forceZoom=true
    
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

  // Clear any snapped node state before loading new workspace
  if (store.snappedNodeId) {
    store.unsnapNode(store.snappedNodeId);
  }

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
  autoFitNodes(true, true); // disableTransition=true, forceZoom=true

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
const handleWorkspaceCreated = async (message: string, targetPosition?: { x: number, y: number }, config?: any) => {
  isCreatingWorkspace.value = true;
  isMorphingFromInputContainer.value = true; // Disable entrance animations
  
  try {
    // Pass Claude Code config if provided
    const claudeCodeConfig = config?.isClaudeCode ? {
      isClaudeCode: true,
      claudeCodeSettings: {
        mode: config.mode,
        allowedTools: config.allowedTools,
        workingDir: config.workingDir,
        systemPrompt: config.systemPrompt,
        costLimit: config.costLimit,
        mcpConfig: config.mcpConfig,
        resumeSession: config.resumeSession,
        autoCompact: config.autoCompact,
        compactThreshold: config.compactThreshold
      }
    } : undefined;
    
    // Create a new workspace with the user's message at the exact input container position
    await handleGenerateWorkspace(message, undefined, claudeCodeConfig, targetPosition || { x: 0, y: 0 });
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

const handleContainerFocus = () => {
  // Center container on viewport and set zoom to 90% when user starts typing
  if (!canvasRef.value) return;
  
  const rect = canvasRef.value.getBoundingClientRect();
  const containerX = 0; // Input container world position (center)
  const containerY = 0;
  const targetZoom = 0.9; // 90% zoom
  
  // Calculate pan values to center the container
  panX.value = rect.width / 2 - containerX * targetZoom;
  panY.value = rect.height / 2 - containerY * targetZoom;
  zoom.value = targetZoom;
  
  console.log('Focused input container - centering viewport', {
    containerX,
    containerY,
    targetZoom,
    panX: panX.value,
    panY: panY.value
  });
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
      
      // Clear any snapped node state before loading workspace
      if (store.snappedNodeId) {
        store.unsnapNode(store.snappedNodeId);
      }
      
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


const centerOnNodeWithAnimation = (nodeId, targetZoom = 0.6, duration = 400) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  isAnimating.value = true;

  const bounds = calculateNodeBounds(node);
  const nodeCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const nodeCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
  const rect = canvasRef.value.getBoundingClientRect();

  const startPanX = panX.value;
  const startPanY = panY.value;
  const startZoom = zoom.value;
  
  focusedNodeId.value = nodeId;
  
  // Simple, fast animation without all the overhead
  const startTime = performance.now();
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Simple easeOut
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // Direct interpolation - no services, no overhead
    const currentZoom = startZoom + (targetZoom - startZoom) * eased;
    const targetPanX = rect.width / 2 - nodeCenterX * targetZoom;
    const targetPanY = rect.height / 2 - nodeCenterY * targetZoom;
    
    panX.value = startPanX + (targetPanX - startPanX) * eased;
    panY.value = startPanY + (targetPanY - startPanY) * eased;
    zoom.value = currentZoom;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isAnimating.value = false;
    }
  };
  
  requestAnimationFrame(animate);
};

// Center on a specific node
const centerOnNode = (nodeId) => {
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


// Collision detection for node placement (fallback for static placement)
const findNonOverlappingPosition = (targetX: number, targetY: number, excludeParentId?: string): { x: number, y: number } => {
  const MIN_DISTANCE = 250; // Minimum distance between node centers (5 grid dots)
  const STEP_SIZE = 50; // How far to move when searching for free space (1 grid dot)
  const MAX_ATTEMPTS = 50; // Maximum number of positions to try
  
  let attempts = 0;
  let currentX = targetX;
  let currentY = targetY;
  
  const isPositionFree = (x: number, y: number): boolean => {
    // Check against all existing nodes except the parent
    for (const node of store.nodes) {
      if (excludeParentId && node.id === excludeParentId) continue;
      
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < MIN_DISTANCE) {
        return false;
      }
    }
    return true;
  };
  
  // First try the target position
  if (isPositionFree(currentX, currentY)) {
    return { x: currentX, y: currentY };
  }
  
  // Search in expanding circles around the target position
  for (let radius = STEP_SIZE; radius <= MAX_ATTEMPTS * STEP_SIZE; radius += STEP_SIZE) {
    // Try positions around the circle at this radius
    const numPositions = Math.max(8, Math.floor(radius / STEP_SIZE * 2));
    
    for (let i = 0; i < numPositions; i++) {
      const angle = (i / numPositions) * 2 * Math.PI;
      const testX = targetX + Math.cos(angle) * radius;
      const testY = targetY + Math.sin(angle) * radius;
      
      attempts++;
      if (attempts >= MAX_ATTEMPTS) break;
      
      if (isPositionFree(testX, testY)) {
        return { x: testX, y: testY };
      }
    }
    
    if (attempts >= MAX_ATTEMPTS) break;
  }
  
  // If no free position found, return the original position
  // This prevents infinite loops but may result in overlap
  console.warn('Collision detection: No free position found, using original position');
  return { x: targetX, y: targetY };
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

  // Find non-overlapping position using collision detection
  const adjustedPosition = findNonOverlappingPosition(
    position.x,
    parentNode.y + verticalOffset,
    parentId
  );

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
  
  // Update drag end time whenever any dragging stops
  if (store.isDragging || isMultiDragging.value) {
    lastDragEndTime.value = Date.now();
    
    // End optimized drag and commit final positions
    dragOptimizer.endDrag(async (nodeId, position) => {
      await store.updateNodePosition(nodeId, position);
    });
    
    // Performance mode exit is now handled by dragOptimizer.endDrag()
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

  // Set wasJustDragging flag to prevent immediate re-selection/centering
  wasJustDragging.value = true;
  setTimeout(() => {
    wasJustDragging.value = false;
  }, 50); // Short delay to allow click event to process before flag resets
  
  // Handle selection rectangle completion
  if (selectionRect.value.isActive) {
    finishSelection();
  }
  
  // Check viewport return after mouse interaction
  viewportReturn.checkNodeVisibility(canvasRef.value);
};

const handleMouseEnter = (e) => {
  showCrosshair.value = true;
};

const handleMouseLeave = (e) => {
  showCrosshair.value = false;
  // Also trigger handleMouseUp for consistency
  handleMouseUp(e);
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

    // Start multi-drag if node is selected (but prevent if node is in full LOD)
    if (selectedNodeIds.value.has(clickedNode.id) && getLODLevel(clickedNode.id) !== 'full') {
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
    
    // Fit to View: Ctrl/Cmd + 0 (alternative shortcut) - LOD-aware
    if (cmdKey && e.key === '0') {
      e.preventDefault();
      autoFitNodes(); // Uses new LOD-aware behavior
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

// Original autoFitNodes for legacy compatibility 
const autoFitNodesLegacy = (disableTransition = false) => {
  console.log('[autoFitNodesLegacy] Called with conditions:', {
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
    store.snappedNodeId !== null // Added: Do not auto-fit if a node is snapped
  ) {
    console.log('[autoFitNodesLegacy] Skipped due to conditions');
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
};

// New LOD-aware fit-to-view that respects current zoom level
const autoFitNodes = (disableTransition = false, forceZoom = false) => {
  console.log('[autoFitNodes] Called with conditions:', {
    hasCanvasRef: !!canvasRef.value,
    autoZoomEnabled: autoZoomEnabled.value,
    isDragging: store.isDragging,
    isPanning: isPanning.value,
    workspaceDragging: workspaceDragState.value.isDragging,
    nodeCount: store.nodes.length,
    currentZoom: zoom.value,
    currentLOD: zoom.value >= LOD_FULL_THRESHOLD ? 'full' : zoom.value >= LOD_PREVIEW_THRESHOLD ? 'preview' : zoom.value >= LOD_COMPACT_THRESHOLD ? 'compact' : 'dot',
    forceZoom,
    disableTransition
  });
  
  if (
    !canvasRef.value ||
    !autoZoomEnabled.value ||
    store.isDragging ||
    isPanning.value ||
    workspaceDragState.value.isDragging ||
    store.snappedNodeId !== null // Added: Do not auto-fit if a node is snapped
  ) {
    console.log('[autoFitNodes] Skipped due to conditions');
    return;
  }

  const bounds = isWorkspaceOverview.value ? calculateWorkspacesBounds() : calculateCanvasBounds();
  if (!bounds) return;

  const rect = canvasRef.value.getBoundingClientRect();
  const padding = isWorkspaceOverview.value ? 120 : 200;

  // Calculate content center position
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Calculate target center position on screen
  let targetCenterX = rect.width / 2;
  if (appStore.isRightContentPanelOpen) {
    // Center in the available 64% space (32% of total viewport width from left edge)
    targetCenterX = rect.width * 0.32; // 64% / 2 = 32%
  }

  // If forceZoom is true, use legacy behavior (for initial load, etc.)
  if (forceZoom) {
    console.log('[autoFitNodes] Force zoom mode - using legacy calculation');
    return autoFitNodesLegacy(disableTransition);
  }

  // LOD-aware fit: Only adjust pan to center content, preserve current zoom
  const currentZoom = zoom.value;
  
  // Check if all content is already visible at current zoom
  const contentWidth = bounds.maxX - bounds.minX + padding * 2;
  const contentHeight = bounds.maxY - bounds.minY + padding * 2;
  const adjustedContentHeight = contentHeight * RTS_SCALE_Y;
  
  const availableWidth = appStore.isRightContentPanelOpen 
    ? rect.width * 0.64  
    : rect.width;

  const contentFitsX = (contentWidth * currentZoom) <= availableWidth;
  const contentFitsY = (adjustedContentHeight * currentZoom) <= rect.height;

  if (contentFitsX && contentFitsY) {
    // Content fits - just center it
    console.log('[autoFitNodes] Content fits at current zoom, centering only');
    
    if (!disableTransition) {
      store.isTransitioning = true;
    }

    panX.value = targetCenterX - centerX * currentZoom;
    panY.value = rect.height / 2 - centerY * currentZoom;

    setTimeout(() => {
      if (!disableTransition) {
        store.isTransitioning = false;
      }
    }, 300);
  } else {
    // Content doesn't fit - need to adjust zoom but respect LOD boundaries
    console.log('[autoFitNodes] Content does not fit, adjusting zoom with LOD consideration');
    
    const scaleX = availableWidth / contentWidth;
    const scaleY = rect.height / adjustedContentHeight;
    let newZoom = Math.min(scaleX, scaleY, 1);

    // Clamp zoom to LOD boundaries to prevent jarring transitions
    const currentLODLevel = getLODLevel('dummy'); // Get current LOD based on zoom
    
    // If we're in a specific LOD level, try to stay within reasonable bounds
    if (currentZoom >= LOD_FULL_THRESHOLD && newZoom < LOD_PREVIEW_THRESHOLD) {
      // Large jump from full to preview/compact - clamp to preview threshold
      newZoom = Math.max(newZoom, LOD_PREVIEW_THRESHOLD);
    } else if (currentZoom >= LOD_PREVIEW_THRESHOLD && newZoom < LOD_COMPACT_THRESHOLD) {
      // Jump from preview to compact/dot - clamp to compact threshold  
      newZoom = Math.max(newZoom, LOD_COMPACT_THRESHOLD);
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
  }

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
  console.log('[FUNCTION DEBUG] checkDistanceFromNodes called');
  console.time('[FUNCTION DEBUG] checkDistanceFromNodes execution time');
  
  if (!canvasRef.value || !store.nodes.length || isWorkspaceOverview.value || isWelcomeScreen.value) {
    showFitButton.value = false;
    console.timeEnd('[FUNCTION DEBUG] checkDistanceFromNodes execution time');
    return;
  }

  console.log('[FUNCTION DEBUG] About to call calculateNodeBounds...');
  const bounds = calculateNodeBounds(null);
  if (!bounds) {
    showFitButton.value = false;
    console.timeEnd('[FUNCTION DEBUG] checkDistanceFromNodes execution time');
    return;
  }

  console.log('[FUNCTION DEBUG] About to call getBoundingClientRect...');
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
  
  console.timeEnd('[FUNCTION DEBUG] checkDistanceFromNodes execution time');
};

// Convert canvas nodes to force layout nodes
const convertToForceNodes = (): ForceNode[] => {
  const forceNodes = store.nodes.map(node => ({
    id: node.id,
    x: node.x || 0,
    y: node.y || 0,
    vx: 0,
    vy: 0,
    workspaceId: node.chatId, // Use chatId as workspaceId
    parentId: node.parentId,
    width: getEffectiveCardDimensions(node).width,
    height: getEffectiveCardDimensions(node).height,
    fixed: snappedNodeId.value === node.id // Don't move snapped nodes
  }));
  
  console.log('Sample force nodes:', forceNodes.slice(0, 3));
  console.log('Workspaces found:', [...new Set(forceNodes.map(n => n.workspaceId))]);
  
  return forceNodes;
};

// Apply force layout results back to canvas nodes
const applyForceLayout = (forceNodes: ForceNode[]) => {
  forceNodes.forEach(forceNode => {
    const canvasNode = store.nodes.find(n => n.id === forceNode.id);
    if (canvasNode && !forceNode.fixed) {
      // Smooth position updates to prevent jarring movements
      const smoothingFactor = 0.1;
      const targetX = forceNode.x;
      const targetY = forceNode.y;
      
      const newX = canvasNode.x + (targetX - canvasNode.x) * smoothingFactor;
      const newY = canvasNode.y + (targetY - canvasNode.y) * smoothingFactor;
      
      store.updateNodePosition(forceNode.id, { x: newX, y: newY });
    }
  });
};

// Start continuous force simulation
const startForceSimulation = () => {
  console.log('Force simulation triggered!');
  console.log('Current nodes:', store.nodes.length);
  
  if (forceLayoutService.isSimulating.value) {
    forceLayoutService.stopSimulation();
  }
  
  const forceNodes = convertToForceNodes();
  console.log('Force nodes created:', forceNodes.length);
  
  forceLayoutService.startSimulation(forceNodes, (updatedNodes) => {
    applyForceLayout(updatedNodes);
  });
};

// Stop force simulation
const stopForceSimulation = () => {
  forceLayoutService.stopSimulation();
};

// Apply single force layout pass (non-animated)
const applySingleForceLayout = () => {
  const forceNodes = convertToForceNodes();
  const layoutResult = forceLayoutService.applySingleLayout(forceNodes);
  
  // Apply results immediately
  layoutResult.forEach(forceNode => {
    store.updateNodePosition(forceNode.id, { x: forceNode.x, y: forceNode.y });
  });
};

// Enhanced physics reset with force layout
const resetWorkspacePhysics = () => {
  console.log('Applying force-based workspace physics...');
  applySingleForceLayout();
};

// Export currently visible nodes and connections
const exportVisibleNodes = () => {
  // Calculate current viewport bounds
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Convert screen coordinates to canvas coordinates
  const viewportLeft = -panX.value / zoom.value;
  const viewportRight = (-panX.value + viewportWidth) / zoom.value;
  const viewportTop = -panY.value / zoom.value;
  const viewportBottom = (-panY.value + viewportHeight) / zoom.value;
  
  // Filter nodes that are visible in the viewport
  const visibleNodes = store.nodes.filter(node => {
    const nodeLeft = node.x;
    const nodeRight = node.x + getEffectiveCardDimensions(node).width;
    const nodeTop = node.y;
    const nodeBottom = node.y + getEffectiveCardDimensions(node).height;
    
    // Check if node overlaps with viewport
    return !(nodeRight < viewportLeft || 
             nodeLeft > viewportRight || 
             nodeBottom < viewportTop || 
             nodeTop > viewportBottom);
  });
  
  // Find connections between visible nodes
  const visibleConnections = [];
  visibleNodes.forEach(node => {
    if (node.parentId) {
      const parentNode = visibleNodes.find(n => n.id === node.parentId);
      if (parentNode) {
        visibleConnections.push({
          id: `${node.parentId}-${node.id}`,
          startNodeId: node.parentId,
          endNodeId: node.id,
          startNode: {
            id: parentNode.id,
            title: parentNode.title,
            x: parentNode.x,
            y: parentNode.y
          },
          endNode: {
            id: node.id,
            title: node.title,
            x: node.x,
            y: node.y,
            branchMessageIndex: node.branchMessageIndex
          },
          label: store.getConnectionLabel?.(node.parentId, node.id) || ''
        });
      }
    }
  });
  
  const exportData = {
    viewport: {
      zoom: zoom.value,
      panX: panX.value,
      panY: panY.value,
      bounds: {
        left: viewportLeft,
        right: viewportRight,
        top: viewportTop,
        bottom: viewportBottom
      },
      dimensions: {
        width: viewportWidth,
        height: viewportHeight
      }
    },
    nodes: visibleNodes.map(node => ({
      id: node.id,
      title: node.title,
      type: node.type,
      x: node.x,
      y: node.y,
      parentId: node.parentId,
      branchMessageIndex: node.branchMessageIndex,
      chatId: node.chatId,
      messageCount: node.messages?.length || 0,
      lastMessage: node.messages?.slice(-1)[0]?.content?.slice(0, 100) || '',
      dimensions: getEffectiveCardDimensions(node)
    })),
    connections: visibleConnections,
    metadata: {
      exportedAt: new Date().toISOString(),
      totalNodesInCanvas: store.nodes.length,
      visibleNodeCount: visibleNodes.length,
      connectionCount: visibleConnections.length
    }
  };
  
  // Copy to clipboard
  navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
  console.log('Visible nodes exported to clipboard:', exportData);
  
  return exportData;
};

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.exportVisibleNodes = exportVisibleNodes;
}

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

// Flag to prevent duplicate zoom initialization
const initialZoomHandledByApp = ref(false);

// Check if mock data exists and auto-load all nodes
const checkAndLoadAllNodes = async () => {
  try {
    // Check if there are multiple workspaces with mock data
    const response = await fetch('http://127.0.0.1:5050/api/all-nodes');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.totalNodes > 0 && data.totalWorkspaces > 1) {
        console.log(`[checkAndLoadAllNodes] Found ${data.totalNodes} nodes across ${data.totalWorkspaces} workspaces - auto-loading all nodes`);
        
        // Load all nodes instead of showing workspace overview
        const result = await store.loadAllNodesMode();
        if (result.success) {
          console.log(`[checkAndLoadAllNodes] Successfully loaded ${result.totalNodes} nodes for performance testing`);
          
          // Force exit workspace overview mode to show all loaded nodes
          isWorkspaceOverview.value = false;
          
          return true;
        }
      }
    }
  } catch (error) {
    console.log('[checkAndLoadAllNodes] No mock data or error:', error);
  }
  return false;
};

// Method to set initial optimal zoom without transitions
const setInitialOptimalZoom = async () => {
  console.log('[setInitialOptimalZoom] Called from App.vue');
  initialZoomHandledByApp.value = true;
  
  await nextTick();
  const rect = canvasRef.value?.getBoundingClientRect();
  
  if (rect && store.nodes.length > 0) {
    const bounds = calculateNodeBounds();
    if (bounds) {
      const contentWidth = bounds.maxX - bounds.minX + 400; // Add padding
      const contentHeight = bounds.maxY - bounds.minY + 400; // Add padding
      
      // Reduce available width when right content panel is open
      const availableWidth = appStore.isRightContentPanelOpen 
        ? rect.width * 0.64  // Use 64% of width (100% - 36% panel)
        : rect.width;
      
      // Always start at minimum zoom for full overview
      const optimalZoom = ZOOM_MIN;
      
      // Calculate center position
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const targetPanX = rect.width / 2 - centerX * optimalZoom;
      const targetPanY = rect.height / 2 - centerY * optimalZoom;
      
      // Set values directly for immediate positioning without transition
      zoom.value = optimalZoom;
      panX.value = targetPanX;
      panY.value = targetPanY;
      
      console.log('[setInitialOptimalZoom] Set min zoom for overview:', {
        optimalZoom,
        bounds,
        targetPanX,
        targetPanY
      });
    }
  } else if (isWelcomeScreen.value) {
    // For welcome screen, center on input container
    const NEW_CHAT_X = -3000;
    const NEW_CHAT_Y = -3000;
    const targetZoom = 1.2;
    
    if (rect) {
      const targetPanX = rect.width / 2 - NEW_CHAT_X * targetZoom;
      const targetPanY = rect.height / 2 - NEW_CHAT_Y * targetZoom;
      
      zoom.value = targetZoom;
      panX.value = targetPanX;
      panY.value = targetPanY;
      
      console.log('[setInitialOptimalZoom] Set welcome screen zoom:', {
        targetZoom,
        targetPanX,
        targetPanY
      });
    }
  }
};

// Expose methods to parent component
defineExpose({
  autoFitNodes,
  setInitialOptimalZoom,
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

// Reset inactivity timer (disabled)
const resetInactivityTimer = () => {
  // Auto-center on idle has been disabled
};

// Throttled pan handler for better performance
let panFrame = null;
const handleMouseMove = (e) => {
  // Always check viewport return if panning, regardless of other conditions
  if (isPanning.value && lastPanPosition.value) {
    // Throttle pan updates to animation frame for smoother performance
    if (!panFrame) {
      panFrame = requestAnimationFrame(() => {
        panX.value = e.clientX - lastPanPosition.value.x;
        panY.value = e.clientY - lastPanPosition.value.y;
        viewportReturn.checkNodeVisibilityImmediate(canvasRef.value);
        panFrame = null;
      });
    }
  }
  
  if (snappedNodeId.value !== null) return;
  if (isClusterVizFocused.value) return;
  
  // Check if drawing tool should handle this event
  if (handleDrawingMouseMove(e)) return;
  
  resetInactivityTimer();

  // Update mouse position for coordinate system display
  mousePosition.value = { x: e.clientX, y: e.clientY };

  // Update crosshair position and canvas coordinates
  updateCrosshair(e.clientX, e.clientY);

  const worldMousePos = screenToWorld(e.clientX, e.clientY);
  
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

  if (isMultiDragging.value && dragStartPosition.value) {
    // Handle multi-node dragging with optimized batching
    const deltaX = worldMousePos.x - dragStartPosition.value.x;
    const deltaY = worldMousePos.y - dragStartPosition.value.y;

    // Batch position updates for smooth dragging
    const updates = [];
    selectedNodeIds.value.forEach(nodeId => {
      const node = store.nodes.find(n => n.id === nodeId);
      const startPos = multiDragStartPositions.value.get(nodeId);
      if (node && startPos) {
        const newX = startPos.x + deltaX;
        const newY = startPos.y + deltaY;
        updates.push({ id: nodeId, x: newX, y: newY });
        // Update visual position immediately (not reactive store)
        node.x = newX;
        node.y = newY;
      }
    });
    
    // Use optimized drag service for batched RAF updates
    dragOptimizer.updateDrag(updates);
    
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

    const newX = canvasX - store.dragOffset.x;
    const newY = canvasY - store.dragOffset.y;
    
    // Update visual position immediately
    const node = store.nodes.find(n => n.id === store.activeNode);
    if (node) {
      node.x = newX;
      node.y = newY;
      // Use optimized drag service for batched updates
      dragOptimizer.updateDrag([{ id: store.activeNode, x: newX, y: newY }]);
    }
  } else if (selectionRect.value.isActive) {
    // Handle selection rectangle
    selectionRect.value.currentX = e.clientX;
    selectionRect.value.currentY = e.clientY;
    
    // Update selection in real-time
    updateSelectionFromRect();
  }
  
  // Check viewport return during any drag operations (non-panning, since panning is handled at the top)
  if (store.isDragging || isMultiDragging.value || shapeDragState.value.isDragging || workspaceDragState.value.isDragging) {
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
  selectedNodeIds.value.clear();
  nodesInRect.forEach(node => {
    selectedNodeIds.value.add(node.id);
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

// Track recent dragging for dots (similar to BranchNode)
const dotWasRecentlyDragging = ref(false);

// Handle dot click - specific for dot LOD nodes  
const handleDotClick = async (e: MouseEvent, nodeId: string) => {
  e.stopPropagation();
  
  // Use same logic as BranchNode - check for recent dragging
  if (!dotWasRecentlyDragging.value) {
    handleNodeSelect(nodeId);
  }
};

// Handle dot mouse down - specific for dot LOD nodes
const handleDotMouseDown = (e: MouseEvent, node: any) => {
  e.stopPropagation();
  
  // Track drag state for dots
  let wasDragging = false;
  
  const startX = e.clientX;
  const startY = e.clientY;
  
  const handleMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = Math.abs(moveEvent.clientX - startX);
    const deltaY = Math.abs(moveEvent.clientY - startY);
    
    // If moved more than a few pixels, consider it dragging
    if (deltaX > 3 || deltaY > 3) {
      wasDragging = true;
      // Start regular drag logic
      handleDragStart(e, node);
      // Remove these temporary listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  };
  
  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (wasDragging) {
      // Set flag to prevent immediate click handling
      dotWasRecentlyDragging.value = true;
      setTimeout(() => {
        dotWasRecentlyDragging.value = false;
      }, 100);
    }
  };
  
  // Add temporary listeners to detect drag
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

// Handle drag start for nodes
const handleDragStart = (e, node) => {
  // Prevent dragging nodes when they are in full detail LOD
  if (getLODLevel(node.id) === 'full') {
    return;
  }
  
  // Check if multi-drag is already active (set by handleCanvasMouseDown)
  if (isMultiDragging.value && selectedNodeIds.value.has(node.id) && selectedNodeIds.value.size > 1) {
    // Multi-drag already set up, just ensure drag start position is set
    if (!dragStartPosition.value) {
      const canvasRect = canvasRef.value.getBoundingClientRect();
      const worldX = (e.clientX - canvasRect.left - panX.value) / zoom.value;
      const worldY = (e.clientY - canvasRect.top - panY.value) / zoom.value;
      dragStartPosition.value = { x: worldX, y: worldY };
    }
    return;
  }
  
  // Check if this node is part of a multi-selection but multi-drag isn't active yet
  if (selectedNodeIds.value.has(node.id) && selectedNodeIds.value.size > 1) {
    // Start multi-drag
    isMultiDragging.value = true;
    multiDragStartPositions.value.clear();
    multiDragShapePositions.value.clear();
    
    // Collect nodes for optimized drag
    const nodesToDrag = [];
    
    // Save start positions for all selected nodes
    selectedNodeIds.value.forEach(nodeId => {
      const selectedNode = store.nodes.find(n => n.id === nodeId);
      if (selectedNode) {
        multiDragStartPositions.value.set(nodeId, { x: selectedNode.x, y: selectedNode.y });
        nodesToDrag.push({ id: nodeId, x: selectedNode.x, y: selectedNode.y });
      }
    });
    
    // Initialize drag optimizer for smooth dragging
    dragOptimizer.startDrag(nodesToDrag);
    
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
    
    // Initialize drag optimizer for single node
    dragOptimizer.startDrag([{ id: node.id, x: node.x, y: node.y }]);
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
          autoFitNodes(true, true); // disableTransition=true, forceZoom=true
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
    // Check if we should auto-load all nodes for performance testing
    const autoLoadedAllNodes = await checkAndLoadAllNodes();
    
    if (!autoLoadedAllNodes) {
      console.log('[onMounted] Auto-load failed, using normal loadAllWorkspaces');
      // Load all workspaces as nodes on the infinite canvas (normal mode)
      await loadAllWorkspaces();
    } else {
      console.log('[onMounted] Auto-load succeeded, skipping loadAllWorkspaces');
    }

    console.log('[onMounted] Final node count in store:', store.nodes.length);
    console.log('[onMounted] Sample nodes:', store.nodes.slice(0, 3).map(n => ({ id: n.id, title: n.title, chatId: n.chatId })));
    
    store.nodes.forEach(node => {
      expandedNodes.value.add(node.id);
    });

    // Preload clustering data for faster topic switching
    // CRITICAL: If app loads at clustering zoom level, preload immediately
    if (zoom.value < 0.1) {
      console.log('[PRELOAD] App loaded at clustering zoom, preloading immediately');
      preloadClusteringData();
    } else {
      setTimeout(() => {
        preloadClusteringData();
      }, 1000); // Delay only if not immediately needed
    }

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
          if (store.nodes.length && !initialZoomHandledByApp.value) {
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
          // Initial zoom will be set by App.vue calling setInitialOptimalZoom
          console.log('[onMounted] Nodes present, zoom will be set by App.vue');
          await nextTick();
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

// Clustering functions
const shouldShowClustering = computed(() => {
  return zoom.value < 0.1; // Show clustering when zoom is less than 10%
});


// Workspace nodes with smooth visibility transitions
const workspaceFadeFactor = computed(() => {
  if (!isClusteringMode.value) return 1;
  
  if (zoom.value >= 0.01) { // Above 1% - gradual fade in
    // Smooth transition from 20% to 100% opacity over 1%-6% range
    const transitionFactor = Math.min(1, (zoom.value - 0.01) / 0.05);
    // Use easing for smoother feel
    const easedFactor = Math.pow(transitionFactor, 0.7);
    return 0.2 + easedFactor * 0.8; // 20% to 100% opacity
  } else {
    // Below 1% - fade out workspace nodes
    const minZoom = 0.003; // Fully faded at 0.3% zoom
    if (zoom.value <= minZoom) return 0;
    // Smooth fade between minZoom and 1%
    const fadeFactor = (zoom.value - minZoom) / (0.01 - minZoom);
    return fadeFactor * 0.2; // Up to 20% opacity
  }
});

// Topic label scaling - smooth continuous scaling
const topicLabelScaleFactor = computed(() => {
  if (!isClusteringMode.value) return 1;
  
  if (zoom.value >= 0.1) {
    // Above 10% - hide topics (normal node view)
    return 0;
  } else if (zoom.value >= 0.08) {
    // 8%-10% - fade out transition
    const fadeFactor = (0.1 - zoom.value) / (0.1 - 0.08);
    return fadeFactor * 0.8; // Fade from 0.8x to 0
  } else {
    // Below 8% - continuous inverse scaling for consistent size
    const baseScale = 1 / zoom.value;
    
    // Smooth adjustment factor based on zoom level
    // Use a smooth curve instead of stepped adjustments
    let adjustmentFactor;
    if (zoom.value < 0.005) {
      // Extreme zoom out - larger but controlled
      adjustmentFactor = 0.35;
    } else {
      // Smooth interpolation for normal clustering range
      // Increased factors for better text readability
      // At 8%: factor = 0.25 (scale = 3.1x)
      // At 5%: factor = 0.28 (scale = 5.6x)  
      // At 1%: factor = 0.32 (scale = 32x)
      // Logarithmic interpolation for smoothness
      const t = Math.log(zoom.value / 0.08) / Math.log(0.005 / 0.08);
      adjustmentFactor = 0.25 + t * (0.35 - 0.25);
    }
    
    return baseScale * adjustmentFactor;
  }
});


// Topic connections visibility - always visible in clustering mode
const topicConnectionOpacity = computed(() => {
  if (!isClusteringMode.value) return 0;
  
  // Always show connections when topics are visible
  if (zoom.value < 0.1) {
    // Stronger at mid-range zooms
    if (zoom.value >= 0.03 && zoom.value <= 0.08) {
      return 0.6; // Good visibility for navigation
    } else if (zoom.value < 0.03) {
      // Fade out at extreme zoom out
      return 0.3;
    } else {
      // Fade near transition to normal view
      return 0.4;
    }
  }
  return 0;
});

// Calculate converged position for workspace root nodes
const getConvergedNodePosition = (nodeId: string, originalX: number, originalY: number) => {
  if (!isClusteringMode.value || convergenceFactor.value === 0 || !clusteringData.value) {
    return { x: originalX, y: originalY };
  }
  
  // Find which topic this node belongs to
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node || node.parentId) {
    return { x: originalX, y: originalY }; // Only converge root nodes
  }
  
  // Find the workspace index (convert from frontend reverse order to clustering API order)
  const frontendIndex = chatStore.chats.findIndex(chat => {
    return store.nodes.some(n => n.chatId === chat.id && n.id === nodeId);
  });
  
  if (frontendIndex === -1) {
    return { x: originalX, y: originalY };
  }
  
  // Convert to clustering API index (creation order)
  const clusteringIndex = chatStore.chats.length - 1 - frontendIndex;
  
  // Find the topic assignment for this workspace
  const topicAssignment = clusteringData.value.clusters?.[clusteringIndex];
  if (typeof topicAssignment === 'undefined') {
    return { x: originalX, y: originalY };
  }
  
  // Find the topic center position
  const topicId = String(topicAssignment);
  const topicPosition = clusteringData.value.topic_positions?.[topicId];
  if (!topicPosition) {
    return { x: originalX, y: originalY };
  }
  
  // Interpolate between original orbital position and topic center
  const targetX = topicPosition.x;
  const targetY = topicPosition.y;
  
  return { x: originalX, y: originalY };
};

const triggerClustering = async () => {
  if (!chatStore.chats || chatStore.chats.length < 2) {
    return; // Need at least 2 workspaces to cluster
  }

  let loadingTimeout; // Declare here for proper scoping
  
  try {
    isClusteringTransition.value = true;
    
    // Use cached clustering data if available
    if (clusteringData.value && topicLabels.value.length > 0) {
      // Already have clustering data, just show it
      isClusteringMode.value = true;
      isClusteringTransition.value = false;
      return;
    }
    
    // Only show loading overlay if request takes more than 200ms (to avoid flash for cached responses)
    loadingTimeout = setTimeout(() => {
      isLoadingClustering.value = true;
    }, 200);
    
    // Call clustering API only if we don't have cached data
    const response = await fetch('http://127.0.0.1:5050/api/workspaces/cluster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        use_existing_data: true
      })
    });

    if (!response.ok) {
      throw new Error(`Clustering API failed: ${response.status}`);
    }

    const result = await response.json();
    clusteringData.value = result;

    // Use topic positions from the solar system layout
    topicLabels.value = Object.entries(result.topics).map(([topicId, topic]) => {
      const topicPos = result.topic_positions[topicId];
      
      return {
        id: topicId,
        topic: topic.topic,
        size: topic.size,
        coherence: topic.coherence,
        keywords: topic.keywords || [],
        position: { 
          x: topicPos.x,
          y: topicPos.y
        }
      };
    });
    
    // Store workspace orbital positions for node repositioning
    store.workspaceOrbitalPositions = result.workspace_positions;

    // CRITICAL: Reload nodes from database to get updated orbital positions
    await store.loadAllNodesMode();

    isClusteringMode.value = true;
    
  } catch (error) {
    console.error('Failed to cluster workspaces:', error);
  } finally {
    clearTimeout(loadingTimeout);
    isClusteringTransition.value = false;
    isLoadingClustering.value = false;
  }
};

const exitClustering = () => {
  isClusteringTransition.value = true;
  
  setTimeout(() => {
    isClusteringMode.value = false;
    // Keep cached data for faster re-entry
    // clusteringData.value = null;
    // topicLabels.value = [];
    isClusteringTransition.value = false;
  }, 300); // Allow transition animation
};

// Preload clustering data for faster switching
let isPreloading = false;
const preloadClusteringData = async () => {
  if (clusteringData.value || !chatStore.chats || chatStore.chats.length < 2 || isPreloading) {
    return; // Already cached, not enough workspaces, or already preloading
  }
  
  isPreloading = true;
  
  let loadingTimeout; // Declare here for proper scoping
  
  try {
    // Only show loading overlay if request takes more than 200ms (to avoid flash for cached responses)
    loadingTimeout = setTimeout(() => {
      isLoadingClustering.value = true;
    }, 200);
    
    const response = await fetch('http://127.0.0.1:5050/api/workspaces/cluster', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        use_existing_data: true
      })
    });

    if (response.ok) {
      const result = await response.json();
      clusteringData.value = result;
      
      // Prepare topic labels
      topicLabels.value = Object.entries(result.topics).map(([topicId, topic]) => {
        const topicPos = result.topic_positions[topicId];
        
        return {
          id: topicId,
          topic: topic.topic,
          size: topic.size,
          coherence: topic.coherence,
          keywords: topic.keywords || [],
          position: { 
            x: topicPos.x,
            y: topicPos.y
          }
        };
      });
      
      store.workspaceOrbitalPositions = result.workspace_positions;
      console.log('🚀 Preloaded clustering data for fast switching');
    }
  } catch (error) {
    console.log('Failed to preload clustering data:', error);
  } finally {
    clearTimeout(loadingTimeout);
    isPreloading = false;
    isLoadingClustering.value = false;
  }
};

// Watch zoom level to trigger clustering mode
watch(shouldShowClustering, (showClustering) => {
  if (showClustering && !isClusteringMode.value && !isClusteringTransition.value) {
    triggerClustering();
  } else if (!showClustering && isClusteringMode.value && !isClusteringTransition.value) {
    exitClustering();
  }
});

// Watch for zoom and pan changes to re-render grid
// PERFORMANCE: Skip during animations to prevent lag
let gridRenderPending = false;
watch([() => zoom.value, () => panX.value, () => panY.value], () => {
  // Skip grid updates only during node focus animations (not zoom/pan)
  if (isAnimating.value) return;
  
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
}, 500); // 500ms debounce

// Clean up debounced function on unmount
onBeforeUnmount(() => {
  debouncedFetchToolCallData.cancel();
});

watch(visibleNodes, (newNodes) => {
  // Only fetch when not dragging to avoid spamming API during drag operations
  if (!store.isDragging && !isPanning.value) {
    debouncedFetchToolCallData(newNodes);
  }
}, { deep: true });

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

/* Full viewport crosshair guidelines */
.viewport-crosshair {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}

.crosshair-line-h {
  position: absolute;
  left: 0;
  width: 100vw;
  height: 1px;
  background: oklch(from oklch(var(--bc)) l c h / 0.15);
  box-shadow: 0 0 2px oklch(from oklch(var(--b1)) l c h / 0.8);
  transform: translateY(-0.5px);
  mix-blend-mode: difference;
}

.crosshair-line-v {
  position: absolute;
  top: 0;
  width: 1px;
  height: 100vh;
  background: oklch(from oklch(var(--bc)) l c h / 0.15);
  box-shadow: 0 0 2px oklch(from oklch(var(--b1)) l c h / 0.8);
  transform: translateX(-0.5px);
  mix-blend-mode: difference;
}

.crosshair-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: oklch(var(--bc));
  box-shadow: 0 0 6px oklch(from oklch(var(--b1)) l c h / 0.8), 0 0 2px oklch(var(--bc));
  transform: translate(-3px, -3px);
  mix-blend-mode: difference;
}

.crosshair-coordinates {
  position: absolute;
  background: oklch(from oklch(var(--b1)) l c h / 0.95);
  color: oklch(var(--bc));
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  border: 1px solid oklch(from oklch(var(--bc)) l c h / 0.2);
  box-shadow: 0 4px 12px oklch(from oklch(var(--b1)) l c h / 0.3);
}

.crosshair-coordinates span {
  color: oklch(from oklch(var(--bc)) l c h / 0.6);
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

/* Clustering-specific loading overlay */
.clustering-load {
  background: oklch(from oklch(var(--b1)) l c h / 0.85);
  backdrop-filter: blur(20px);
}

.clustering-load .loading-title {
  color: oklch(var(--p));
  font-size: 1.5rem;
}

.clustering-load .loading-subtitle {
  color: oklch(var(--bc) / 0.7);
  font-size: 1rem;
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
  background: linear-gradient(1deg, 
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
  pointer-events: none;
}

/* LOD Toaster styles */
.lod-toaster {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.lod-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

/* Clustering mode transitions */
.enhanced-infinite-canvas.clustering-mode {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.enhanced-infinite-canvas.clustering-mode .nodes-layer {
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fade out non-root nodes in clustering mode */
.enhanced-infinite-canvas.clustering-mode [data-node-type="child"] {
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced visibility for root nodes in clustering */
.enhanced-infinite-canvas.clustering-mode [data-node-type="root"] {
  opacity: 1;
  transform: scale(1.1);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Topic cluster label animations */
@keyframes clusterAppear {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(20px);
  }
  60% {
    transform: scale(1.1) translateY(-5px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.topic-cluster-entering {
  animation: clusterAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>