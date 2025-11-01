<template>
  <div class="w-screen h-screen bg-black relative overflow-hidden">
    <div ref="container" class="w-screen h-full relative">
      <canvas ref="canvas" class="w-full! h-full block"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import * as THREE from "three";
import { gsap } from "gsap";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const canvas = ref(null);
const container = ref(null);
let renderer, scene, camera, raycaster, mouse, composer, cssRenderer;
let nodes = [];
let animationId;
let cameraTarget = new THREE.Vector3(0, 0, 0);
let activeNode = null;
let moveCameraTo;
let isTransitioning = false;

const props = defineProps(["content"]);

async function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#000");

  function getSize() {
    if (container.value)
      return {
        w: container.value.clientWidth,
        h: container.value.clientHeight,
      };
    if (canvas.value)
      return {
        w: canvas.value.clientWidth || window.innerWidth,
        h: canvas.value.clientHeight || window.innerHeight,
      };
    return { w: window.innerWidth, h: window.innerHeight };
  }

  const { w, h } = getSize();
  const width = w;
  const height = h;

  // Kamera agak tinggi dan menunduk agar horizon tak terlihat
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, -10);

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value ?? undefined,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Tambahkan composer untuk postprocessing
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    1.5, // strength → intensitas bloom
    1, // radius → seberapa meluas
    0.2 // threshold → warna yang lebih terang terkena bloom
  );
  composer.addPass(bloomPass);

  // --- Tambahkan CSS3DRenderer ---
  cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(width, height);
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.top = "0";
  canvas.value.parentElement.appendChild(cssRenderer.domElement);

  // Cahaya lembut
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const point = new THREE.PointLight(0xffffff, 1);
  point.position.set(10, 25, 10);
  scene.add(ambient, point);

  // --- Aurora Background ---
  const auroraGeometry = new THREE.PlaneGeometry(600, 200, 1, 1);
  const auroraMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      opacity: { value: 0.25 },
    },
    vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
    fragmentShader: `
    uniform float time;
    uniform float opacity;
    varying vec2 vUv;

    void main() {
      float y = vUv.y;

      // gelombang horizontal bergerak
      float wave1 = sin(vUv.x * 10.0 + time * 0.01) * 0.08;
      float wave2 = cos(vUv.x * 15.0 - time * 0.008) * 0.08;

      // pergeseran vertikal lembut
      float verticalMove = sin(time * 0.002 + vUv.x * 5.0) * 0.05;

      // gradient aurora
      float gradient = smoothstep(0.2 + wave1 + wave2 + verticalMove,
                                  0.8 + wave1 + wave2 + verticalMove,
                                  vUv.y);

      // warna aurora
      vec3 col = vec3(0.2, 0.4, 0.7) * gradient;

      // fade ke bawah supaya pegunungan tetap terlihat
      float fade = smoothstep(0.0, 0.3, vUv.y);
      col *= fade;

      gl_FragColor = vec4(col, opacity * gradient);
    }
  `,
    transparent: true,
    depthTest: false,
  });

  const auroraMesh = new THREE.Mesh(auroraGeometry, auroraMaterial);
  auroraMesh.position.set(0, 30, -150); // turunkan posisinya supaya tidak terlalu tinggi
  auroraMesh.renderOrder = -10;
  scene.add(auroraMesh);

  // === ITEM ROADMAP ===
  const steps = props.content;
  steps.forEach((step, i) => {
    var tags = "";
    step.tags.forEach((tag) => {
      tags += `<div class="text-xs px-3 py-1 rounded-full bg-linear-to-br from-base/20 to-black/10">${tag}</div>`;
    });

    // Elemen HTML Card
    const el = document.createElement("div");
    el.className =
      "card bg-base/10 backdrop-blur-md border border-base/20 rounded-lg text-base w-72 p-4 pb-6 transition-all duration-300";

    el.innerHTML = `
    <div class="relative">
      <div class="flex justify-between items-center mb-3">
        <div class="flex justify-start gap-1">
          ${tags}
        </div>
        <div class="text-xs px-3 py-1 rounded-full bg-base/10 border border-base/20">${step.tahun}</div>
      </div>
      <h2 class="text-xl font-orbitron font-semibold">${step.name}</h2>
      <p class="text-xs font-inter opacity-80 mt-2">${step.desc}</p>
      <img src="${step.img}" class="rounded pointer-events-none mt-4" />
    </div>
  `;

    // Buat objek CSS3D
    const cardObject = new CSS3DObject(el);
    cardObject.scale.set(0.02, 0.02, 0.02);
    cardObject.isActive = false; // ✔ simpan state aktif

    cardObject._tiltHandler = null;
    cardObject._leaveHandler = null;

    const side = i % 2 === 0 ? -1 : 1;
    cardObject.position.set(side * 10, 0, -i * 6);
    scene.add(cardObject);

    el.addEventListener("mouseenter", () => {
      if (cardObject.isActive || isTransitioning) return;
      gsap.killTweensOf(cardObject.scale);
      gsap.to(cardObject.scale, {
        x: 0.022,
        y: 0.022,
        z: 0.022,
        duration: 0.3,
        ease: "power2.out",
      });
    });

    el.addEventListener("mouseleave", () => {
      if (cardObject.isActive || isTransitioning) return;
      gsap.killTweensOf(cardObject.scale);
      gsap.to(cardObject.scale, {
        x: 0.02,
        y: 0.02,
        z: 0.02,
        duration: 0.3,
        ease: "power2.out",
      });
    });

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
  const particlesX = 700; // dari 160 → 260
  const particlesZ = 800; // dari 480 → 720
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
      pointSize: { value: 1.5 },
      parallaxOffset: { value: new THREE.Vector2(0, 0) },

      // 🎨 warna bisa diubah dari JS:
      colorNear: { value: new THREE.Color(0x3b82f6) }, // biru terang
      colorFar: { value: new THREE.Color(0x1e1b4b) }, // ungu tua
    },
    vertexShader: `
      uniform float time;
      uniform vec3 cameraPos;
      uniform float noiseScale;
      uniform float noiseAmp;
      uniform float pointSize;

      varying float vDist;
      varying float vHeight;

      uniform vec2 parallaxOffset;

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

        // noise pegunungan
        pos.y += snoise(vec3(pos.xz * noiseScale + time * 0.0008, 0.0)) * noiseAmp;

        // offset parallax
        pos.x += parallaxOffset.x;
        pos.z += parallaxOffset.y;

        vHeight = pos.y;
        vDist = distance(cameraPos, pos);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = pointSize;
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

        // fade berdasarkan jarak ke kamera
        float fade = clamp(1.0 - (vDist / fadeDist), 0.0, 1.0);

        // gradasi vertikal berdasarkan tinggi
        float hMix = smoothstep(-5.0, 10.0, vHeight);
        vec3 baseColor = mix(colorFar, colorNear, hMix);

        // fade tambahan untuk depth (lebih jauh lebih transparan)
        float depthFade = smoothstep(fadeDist * 0.2, fadeDist, vDist);

        // final color dengan alpha menurun seiring jarak
        gl_FragColor = vec4(baseColor, fade * (4.0 - depthFade));
      }
      `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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

  // PERBAIKAN DI moveCameraTo - tambahkan flag transisi
  isTransitioning = false;

  moveCameraTo = (target) => {
    if (!target || activeNode === target || isTransitioning) return;

    isTransitioning = true;
    activeNode = target;

    const pos = target.position.clone();
    const targetCamPos = new THREE.Vector3(pos.x * 0.1, 5, pos.z + 18);

    const targetLook = new THREE.Vector3(0, 0, pos.z - 5);

    gsap.to(camera.position, {
      x: targetCamPos.x,
      y: targetCamPos.y,
      z: targetCamPos.z,
      duration: 1.5,
      ease: "power2.inOut",
      onUpdate: () => {
        const offsetX = camera.position.x * 2;
        const offsetZ = camera.position.z * 2;
        materialMountain.uniforms.parallaxOffset.value.set(offsetX, offsetZ);
      },
      onComplete: () => {
        isTransitioning = false;
      },
    });

    gsap.to(cameraTarget, {
      x: targetLook.x,
      y: targetLook.y,
      z: targetLook.z,
      duration: 1.5,
      ease: "power2.inOut",
    });

    nodes.forEach((n) => {
      const el = n.element;
      gsap.killTweensOf(n.scale);

      if (n === target) {
        n.isActive = true;

        if (n._tiltHandler) {
          el.removeEventListener("mousemove", n._tiltHandler);
          n._tiltHandler = null;
        }
        if (n._leaveHandler) {
          el.removeEventListener("mouseleave", n._leaveHandler);
          n._leaveHandler = null;
        }

        const dx = camera.position.x - n.position.x;
        const dz = camera.position.z - n.position.z;
        const fullAngle = Math.atan2(dx, dz);
        const rotateFactor = 0.25;
        const targetAngle = fullAngle * rotateFactor;

        gsap.to(n.rotation, {
          y: targetAngle,
          duration: 1.2,
          ease: "power2.out",
          // ❌ HAPUS onUpdate: () => n.updateMatrixWorld(true)
        });

        gsap.to(n.scale, {
          x: 0.03,
          y: 0.03,
          z: 0.03,
          duration: 0.8,
          ease: "power2.out",
        });

        gsap.to(el.style, {
          opacity: 1,
          filter: "brightness(1.4)",
          duration: 0.8,
          ease: "power2.out",
        });

        // Setup tilt dengan throttle yang lebih agresif
        let lastUpdate = 0;
        const throttleMs = 16; // ~60fps max

        const tiltHandler = (e) => {
          if (!n.isActive) return;

          const now = Date.now();
          if (now - lastUpdate < throttleMs) return; // ✅ Throttle
          lastUpdate = now;

          const rect = el.getBoundingClientRect();
          const px = e.clientX;
          const py = e.clientY;
          if (
            px < rect.left ||
            px > rect.right ||
            py < rect.top ||
            py > rect.bottom
          )
            return;

          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          const intensity = 0.6;
          const rotateX = (y - 0.5) * -intensity;
          const rotateY = (x - 0.5) * intensity;

          const dx = camera.position.x - n.position.x;
          const dz = camera.position.z - n.position.z;
          const fullAngle = Math.atan2(dx, dz);
          const rotateFactor = 0.25;
          const baseY = fullAngle * rotateFactor;

          gsap.to(n.rotation, {
            x: rotateX * 0.8,
            y: baseY + rotateY * 0.6,
            duration: 0.25,
            ease: "power2.out",
            // ❌ HAPUS onUpdate: () => n.updateMatrixWorld(true)
          });
        };

        const leaveHandler = () => {
          if (!n.isActive) return;
          gsap.to(n.rotation, {
            x: 0,
            y: fullAngle * rotateFactor,
            duration: 0.6,
            ease: "power3.out",
            // ❌ HAPUS onUpdate: () => n.updateMatrixWorld(true)
          });
        };

        n._tiltHandler = tiltHandler;
        n._leaveHandler = leaveHandler;
        el.addEventListener("mousemove", tiltHandler);
        el.addEventListener("mouseleave", leaveHandler);
      } else {
        if (n._tiltHandler) {
          n.element.removeEventListener("mousemove", n._tiltHandler);
          n._tiltHandler = null;
        }
        if (n._leaveHandler) {
          n.element.removeEventListener("mouseleave", n._leaveHandler);
          n._leaveHandler = null;
        }

        n.isActive = false;

        gsap.to(n.rotation, {
          y: 0,
          duration: 1.2,
          ease: "power2.out",
        });

        gsap.to(n.scale, {
          x: 0.02,
          y: 0.02,
          z: 0.02,
          duration: 0.8,
          ease: "power2.out",
        });

        gsap.to(el.style, {
          opacity: 0.4,
          filter: "brightness(0.6)",
          duration: 0.8,
          ease: "power2.out",
        });
      }
    });
  };

  canvas.value.addEventListener("click", (event) => {
    const rect = canvas.value.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);
    if (intersects.length > 0) moveCameraTo(intersects[0].object);
  });

  function animate() {
    const elapsed = performance.now();

    stormMaterial.uniforms.time.value = elapsed;
    stormMaterial.uniforms.time.value = elapsed;
    updateMountain(elapsed);

    scene.updateMatrixWorld();

    camera.lookAt(cameraTarget);
    composer.render(); // ← ganti dari renderer.render(scene, camera)
    cssRenderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }
  animate();

  window.addEventListener("resize", () => {
    const { w: nw, h: nh } = getSize();
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();

    renderer.setSize(nw, nh);
    composer.setSize(nw, nh);
    cssRenderer.setSize(nw, nh);
  });

  moveCameraTo(nodes[0]);
}

function setupTiltHandlers(n, fullAngle, rotateFactor) {
  const el = n.element;
  const baseY = fullAngle * rotateFactor;

  // ✅ PERBAIKAN 5: Throttle mousemove untuk performa lebih baik
  let isAnimating = false;

  const tiltHandler = (e) => {
    if (!n.isActive || isAnimating) return;

    const rect = el.getBoundingClientRect();
    const px = e.clientX;
    const py = e.clientY;

    // Safety check
    if (
      px < rect.left ||
      px > rect.right ||
      py < rect.top ||
      py > rect.bottom
    ) {
      return;
    }

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const intensity = 0.6;
    const rotateX = (y - 0.5) * -intensity;
    const rotateY = (x - 0.5) * intensity;

    isAnimating = true;

    gsap.to(n.rotation, {
      x: rotateX * 0.8,
      y: baseY + rotateY * 0.6,
      duration: 0.25,
      ease: "power2.out",
      overwrite: true, // ✅ Overwrite animasi sebelumnya
      onUpdate: () => n.updateMatrixWorld(true),
      onComplete: () => {
        isAnimating = false;
      },
    });
  };

  const leaveHandler = () => {
    if (!n.isActive) return;

    isAnimating = true;

    gsap.to(n.rotation, {
      x: 0,
      y: baseY,
      duration: 0.6,
      ease: "power3.out",
      overwrite: true, // ✅ Overwrite animasi sebelumnya
      onUpdate: () => n.updateMatrixWorld(true),
      onComplete: () => {
        isAnimating = false;
      },
    });
  };

  // Simpan reference
  n._tiltHandler = tiltHandler;
  n._leaveHandler = leaveHandler;

  // Pasang listener
  el.addEventListener("mousemove", tiltHandler);
  el.addEventListener("mouseleave", leaveHandler);
}

onMounted(async () => {
  await nextTick();
  createScene();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);

  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss(); // Memaksa WebGL melepaskan context
    renderer.domElement = null;
    renderer = null;
  }

  if (cssRenderer) {
    cssRenderer.domElement.remove();
    cssRenderer = null;
  }

  if (composer) {
    composer.passes = [];
    composer = null;
  }

  nodes = [];
  activeNode = null;
});
</script>

<style scoped>
canvas {
  display: block;
  cursor: pointer;
}
</style>
