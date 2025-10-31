<template>
  <div class="w-screen h-screen bg-black relative">
    <canvas ref="canvasRef" class="w-full h-full"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import { gsap } from "gsap";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";

const canvasRef = ref(null);
let renderer, scene, camera, raycaster, mouse;
let nodes = [];
let animationId;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let activeNode = null;
let moveCameraTo;

function createScene(canvas) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#000");

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Kamera agak tinggi dan menunduk agar horizon tak terlihat
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, -10);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);

  // --- Tambahkan CSS3DRenderer ---
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(width, height);
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.top = "0";
  canvas.parentElement.appendChild(cssRenderer.domElement);

  // Cahaya lembut
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const point = new THREE.PointLight(0xffffff, 1);
  point.position.set(10, 25, 10);
  scene.add(ambient, point);

  // === ITEM ROADMAP ===
  const steps = [
    {
      name: "Concept",
      img: "https://placehold.co/200x120",
      desc: "Tahap awal ide.",
    },
    {
      name: "Prototype",
      img: "https://placehold.co/200x120",
      desc: "Membuat purwarupa.",
    },
    {
      name: "MVP",
      img: "https://placehold.co/200x120",
      desc: "Versi awal siap uji.",
    },
    {
      name: "Scale",
      img: "https://placehold.co/200x120",
      desc: "Perluas fitur & user.",
    },
    {
      name: "Optimize",
      img: "https://placehold.co/200x120",
      desc: "Tingkatkan performa.",
    },
  ];

  steps.forEach((step, i) => {
    // Elemen HTML Card
    const el = document.createElement("div");
    el.className =
      "card bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white w-48 p-4 text-center transition-all duration-300 hover:bg-white/20";
    el.innerHTML = `
    <img src="${step.img}" class="rounded-lg mb-3 pointer-events-none" />
    <h3 class="text-lg font-semibold mb-1">${step.name}</h3>
    <p class="text-xs opacity-80 mb-3">${step.desc}</p>
    <button class="px-3 py-1 bg-white/20 hover:bg-white/40 rounded-md transition">Explore</button>
  `;

    // Buat objek CSS3D
    const cardObject = new CSS3DObject(el);
    cardObject.scale.set(0.02, 0.02, 0.02);
    const side = i % 2 === 0 ? -1 : 1;
    cardObject.position.set(side * 4, 0, -i * 8);
    scene.add(cardObject);

    // Simpan referensi ke nodes agar kamera bisa bergerak ke sana
    nodes.push(cardObject);

    // Tambahkan interaksi klik langsung di HTML
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      moveCameraTo(cardObject);
    });
  });

  // === PEGUNUNGAN DENGAN GRADIENT FADE ===
  const mountainWidth = 200;
  const mountainDepth = 600;
  const particlesX = 480; // dari 160 → 260
  const particlesZ = 1080; // dari 480 → 720
  const baseY = -8;
  const noiseScale = 0.07;
  const noiseAmp = 12;
  const moveSpeed = 0.0018;

  const geometryMountain = new THREE.BufferGeometry();
  const positions = new Float32Array(particlesX * particlesZ * 3);
  const colors = new Float32Array(particlesX * particlesZ * 3);
  const color = new THREE.Color();

  for (let i = 0; i < particlesX; i++) {
    for (let j = 0; j < particlesZ; j++) {
      const x = (i / (particlesX - 1) - 0.5) * mountainWidth;
      const z = (j / (particlesZ - 1) - 0.5) * mountainDepth;
      const idx = (i * particlesZ + j) * 3;

      positions[idx] = x;
      positions[idx + 1] = baseY;
      positions[idx + 2] = z;

      // Semakin jauh, semakin gelap & transparan
      const depthFactor = 1 - j / (particlesZ - 1);
      color.setHSL(0.55, 0.8, 0.3 * depthFactor + 0.1);
      colors[idx] = color.r * depthFactor;
      colors[idx + 1] = color.g * depthFactor;
      colors[idx + 2] = color.b * depthFactor;
    }
  }

  geometryMountain.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  geometryMountain.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const materialMountain = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      cameraPos: { value: new THREE.Vector3() },
      baseY: { value: -3.5 },
      noiseScale: { value: 0.1 },
      noiseAmp: { value: 8.0 },
      fadeDist: { value: 150.0 },

      // 🎨 warna bisa diubah dari JS:
      colorNear: { value: new THREE.Color(0x3b82f6) }, // biru terang
      colorFar: { value: new THREE.Color(0x1e1b4b) }, // ungu tua
    },
    vertexShader: `
    uniform float time;
    uniform vec3 cameraPos;
    uniform float noiseScale;
    uniform float noiseAmp;
    varying float vDist;
    varying float vHeight;

    // noise 3D
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec3 v){
      const vec2  C = vec2(1.0/6.0, 1.0/3.0);
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 1.0/7.0;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vec3 pos = position;
      pos.y += snoise(vec3(pos.xz * noiseScale + time * 0.0008, 0.0)) * noiseAmp;

      vHeight = pos.y;
      vDist = distance(cameraPos, pos);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 3.5;
    }
  `,
    fragmentShader: `
    varying float vDist;
    varying float vHeight;
    uniform float fadeDist;
    uniform vec3 colorNear;
    uniform vec3 colorFar;

    void main() {
      // bentuk bulat
      vec2 c = gl_PointCoord - vec2(0.5);
      if (dot(c, c) > 0.25) discard;

      float fade = clamp(1.0 - (vDist / fadeDist), 0.0, 1.0);

      // gradasi vertikal (berdasarkan tinggi)
      float hMix = smoothstep(-5.0, 10.0, vHeight);
      vec3 baseColor = mix(colorFar, colorNear, hMix);

      // semakin jauh semakin gelap
      vec3 finalColor = mix(vec3(0.0), baseColor, fade);
      gl_FragColor = vec4(finalColor, fade);
    }
  `,
    transparent: true,
    depthWrite: false,
  });

  const mountainMesh = new THREE.Points(geometryMountain, materialMountain);
  mountainMesh.position.y = -1;
  scene.add(mountainMesh);

  const noise = new ImprovedNoise();

  function updateMountain(time) {
    const posArr = geometryMountain.attributes.position.array;
    let idx = 0;
    const phase = time * moveSpeed * 4.0;

    for (let i = 0; i < particlesX; i++) {
      for (let j = 0; j < particlesZ; j++) {
        const x = (i / (particlesX - 1) - 0.5) * mountainWidth;
        const z = (j / (particlesZ - 1) - 0.5) * mountainDepth;

        const yNoise =
          noise.noise((x + phase) * noiseScale, z * noiseScale, 0.0) * noiseAmp;

        posArr[idx + 1] = baseY + yNoise;
        idx += 3;
      }
    }
    geometryMountain.attributes.position.needsUpdate = true;
  }

  // === PARTIKEL BADAi 3D (ABSTRAK & SINEMATIK) ===
  const stormCount = 2000;
  const stormGeometry = new THREE.BufferGeometry();
  const stormPositions = new Float32Array(stormCount * 3);
  const stormSeeds = new Float32Array(stormCount);
  const stormSizes = new Float32Array(stormCount);

  for (let i = 0; i < stormCount; i++) {
    stormPositions[i * 3] = (Math.random() - 0.5) * 400; // X
    stormPositions[i * 3 + 1] = Math.random() * 120 + 10; // Y
    stormPositions[i * 3 + 2] = (Math.random() - 0.5) * 400; // Z
    stormSeeds[i] = Math.random() * 1000.0;
    stormSizes[i] = 1.0 + Math.random() * 2.5;
  }

  stormGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(stormPositions, 3)
  );
  stormGeometry.setAttribute("aSeed", new THREE.BufferAttribute(stormSeeds, 1));
  stormGeometry.setAttribute("aSize", new THREE.BufferAttribute(stormSizes, 1));

  const stormMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      colorNear: { value: new THREE.Color(0x99ccff) },
      colorFar: { value: new THREE.Color(0xffffff) },
      depthFade: { value: 300.0 }, // makin besar, makin lama hilang di kejauhan
    },
    vertexShader: `
    uniform float time;
    uniform float depthFade;
    attribute float aSeed;
    attribute float aSize;
    varying float vFade;

    // fungsi random dan noise sederhana
    float rand(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      vec3 pos = position;

      // waktu acak per partikel
      float t = time * 0.0004 + aSeed;

      // arah dominan badai: datang dari kiri depan (x-, z-) menuju kanan belakang (x+, z+)
      pos.x += sin(t * 6.1 + rand(aSeed) * 6.283) * 20.0;
      pos.y += cos(t * 1.3 + rand(aSeed + 1.0) * 6.283) * 90.0;
      pos.z += sin(t * 8.7 + rand(aSeed + 2.0) * 6.283) * 20.0;

      // translasi perlahan (seperti arus angin)
      pos.x += mod(time * 0.08 + aSeed * 100.0, 800.0) - 400.0;
      pos.z += mod(time * 0.08 + aSeed * 70.0, 800.0) - 400.0;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // ukuran menyesuaikan jarak
      gl_PointSize = aSize * (300.0 / -mvPosition.z);

      // opacity fade berdasarkan jarak
      vFade = smoothstep(-depthFade, 0.0, mvPosition.z);
    }
  `,
    fragmentShader: `
    uniform vec3 colorNear;
    uniform vec3 colorFar;
    varying float vFade;

    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float d = dot(c, c);
      if (d > 0.25) discard; // bentuk bulat

      vec3 color = mix(colorNear, colorFar, d * 1.2);
      gl_FragColor = vec4(color, (1.0 - d * 2.0) * vFade * 0.9);
    }
  `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stormParticles = new THREE.Points(stormGeometry, stormMaterial);
  scene.add(stormParticles);

  // === INTERAKSI ===
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  moveCameraTo = (target) => {
    if (!target || activeNode === target) return;
    activeNode = target;

    const pos = target.position.clone();
    const targetCamPos = new THREE.Vector3(pos.x * 0.3, 5, pos.z + 18);
    const targetLook = new THREE.Vector3(pos.x, 0, pos.z - 6);

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 1.8,
      ease: "power2.inOut",
    });

    gsap.to(cameraTarget, {
      x: targetLook.x,
      y: targetLook.y,
      z: targetLook.z,
      duration: 1.8,
      ease: "power2.inOut",
    });

    nodes.forEach((n) => {
      gsap.killTweensOf(n.material);
      gsap.to(n.material, {
        opacity: n === target ? 1 : 0.15,
        duration: 1.5,
        ease: "power1.inOut",
      });
    });
  };

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);
    if (intersects.length > 0) moveCameraTo(intersects[0].object);
  });

  function animate() {
    const elapsed = performance.now();
    updateMountain(elapsed);

    stormMaterial.uniforms.time.value = elapsed;

    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener("resize", () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  moveCameraTo(nodes[0]);
}

onMounted(() => {
  if (canvasRef.value) createScene(canvasRef.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  renderer.dispose();
});
</script>

<style scoped>
canvas {
  display: block;
  cursor: pointer;
}
</style>
