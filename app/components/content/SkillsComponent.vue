<template>
  <div ref="container" class="w-screen h-screen bg-black relative">
    <canvas ref="canvas" class="w-full h-full"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { gsap } from "gsap";

const container = ref(null);
const canvas = ref(null);
let animationId;

onMounted(() => {
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;

  // --- Scene & Camera ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(80, 80, 120);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
  });
  renderer.setSize(width, height);

  // --- OrbitControls ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true;
  controls.enableZoom = true;

  // --- Lights ---
  const pointLight = new THREE.PointLight(0xffffff, 1);
  pointLight.position.set(50, 50, 50);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // --- Nodes (center + random) ---
  const nodes = [];

  // Node center
  nodes.push({
    id: 0,
    x: 0,
    y: 0,
    z: 0,
    isCenter: true,
  });

  // Node random
  const nodeCount = 40; // jumlah node selain center
  const range = 120; // jarak random dari origin

  for (let i = 1; i <= nodeCount; i++) {
    nodes.push({
      id: i,
      x: (Math.random() - 0.5) * range,
      y: (Math.random() - 0.5) * range,
      z: (Math.random() - 0.5) * range,
      isCenter: false,
    });
  }

  // --- Links antar node dekat ---
  const links = [];
  const linkThreshold = 40;

  nodes.forEach((node, i) => {
    nodes.forEach((other, j) => {
      if (i >= j) return;
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const dz = node.z - other.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist <= linkThreshold) {
        links.push({ source: i, target: j });
      }
    });
  });

  // --- Node Meshes ---
  const nodeMeshes = nodes.map((node) => {
    const size = node.isCenter ? 10 : 4;
    const color = node.isCenter ? 0xff0000 : 0x57b846;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: node.isCenter ? 0xff4444 : 0x00ff00,
        emissiveIntensity: 0.5,
      })
    );
    mesh.position.set(node.x, node.y, node.z);
    scene.add(mesh);

    // Floating animation untuk node biasa
    if (!node.isCenter) {
      gsap.to(mesh.position, {
        y: mesh.position.y + Math.random() * 2,
        duration: 1.5,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        delay: Math.random(),
      });
    }

    return mesh;
  });

  // --- Link Meshes ---
  const linkMeshes = links.map((link) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(
        nodes[link.source].x,
        nodes[link.source].y,
        nodes[link.source].z
      ),
      new THREE.Vector3(
        nodes[link.target].x,
        nodes[link.target].y,
        nodes[link.target].z
      ),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    scene.add(line);
    return line;
  });

  // --- Update links setiap frame ---
  function animateLinks() {
    linkMeshes.forEach((line, i) => {
      const sourceMesh = nodeMeshes[links[i].source];
      const targetMesh = nodeMeshes[links[i].target];
      const positions = line.geometry.attributes.position.array;

      positions[0] = sourceMesh.position.x;
      positions[1] = sourceMesh.position.y;
      positions[2] = sourceMesh.position.z;

      positions[3] = targetMesh.position.x;
      positions[4] = targetMesh.position.y;
      positions[5] = targetMesh.position.z;

      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  // --- Animate Loop ---
  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    animateLinks();
    renderer.render(scene, camera);
  }
  animate();
});

onBeforeUnmount(() => cancelAnimationFrame(animationId));
</script>
