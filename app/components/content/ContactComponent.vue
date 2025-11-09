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
let renderer, scene, camera, animationId, pointCloud, uniforms;

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

  // Create star field
  const STAR_COUNT = 1000;
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const seed = Math.random() * 1000;

  // Use d3's randomUniform to distribute stars in a disk-ish volume
  const randR = randomUniform(0, 1);
  const sizeScale = scaleLinear().domain([0, 1]).range([0.8, 4.2]);

  for (let i = 0; i < STAR_COUNT; i++) {
    const r = Math.sqrt(randR()) * 600; // radial distribution (denser center)
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const y = (Math.random() - 0.5) * 400; // some vertical thickness
    const z = Math.sin(theta) * r;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    sizes[i] = sizeScale(Math.random());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  // Shader material for twinkling effect
  uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uTwinkleAmp: { value: 0.8 },
  };

  const vertexShader = `
    attribute float aSize;
    uniform float uPixelRatio;
    uniform float uTime;
    varying vec3 vPosition;
    varying float vSize;

    void main() {
      vPosition = position;
      vSize = aSize;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float psize = aSize * (300.0 / -mvPosition.z) * uPixelRatio;
      gl_PointSize = clamp(psize, 0.0, 40.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform float uTime;
    uniform float uTwinkleAmp;
    varying vec3 vPosition;
    varying float vSize;

    // simple 2D circle for point sprite
    float circle(vec2 uv, float r) {
      float d = length(uv);
      return smoothstep(r, r - 0.02, d);
    }

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float mask = circle(uv, 0.5);

      // per-star pseudo-random based on position
      float rnd = fract(sin(dot(vPosition.xy, vec2(12.9898,78.233))) * 43758.5453123);

      // twinkle pattern: sine wave with random phase and speed
      float tw = sin(uTime * (0.5 + rnd * 2.5) + rnd * 20.0);
      tw = (tw * 0.5 + 0.5); // 0..1
      float intensity = mix(0.6, 1.6, pow(tw, 2.0) * uTwinkleAmp);

      vec3 color = vec3(1.0);
      float alpha = mask * intensity;

      // Soft edges
      alpha *= smoothstep(0.0, 0.45, mask);

      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color * intensity, alpha);
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

  pointCloud = new THREE.Points(geometry, material);
  scene.add(pointCloud);

  // GSAP animasi: naik-turun amplitude twinkle, loop
  gsap.to(uniforms.uTwinkleAmp, {
    value: 1.6,
    duration: 4.5,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });

  // Resize handling
  const onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  };

  window.addEventListener("resize", onResize);

  // Render loop
  const clock = new THREE.Clock();
  const tick = () => {
    const dt = clock.getDelta();
    uniforms.uTime.value += dt * 2.0; // advance time (can tune speed)

    // subtle rotation for parallax
    pointCloud.rotation.y += 0.0005;

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(tick);
  };
  tick();

  // cleanup on unmount
  onBeforeUnmount(() => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);
    if (pointCloud) {
      pointCloud.geometry.dispose();
      pointCloud.material.dispose();
      scene.remove(pointCloud);
    }
    renderer.dispose();
  });
});
</script>

<style scoped>
/* canvas already sized by tailwind classes */
</style>
