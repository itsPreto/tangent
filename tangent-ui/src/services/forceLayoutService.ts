import { ref } from 'vue';

export interface ForceSettings {
  // Node separation forces
  siblingRepulsion: number;        // Force between sibling nodes in same workspace
  parentChildAttraction: number;   // Force between parent and child nodes
  workspaceRepulsion: number;      // Force between nodes from different workspaces
  
  // Global physics settings
  damping: number;                 // Energy damping factor (0-1)
  timeStep: number;                // Physics simulation time step
  minDistance: number;             // Minimum distance between any two nodes
  maxForce: number;                // Maximum force magnitude to prevent instability
  
  // Distance targets
  siblingDistance: number;         // Target distance between siblings (1000px)
  parentChildDistance: number;     // Target distance between parent/child
  workspaceDistance: number;       // Target distance between different workspaces (4000px)
}

export interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  workspaceId?: string;
  parentId?: string;
  width: number;
  height: number;
  fixed?: boolean; // If true, node won't move during simulation
}

class ForceLayoutService {
  // Default force settings
  private defaultSettings: ForceSettings = {
    siblingRepulsion: 0.8,
    parentChildAttraction: 0.6,
    workspaceRepulsion: 1.2,
    damping: 0.9,
    timeStep: 0.016, // ~60fps
    minDistance: 50,
    maxForce: 500,
    siblingDistance: 1000,
    parentChildDistance: 800,
    workspaceDistance: 4000
  };

  public settings = ref<ForceSettings>({ ...this.defaultSettings });
  public isSimulating = ref(false);
  private animationFrame: number | null = null;
  private nodes: Node[] = [];

  // Calculate repulsion force between two nodes
  private calculateRepulsion(node1: Node, node2: Node, targetDistance: number, strength: number): { fx: number; fy: number } {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      return { fx: 0, fy: 0 };
    }
    
    // Only apply repulsion if nodes are closer than target distance
    if (distance >= targetDistance) {
      return { fx: 0, fy: 0 };
    }
    
    // Normalize direction
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Stronger repulsion when nodes are very close
    const distanceRatio = distance / targetDistance;
    const forceMagnitude = strength * (1 - distanceRatio) * 100; // Scale up force
    const clampedForce = Math.min(forceMagnitude, this.settings.value.maxForce);
    
    return {
      fx: -nx * clampedForce, // Negative because it's repulsion
      fy: -ny * clampedForce
    };
  }

  // Calculate attraction force between two nodes
  private calculateAttraction(node1: Node, node2: Node, targetDistance: number, strength: number): { fx: number; fy: number } {
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      return { fx: 0, fy: 0 };
    }
    
    // Normalize direction
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Calculate force magnitude - stronger when further from target distance
    const distanceError = distance - targetDistance;
    const forceMagnitude = strength * Math.abs(distanceError) * 0.5; // Increased scale factor
    const clampedForce = Math.min(forceMagnitude, this.settings.value.maxForce);
    
    // Apply force in direction to reach target distance
    const forceDirection = distanceError > 0 ? 1 : -1; // Attraction if too far, repulsion if too close
    
    return {
      fx: nx * clampedForce * forceDirection,
      fy: ny * clampedForce * forceDirection
    };
  }

  // Single physics simulation step
  private simulationStep(): boolean {
    const settings = this.settings.value;
    let maxMovement = 0;
    let totalForces = 0;
    
    // Reset forces
    this.nodes.forEach(node => {
      if (!node.fixed) {
        node.vx = node.vx || 0;
        node.vy = node.vy || 0;
      }
    });

    // Calculate forces between all node pairs
    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      if (nodeA.fixed) continue;
      
      let totalFx = 0;
      let totalFy = 0;
      
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        
        const nodeB = this.nodes[j];
        
        // Determine relationship and apply appropriate forces
        const sameWorkspace = nodeA.workspaceId === nodeB.workspaceId;
        const isParentChild = nodeA.parentId === nodeB.id || nodeB.parentId === nodeA.id;
        
        if (sameWorkspace) {
          if (isParentChild) {
            // Parent-child attraction
            const force = this.calculateAttraction(
              nodeA, nodeB, 
              settings.parentChildDistance, 
              settings.parentChildAttraction
            );
            totalFx += force.fx;
            totalFy += force.fy;
          } else {
            // Sibling repulsion
            const force = this.calculateRepulsion(
              nodeA, nodeB,
              settings.siblingDistance,
              settings.siblingRepulsion
            );
            totalFx += force.fx;
            totalFy += force.fy;
          }
        } else {
          // Different workspace repulsion
          const force = this.calculateRepulsion(
            nodeA, nodeB,
            settings.workspaceDistance,
            settings.workspaceRepulsion
          );
          totalFx += force.fx;
          totalFy += force.fy;
        }
      }
      
      totalForces += Math.abs(totalFx) + Math.abs(totalFy);
      
      // Apply forces to velocity
      nodeA.vx += totalFx * settings.timeStep;
      nodeA.vy += totalFy * settings.timeStep;
      
      // Apply damping
      nodeA.vx *= settings.damping;
      nodeA.vy *= settings.damping;
      
      // Update position
      const newX = nodeA.x + nodeA.vx * settings.timeStep;
      const newY = nodeA.y + nodeA.vy * settings.timeStep;
      
      // Track maximum movement for convergence detection
      const movement = Math.sqrt((newX - nodeA.x) ** 2 + (newY - nodeA.y) ** 2);
      maxMovement = Math.max(maxMovement, movement);
      
      nodeA.x = newX;
      nodeA.y = newY;
    }
    
    console.log('Simulation step - maxMovement:', maxMovement, 'totalForces:', totalForces);
    
    // Return whether simulation should continue (not converged)
    return maxMovement > 0.5; // Stop when nodes move less than 0.5px
  }

  // Start force simulation
  startSimulation(nodes: Node[], onUpdate?: (nodes: Node[]) => void) {
    console.log('ForceLayoutService.startSimulation called with', nodes.length, 'nodes');
    
    this.nodes = nodes.map(node => ({
      ...node,
      vx: node.vx || 0,
      vy: node.vy || 0
    }));
    
    console.log('Simulation starting, isSimulating:', this.isSimulating.value);
    this.isSimulating.value = true;
    console.log('Simulation state set to:', this.isSimulating.value);
    
    const animate = () => {
      if (!this.isSimulating.value) {
        console.log('Animation stopped, isSimulating is false');
        return;
      }
      
      const shouldContinue = this.simulationStep();
      console.log('Simulation step completed, shouldContinue:', shouldContinue);
      
      // Call update callback
      if (onUpdate) {
        onUpdate([...this.nodes]);
      }
      
      if (shouldContinue) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        console.log('Simulation converged, stopping');
        this.stopSimulation();
      }
    };
    
    console.log('Starting animation frame');
    this.animationFrame = requestAnimationFrame(animate);
  }

  // Stop force simulation
  stopSimulation() {
    this.isSimulating.value = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Apply single layout pass (non-animated)
  applySingleLayout(nodes: Node[]): Node[] {
    this.nodes = nodes.map(node => ({
      ...node,
      vx: node.vx || 0,
      vy: node.vy || 0
    }));
    
    // Run multiple steps for quick layout
    for (let i = 0; i < 50; i++) {
      const shouldContinue = this.simulationStep();
      if (!shouldContinue) break;
    }
    
    return [...this.nodes];
  }

  // Preset configurations
  getPresets() {
    return {
      tight: {
        ...this.defaultSettings,
        siblingDistance: 600,
        workspaceDistance: 2000,
        siblingRepulsion: 1.0,
        workspaceRepulsion: 1.5
      },
      normal: this.defaultSettings,
      spacious: {
        ...this.defaultSettings,
        siblingDistance: 1500,
        workspaceDistance: 6000,
        siblingRepulsion: 0.6,
        workspaceRepulsion: 1.0
      }
    };
  }

  // Apply preset
  applyPreset(preset: 'tight' | 'normal' | 'spacious') {
    this.settings.value = { ...this.getPresets()[preset] };
  }

  // Reset to default settings
  resetSettings() {
    this.settings.value = { ...this.defaultSettings };
  }
}

export const forceLayoutService = new ForceLayoutService();