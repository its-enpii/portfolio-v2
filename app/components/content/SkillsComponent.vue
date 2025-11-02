<template>
  <div class="w-screen h-screen bg-black relative overflow-hidden">
    <canvas ref="canvas" class="w-full h-full"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import { gsap } from "gsap";

const props = defineProps(["content"]);

const canvas = ref(null);
let animationId = null;
let scene, camera, renderer, labelRenderer;
let smokeUniforms;
let smokeMesh = null;

onMounted(() => {
  initScene();
  window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  if (animationId) cancelAnimationFrame(animationId);
  renderer?.dispose && renderer.dispose();
});

// ---------- INIT SCENE ----------
function initScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  scene = new THREE.Scene();

  // orthographic camera (kamu pakai ini)
  camera = new THREE.OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    -1000,
    2000
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio || 1);

  // label renderer (CSS labels)
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  canvas.value.parentElement.appendChild(labelRenderer.domElement);

  // add realistic thin fog (shader-based plane)
  addSmoke();
  const nebulaMaterial = addNebulaBackground();

  // Node & Links (kept as you had)
  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.AmbientLight(0x99ccff, 0.4));

  const nodes = createNodes();
  const nodeMeshes = createNodeIcons(nodes, group);
  const links = createLinks(nodes);
  const linkMeshes = createLinkMeshes(links, nodes, group);

  // center group
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.position.x = -center.x;
  group.position.y = -center.y;

  // animation loop
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    animateSmoke();
    nebulaMaterial.uniforms.time.value += 0.5; // sesuaikan kecepatan
    updateLinks(linkMeshes, nodeMeshes, links);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  };
  animate();
}

// ===================================================
// ✨ Particle Overlay dengan Depth + Intensitas Realistis
// ===================================================
let particleGroup;
let particleSpeeds = [];

function addSmoke() {
  const particleCount = 250;
  particleGroup = new THREE.Group();

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);
  const opacities = new Float32Array(particleCount);

  const color1 = new THREE.Color(0x88ccff);
  const color2 = new THREE.Color(0xffffff);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * window.innerWidth * 1.5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * window.innerHeight * 1.5;
    positions[i * 3 + 2] = -400 + Math.random() * 800;

    // ukuran dan opacity berdasarkan kedalaman (Z)
    const depthFactor = 1 - Math.abs(positions[i * 3 + 2]) / 100;
    sizes[i] = 2 + depthFactor * 6;
    opacities[i] = 0.3 + depthFactor * 0.7;

    const c = color1.clone().lerp(color2, Math.random());
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    particleSpeeds.push({
      x: (Math.random() - 0.5) * 0.05,
      y: (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.3,
    });
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute float opacity;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float time;
      void main() {
        vColor = color;
        vOpacity = opacity;
        vec3 pos = position;
        pos.x += sin(time * 0.3 + position.y * 0.01) * 2.0;
        pos.y += cos(time * 0.4 + position.x * 0.01) * 2.0;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor, alpha * vOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 999;
  particleGroup.add(points);
  scene.add(particleGroup);
}

// ===================================================
// 🌬️ Animasi partikel dengan Depth Movement
// ===================================================
function animateSmoke() {
  if (!particleGroup) return;
  const points = particleGroup.children[0];
  if (!points) return;

  const positions = points.geometry.attributes.position.array;
  const opacities = points.geometry.attributes.opacity.array;
  const sizes = points.geometry.attributes.size.array;
  points.material.uniforms.time.value += 0.01;

  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3] += particleSpeeds[i].x * 3; // x lebih terasa
    positions[i * 3 + 1] += particleSpeeds[i].y * 3; // y lebih terasa
    positions[i * 3 + 2] += particleSpeeds[i].z * 5; // z lebih cepat

    // update ukuran & opacity sesuai kedalaman baru
    const depthFactor = 1 - Math.abs(positions[i * 3 + 2]) / 400;
    sizes[i] = 2 + depthFactor * 6;
    opacities[i] = 0.3 + depthFactor * 0.7;

    // reset posisi bila keluar dari area
    if (positions[i * 3 + 2] > 400) positions[i * 3 + 2] = -400;
    if (positions[i * 3 + 2] < -400) positions[i * 3 + 2] = 400;
  }

  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.size.needsUpdate = true;
  points.geometry.attributes.opacity.needsUpdate = true;
}

function addNebulaBackground() {
  const geometry = new THREE.PlaneGeometry(
    window.innerWidth,
    window.innerHeight,
    1,
    1
  );

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;

      // Simple 2D noise
      float rand(vec2 co){
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }
      float noise(vec2 pos){
          vec2 i = floor(pos);
          vec2 f = fract(pos);
          float a = rand(i);
          float b = rand(i + vec2(1.0, 0.0));
          float c = rand(i + vec2(0.0, 1.0));
          float d = rand(i + vec2(1.0, 1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      void main() {
        vec2 uv = vUv * 3.0;
        float n = noise(uv + time*0.05);
        vec3 color = mix(vec3(0.05,0.0,0.1), vec3(0.4,0.1,0.5), n);
        gl_FragColor = vec4(color,0.3);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -500; // di belakang partikel
  scene.add(mesh);

  return material;
}

// ===================================================
// 📏 Resize Handler
// ===================================================
function handleResize() {
  if (!camera || !renderer || !labelRenderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  // update smoke plane geometry to match new size
  if (smokeMesh && smokeMesh.geometry) {
    smokeMesh.geometry.dispose();
    smokeMesh.geometry = new THREE.PlaneGeometry(
      window.innerWidth,
      window.innerHeight
    );
  }

  labelRenderer.setSize(width, height);
}

// ===================================================
// 🌐 Node & Links (unchanged, labels as CSS2DObjects)
// ===================================================
function createNodes() {
  const nodes = [];
  const count = props.content.length;
  nodes.push({
    id: 0,
    x: 0,
    y: 0,
    z: 0,
    isCenter: true,
    data: props.content[0],
  });

  const levelSpacing = 80;
  const nodeSpacing = 80;
  const levels = Math.ceil(Math.log2(count));
  let index = 1;

  for (let level = 1; level <= levels; level++) {
    const numNodes = Math.min(Math.pow(2, level - 1), count - index);
    const totalWidth = (numNodes - 1) * nodeSpacing;
    for (let i = 0; i < numNodes && index < count; i++) {
      const x = i * nodeSpacing - totalWidth / 2;
      const y = -level * levelSpacing;
      nodes.push({
        id: index,
        x,
        y,
        z: 0,
        isCenter: false,
        data: props.content[index],
      });
      index++;
    }
  }
  return nodes;
}

function createNodeIcons(nodes, scene) {
  return nodes.map((node) => {
    const el = document.createElement("div");
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.width = node.isCenter ? "50px" : "32px";
    el.style.height = node.isCenter ? "50px" : "32px";
    el.style.borderRadius = "50%";
    el.style.background = node.isCenter
      ? "rgba(255,0,0,0.3)"
      : "rgba(0,255,0,0.2)";
    el.style.boxShadow = node.isCenter
      ? "0 0 12px rgba(255,0,0,0.8)"
      : "0 0 8px rgba(0,255,0,0.5)";
    const img = document.createElement("img");
    img.src = node.data.icon;
    img.style.width = node.isCenter ? "28px" : "20px";
    img.style.height = node.isCenter ? "28px" : "20px";
    el.appendChild(img);

    const label = new CSS2DObject(el);
    label.position.set(node.x, node.y, 0);
    scene.add(label);
    return label;
  });
}

function createLinks(nodes) {
  const links = [];
  nodes.forEach((a, i) => {
    nodes.forEach((b, j) => {
      if (i >= j) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 140) links.push({ source: i, target: j });
    });
  });
  return links;
}

function createLinkMeshes(links, nodes, scene) {
  return links.map((link) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(nodes[link.source].x, nodes[link.source].y, 0),
      new THREE.Vector3(nodes[link.target].x, nodes[link.target].y, 0),
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        opacity: 0.25,
        transparent: true,
      })
    );
    scene.add(line);
    return line;
  });
}

function updateLinks(linkMeshes, nodeMeshes, links) {
  linkMeshes.forEach((line, i) => {
    const src = nodeMeshes[links[i].source];
    const tgt = nodeMeshes[links[i].target];
    const pos = line.geometry.attributes.position.array;
    pos[0] = src.position.x;
    pos[1] = src.position.y;
    pos[3] = tgt.position.x;
    pos[4] = tgt.position.y;
    line.geometry.attributes.position.needsUpdate = true;
  });
}
</script>

<style scoped>
canvas {
  display: block;
}
</style>
