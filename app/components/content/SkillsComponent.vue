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
let nebulaMesh = null;

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
  labelRenderer.domElement.style.pointerEvents = "auto";
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

  nebulaMesh = new THREE.Mesh(geometry, material);
  nebulaMesh.position.z = -500;
  scene.add(nebulaMesh);

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

  if (nebulaMesh && nebulaMesh.geometry) {
    nebulaMesh.geometry.dispose();
    nebulaMesh.geometry = new THREE.PlaneGeometry(width, height);
    nebulaMesh.material.uniforms.resolution.value.set(width, height);
  }

  labelRenderer.setSize(width, height);
}

// ===================================================
// 🌐 Node & Links (unchanged, labels as CSS2DObjects)
// ===================================================
function createNodes() {
  const nodes = [];
  const spacing = 80;
  const offsetX = -200;
  const offsetY = 250;

  // Pola posisi 18 titik berdasarkan bentuk rasi Gemini (dua sosok berdiri)
  const positions = [
    // Castor (kiri)
    [0, 0],
    [0, -spacing],
    [0, -spacing * 2],
    [0, -spacing * 3],
    [0, -spacing * 4], // vertikal utama
    [-spacing * 0.6, -spacing * 1.5], // tangan kiri
    [-spacing * 0.6, -spacing * 3.5], // kaki kiri
    [spacing * 0.6, -spacing * 1.5], // tangan kanan (menyilang)
    [spacing * 0.6, -spacing * 3.5], // kaki kanan (menyilang)
    // Pollux (kanan)
    [spacing * 3, 0],
    [spacing * 3, -spacing],
    [spacing * 3, -spacing * 2],
    [spacing * 3, -spacing * 3],
    [spacing * 3, -spacing * 4], // vertikal utama
    [spacing * 3.6, -spacing * 1.5], // tangan kanan luar
    [spacing * 3.6, -spacing * 3.5], // kaki kanan luar
    [spacing * 2.4, -spacing * 1.5], // tangan kiri dalam
    [spacing * 2.4, -spacing * 3.5], // kaki kiri dalam
  ];

  const scale = 1.6; // ubah nilai ini untuk memperbesar atau memperkecil

  for (let i = 0; i < props.content.length; i++) {
    const [x, y] = positions[i % positions.length];
    nodes.push({
      id: i,
      x: offsetX + x * scale,
      y: offsetY + y * scale,
      z: 0,
      isCenter: i === 0,
      data: props.content[i],
    });
  }

  return nodes;
}

function createLinks(nodes) {
  const links = [
    // Castor kiri (tulang belakang)
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    // tangan & kaki Castor
    [2, 5],
    [3, 6],
    [2, 7],
    [3, 8],
    // Pollux kanan (tulang belakang)
    [9, 10],
    [10, 11],
    [11, 12],
    [12, 13],
    // tangan & kaki Pollux
    [11, 14],
    [12, 15],
    [11, 16],
    [12, 17],
    // penghubung kepala
    [0, 9],
  ];

  return links.map(([a, b]) => ({ source: a, target: b }));
}

function createNodeIcons(nodes, scene) {
  return nodes.map((node) => {
    // Wrapper dikontrol oleh CSS2DRenderer
    const wrapper = document.createElement("div");
    wrapper.style.pointerEvents = "auto";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    // Elemen visual (yang akan di-scale)
    const el = document.createElement("div");
    el.style.width = "64px";
    el.style.height = "64px";
    el.style.borderRadius = "50%";
    el.style.boxShadow = "0 0 8px rgba(255, 255, 255, 0.2)";
    el.style.pointerEvents = "none"; // pointerEvent tetap di wrapper
    el.style.transformOrigin = "center center";
    el.style.transition = "box-shadow 0.3s ease";

    el.classList.add(
      "bg-base/10",
      "backdrop-blur-sm",
      "border",
      "border-base/20",
      "flex",
      "items-center",
      "justify-center"
    );

    const img = document.createElement("img");
    img.src = node.data.icon;
    img.style.width = "32px";
    img.style.height = "32px";
    img.style.pointerEvents = "none";
    el.appendChild(img);

    // tambahkan ke wrapper
    wrapper.appendChild(el);

    // Hover event di wrapper (bukan di el)
    wrapper.addEventListener("mouseenter", () => {
      gsap.to(el, {
        scale: 1.4,
        boxShadow: "0 0 15px rgba(255, 255, 255, 0.6)",
        duration: 0.4,
        ease: "power2.out",
      });
    });

    wrapper.addEventListener("mouseleave", () => {
      gsap.to(el, {
        scale: 1,
        boxShadow: "0 0 8px rgba(255, 255, 255, 0.2)",
        duration: 0.4,
        ease: "power2.inOut",
      });
    });

    // CSS2DObject pakai wrapper
    const label = new CSS2DObject(wrapper);
    label.position.set(node.x, node.y, 0);
    scene.add(label);

    return label;
  });
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
