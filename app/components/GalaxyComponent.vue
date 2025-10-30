<template>
  <div class="w-screen h-screen flex items-center justify-center relative">
    <div ref="container" class="w-full h-full relative">
      <div class="absolute top-4 left-4 z-50 text-white pointer-events-none">
        <h1 class="text-lg font-semibold">Nuxt Galaxy — realistic demo</h1>
      </div>

      <transition name="fade">
        <div
          v-if="selectedPlanetData"
          class="absolute right-4 top-4 z-60 w-72 p-3 bg-black/45 backdrop-blur-sm border border-white/6 text-white rounded-md pointer-events-auto"
        >
          <div class="text-xs text-gray-300">NODE</div>
          <div class="text-base font-medium text-gray-100">
            {{ selectedPlanetData.name }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            ID: {{ selectedPlanetData.id }}
          </div>
        </div>
      </transition>

      <canvas ref="canvas" class="w-full h-full block"></canvas>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from "vue";

const canvas = ref(null);
const container = ref(null);
const emit = defineEmits(["planet-selected", "planet-exit"]);

let pauseControls = () => {};
let resumeControls = () => {};
let backToGalaxy = (/* id | mesh */) => {};
let getPlanetById = (/* id */) => null;
defineExpose({
  pauseControls: (...args) => pauseControls(...args),
  resumeControls: (...args) => resumeControls(...args),
  backToGalaxy: (...args) => backToGalaxy(...args),
  getPlanetById: (...args) => getPlanetById(...args),
});

const selectedPlanetData = ref(null);

onMounted(async () => {
  await nextTick();

  const THREE = await import("three");
  const { OrbitControls } = await import(
    "three/examples/jsm/controls/OrbitControls.js"
  );
  const gsapModule = await import("gsap");
  const d3 = await import("d3");
  const { EffectComposer } = await import(
    "three/examples/jsm/postprocessing/EffectComposer.js"
  );
  const { RenderPass } = await import(
    "three/examples/jsm/postprocessing/RenderPass.js"
  );
  const { UnrealBloomPass } = await import(
    "three/examples/jsm/postprocessing/UnrealBloomPass.js"
  );
  const { AfterimagePass } = await import(
    "three/examples/jsm/postprocessing/AfterimagePass.js"
  );
  const { ShaderPass } = await import(
    "three/examples/jsm/postprocessing/ShaderPass.js"
  );
  const { ClearPass } = await import(
    "three/examples/jsm/postprocessing/ClearPass.js"
  );

  const { Lensflare, LensflareElement } = await import(
    "three/examples/jsm/objects/Lensflare.js"
  );

  const { RGBShiftShader } = await import(
    "three/examples/jsm/shaders/RGBShiftShader.js"
  );

  const gsap = gsapModule.default;

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
    Float32BufferAttribute,
    PointsMaterial,
    Raycaster,
    Vector2,
    Vector3,
    Color,
    Group,
    MeshBasicMaterial,
    BackSide,
    SpriteMaterial,
    Sprite,
    CanvasTexture,
    LineBasicMaterial,
    Line,
    BufferAttribute,
    TextureLoader,
    ShaderMaterial,
    MathUtils,
  } = THREE;

  let rotationPaused = false;

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

  const scene = new THREE.Scene();
  const labelScene = new THREE.Scene();
  const planetScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(80, w / h, 0.1, 6000);
  camera.position.set(0, 140, 340);
  const initialCameraPosition = camera.position.clone();

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas.value ?? undefined,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

  const nebGeo = new THREE.SphereGeometry(2000, 64, 64);
  const nebMesh = new THREE.Mesh(nebGeo, nebMaterial);
  scene.add(nebMesh);

  const sunTexture = new THREE.TextureLoader().load("/textures/sun.jpg");
  const sunGeo = new THREE.SphereGeometry(24, 64, 64);
  const sunMat = new THREE.MeshStandardMaterial({
    map: sunTexture,
    roughness: 0.2,
    color: new THREE.Color(0x302ee6),
    emissive: new THREE.Color(0x3d348b),
    emissiveIntensity: 0.6,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(0, 0, 0);
  planetScene.add(sun);

  sun.userData.rotationSpeed = 0.0005;

  const sunAuraGeo = new THREE.SphereGeometry(20, 64, 64);
  const sunAuraMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x3d348b) },
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

  const plasmaGeo = new THREE.SphereGeometry(28, 64, 64);
  const plasmaMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      colorA: { value: new THREE.Color(0x040303) },
      colorB: { value: new THREE.Color(0x3d348b) },
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
    color: 0x514997,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 1.4,
  });
  const corona = new THREE.Sprite(coronaMaterial);
  corona.scale.set(180, 180, 1);
  sun.add(corona);

  const haloGeo = new THREE.SphereGeometry(10, 64, 64);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      glowColor: { value: new THREE.Color(0x66ccff) },
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

  const spread = 3000;
  const particleCount = 6000;
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
      uColor: { value: new THREE.Color(0xdfeff3) },
      uSize: { value: 1.6 },
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
      gl_PointSize = uSize * (800.0 / -mvPosition.z);
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
    innerColor = 0x3d348b,
    outerColor = 0x886b62,
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

      positions[i3] = Math.cos(angle) * r + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(angle) * r + randomZ;

      const color = colorInside.clone().lerp(colorOutside, radiusRatio);
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
    count: 48000,
    radius: 200,
    branches: 4,
    spin: 8,
    innerColor: 0x7a74ae,
    outerColor: 0x3d348b,
  });
  galaxy.frustumCulled = false;
  galaxy.renderOrder = 10;
  scene.add(galaxy);

  const mainPlanetDefs = [
    {
      id: 0,
      name: "About Me",
      hue: 210,
      texture: "/textures/planet/about_me.jpg",
    },
    {
      id: 1,
      name: "Skills",
      hue: 180,
      texture: "/textures/planet/skills.jpg",
    },
    {
      id: 2,
      name: "Projects",
      hue: 30,
      texture: "/textures/planet/projects.jpg",
    },
    {
      id: 3,
      name: "Contact",
      hue: 280,
      texture: "/textures/planet/contact.jpg",
    },
  ];
  const clickablePlanets = [];

  function createLabelTexture(text) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const fontSize = 48;
    ctx.font = `600 ${fontSize}px Orbitron, sans-serif`;
    const tm = ctx.measureText(text);
    const textWidth = tm.width;
    const paddingX = 48;
    const paddingY = 24;
    const borderRadius = 24;
    c.width = Math.max(160, textWidth + paddingX * 2);
    c.height = fontSize + paddingY * 2;
    ctx.font = `500 ${fontSize}px Orbitron, sans-serif`;
    ctx.fillStyle = "rgba(4, 4, 3, 0.5)";
    roundRect(ctx, 0, 0, c.width, c.height, borderRadius);
    ctx.fill();
    ctx.strokeStyle = "rgba(243,243,243,1)";
    ctx.lineWidth = 2;
    roundRect(ctx, 0, 0, c.width, c.height, borderRadius);
    ctx.stroke();
    ctx.fillStyle = "#3D348B";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8;
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new CanvasTexture(c);
    tex.needsUpdate = true;
    return { texture: tex, aspectRatio: c.width / c.height };
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function createPlanet(rDistance, theta, def) {
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(def.texture, () => {
      texture.colorSpace = THREE.SRGBColorSpace;
    });

    const planetGeo = new SphereGeometry(10.0, 96, 96);
    const planetMat = new THREE.MeshStandardMaterial({
      map: texture,
      metalness: 0.4,
      roughness: 0.2,
      emissive: new THREE.Color(0xe6af2e),
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
      name: def.name,
      id: def.id,
    };
    planetScene.add(planet);

    planet.userData.baseRadius = rDistance;
    planet.userData.baseTheta = theta;
    planet.userData.orbitSpeed = 0.001 + Math.random() * 0.001;
    planet.userData.rotationSpeed = 0.002 + Math.random() * 0.001;

    planet.rotation.z = THREE.MathUtils.degToRad(23.5);

    const planetCoronaTexture = new THREE.TextureLoader().load(
      "/textures/glow.png"
    );
    const planetCoronaMaterial = new THREE.SpriteMaterial({
      map: planetCoronaTexture,
      color: 0x3d348b,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.8,
    });
    const planetCorona = new THREE.Sprite(planetCoronaMaterial);
    planetCorona.scale.set(64, 64, 1);
    planet.add(planetCorona);

    const planetPlasmaGeo = new THREE.SphereGeometry(11, 96, 96);
    const planetPlasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        colorA: { value: new THREE.Color(0x36290d) },
        colorB: { value: new THREE.Color(0x3d348b) },
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
        color: { value: new THREE.Color(0xe6af2e) },
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
          float glow = pow(abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
          gl_FragColor = vec4(color * glow * intensity, 1.0);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const glowMesh = new Mesh(new THREE.SphereGeometry(12, 64, 64), glowMat);
    glowMesh.scale.multiplyScalar(1.45);
    glowMesh.renderOrder = 999;
    planet.add(glowMesh);
    planet.userData.glowMat = glowMat;
    planet.userData.glowMesh = glowMesh;

    const segments = 96;
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
      color: 0xeac670,
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

    clickablePlanets.push(planet);
  }

  const baseRadius = 60;
  const orbitGap = 40;
  const planetsPerOrbit = 1;
  const angleOffset = Math.random() * Math.PI * 2;

  mainPlanetDefs.forEach((def, idx) => {
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

  const asteroidCount = 300;
  for (let i = 0; i < asteroidCount; i++) {
    const radius = 400 + Math.random() * 300;
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 200;

    const geom = new SphereGeometry(Math.random() * 2 + 0.5, 8, 8);
    const mat = new MeshStandardMaterial({
      color: 0x111111,
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
    const geom = new THREE.SphereGeometry(2, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3d348b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const comet = new THREE.Mesh(geom, mat);

    // 🔹 Buat ekor
    const tailGeom = new THREE.ConeGeometry(1.5, 20, 32, 1, true);
    const tailMat = new THREE.MeshBasicMaterial({
      color: 0x040303,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const tail = new THREE.Mesh(tailGeom, tailMat);
    tail.position.z = 10; // dorong sedikit ke belakang bola
    tail.rotation.x = Math.PI; // default: ekor ke belakang
    comet.add(tail);

    // 🔹 Random arah: true = kiri→kanan, false = kanan→kiri
    const fromLeft = Math.random() < 0.5;

    // 🔹 Posisi awal dan kecepatan berdasarkan arah
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

    // 🔹 Rotasi ekor agar menghadap berlawanan arah gerak
    if (!fromLeft) {
      tail.rotation.y = Math.PI; // balikkan ekor
    }

    // 🔹 Glow (cahaya di kepala komet)
    const glowTex = new THREE.TextureLoader().load("textures/sun-glow.png");
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

  const comets = [];
  setInterval(() => {
    if (comets.length < 10) comets.push(createComet());
  }, 2000);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const controls = new OrbitControls(camera, renderer.domElement);
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

  function onPointerDown(event) {
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

  function onPointerMove(event) {
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

  function onPointerUp(event) {
    if (!isDragging) return;
    isDragging = false;
    dragMomentum.copy(dragVelocity);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", onPointerUp);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.8, 0.0);
  bloomPass.threshold = 0.88;
  bloomPass.strength = 0.18;
  bloomPass.radius = 0.5;
  composer.addPass(bloomPass);

  const afterimagePass = new AfterimagePass();
  afterimagePass.uniforms["damp"].value = 0.96;
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

  let rafId;
  const clock = new THREE.Clock();
  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

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

    clickablePlanets.forEach((pl, i) => {
      const data = pl.userData;
      if (!data) return;
      if (rotationPaused) return;

      if (data.baseRadius === undefined) data.baseRadius = pl.position.length();
      if (data.baseTheta === undefined)
        data.baseTheta = Math.random() * Math.PI * 2;
      if (data.orbitSpeed === undefined)
        data.orbitSpeed = 0.001 + Math.random() * 0.0005;

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

      pl.rotation.y += data.rotationSpeed;
    });

    const delta = clock.getDelta();
    nebMesh.position.copy(camera.position);
    particlesMat.uniforms.uTime.value = clock.getElapsedTime();
    plasma.scale.setScalar(0.91 + Math.sin(t * 1.2) * 0.03);

    if (!rotationPaused) {
      nebUniforms.u_time.value += 0.01;
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
        if (Math.abs(c.position.x) > 2000 || c.position.z > 400) {
          scene.remove(c);
          comets.splice(i, 1);
        }
      });
    }

    sun.scale.setScalar(1 + Math.sin(t * 1.4) * 0.02);
    sun.rotation.y += sun.userData.rotationSpeed;
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

  function createEnergyRing(position, colorA = 0x3d348b, colorB = 0xe6af2e) {
    const ringGeo = new THREE.RingGeometry(1.0, 1.6, 128);
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

    const coreGeo = new THREE.SphereGeometry(0.6, 64, 64);
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

    const shockGeo = new THREE.PlaneGeometry(6, 6, 64, 64);
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

    const lensGeo = new THREE.PlaneGeometry(2, 2, 64, 64);
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
      {
        x: 60,
        y: 60,
        z: 60,
        duration: 2.8,
        ease: "expo.out",
      }
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
      {
        x: 10,
        y: 10,
        z: 10,
        duration: 2.8,
        ease: "power3.out",
      }
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
      {
        x: 100,
        y: 100,
        z: 100,
        duration: 3.5,
        ease: "expo.out",
      }
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

    const clock = new THREE.Clock();
    function update() {
      const t = clock.getElapsedTime();
      ringMat.uniforms.uTime.value = t;
      coreMat.uniforms.uTime.value = t;
      shockMat.uniforms.uTime.value = t;
      lensMat.uniforms.uTime.value = t;
      requestAnimationFrame(update);
    }
    update();
  }

  function pausePlanetRotation() {
    rotationPaused = true;
  }
  function resumePlanetRotation() {
    rotationPaused = false;
  }

  function onClick(event) {
    const dragDistance = Math.sqrt(
      Math.pow(event.clientX - ((dragStartPos.x * w) / 2 + w / 2), 2) +
        Math.pow(event.clientY - ((-dragStartPos.y * h) / 2 + h / 2), 2)
    );

    if (dragDistance > 5) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(clickablePlanets, true);

    if (intersects.length) {
      let target = intersects[0].object;
      while (target && (!target.userData || target.userData.id === undefined))
        target = target.parent;
      if (target) {
        const worldPos = new THREE.Vector3();
        target.getWorldPosition(worldPos);

        createEnergyRing(worldPos);
        triggerWarpEffect();

        pausePlanetRotation();

        focusPlanet(target);
      }
    }
  }
  renderer.domElement.addEventListener("click", onClick);

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

    const tl = gsap.timeline({
      onUpdate: () => {
        camera.lookAt(planetCenter);
        const cur = camera.position.distanceTo(planetCenter);
        const progress = 1 - (cur - endDist) / (startDist - endDist || 1);
        if (!shown && progress > 0.985) {
          shown = true;
          selectedPlanetData.value = {
            id: planet.userData.id,
            name: planet.userData.name,
          };
          emit("planet-selected", planet.userData.id);
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
        ease: "power2.inOut",
      },
      0
    );
    tl.to(
      planet.material,
      { opacity: 0.14, duration: 1.6, ease: "power1.inOut" },
      0
    );
  }

  backToGalaxy = (planetOrId) => {
    const planet =
      typeof planetOrId === "object"
        ? planetOrId
        : clickablePlanets.find((p) => p.userData.id === planetOrId);
    const lookTarget = planet
      ? planet.userData.basePos.clone()
      : new Vector3(0, 0, 0);
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
      },
    });
    tl.to(
      camera.position,
      {
        x: exitPos.x,
        y: exitPos.y,
        z: exitPos.z,
        duration: 1.5,
        ease: "power2.inOut",
      },
      0
    );
    tl.to(
      planet ? planet.material : {},
      { opacity: 1, duration: 1.0, ease: "power1.inOut" },
      "<"
    );
  };

  pauseControls = () => {
    if (controls) controls.enabled = false;
  };
  resumeControls = () => {
    if (controls) controls.enabled = true;
  };
  getPlanetById = (id) =>
    clickablePlanets.find((p) => p.userData.id === id) || null;

  function onResize() {
    const { w: nw, h: nh } = getSize();
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    composer.setSize(nw, nh);
  }
  window.addEventListener("resize", onResize);

  onBeforeUnmount(() => {
    try {
      window.removeEventListener("resize", onResize);
    } catch (e) {}
    try {
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerUp);
    } catch (e) {}
    try {
      cancelAnimationFrame(rafId);
    } catch (e) {}
    try {
      particlesGeo && particlesGeo.dispose && particlesGeo.dispose();
    } catch (e) {}
    try {
      particlesMat && particlesMat.dispose && particlesMat.dispose();
    } catch (e) {}
    try {
      sun.geometry.dispose();
      sun.material.dispose();
    } catch (e) {}
    try {
      halo.geometry.dispose();
      halo.material.dispose();
    } catch (e) {}
    try {
      nebMesh.geometry.dispose();
      nebMesh.material.dispose();
    } catch (e) {}
    try {
      renderer.dispose();
    } catch (e) {}
    try {
      composer && composer.dispose && composer.dispose();
    } catch (e) {}
  });
});
</script>

<style>
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
