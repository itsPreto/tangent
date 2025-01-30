<template>
    <div ref="containerRef" class="topic-cluster-viz h-full w-full">
        <!-- Granularity Toggle -->
        <div class="absolute top-4 left-4 z-10 flex gap-2">
            <button v-for="level in ['message', 'branch', 'workspace']" :key="level"
                class="px-3 py-1.5 text-sm rounded-full transition-colors" :class="[
                    granularity === level
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-base-200/90 backdrop-blur hover:bg-base-300/90'
                ]" @click="granularity = level">
                {{ level.charAt(0).toUpperCase() + level.slice(1) }}
            </button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading"
            class="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur z-20">
            <div class="loading loading-spinner loading-lg text-primary"></div>
        </div>

        <!-- Topic Labels Layer -->
        <div ref="labelRendererRef" class="absolute inset-0 pointer-events-none z-10"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';

interface Topic {
    id: string;
    label: string;
    score: number;
    messageCount: number;
    children?: Topic[];
}

interface Props {
    selectedTopic?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (e: 'select-topic', topic: Topic): void;
}>();

// Refs
const containerRef = ref<HTMLDivElement | null>(null);
const labelRendererRef = ref<HTMLDivElement | null>(null);
const isLoading = ref(true);
const granularity = ref<'message' | 'branch' | 'workspace'>('workspace');

// Scene objects using shallowRef to avoid reactivity issues
const sceneObjects = shallowRef({
    scene: new THREE.Scene(),
    camera: null as THREE.PerspectiveCamera | null,
    renderer: null as THREE.WebGLRenderer | null,
    labelRenderer: null as CSS2DRenderer | null,
    controls: null as OrbitControls | null,
    topicObjects: new Map<string, {
        mesh: THREE.Mesh,
        label: CSS2DObject,
        position: THREE.Vector3,
        connections: THREE.Line[]
    }>(),
});

// Mock data - replace with real data fetching
const topics = ref<Topic[]>([
    {
        id: '1',
        label: 'React Components',
        score: 0.85,
        messageCount: 15,
        children: []
    },
    {
        id: '2',
        label: 'Neural Networks',
        score: 0.92,
        messageCount: 8,
        children: []
    }
]);

const initScene = () => {
    if (!containerRef.value || !labelRendererRef.value) return;

    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;

    // Scene setup with fog for depth effect
    sceneObjects.value.scene.background = new THREE.Color(0xf0f0f0);
    sceneObjects.value.scene.fog = new THREE.Fog(0xf0f0f0, 200, 800);

    // Camera
    sceneObjects.value.camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
    sceneObjects.value.camera.position.set(200, 100, 200);
    sceneObjects.value.camera.lookAt(0, 0, 0);

    // Renderer
    sceneObjects.value.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    sceneObjects.value.renderer.setSize(width, height);
    sceneObjects.value.renderer.setPixelRatio(window.devicePixelRatio);
    sceneObjects.value.renderer.shadowMap.enabled = true;
    containerRef.value.appendChild(sceneObjects.value.renderer.domElement);

    // Label renderer
    sceneObjects.value.labelRenderer = new CSS2DRenderer();
    sceneObjects.value.labelRenderer.setSize(width, height);
    sceneObjects.value.labelRenderer.domElement.style.position = 'absolute';
    sceneObjects.value.labelRenderer.domElement.style.top = '0';
    sceneObjects.value.labelRenderer.domElement.style.pointerEvents = 'none';
    labelRendererRef.value.appendChild(sceneObjects.value.labelRenderer.domElement);

    // Controls
    sceneObjects.value.controls = new OrbitControls(
        sceneObjects.value.camera,
        sceneObjects.value.renderer.domElement
    );
    sceneObjects.value.controls.enableDamping = true;
    sceneObjects.value.controls.dampingFactor = 0.05;
    sceneObjects.value.controls.enableZoom = true;
    sceneObjects.value.controls.enablePan = true;
    sceneObjects.value.controls.minDistance = 100;
    sceneObjects.value.controls.maxDistance = 500;
    sceneObjects.value.controls.maxPolarAngle = Math.PI / 1.5;
    sceneObjects.value.controls.autoRotate = true;
    sceneObjects.value.controls.autoRotateSpeed = 0.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sceneObjects.value.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 200, 200);
    directionalLight.castShadow = true;
    sceneObjects.value.scene.add(directionalLight);

    // Add subtle hemisphere light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.2);
    sceneObjects.value.scene.add(hemiLight);
};

const handleResize = () => {
    if (!containerRef.value || !sceneObjects.value.camera || !sceneObjects.value.renderer || !sceneObjects.value.labelRenderer) return;

    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;

    sceneObjects.value.camera.aspect = width / height;
    sceneObjects.value.camera.updateProjectionMatrix();

    sceneObjects.value.renderer.setSize(width, height);
    sceneObjects.value.labelRenderer.setSize(width, height);
};

const createTopicSphere = (topic: Topic, index: number, total: number) => {
    const { scene } = sceneObjects.value;
    if (!scene || !containerRef.value) return;

    // Calculate sphere size based on score and message count
    const maxSize = 15;
    const minSize = 5;
    const size = minSize + (maxSize - minSize) * topic.score;

    // Create sphere with custom geometry
    const geometry = new THREE.SphereGeometry(size, 32, 32);
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(index / total, 0.7, 0.6),
        transparent: true,
        opacity: 0.8,
        metalness: 0.2,
        roughness: 0.3,
        clearcoat: 0.4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Calculate position on a 3D spiral
    const turns = 1;  // Number of turns around the spiral
    const heightScale = 100;  // Vertical scale of the spiral

    const theta = (index / total) * Math.PI * 2 * turns;
    const radius = 100 + (index / total) * 50;  // Increasing radius
    const y = ((index / total) - 0.5) * heightScale;

    const position = new THREE.Vector3(
        Math.cos(theta) * radius,
        y,
        Math.sin(theta) * radius
    );
    mesh.position.copy(position);

    // Create label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'topic-label px-2 py-1 bg-base-200/90 backdrop-blur rounded text-sm pointer-events-auto cursor-pointer';
    labelDiv.textContent = `${topic.label} (${topic.messageCount})`;
    labelDiv.addEventListener('click', () => emit('select-topic', topic));

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, size + 5, 0);
    mesh.add(label);

    scene.add(mesh);
    sceneObjects.value.topicObjects.set(topic.id, {
        mesh,
        label,
        position,
        connections: []
    });
};

const createConnections = () => {
    const { scene } = sceneObjects.value;
    if (!scene) return;

    // Create connections between topics
    topics.value.forEach((topic, i) => {
        if (i === 0) return;

        const startObj = sceneObjects.value.topicObjects.get(topics.value[i - 1].id);
        const endObj = sceneObjects.value.topicObjects.get(topic.id);

        if (startObj && endObj) {
            // Create curved connection
            const midPoint = new THREE.Vector3().addVectors(
                startObj.position,
                endObj.position
            ).multiplyScalar(0.5);

            // Add some height to the midpoint
            midPoint.y += 20;

            const curve = new THREE.QuadraticBezierCurve3(
                startObj.position,
                midPoint,
                endObj.position
            );

            const points = curve.getPoints(50);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);

            const material = new THREE.LineBasicMaterial({
                color: 0x999999,
                transparent: true,
                opacity: 0.3,
                linewidth: 1
            });

            const connection = new THREE.Line(geometry, material);
            scene.add(connection);

            // Store connection reference
            startObj.connections.push(connection);
            endObj.connections.push(connection);
        }
    });
};

const animate = () => {
    if (!sceneObjects.value.renderer || !sceneObjects.value.scene || !sceneObjects.value.camera) return;

    requestAnimationFrame(animate);

    if (sceneObjects.value.controls) {
        sceneObjects.value.controls.update();
    }

    sceneObjects.value.renderer.render(sceneObjects.value.scene, sceneObjects.value.camera);

    if (sceneObjects.value.labelRenderer) {
        sceneObjects.value.labelRenderer.render(sceneObjects.value.scene, sceneObjects.value.camera);
    }
};

// Lifecycle hooks
onMounted(async () => {
    await nextTick();
    initScene();

    // Create topic spheres
    topics.value.forEach((topic, index) => {
        createTopicSphere(topic, index, topics.value.length);
    });

    // Create connections after all spheres are created
    createConnections();

    // Start animation loop
    animate();

    // Add resize observer
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.value) {
        resizeObserver.observe(containerRef.value);
    }

    isLoading.value = false;

    // Cleanup
    onBeforeUnmount(() => {
        resizeObserver.disconnect();

        // Dispose of all Three.js objects
        sceneObjects.value.topicObjects.forEach((obj) => {
            obj.mesh.geometry.dispose();
            (obj.mesh.material as THREE.Material).dispose();
            obj.connections.forEach(connection => {
                connection.geometry.dispose();
                (connection.material as THREE.Material).dispose();
                sceneObjects.value.scene.remove(connection);
            });
            sceneObjects.value.scene.remove(obj.mesh);
        });

        sceneObjects.value.renderer?.dispose();
        sceneObjects.value.scene.clear();
    });
});

// Watch for topic selection
watch(() => props.selectedTopic, (newTopic) => {
    if (!newTopic || !sceneObjects.value.camera || !sceneObjects.value.controls) return;

    const selectedObject = sceneObjects.value.topicObjects.get(newTopic);
    if (selectedObject) {
        // Disable auto-rotation when focusing on a topic
        sceneObjects.value.controls.autoRotate = false;

        const targetPosition = selectedObject.position.clone();
        const distance = 100; // Distance to view from
        const offset = new THREE.Vector3(distance, distance / 2, distance);

        const duration = 1000;
        const startPosition = sceneObjects.value.camera.position.clone();
        const startTime = Date.now();

        const animateCamera = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            sceneObjects.value.camera!.position.lerpVectors(
                startPosition,
                targetPosition.clone().add(offset),
                easeProgress
            );

            sceneObjects.value.controls!.target.lerpVectors(
                sceneObjects.value.controls!.target,
                targetPosition,
                easeProgress
            );

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            } else {
                // Re-enable auto-rotation after animation
                setTimeout(() => {
                    if (sceneObjects.value.controls) {
                        sceneObjects.value.controls.autoRotate = true;
                    }
                }, 1000);
            }
        };

        animateCamera();
    }
});

// Watch for granularity changes
watch(granularity, (newGranularity) => {
    console.log(`Updating visualization for ${newGranularity} granularity`);
    // Here you would fetch and update topics based on granularity
});
</script>

<style scoped>
.topic-cluster-viz {
    position: relative;
    overflow: hidden;
    touch-action: none;
}

.topic-label {
    transition: all 0.2s ease;
    pointer-events: all;
    user-select: none;
    white-space: nowrap;
}

.topic-label:hover {
    transform: scale(1.1);
    background-color: rgb(var(--color-primary) / 0.1);
}

/* Ensure proper rendering of Three.js canvas */
:deep(canvas) {
    width: 100% !important;
    height: 100% !important;
    touch-action: none;
    outline: none;
}

/* Label renderer styling */
:deep(.css2drenderer) {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
}

/* Make labels interactive while keeping parent non-interactive */
:deep(.css2drenderer *) {
    pointer-events: all;
}

/* Ensure controls work properly */
:deep(.orbit-controls) {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* GPU acceleration */
:deep(canvas),
.topic-cluster-viz {
    transform: translateZ(0);
    backface-visibility: hidden;
    perspective: 1000px;
}

/* Loading state */
.loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}
</style>