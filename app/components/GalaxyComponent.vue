<template>
  <div class="w-screen h-screen flex items-center justify-center relative">
    <div ref="container" class="w-full h-full relative">
      <transition name="fade">
        <div v-if="!selectedPlanetData">
          <nav
            class="fixed right-2 top-1/2 -translate-y-1/2 w-fit h-fit opacity-0"
            ref="nav"
          >
            <ul
              class="flex flex-col p-1 gap-6 relative z-10 bg-base/10 backdrop-blur-sm rounded-full border border-base/20"
            >
              <li
                v-for="(socialMedia, index) in socialMedias"
                :key="index"
                class="group"
              >
                <a
                  :href="socialMedia.url"
                  target="_blank"
                  class="w-12 h-12 flex justify-center items-center border-0 rounded-full group-hover:bg-base/10 group-hover:border group-hover:border-base/20 transition-all duration-100 ease-in-out"
                >
                  <Icon :name="socialMedia.icon" class="text-2xl text-base" />
                </a>
              </li>
            </ul>
          </nav>

          <div class="fixed top-10 left-20 select-none opacity-0" ref="title">
            <h4 class="text-base font-semibold text-xl font-orbitron">
              Hello, I am
            </h4>
            <h1 class="text-base font-bold text-8xl font-orbitron">ENPII</h1>
            <div
              class="absolute -bottom-4 left-0 w-40 h-2 rounded-full bg-secondary"
            ></div>
          </div>

          <div
            class="fixed bottom-10 left-20 w-4/12 select-none opacity-0"
            ref="description"
          >
            <div class="font-inter">
              <span class="text-base font-semibold">
                Enpii - full stack developer.
              </span>
              <span class="text-base/60">
                I love exploring design and transforming ideas into simple,
                functional, and visually appealing web experiences. Each project
                is a step in my creative journey.
              </span>
            </div>
          </div>
        </div>
      </transition>

      <canvas ref="canvas" class="w-full h-full block"></canvas>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import gsap from "gsap";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const props = defineProps(["listPlanets"]);

const {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
  Points,
  BufferGeometry,
  Raycaster,
  Vector2,
  Vector3,
  Group,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  LineBasicMaterial,
  Line,
  BufferAttribute,
  ShaderMaterial,
} = THREE;

const socialMedias = ref([
  {
    url: "https://www.instagram.com/its.enpii",
    icon: "mdi:instagram",
  },
  {
    url: "https://web.facebook.com/arafi118",
    icon: "ri:facebook-fill",
  },
  {
    url: "https://dribbble.com/enpii",
    icon: "mingcute:dribbble-line",
  },
  {
    url: "https://github.com/its-enpii",
    icon: "proicons:github",
  },
]);

const canvas = ref(null);
const container = ref(null);
const emit = defineEmits(["planet-clicked", "planet-selected", "planet-exit"]);
const selectedPlanetData = ref(null);
const title = ref(null);
const description = ref(null);
const nav = ref(null);

let scene;
let labelScene;
let planetScene;
let camera;
let renderer;
let composer;
let controls;
let rafId;
let cometInterval;
let resizeTimeout;
let clickablePlanets = [];
let comets = [];
let initialCameraPosition;
let rotationPaused = false;

let pauseControls = () => {};
let resumeControls = () => {};
let backToGalaxy = () => {};
let getPlanetById = () => null;
let focusOnPlanet = () => {};

defineExpose({
  pauseControls: (...args) => pauseControls(...args),
  resumeControls: (...args) => resumeControls(...args),
  backToGalaxy: (...args) => backToGalaxy(...args),
  getPlanetById: (...args) => getPlanetById(...args),
  focusOnPlanet: (...args) => focusOnPlanet(...args),
});

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

function onResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (!camera || !renderer || !composer) return;
    const { w: nw, h: nh } = getSize();
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    composer.setSize(nw, nh);
  }, 150);
}

function getColor(palette, shade = 500, format = "hex") {
  const colors = {
    base: {
      50: "fefefe",
      100: "fcfcfc",
      200: "f9f9f9",
      300: "f6f6f6",
      400: "f4f4f4",
      500: "f3f3f3",
      600: "dcdcdc",
      700: "c5c5c5",
      800: "aeaeae",
      900: "979797",
      950: "808080",
    },
    primary: {
      50: "ebe9ff",
      100: "dcd8ff",
      200: "b9b2ff",
      300: "958bff",
      400: "7265ee",
      500: "3d348b",
      600: "342d7a",
      700: "2b2669",
      800: "221f58",
      900: "191847",
      950: "100f36",
    },
    secondary: {
      50: "fff9e8",
      100: "fff2d0",
      200: "ffe4a1",
      300: "ffd673",
      400: "ffc845",
      500: "e6af2e",
      600: "cc9829",
      700: "b38124",
      800: "996a1f",
      900: "80531a",
      950: "663c15",
    },
    black: {
      50: "f2f2f2",
      100: "d9d9d9",
      200: "bfbfbf",
      300: "a6a6a6",
      400: "4d4d4d",
      500: "040303",
      600: "030203",
      700: "020202",
      800: "010101",
      900: "000000",
      950: "000000",
    },
  };

  const colorValue = colors?.[palette]?.[shade];
  if (!colorValue) return null;

  switch (format) {
    case "hex":
      return `#${colorValue}`;
    case "int":
      return parseInt(`0x${colorValue}`);
    case "raw":
      return colorValue;
    default:
      throw new Error(
        'Format tidak dikenali. Gunakan "hex", "int", atau "raw".'
      );
  }
}

onBeforeUnmount(() => {
  console.log("🧹 Cleanup starting...");

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  if (cometInterval) {
    clearInterval(cometInterval);
    cometInterval = null;
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }

  if (typeof window !== "undefined") {
    window.removeEventListener("resize", onResize);
  }

  if (renderer?.domElement) {
    try {
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerUp);
    } catch (e) {
      console.warn("Error removing event listeners:", e);
    }
  }

  try {
    [scene, labelScene, planetScene].forEach((s) => {
      if (s) {
        s.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (object.material.map) object.material.map.dispose();
              object.material.dispose();
            }
          }
        });

        while (s.children.length > 0) {
          s.remove(s.children[0]);
        }
      }
    });

    if (composer) {
      composer.dispose();
      composer = null;
    }

    if (controls) {
      controls.dispose();
      controls = null;
    }

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement = null;
      renderer = null;
    }

    clickablePlanets = [];
    comets = [];

    console.log("✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
});

onMounted(async () => {
  await nextTick();

  if (!canvas.value) {
    console.warn("Canvas element not found");
    return;
  }

  const { w, h } = getSize();

  scene = new THREE.Scene();
  labelScene = new THREE.Scene();
  planetScene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(80, w / h, 0.1, 6000);
  camera.position.set(0, 600, 1200);
  initialCameraPosition = camera.position.clone();

  gsap.to(camera.position, {
    x: 0,
    y: 140,
    z: 280,
    duration: 3,
    ease: "power3.inOut",
    onComplete: () => {
      initialCameraPosition = camera.position.clone();
      gsap.fromTo(
        title.value,
        { opacity: 0, x: -100 },
        { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
      );
      gsap.fromTo(
        description.value,
        { opacity: 0, x: -100 },
        { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
      );
      gsap.fromTo(
        nav.value,
        { opacity: 0, x: 100 },
        { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
      );
    },
  });

  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.physicallyCorrectLights = true;
  renderer.autoClear = false;

  scene.add(new AmbientLight(0xffffff, 0.28));
  const dirLight = new DirectionalLight(0xffffff, 0.55);
  dirLight.position.set(90, 120, 60);
  scene.add(dirLight);

  planetScene.add(new AmbientLight(0xffffff, 0.28));
  const dirLightPlanet = new DirectionalLight(0xffffff, 0.55);
  dirLightPlanet.position.set(90, 120, 60);
  planetScene.add(dirLightPlanet);

  const nebUniforms = {
    u_time: { value: 0 },
    u_scale: { value: 1.5 },
    u_intensity: { value: 0.85 },
    u_hueShift: { value: 0.75 },
  };

  const nebVertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const nebFragment = `
    precision highp float;
    varying vec2 vUv;
    uniform float u_time;
    uniform float u_scale;
    uniform float u_intensity;
    uniform float u_hueShift;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
    }
    float fbm(vec2 p){
      float z = 0.0;
      float amp = 0.5;
      for (int i=0; i<6; i++){
        z += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return z;
    }

    vec3 hueRotate(vec3 color, float shift){
      float angle = (shift - 0.5) * 1.5;
      float s = sin(angle), c = cos(angle);
      mat3 m = mat3(
        0.213 + c*0.787 - s*0.213, 0.715 - c*0.715 - s*0.715, 0.072 - c*0.072 + s*0.928,
        0.213 - c*0.213 + s*0.143, 0.715 + c*0.285 + s*0.140, 0.072 - c*0.072 - s*0.283,
        0.213 - c*0.213 - s*0.787, 0.715 - c*0.715 + s*0.715, 0.072 + c*0.928 + s*0.072
      );
      return clamp(m * color, 0.0, 1.0);
    }

    void main(){
      vec2 uv = vUv * 2.0 - 1.0;
      vec2 p = uv * (1.0 + u_scale);
      float t = u_time * 0.04;

      float n = fbm(p + vec2(t, -t*0.6));
      float n2 = fbm(p * 2.0 + vec2(-t*0.8, t*0.5)) * 0.5;
      float v = smoothstep(0.1, 0.7, (n * 0.7 + n2 * 0.3));

      float fall = 1.0 - smoothstep(0.3, 1.1, length(uv));
      float intensity = u_intensity * v * fall;

      vec3 base = vec3(0.005, 0.0, 0.01);   
      vec3 mid  = vec3(0.05, 0.02, 0.1);    
      vec3 glow = vec3(0.25, 0.1, 0.45);    

      vec3 col = mix(base, mid, intensity);
      col = mix(col, glow, pow(intensity, 2.0) * 0.8);
      col = hueRotate(col, u_hueShift);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const nebMaterial = new THREE.ShaderMaterial({
    uniforms: nebUniforms,
    vertexShader: nebVertex,
    fragmentShader: nebFragment,
    side: THREE.BackSide,
    transparent: false,
    depthWrite: false,
  });

  const nebGeo = new THREE.SphereGeometry(2000, 32, 32);
  const nebMesh = new THREE.Mesh(nebGeo, nebMaterial);
  scene.add(nebMesh);

  const sunTexture = new THREE.TextureLoader().load("/textures/sun.jpg");
  const sunGeo = new THREE.SphereGeometry(24, 32, 32);
  const sunMat = new THREE.MeshStandardMaterial({
    map: sunTexture,
    roughness: 0.2,
    color: new THREE.Color(getColor("secondary", "500", "int")),
    emissive: new THREE.Color(getColor("secondary", "600", "int")),
    emissiveIntensity: 0.6,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 0, 0);
  planetScene.add(sun);
  sun.userData.rotationSpeed = 0.0005;

  const sunAuraGeo = new THREE.SphereGeometry(20, 32, 32);
  const sunAuraMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: {
        value: new THREE.Color(getColor("secondary", "500", "int")),
      },
      time: { value: 0 },
      intensity: { value: 2.5 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 glowColor;
      uniform float time;
      uniform float intensity;

      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(vec3 x){
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f*f*(3.0-2.0*f);
        float n = p.x + p.y*57.0 + 113.0*p.z;
        return mix(mix(mix( hash(n+0.0), hash(n+1.0), f.x),
                       mix( hash(n+57.0), hash(n+58.0), f.x), f.y),
                   mix(mix( hash(n+113.0), hash(n+114.0), f.x),
                       mix( hash(n+170.0), hash(n+171.0), f.x), f.y), f.z);
      }

      void main() {
        float r = length(vPos) / 20.0;
        float n = noise(vPos * 0.2 + time * 0.25);
        float alpha = smoothstep(1.2, 0.0, r + n * 0.25);
        alpha = pow(alpha, 3.0);
        vec3 color = glowColor * (1.2 + n * 0.8);
        gl_FragColor = vec4(color, alpha * 0.9 * intensity);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const sunAura = new THREE.Mesh(sunAuraGeo, sunAuraMat);
  sunAura.scale.multiplyScalar(2.2);
  sun.add(sunAura);

  const plasmaGeo = new THREE.SphereGeometry(28, 32, 32);
  const plasmaMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      colorA: { value: new THREE.Color(getColor("secondary", "800", "int")) },
      colorB: { value: new THREE.Color(getColor("secondary", "700", "int")) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform float time;
      uniform vec3 colorA;
      uniform vec3 colorB;

      float noise(vec3 p) {
        return sin(p.x * 3.1 + time * 0.6) *
               sin(p.y * 2.7 + time * 0.8) *
               sin(p.z * 3.3 + time * 0.7);
      }

      void main() {
        vec3 p = normalize(vPos);
        float n = noise(p);
        float pulse = sin(time * 2.0 + n * 6.283) * 0.5 + 0.5;
        vec3 color = mix(colorA, colorB, pulse);
        float alpha = smoothstep(0.0, 0.7, pulse);
        gl_FragColor = vec4(color * (1.5 + n * 0.5), alpha * 0.6);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const plasma = new THREE.Mesh(plasmaGeo, plasmaMat);
  sun.add(plasma);

  const coronaTexture = new THREE.TextureLoader().load(
    "/textures/sun-glow.png"
  );
  const coronaMaterial = new THREE.SpriteMaterial({
    map: coronaTexture,
    color: getColor("secondary", "700", "int"),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 1.4,
  });
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.set(180, 180, 1);
  sun.add(corona);

  const haloGeo = new THREE.SphereGeometry(10, 32, 32);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      glowColor: {
        value: new THREE.Color(getColor("secondary", "400", "int")),
      },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 glowColor;
      uniform float time;

      float noise(vec3 p) {
        return sin(p.x*4.0 + time)*sin(p.y*4.0 + time)*sin(p.z*4.0 + time);
      }

      void main() {
        float r = length(vPos) / 10.0;
        float n = noise(vPos * 0.5);
        float glow = smoothstep(1.0, 0.0, r - n*0.3);
        gl_FragColor = vec4(glowColor, glow * 0.7);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.scale.set(2.0, 2.0, 2.0);
  scene.add(halo);

  const spread = 2000;
  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);
  const phases = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const r = spread * Math.pow(Math.random(), 0.6);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions.set([x, y, z], i * 3);
    phases[i] = Math.random() * Math.PI * 2;
  }

  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  particlesGeo.setAttribute(
    "phase",
    new THREE.Float32BufferAttribute(phases, 1)
  );

  const particlesMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(getColor("base", "500", "int")) },
      uSize: { value: 1.8 },
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uSize;
      uniform float uTime;
      attribute float phase;
      varying float vTwinkle;

      void main() {
        vTwinkle = sin(uTime * 2.0 + phase) * 0.5 + 0.5;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vTwinkle;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float intensity = smoothstep(0.5, 0.0, d);
        float alpha = mix(0.2, 1.0, vTwinkle); 
        gl_FragColor = vec4(uColor, alpha * intensity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(particlesGeo, particlesMat);
  particles.frustumCulled = false;
  particles.renderOrder = 999;
  particles.material.depthTest = false;
  scene.add(particles);

  function createSpiralGalaxy({
    count = 40000,
    radius = 5,
    branches = 3,
    spin = 6.0,
    randomness = 0.35,
    randomnessPower = 2.5,
    innerColor = 0xffd66b,
    outerColor = 0x3d348b,
  } = {}) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorInside = new THREE.Color(innerColor);
    const colorOutside = new THREE.Color(outerColor);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radiusRatio = Math.random();
      const r = Math.pow(radiusRatio, 1.5) * radius;

      const branch = i % branches;
      const branchAngle = (branch / branches) * Math.PI * 2;
      const spinAngle = (1.0 - radiusRatio) * spin;
      const angle = branchAngle + spinAngle;

      const heightCurve = Math.pow(1.0 - radiusRatio, 12.0);
      const bulgeStrength = 4.0;
      const diskFlatness = 0.04;
      const randomY =
        (Math.random() - 0.5) *
        randomness *
        radius *
        (diskFlatness + heightCurve * bulgeStrength);

      const randomX =
        Math.pow(Math.random(), randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        randomness *
        r;
      const randomZ =
        Math.pow(Math.random(), randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        randomness *
        r;

      const x = Math.cos(angle) * r + randomX;
      const y = randomY;
      const z = Math.sin(angle) * r + randomZ;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const distance3D = Math.sqrt(x * x + y * y * 2.5 + z * z);
      const distanceRatio = Math.pow(distance3D / radius, 1.3);

      const mixBias = 1.4;
      const color = colorInside
        .clone()
        .lerp(colorOutside, Math.min(1, distanceRatio * mixBias));
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      sizeAttenuation: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });

    const galaxy = new THREE.Points(geometry, material);
    galaxy.userData.radius = radius;
    return galaxy;
  }

  const galaxy = createSpiralGalaxy({
    count: 56000,
    radius: 200,
    branches: 4,
    spin: 8,
    innerColor: getColor("secondary", "700", "int"),
    outerColor: getColor("primary", "600", "int"),
  });
  galaxy.frustumCulled = false;
  galaxy.renderOrder = 10;
  scene.add(galaxy);

  function createLabelTexture(text) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const fontSize = 26;
    const paddingX = 48;
    const paddingY = 28;
    const borderRadius = 22;

    ctx.font = `700 ${fontSize}px Orbitron, sans-serif`;
    const tm = ctx.measureText(text);
    const textWidth = tm.width;
    c.width = Math.max(200, textWidth + paddingX * 2);
    c.height = fontSize + paddingY * 2;

    ctx.font = `700 ${fontSize}px Orbitron, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, "rgba(20, 20, 40, 0.65)");
    grad.addColorStop(0.5, "rgba(60, 60, 100, 0.45)");
    grad.addColorStop(1, "rgba(20, 20, 40, 0.65)");
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, c.width, c.height, borderRadius);
    ctx.fill();

    const borderGrad = ctx.createLinearGradient(0, 0, c.width, 0);
    borderGrad.addColorStop(0, "rgba(120,150,255,0.8)");
    borderGrad.addColorStop(0.5, "rgba(220,220,255,1)");
    borderGrad.addColorStop(1, "rgba(120,150,255,0.8)");
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, c.width - 2, c.height - 2, borderRadius);
    ctx.stroke();

    const innerGlow = ctx.createRadialGradient(
      c.width / 2,
      c.height / 2,
      c.height / 4,
      c.width / 2,
      c.height / 2,
      c.height / 1.2
    );
    innerGlow.addColorStop(0, "rgba(255,255,255,0.15)");
    innerGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = innerGlow;
    roundRect(ctx, 0, 0, c.width, c.height, borderRadius);
    ctx.fill();

    ctx.shadowColor = "rgba(100,150,255,0.85)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = getColor("base", "500", "hex");
    ctx.fillText(text.toUpperCase(), c.width / 2, c.height / 2);

    ctx.shadowBlur = 0;
    const accentGrad = ctx.createLinearGradient(
      0,
      c.height - 4,
      c.width,
      c.height
    );
    accentGrad.addColorStop(0, "rgba(100,150,255,0)");
    accentGrad.addColorStop(0.5, "rgba(180,200,255,0.8)");
    accentGrad.addColorStop(1, "rgba(100,150,255,0)");
    ctx.fillStyle = accentGrad;
    ctx.fillRect(borderRadius, c.height - 6, c.width - borderRadius * 2, 2);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;

    return { texture: tex, aspectRatio: c.width / c.height };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  const planetColors = [
    {
      planetColor: getColor("base", "700", "int"),
      coronaColor: getColor("base", "800", "int"),
      plasmaColor: {
        colorA: getColor("secondary", "700", "int"),
        colorB: getColor("secondary", "800", "int"),
      },
      planetGlow: getColor("secondary", "700", "int"),
      ringColor: getColor("secondary", "500", "int"),
    },
    {
      planetColor: getColor("secondary", "700", "int"),
      coronaColor: getColor("secondary", "500", "int"),
      plasmaColor: {
        colorA: getColor("secondary", "800", "int"),
        colorB: getColor("secondary", "900", "int"),
      },
      planetGlow: getColor("secondary", "800", "int"),
      ringColor: getColor("secondary", "700", "int"),
    },
    {
      planetColor: getColor("primary", "500", "int"),
      coronaColor: getColor("primary", "500", "int"),
      plasmaColor: {
        colorA: getColor("secondary", "700", "int"),
        colorB: getColor("secondary", "800", "int"),
      },
      planetGlow: getColor("primary", "800", "int"),
      ringColor: getColor("primary", "700", "int"),
    },
    {
      planetColor: getColor("black", "700", "int"),
      coronaColor: getColor("black", "800", "int"),
      plasmaColor: {
        colorA: getColor("primary", "400", "int"),
        colorB: getColor("primary", "500", "int"),
      },
      planetGlow: getColor("black", "400", "int"),
      ringColor: getColor("black", "400", "int"),
    },
  ];

  function createSatellite(planet, satelliteConfig) {
    const satGeo = new THREE.SphereGeometry(satelliteConfig.size || 2, 16, 16);
    const satMat = new THREE.MeshStandardMaterial({
      color: satelliteConfig.color || 0xaaaaaa,
      metalness: 0.3,
      roughness: 0.7,
    });
    const satellite = new THREE.Mesh(satGeo, satMat);

    const satDistance = satelliteConfig.distance || 20;
    const satAngle = Math.random() * Math.PI * 2;

    satellite.position.set(
      Math.sin(satAngle) * satDistance,
      0,
      Math.cos(satAngle) * satDistance
    );

    satellite.userData = {
      orbitRadius: satDistance,
      orbitSpeed: satelliteConfig.speed || 0.01,
      currentAngle: satAngle,
    };

    planet.add(satellite);
    return satellite;
  }

  function createParticleRings(planet, ringConfig = {}) {
    const innerRadius = ringConfig.innerRadius ?? 15;
    const outerRadius = ringConfig.outerRadius ?? 25;
    const particleCount = ringConfig.particleCount ?? 3000;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const particleData = [];

    const color = new THREE.Color(ringConfig.color ?? 0xccaa77);

    for (let i = 0; i < particleCount; i++) {
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const angle = Math.random() * Math.PI * 2;
      const yOffset = (Math.random() - 0.5) * 0.5;

      particleData.push({
        radius,
        angle,
        speed: ringConfig.rotationSpeed ?? 0.0001 + Math.random() * 0.0002,
        yOffset,
      });

      // -------------------------------------------
      //  RING HORIZONTAL (bidang XY)
      // -------------------------------------------
      positions[i * 3] = Math.cos(angle) * radius; // X
      positions[i * 3 + 1] = Math.sin(angle) * radius; // Y
      positions[i * 3 + 2] = yOffset; // Z kecil (ketebalan)
      // -------------------------------------------

      const colorVariation = 0.8 + Math.random() * 0.2;
      colors[i * 3] = color.r * colorVariation;
      colors[i * 3 + 1] = color.g * colorVariation;
      colors[i * 3 + 2] = color.b * colorVariation;

      sizes[i] = ringConfig.particleSize ?? 0.3 + Math.random() * 0.5;
    }

    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    ringGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    ringGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const ringMat = new THREE.PointsMaterial({
      size: ringConfig.particleSize ?? 0.4,
      vertexColors: true,
      transparent: true,
      opacity: ringConfig.opacity ?? 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const ringParticles = new THREE.Points(ringGeo, ringMat);

    // TILT RING
    ringParticles.rotation.z = THREE.MathUtils.degToRad(ringConfig.tilt ?? 0);

    // Simpan data untuk animasi
    ringParticles.userData.particleData = particleData;
    ringParticles.userData.rotationSpeed = ringConfig.rotationSpeed ?? 0.001;

    planet.add(ringParticles);
    planet.userData.particleRings = ringParticles;

    return ringParticles;
  }

  function createPlanet(rDistance, theta, def) {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(def.texture, () => {
      texture.colorSpace = THREE.SRGBColorSpace;
    });

    const planetGeo = new SphereGeometry(10.0, 48, 48);
    const planetMat = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.4,
      roughness: 0.2,
      emissive: new THREE.Color(planetColors[def.id].planetColor),
      emissiveIntensity: 0.4,
    });
    const planet = new Mesh(planetGeo, planetMat);

    const x = Math.sin(theta) * rDistance;
    const y = 0;
    const z = Math.cos(theta) * rDistance;
    planet.position.set(x, y, z);
    planet.userData = {
      basePos: planet.position.clone(),
      orbitSpeed: 0.001 + Math.random() * 0.001,
      info: def,
    };
    planetScene.add(planet);

    planet.userData.baseRadius = rDistance;
    planet.userData.baseTheta = theta;

    const baseOrbitSpeed = 0.002;
    planet.userData.orbitSpeed =
      baseOrbitSpeed / Math.pow(rDistance / 100, 0.5);
    planet.userData.rotationSpeed = 0.002 + Math.random() * 0.001;
    planet.rotation.z = THREE.MathUtils.degToRad(23.5);

    const planetCoronaTexture = new THREE.TextureLoader().load(
      "/textures/glow.png"
    );
    const planetCoronaMaterial = new THREE.SpriteMaterial({
      map: planetCoronaTexture,
      color: planetColors[def.id].coronaColor,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    });
    const planetCorona = new THREE.Sprite(planetCoronaMaterial);
    planetCorona.scale.set(64, 64, 1);
    planet.add(planetCorona);

    const planetPlasmaGeo = new THREE.SphereGeometry(11, 48, 48);
    const planetPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorA: {
          value: new THREE.Color(planetColors[def.id].plasmaColor.colorA),
        },
        colorB: {
          value: new THREE.Color(planetColors[def.id].plasmaColor.colorB),
        },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;

        float noise(vec3 p) {
          return (
            sin(p.x * 2.1 + time * 0.3) +
            sin(p.y * 2.3 + time * 0.4) +
            sin(p.z * 2.5 + time * 0.5)
          ) / 3.0;
        }

        void main() {
          vec3 p = normalize(vPos);
          float n = noise(p);
          float pulse = sin(time * 2.0 + n * 6.283) * 0.5 + 0.5;
          vec3 color = mix(colorA, colorB, pulse);
          float alpha = smoothstep(0.0, 0.7, pulse);
          gl_FragColor = vec4(color * (1.5 + n * 0.5), alpha * 0.6);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const planetPlasma = new THREE.Mesh(planetPlasmaGeo, planetPlasmaMat);
    planet.add(planetPlasma);
    planet.userData.plasma = planetPlasma;
    planet.userData.plasmaMat = planetPlasmaMat;

    const glowMat = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(planetColors[def.id].planetGlow) },
        intensity: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 color;
        uniform float intensity;
        void main() {
          float glow = pow(abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 6.0);
          gl_FragColor = vec4(color * glow * intensity, 1.0);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const glowMesh = new Mesh(new THREE.SphereGeometry(12, 32, 32), glowMat);
    glowMesh.scale.multiplyScalar(1.45);
    glowMesh.renderOrder = 999;
    planet.add(glowMesh);
    planet.userData.glowMat = glowMat;
    planet.userData.glowMesh = glowMesh;

    const segments = 64;
    const ringPositions = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      ringPositions[i * 3] = Math.sin(a) * rDistance;
      ringPositions[i * 3 + 1] = 0;
      ringPositions[i * 3 + 2] = Math.cos(a) * rDistance;
    }
    const ringGeo = new BufferGeometry();
    ringGeo.setAttribute("position", new BufferAttribute(ringPositions, 3));
    const ringMat = new LineBasicMaterial({
      color: planetColors[def.id].ringColor,
      transparent: true,
      opacity: 0.045,
    });
    const ring = new Line(ringGeo, ringMat);
    scene.add(ring);
    planet.userData.orbitRing = ring;

    const labelData = createLabelTexture(def.name);
    const labelMat = new SpriteMaterial({
      map: labelData.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const labelSprite = new Sprite(labelMat);
    const spriteHeight = 12;
    labelSprite.scale.set(
      spriteHeight * labelData.aspectRatio,
      spriteHeight,
      1
    );
    labelSprite.position.set(0, 18, 0);

    const labelParent = new THREE.Object3D();
    labelScene.add(labelParent);
    labelParent.add(labelSprite);
    planet.userData.labelParent = labelParent;
    planet.userData.labelSprite = labelSprite;

    if (def.satellites && def.satellites.length > 0) {
      planet.userData.satellites = [];
      def.satellites.forEach((satConfig) => {
        const satellite = createSatellite(planet, satConfig);
        planet.userData.satellites.push(satellite);
      });
    }

    if (def.hasRings && def.ringConfig) {
      createParticleRings(planet, def.ringConfig);
    }

    clickablePlanets.push(planet);
  }

  const baseRadius = 60;
  const orbitGap = 40;
  const planetsPerOrbit = 1;
  const angleOffset = Math.random() * Math.PI * 2;

  props.listPlanets.forEach((def, idx) => {
    const orbitIndex = Math.floor(idx / planetsPerOrbit);
    const localIndex = idx % planetsPerOrbit;
    const angle =
      (localIndex / planetsPerOrbit) * Math.PI * 4 +
      angleOffset +
      (Math.random() - 0.8) * 12;
    const rDist =
      baseRadius + orbitIndex * orbitGap + (Math.random() - 0.5) * 2;
    createPlanet(rDist, angle, def);
  });

  const asteroidGroup = new Group();
  scene.add(asteroidGroup);

  const asteroidCount = 150;
  for (let i = 0; i < asteroidCount; i++) {
    const radius = 400 + Math.random() * 300;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 200;

    const geom = new SphereGeometry(Math.random() * 2 + 0.5, 8, 8);
    const mat = new MeshStandardMaterial({
      color: getColor("black", "600", "int"),
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const asteroid = new Mesh(geom, mat);

    asteroid.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );
    asteroid.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    asteroid.userData.orbitSpeed = 0.0003 + Math.random() * 0.0005;
    asteroid.userData.angle = angle;

    asteroidGroup.add(asteroid);
  }

  const ambient = new THREE.AmbientLight(0x222222);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(300, 400, 200);
  scene.add(ambient, keyLight);

  function createComet() {
    const geom = new THREE.SphereGeometry(2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3d348b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const comet = new THREE.Mesh(geom, mat);

    const tailGeom = new THREE.ConeGeometry(1.5, 20, 16, 1, true);
    const tailMat = new THREE.MeshBasicMaterial({
      color: 0x040303,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tail = new THREE.Mesh(tailGeom, tailMat);
    tail.position.z = 10;
    tail.rotation.x = Math.PI;
    comet.add(tail);

    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft
      ? -800 - Math.random() * 400
      : 800 + Math.random() * 400;
    const velocityX = fromLeft
      ? 3 + Math.random() * 2
      : -(3 + Math.random() * 2);

    comet.position.set(startX, Math.random() * 300 - 150, -800);
    comet.userData.velocity = new THREE.Vector3(
      velocityX,
      Math.random() * 0.5 - 0.25,
      5
    );

    if (!fromLeft) {
      tail.rotation.y = Math.PI;
    }

    const glowTex = new THREE.TextureLoader().load("/textures/sun-glow.png");
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x9b5de5,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(24, 24, 1);
    comet.add(glow);

    scene.add(comet);
    return comet;
  }

  cometInterval = setInterval(() => {
    if (comets.length < 5 && !rotationPaused) comets.push(createComet());
  }, 3000);

  const raycaster = new Raycaster();
  const pointer = new Vector2();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 50;
  controls.maxDistance = 1200;
  controls.enablePan = true;
  controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;

  let isDragging = false;
  let dragStartPos = new Vector2();
  let dragVelocity = new Vector2();
  let lastDragPos = new Vector2();
  let dragMomentum = new Vector2();
  const dragSensitivity = 0.6;
  const momentumDamping = 0.9;

  function handlePointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    dragStartPos.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    lastDragPos.copy(dragStartPos);
    isDragging = true;
    dragVelocity.set(0, 0);
    dragMomentum.set(0, 0);
  }

  function handlePointerMove(event) {
    if (!isDragging) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const currentPos = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    dragVelocity.x = (currentPos.x - lastDragPos.x) * dragSensitivity;
    dragVelocity.y = (currentPos.y - lastDragPos.y) * dragSensitivity;

    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position.clone().sub(controls.target));

    spherical.theta -= dragVelocity.x * 2;
    spherical.phi -= dragVelocity.y * 2;

    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.lookAt(controls.target);

    lastDragPos.copy(currentPos);
  }

  function handlePointerUp(event) {
    if (!isDragging) return;
    isDragging = false;
    dragMomentum.copy(dragVelocity);
  }

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.6, 0.0);
  bloomPass.threshold = 0.9;
  bloomPass.strength = 0.12;
  bloomPass.radius = 0.4;
  composer.addPass(bloomPass);

  const afterimagePass = new AfterimagePass();
  afterimagePass.uniforms["damp"].value = 0.98;
  composer.addPass(afterimagePass);

  const WarpShader = {
    uniforms: {
      tDiffuse: { value: null },
      u_strength: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float u_strength;
      varying vec2 vUv;
      void main(){
        vec2 center = vec2(0.5);
        vec2 dir = vUv - center;
        float dist = length(dir);
        dir *= pow(dist, 2.0) * u_strength;
        gl_FragColor = texture2D(tDiffuse, vUv - dir);
      }
    `,
  };

  const warpPass = new ShaderPass(WarpShader);
  composer.addPass(warpPass);

  function triggerWarpEffect() {
    gsap.fromTo(
      warpPass.uniforms.u_strength,
      { value: 0 },
      {
        value: 0.4,
        duration: 0.8,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      }
    );
  }

  function createEnergyRing(position, colorA = 0x3d348b, colorB = 0xe6af2e) {
    const ringGeo = new THREE.RingGeometry(1.0, 1.6, 64);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 1.0 },
        colorA: { value: new THREE.Color(colorB) },
        colorB: { value: new THREE.Color(colorA) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec2 vUv;

        void main() {
          float dist = length(vUv - 0.5) * 2.0;
          float pulse = sin(uTime * 6.0 + dist * 20.0) * 0.5 + 0.5;
          vec3 color = mix(colorA, colorB, dist);
          float alpha = smoothstep(0.8, 0.0, dist) * (0.7 + pulse * 0.3);
          gl_FragColor = vec4(color * (1.0 + pulse * 0.5), alpha * uOpacity);
        }
      `,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.lookAt(camera.position);
    scene.add(ring);

    const coreGeo = new THREE.SphereGeometry(0.6, 32, 32);
    const coreMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.9 },
        colorA: { value: new THREE.Color(colorB) },
        colorB: { value: new THREE.Color(colorA) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec3 vPos;

        void main() {
          float glow = sin(length(vPos.xy) * 6.0 - uTime * 8.0) * 0.5 + 0.5;
          vec3 color = mix(colorA, colorB, glow);
          float alpha = smoothstep(1.2, 0.0, length(vPos.xy)) * uOpacity;
          gl_FragColor = vec4(color * (1.5 + glow), alpha);
        }
      `,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(position);
    scene.add(core);

    const shockGeo = new THREE.PlaneGeometry(6, 6, 32, 32);
    const shockMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.4 },
        colorA: { value: new THREE.Color(0x040303) },
        colorB: { value: new THREE.Color(colorA) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;
        uniform vec3 colorA;
        uniform vec3 colorB;

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv) * 2.0;
          float wave = sin(dist * 40.0 - uTime * 8.0) * 0.5 + 0.5;
          float glow = smoothstep(0.5, 0.0, abs(dist - 0.5 + wave * 0.05));
          vec3 color = mix(colorA, colorB, glow);
          gl_FragColor = vec4(color, glow * uOpacity);
        }
      `,
      side: THREE.DoubleSide,
    });
    const shockwave = new THREE.Mesh(shockGeo, shockMat);
    shockwave.position.copy(position);
    shockwave.lookAt(camera.position);
    scene.add(shockwave);

    const lensGeo = new THREE.PlaneGeometry(2, 2, 32, 32);
    const lensMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.6 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv);
          float bend = 0.03 / (dist + 0.05);
          vec2 refractUV = uv + normalize(uv) * bend;
          float flare = smoothstep(0.15, 0.0, dist) + sin(uTime * 8.0) * 0.1;
          vec3 color = vec3(1.0, 0.9, 0.8) * flare;
          gl_FragColor = vec4(color, flare * uOpacity);
        }
      `,
      side: THREE.DoubleSide,
    });
    const lensFlare = new THREE.Mesh(lensGeo, lensMat);
    lensFlare.position.copy(position);
    lensFlare.lookAt(camera.position);
    scene.add(lensFlare);

    gsap.fromTo(
      ring.scale,
      { x: 0.2, y: 0.2, z: 0.2 },
      { x: 60, y: 60, z: 60, duration: 2.8, ease: "expo.out" }
    );
    gsap.to(ringMat.uniforms.uOpacity, {
      value: 0,
      duration: 2.8,
      ease: "power2.inOut",
      onComplete: () => {
        scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      },
    });

    gsap.fromTo(
      core.scale,
      { x: 0.4, y: 0.4, z: 0.4 },
      { x: 10, y: 10, z: 10, duration: 2.8, ease: "power3.out" }
    );
    gsap.to(coreMat.uniforms.uOpacity, {
      value: 0,
      duration: 2.6,
      ease: "power2.inOut",
      onComplete: () => {
        scene.remove(core);
        coreGeo.dispose();
        coreMat.dispose();
      },
    });

    gsap.fromTo(
      shockwave.scale,
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 100, y: 100, z: 100, duration: 3.5, ease: "expo.out" }
    );
    gsap.to(shockMat.uniforms.uOpacity, {
      value: 0,
      duration: 3.0,
      ease: "power2.inOut",
      onComplete: () => {
        scene.remove(shockwave);
        shockGeo.dispose();
        shockMat.dispose();
      },
    });

    gsap.to(lensMat.uniforms.uOpacity, {
      value: 0,
      delay: 2.5,
      duration: 1.2,
      ease: "power2.inOut",
      onComplete: () => {
        scene.remove(lensFlare);
        lensGeo.dispose();
        lensMat.dispose();
      },
    });

    const effectClock = new THREE.Clock();
    let effectRafId;
    function updateEffect() {
      const t = effectClock.getElapsedTime();
      if (ringMat.uniforms) ringMat.uniforms.uTime.value = t;
      if (coreMat.uniforms) coreMat.uniforms.uTime.value = t;
      if (shockMat.uniforms) shockMat.uniforms.uTime.value = t;
      if (lensMat.uniforms) lensMat.uniforms.uTime.value = t;

      if (t < 4) {
        effectRafId = requestAnimationFrame(updateEffect);
      } else {
        cancelAnimationFrame(effectRafId);
      }
    }
    updateEffect();
  }

  function pausePlanetRotation() {
    rotationPaused = true;
  }

  function resumePlanetRotation() {
    rotationPaused = false;
  }

  function handleClick(event) {
    const dragDistance = Math.sqrt(
      Math.pow(event.clientX - ((dragStartPos.x * w) / 2 + w / 2), 2) +
        Math.pow(event.clientY - ((-dragStartPos.y * h) / 2 + h / 2), 2)
    );

    if (dragDistance > 5) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.set(x, y);

    raycaster.params.Mesh.threshold = 0.2;
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(clickablePlanets, true);
    if (intersects.length > 0) {
      let target = null;

      for (const hit of intersects) {
        let obj = hit.object;
        while (
          obj &&
          (!obj.userData?.info || obj.userData.info.id === undefined)
        ) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.info) {
          target = obj;
          break;
        }
      }

      if (target) {
        emit("planet-clicked", target.userData.info);

        const worldPos = new THREE.Vector3();
        target.getWorldPosition(worldPos);

        createEnergyRing(worldPos);
        triggerWarpEffect();
        pausePlanetRotation();
        focusPlanet(target);
      }
    }
  }

  function focusPlanet(planet) {
    const planetCenter = planet.position.clone();
    const insideOffset = -2.2;
    const endPos = planetCenter
      .clone()
      .add(planetCenter.clone().normalize().multiplyScalar(insideOffset));
    controls.enabled = false;

    const startPos = camera.position.clone();
    const startDist = startPos.distanceTo(planetCenter);
    const endDist = endPos.distanceTo(planetCenter);
    let shown = false;

    gsap.fromTo(
      title.value,
      { opacity: 1, x: 0 },
      { opacity: 0, x: -100, duration: 0.8, ease: "power1.out" }
    );
    gsap.fromTo(
      description.value,
      { opacity: 1, x: 0 },
      { opacity: 0, x: -100, duration: 0.8, ease: "power1.out" }
    );
    gsap.fromTo(
      nav.value,
      { opacity: 1, x: 0 },
      { opacity: 0, x: 100, duration: 0.8, ease: "power1.out" }
    );

    const tl = gsap.timeline({
      onUpdate: () => {
        camera.lookAt(planetCenter);
        const cur = camera.position.distanceTo(planetCenter);
        const progress = 1 - (cur - endDist) / (startDist - endDist || 1);
        if (!shown && progress > 0.99 && tl.time() > 1.4) {
          shown = true;
          selectedPlanetData.value = planet.userData.info;
          emit("planet-selected", planet.userData.info);
        }
      },
    });

    tl.to(
      camera.position,
      {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: 2.2,
        ease: "power4.inOut",
      },
      0
    );
    tl.to(
      planet.material,
      { opacity: 0.14, duration: 1.6, ease: "power1.inOut" },
      0
    );
  }

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointerleave", handlePointerUp);
  renderer.domElement.addEventListener("click", handleClick);
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  function animate() {
    if (!canvas.value || !renderer) return;

    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const delta = clock.getDelta();

    if (!isDragging && dragMomentum.length() > 0.001) {
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position.clone().sub(controls.target));

      spherical.theta -= dragMomentum.x * 2;
      spherical.phi -= dragMomentum.y * 2;

      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      camera.position.setFromSpherical(spherical).add(controls.target);
      camera.lookAt(controls.target);

      dragMomentum.multiplyScalar(momentumDamping);
    }

    nebMaterial.uniforms.u_time.value = t * 0.6;
    nebMesh.rotation.y += 0.0003;
    nebMesh.rotation.x = Math.sin(t * 0.05) * 0.03;
    nebMesh.position.copy(camera.position);

    clickablePlanets.forEach((pl, i) => {
      const data = pl.userData;
      if (!data) return;
      if (rotationPaused) return;

      if (data.baseRadius === undefined) data.baseRadius = pl.position.length();
      if (data.baseTheta === undefined)
        data.baseTheta = Math.random() * Math.PI * 2;

      data.baseTheta += data.orbitSpeed;

      const x = data.baseRadius * Math.cos(data.baseTheta);
      const z = data.baseRadius * Math.sin(data.baseTheta);
      const y = Math.sin(t * 0.6 + i) * 0.3;

      pl.position.set(x, y, z);
      pl.position.x += Math.sin(t * 0.25 + i * 1.2) * 0.2;
      pl.position.z += Math.cos(t * 0.3 + i * 0.8) * 0.2;

      if (data.labelParent) {
        data.labelParent.position.copy(pl.position);
      }

      if (data.orbitRing) {
        data.orbitRing.material.opacity =
          0.035 + Math.sin(t * 0.6 + i * 1.3) * 0.012;
        data.orbitRing.rotation.y += 0.0002;
      }

      if (data.plasma) {
        data.plasma.scale.setScalar(0.95 + Math.sin(t * 0.5) * 0.03);
        data.plasmaMat.uniforms.time.value = t * 0.3;
      }

      if (data.satellites) {
        data.satellites.forEach((sat) => {
          sat.userData.currentAngle += sat.userData.orbitSpeed;
          const r = sat.userData.orbitRadius;
          sat.position.x = Math.sin(sat.userData.currentAngle) * r;
          sat.position.z = Math.cos(sat.userData.currentAngle) * r;
        });
      }

      if (data.particleRings) {
        const rings = data.particleRings;
        const positions = rings.geometry.attributes.position.array;
        const particleData = rings.userData.particleData;

        for (let i = 0; i < particleData.length; i++) {
          particleData[i].angle += particleData[i].speed;

          const radius = particleData[i].radius;
          const angle = particleData[i].angle;

          positions[i * 3] = Math.cos(angle) * radius;
          positions[i * 3 + 1] = particleData[i].yOffset;
          positions[i * 3 + 2] = Math.sin(angle) * radius;
        }

        rings.geometry.attributes.position.needsUpdate = true;
      }

      pl.rotation.y += data.rotationSpeed;
    });

    particlesMat.uniforms.uTime.value = t;

    plasma.scale.setScalar(0.91 + Math.sin(t * 1.2) * 0.03);
    sun.scale.setScalar(1 + Math.sin(t * 1.4) * 0.02);
    sun.rotation.y += sun.userData.rotationSpeed;

    if (!rotationPaused) {
      nebUniforms.u_time.value += delta * 1.0;
      galaxy.rotation.y -= 0.0018;
      plasmaMat.uniforms.time.value = t;
      sunAuraMat.uniforms.time.value = t;
      haloMat.uniforms.time.value += 0.02;

      asteroidGroup.children.forEach((a) => {
        a.userData.angle += a.userData.orbitSpeed;
        a.position.x = Math.cos(a.userData.angle) * 500;
        a.position.z = Math.sin(a.userData.angle) * 500;
        a.rotation.y += 0.002;
        a.rotation.x += 0.001;
      });

      comets.forEach((c, i) => {
        c.position.add(c.userData.velocity);
        if (Math.abs(c.position.x) > 2000 || Math.abs(c.position.z) > 2000) {
          scene.remove(c);
          c.geometry.dispose();
          c.material.dispose();
          comets.splice(i, 1);
        }
      });
    }

    controls.update();

    renderer.clear();
    renderer.render(scene, camera);
    composer.render();
    renderer.clearDepth();
    renderer.render(planetScene, camera);
    renderer.clearDepth();
    renderer.render(labelScene, camera);
  }

  animate();

  pauseControls = () => {
    if (controls) controls.enabled = false;
  };

  resumeControls = () => {
    if (controls) controls.enabled = true;
  };

  backToGalaxy = (planetInfo) => {
    const planet = clickablePlanets.find(
      (p) => p.userData.info.id === planetInfo.id
    );

    const lookTarget = planet
      ? planet.userData.basePos.clone()
      : new Vector3(0, 0, 0);
    const startPos = camera.position.clone();
    const exitPos = initialCameraPosition.clone();

    const tl = gsap.timeline({
      onUpdate: () => camera.lookAt(lookTarget),
      onComplete: () => {
        if (planet) planet.material.opacity = 1;
        if (planet && planet.userData && planet.userData.glowMat) {
          planet.userData.glowMat.opacity = 0;
          if (planet.userData.glowMesh)
            planet.userData.glowMesh.scale.set(1.45, 1.45, 1.45);
        }

        resumePlanetRotation();
        resumeControls();
        selectedPlanetData.value = null;
        emit("planet-exit");

        nextTick(() => {
          if (title.value) {
            gsap.fromTo(
              title.value,
              { opacity: 0, x: -100 },
              { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
            );
          }
          if (description.value) {
            gsap.fromTo(
              description.value,
              { opacity: 0, x: -100 },
              { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
            );
          }
          if (nav.value) {
            gsap.fromTo(
              nav.value,
              { opacity: 0, x: 100 },
              { opacity: 1, x: 0, duration: 0.8, ease: "power1.out" }
            );
          }
        });
      },
    });

    tl.fromTo(
      camera.position,
      { x: startPos.x, y: startPos.y, z: startPos.z },
      {
        x: exitPos.x,
        y: exitPos.y,
        z: exitPos.z,
        duration: 1.5,
        ease: "power2.inOut",
      }
    );

    if (planet) {
      tl.to(
        planet.material,
        { opacity: 1, duration: 1.0, ease: "power1.inOut" },
        "<"
      );
    }
  };

  focusOnPlanet = (planetId) => {
    const planet = clickablePlanets.find(
      (p) => p.userData.info.id === planetId
    );
    if (!planet) return;

    const planetCenter = planet.position.clone();
    const insideOffset = -2.2;
    const endPos = planetCenter
      .clone()
      .add(planetCenter.clone().normalize().multiplyScalar(insideOffset));

    gsap.to(camera.position, {
      x: endPos.x,
      y: endPos.y,
      z: endPos.z,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.lookAt(planetCenter);
      },
    });
  };

  getPlanetById = (id) =>
    clickablePlanets.find((p) => p.userData.info.id === id) || null;

  console.log("✅ Galaxy scene initialized");
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.28s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
