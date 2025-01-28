<script setup lang="ts">
import { ref, watch, onMounted, computed, shallowRef } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';

interface ChatSummary {
    id: string;
    title: string;
    summary: string;
    timestamp: string;
    hasReflection: boolean;
}

interface TopicCluster {
    id: string;
    topic: string;
    size: number;
    coherence: number;
    summaries: ChatSummary[];
}

interface ClusterNode {
    id: string;
    name: string;
    type: 'topic' | 'summary';
    size: number;
    cluster?: string;
}

// Mock data
const mockData = {
    topics: [
        {
            id: '1',
            topic: 'Code Generation',
            size: 5,
            coherence: 0.85,
            summaries: [
                {
                    id: '1a',
                    title: 'React Component Discussion',
                    summary: 'Discussion about building reusable React components',
                    timestamp: '2024-01-20T10:00:00Z',
                    hasReflection: true
                },
            ]
        },
        {
            id: '2',
            topic: 'AI Concepts',
            size: 3,
            coherence: 0.92,
            summaries: [
                {
                    id: '2a',
                    title: 'Neural Networks Explained',
                    summary: 'Overview of neural network architectures',
                    timestamp: '2024-01-19T15:30:00Z',
                    hasReflection: false
                },
            ]
        },
    ] as TopicCluster[]
};

const props = defineProps<{
    width?: number;
    height?: number;
    selectedTopic?: string;
}>();

const emit = defineEmits<{
    (e: 'select-node', node: ClusterNode): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const nodes = shallowRef<ClusterNode[]>([]);

// Use shallowRef for Three.js objects to avoid reactivity issues
const sceneObjects = shallowRef({
    scene: null as THREE.Scene | null,
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    labelRenderer: null as CSS2DRenderer | null,
    controls: null as OrbitControls | null,
    nodeObjects: new Map<string, {
        mesh: THREE.Mesh,
        label: CSS2DObject,
        position: THREE.Vector3
    }>(),
});

const initializeNodes = () => {
    const topicNodes: ClusterNode[] = mockData.topics.map(topic => ({
        id: topic.id,
        name: topic.topic,
        type: 'topic',
        size: 30 + (topic.size * 2),
    }));

    const summaryNodes: ClusterNode[] = [];
    mockData.topics.forEach(topic => {
        topic.summaries.forEach(summary => {
            summaryNodes.push({
                id: summary.id,
                name: summary.title,
                type: 'summary',
                size: 15,
                cluster: topic.id,
            });
        });
    });

    nodes.value = [...topicNodes, ...summaryNodes];
};

// In TopicClusterViz component
watch(() => [props.width, props.height], () => {
    handleResize();
    // Add camera aspect ratio update if needed
    if (sceneObjects.value.camera) {
        sceneObjects.value.camera.aspect = (props.width || 800) / (props.height || 600);
        sceneObjects.value.camera.updateProjectionMatrix();
    }
});
const createScene = () => {
    if (!containerRef.value) return;

    const width = props.width || 800;
    const height = props.height || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 500;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.value.appendChild(renderer.domElement);

    // Label renderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    containerRef.value.appendChild(labelRenderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, labelRenderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    sceneObjects.value = {
        scene,
        camera,
        renderer,
        labelRenderer,
        controls,
        nodeObjects: new Map(),
    };
};

const createNodes = () => {
    const { scene, nodeObjects } = sceneObjects.value;
    if (!scene) return;

    nodes.value.forEach((node, index) => {
        const geometry = new THREE.SphereGeometry(node.size * 0.5, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: node.type === 'topic' ? 0x60A5FA : 0xF87171,
            transparent: true,
            opacity: 0.8,
        });

        const mesh = new THREE.Mesh(geometry, material);

        const phi = Math.acos(-1 + (2 * index) / nodes.value.length);
        const theta = Math.sqrt(nodes.value.length * Math.PI) * phi;
        const radius = 200;

        const position = new THREE.Vector3(
            radius * Math.cos(theta) * Math.sin(phi),
            radius * Math.sin(theta) * Math.sin(phi),
            radius * Math.cos(phi)
        );

        mesh.position.copy(position);

        // Create label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'node-label';
        labelDiv.textContent = node.name;
        labelDiv.style.color = 'black';
        labelDiv.style.padding = '2px';
        labelDiv.style.fontSize = node.type === 'topic' ? '14px' : '12px';

        const label = new CSS2DObject(labelDiv);
        label.position.copy(position);

        scene.add(mesh);
        scene.add(label);

        nodeObjects.set(node.id, { mesh, label, position });
    });
};

const createConnections = () => {
    const { scene, nodeObjects } = sceneObjects.value;
    if (!scene) return;

    mockData.topics.forEach(topic => {
        const topicNodeObj = nodeObjects.get(topic.id);

        topic.summaries.forEach(summary => {
            const summaryNodeObj = nodeObjects.get(summary.id);

            if (topicNodeObj && summaryNodeObj) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    topicNodeObj.position,
                    summaryNodeObj.position,
                ]);
                const material = new THREE.LineBasicMaterial({
                    color: 0x999999,
                    transparent: true,
                    opacity: 0.6,
                });
                const line = new THREE.Line(geometry, material);
                scene.add(line);
            }
        });
    });
};

const animate = () => {
    const { renderer, scene, camera, labelRenderer, controls } = sceneObjects.value;
    if (!renderer || !scene || !camera || !labelRenderer || !controls) return;

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
};

const handleResize = () => {
    const { camera, renderer, labelRenderer } = sceneObjects.value;
    if (!camera || !renderer || !labelRenderer || !containerRef.value) return;

    const width = props.width || 800;
    const height = props.height || 600;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
};

const handleNodeClick = (event: MouseEvent) => {
    const { camera, scene, nodeObjects } = sceneObjects.value;
    if (!camera || !scene) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / (props.width || 800)) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / (props.height || 600)) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        for (const [nodeId, nodeObj] of nodeObjects.entries()) {
            if (nodeObj.mesh === clickedMesh) {
                const clickedNode = nodes.value.find(node => node.id === nodeId);
                if (clickedNode) {
                    emit('select-node', clickedNode);
                }
                break;
            }
        }
    }
};

onMounted(() => {
    initializeNodes();
    createScene();
    createNodes();
    createConnections();
    animate();

    window.addEventListener('resize', handleResize);
    containerRef.value?.addEventListener('click', handleNodeClick);

    return () => {
        window.removeEventListener('resize', handleResize);
        containerRef.value?.removeEventListener('click', handleNodeClick);

        // Cleanup Three.js objects
        const { scene, renderer, labelRenderer } = sceneObjects.value;
        if (scene) {
            scene.clear();
        }
        renderer?.dispose();
        labelRenderer?.dispose();
    };
});

watch(() => props.selectedTopic, (newTopic) => {
    const { camera, controls, nodeObjects } = sceneObjects.value;
    if (!camera || !controls || !newTopic) return;

    const selectedNodeObj = nodeObjects.get(newTopic);
    if (selectedNodeObj) {
        const position = selectedNodeObj.position.clone();
        position.z += 100;

        const duration = 1000;
        const startPosition = camera.position.clone();
        const startTime = Date.now();

        const animateCamera = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            camera.position.lerpVectors(startPosition, position, progress);
            controls.target.copy(selectedNodeObj.position);

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        };

        animateCamera();
    }
});
</script>

<template>
    <div ref="containerRef" class="topic-cluster-viz"
        :style="{ width: `${width || 800}px`, height: `${height || 600}px` }" />
</template>

<style scoped>
.topic-cluster-viz {
    position: relative;
    overflow: hidden;
}

.node-label {
    background: rgba(255, 255, 255, 0.8);
    border-radius: 4px;
    cursor: pointer;
    padding: 2px 4px;
    pointer-events: none;
    white-space: nowrap;
}
</style>