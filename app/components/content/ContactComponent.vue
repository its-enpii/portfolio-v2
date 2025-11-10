<template>
  <div class="w-screen h-screen bg-black flex items-center justify-center">
    <div
      class="fixed w-screen h-screen flex items-center justify-center overflow-auto"
    >
      <div
        class="relative w-9/12 grid grid-cols-2 gap-6 bg-base/5 backdrop-blur-sm rounded-lg p-4"
      >
        <div class="flex justify-center flex-col">
          <div class="font-orbitron text-2xl font-bold text-base/80">
            Got a Cool Project Brewing?
          </div>
          <div class="font-orbitron text-2xl font-bold text-base/80">
            Drop Me a Line!
          </div>
          <div class="mt-4 font-inter text-base/40 text-sm">
            Let's turn your idea into rock-solid code and beautiful experience.
            I'm ready to hear your project brief.
          </div>

          <ul class="list-none flex flex-col gap-4 mt-10">
            <li
              v-for="(media, index) in props.content"
              :key="index"
              class="flex items-center gap-4 text-base/60"
            >
              <div
                class="w-10 h-10 rounded-full bg-base/5 border border-base/10 flex items-center justify-center"
              >
                <Icon :name="media.icon" class="text-2xl" />
              </div>
              <span>{{ media.text }}</span>
            </li>
          </ul>
        </div>

        <div class="bg-base/5 p-4 border border-base/10 rounded-lg">
          <div class="my-4">
            <label
              class="block mb-2 font-inter font-medium text-sm text-base/20"
              for="full_name"
            >
              Full Name
            </label>
            <input
              type="text"
              id="full_name"
              class="bg-black/5 border border-base/10 text-base/60 text-sm rounded-lg focus:outline-1 focus:outline-base/40 block w-full px-4 py-2.5"
              placeholder="Full Name"
              autocomplete="off"
            />
          </div>

          <div class="my-4">
            <label
              class="block mb-2 font-inter font-medium text-sm text-base/20"
              for="email"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              class="bg-black/5 border border-base/10 text-base/60 text-sm rounded-lg focus:outline-1 focus:outline-base/40 block w-full px-4 py-2.5"
              placeholder="Email"
              autocomplete="off"
            />
          </div>

          <div class="my-4">
            <label
              class="block mb-2 font-inter font-medium text-sm text-base/20"
              for="project_scope"
            >
              Project Scope & Goals
            </label>
            <textarea
              rows="5"
              id="project_scope"
              class="bg-black/5 border border-base/10 text-base/60 text-sm rounded-lg focus:outline-1 focus:outline-base/40 block w-full px-4 py-2.5"
              placeholder="Project Scope & Goals"
              autocomplete="off"
            ></textarea>
          </div>

          <!-- Submit button -->
          <div class="my-4">
            <button
              type="button"
              class="cursor-pointer bg-linear-to-br from-base/5 to-black/5 border border-base/10 text-base/60 text-sm rounded-lg focus:outline-1 focus:outline-base/40 font-inter px-4 py-2.5"
            >
              Send Project Brief
            </button>
          </div>
        </div>
      </div>
    </div>
    <canvas ref="canvas" class="w-full h-full block"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import * as THREE from "three";
import gsap from "gsap";
import { randomUniform, scaleLinear } from "d3";

const props = defineProps(["content"]);
const canvas = ref(null);
let renderer,
  scene,
  camera,
  animationId,
  stormParticles,
  lightningLines,
  debris,
  energyRings,
  uniforms,
  lightningUniforms,
  debrisUniforms,
  ringsUniforms;

onMounted(() => {
  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Scene + Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.z = 400;

  // Create storm particles (vortex)
  const PARTICLE_COUNT = 3000;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const randoms = new Float32Array(PARTICLE_COUNT);

  const colorPalette = [
    [0.5, 0.2, 1.0], // purple
    [0.2, 0.6, 1.0], // blue
    [0.8, 0.3, 0.9], // magenta
    [0.3, 0.8, 1.0], // cyan
    [1.0, 1.0, 1.0], // white (stars)
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 600;
    const height = (Math.random() - 0.5) * 500;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    velocities[i * 3] = Math.random() - 0.5;
    velocities[i * 3 + 1] = Math.random() - 0.5;
    velocities[i * 3 + 2] = Math.random() - 0.5;

    sizes[i] = Math.random() * 3 + 0.5;

    const colorChoice =
      colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = colorChoice[0];
    colors[i * 3 + 1] = colorChoice[1];
    colors[i * 3 + 2] = colorChoice[2];

    randoms[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

  uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };

  const vertexShader = `
    attribute float aSize;
    attribute vec3 aColor;
    attribute vec3 velocity;
    attribute float aRandom;
    uniform float uTime;
    uniform float uPixelRatio;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vColor = aColor;
      
      vec3 pos = position;
      
      float angle = atan(pos.z, pos.x);
      float radius = length(pos.xz);
      
      float rotationSpeed = (1.0 - radius / 600.0) * 2.0;
      angle += uTime * rotationSpeed * (aRandom > 0.5 ? 1.0 : -1.0);
      
      pos.x = cos(angle) * radius;
      pos.z = sin(angle) * radius;
      
      pos.x += sin(uTime * 0.5 + aRandom * 10.0) * 20.0;
      pos.y += cos(uTime * 0.3 + aRandom * 15.0) * 30.0;
      pos.z += sin(uTime * 0.4 + aRandom * 12.0) * 20.0;
      
      float distFromCenter = length(pos.xz) / 600.0;
      vAlpha = 1.0 - smoothstep(0.5, 1.0, distFromCenter);
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      float psize = aSize * (300.0 / -mvPosition.z) * uPixelRatio;
      gl_PointSize = clamp(psize, 1.0, 30.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    precision highp float;
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float dist = length(uv);
      
      float circle = smoothstep(0.5, 0.0, dist);
      
      vec3 finalColor = vColor;
      float alpha = circle * vAlpha * 0.8;
      
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader,
    fragmentShader,
  });

  stormParticles = new THREE.Points(geometry, material);
  scene.add(stormParticles);

  gsap.to(stormParticles.rotation, {
    y: Math.PI * 2,
    duration: 60,
    repeat: -1,
    ease: "none",
  });

  // Create lightning bolts
  const LIGHTNING_COUNT = 150;
  const lightningPositions = new Float32Array(LIGHTNING_COUNT * 3);
  const lightningColors = new Float32Array(LIGHTNING_COUNT * 3);
  const lightningRandom = new Float32Array(LIGHTNING_COUNT);

  for (let i = 0; i < LIGHTNING_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 100 + Math.random() * 400;

    lightningPositions[i * 3] = Math.cos(angle) * radius;
    lightningPositions[i * 3 + 1] = (Math.random() - 0.5) * 400;
    lightningPositions[i * 3 + 2] = Math.sin(angle) * radius;

    const intensity = 0.8 + Math.random() * 0.2;
    lightningColors[i * 3] = intensity;
    lightningColors[i * 3 + 1] = intensity * 0.9;
    lightningColors[i * 3 + 2] = 1.0;

    lightningRandom[i] = Math.random();
  }

  const lightningGeometry = new THREE.BufferGeometry();
  lightningGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(lightningPositions, 3)
  );
  lightningGeometry.setAttribute(
    "aColor",
    new THREE.BufferAttribute(lightningColors, 3)
  );
  lightningGeometry.setAttribute(
    "aRandom",
    new THREE.BufferAttribute(lightningRandom, 1)
  );

  lightningUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };

  const lightningVertexShader = `
    attribute vec3 aColor;
    attribute float aRandom;
    uniform float uTime;
    uniform float uPixelRatio;
    varying vec3 vColor;
    varying float vIntensity;

    void main() {
      vColor = aColor;
      
      vec3 pos = position;
      
      // Flickering effect
      float flicker = step(0.8, fract(sin(uTime * 15.0 + aRandom * 100.0) * 43758.5453));
      vIntensity = flicker;
      
      // Random jitter
      pos.x += sin(uTime * 10.0 + aRandom * 50.0) * 5.0;
      pos.y += cos(uTime * 12.0 + aRandom * 60.0) * 5.0;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
       gl_PointSize = 16.0 * uPixelRatio * flicker;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const lightningFragmentShader = `
    precision highp float;
    varying vec3 vColor;
    varying float vIntensity;

    void main() {
      if (vIntensity < 0.5) discard;
      
      vec2 uv = gl_PointCoord - vec2(0.5);
      float dist = length(uv);
      
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      glow = pow(glow, 2.0);
      
      vec3 finalColor = vColor * 2.0;
      float alpha = glow * vIntensity * 0.6;
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  const lightningMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: lightningUniforms,
    vertexShader: lightningVertexShader,
    fragmentShader: lightningFragmentShader,
  });

  lightningLines = new THREE.Points(lightningGeometry, lightningMaterial);
  scene.add(lightningLines);

  // Create debris/asteroids
  const DEBRIS_COUNT = 150;
  const debrisPositions = new Float32Array(DEBRIS_COUNT * 3);
  const debrisSizes = new Float32Array(DEBRIS_COUNT);
  const debrisRotations = new Float32Array(DEBRIS_COUNT);

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 200 + Math.random() * 500;

    debrisPositions[i * 3] = Math.cos(angle) * radius;
    debrisPositions[i * 3 + 1] = (Math.random() - 0.5) * 600;
    debrisPositions[i * 3 + 2] = Math.sin(angle) * radius;

    debrisSizes[i] = 3 + Math.random() * 8;
    debrisRotations[i] = Math.random() * Math.PI * 2;
  }

  const debrisGeometry = new THREE.BufferGeometry();
  debrisGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(debrisPositions, 3)
  );
  debrisGeometry.setAttribute(
    "aSize",
    new THREE.BufferAttribute(debrisSizes, 1)
  );
  debrisGeometry.setAttribute(
    "aRotation",
    new THREE.BufferAttribute(debrisRotations, 1)
  );

  debrisUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };

  const debrisVertexShader = `
    attribute float aSize;
    attribute float aRotation;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vRotation;

    void main() {
      vec3 pos = position;
      
      // Chaotic movement
      float angle = atan(pos.z, pos.x);
      float radius = length(pos.xz);
      angle -= uTime * 0.3;
      
      pos.x = cos(angle) * radius;
      pos.z = sin(angle) * radius;
      pos.y += sin(uTime * 0.5 + aRotation * 10.0) * 50.0;
      
      vRotation = aRotation + uTime;
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = aSize * (200.0 / -mvPosition.z) * uPixelRatio;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const debrisFragmentShader = `
    precision highp float;
    varying float vRotation;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      
      // Rotate UV
      float c = cos(vRotation);
      float s = sin(vRotation);
      uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
      
      // Square/angular shape
      float square = step(abs(uv.x), 0.3) * step(abs(uv.y), 0.3);
      
      vec3 color = vec3(0.4, 0.3, 0.5);
      float alpha = square * 0.7;
      
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const debrisMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: debrisUniforms,
    vertexShader: debrisVertexShader,
    fragmentShader: debrisFragmentShader,
  });

  debris = new THREE.Points(debrisGeometry, debrisMaterial);
  scene.add(debris);

  // Create energy rings
  const RING_COUNT = 7;
  const ringGeometry = new THREE.TorusGeometry(300, 2, 16, 100);

  for (let i = 0; i < RING_COUNT; i++) {
    ringsUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.3 },
    };

    const ringVertexShader = `
      uniform float uTime;
      varying vec3 vPosition;

      void main() {
        vPosition = position;
        vec3 pos = position;
        
        float wave = sin(uTime * 2.0 + position.y * 0.1) * 5.0;
        pos += normal * wave;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const ringFragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vPosition;

      void main() {
        vec3 color = vec3(0.5, 0.2, 1.0);
        float pulse = sin(uTime * 3.0 + vPosition.y * 0.2) * 0.5 + 0.5;
        
        gl_FragColor = vec4(color * (1.0 + pulse), uOpacity);
      }
    `;

    const ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: ringsUniforms,
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.y = Math.random() * Math.PI;
    ring.userData.uniforms = ringsUniforms;
    ring.userData.speed = 0.5 + Math.random() * 1.5;

    if (!energyRings) energyRings = [];
    energyRings.push(ring);
    scene.add(ring);
  }

  // Camera shake effect
  gsap.to(camera.position, {
    x: "+=10",
    y: "+=10",
    duration: 0.1,
    repeat: -1,
    yoyo: true,
    ease: "rough({ strength: 3, points: 20, randomize: true })",
  });

  // Resize handling
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    lightningUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    debrisUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  };

  window.addEventListener("resize", onResize);

  // Render loop
  const clock = new THREE.Clock();
  const tick = () => {
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    uniforms.uTime.value = time;
    lightningUniforms.uTime.value = time;
    debrisUniforms.uTime.value = time;

    // Update energy rings
    if (energyRings) {
      energyRings.forEach((ring, idx) => {
        ring.userData.uniforms.uTime.value = time * ring.userData.speed;
        ring.rotation.z += 0.005 * ring.userData.speed;
      });
    }

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(tick);
  };
  tick();

  // cleanup on unmount
  onBeforeUnmount(() => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);

    if (stormParticles) {
      stormParticles.geometry.dispose();
      stormParticles.material.dispose();
      scene.remove(stormParticles);
    }
    if (lightningLines) {
      lightningLines.geometry.dispose();
      lightningLines.material.dispose();
      scene.remove(lightningLines);
    }
    if (debris) {
      debris.geometry.dispose();
      debris.material.dispose();
      scene.remove(debris);
    }
    if (energyRings) {
      energyRings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
        scene.remove(ring);
      });
    }

    renderer.dispose();
  });
});
</script>

<style scoped>
/* canvas already sized by tailwind classes */
</style>
