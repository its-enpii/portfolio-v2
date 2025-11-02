<template>
  <div
    ref="container"
    class="w-screen h-screen overflow-hidden bg-black relative z-800"
  >
    <div
      class="fixed w-screen h-screen flex items-center justify-center overflow-auto"
    >
      <div class="relative w-9/12 flex" ref="cardContainer">
        <div
          class="relative w-4/12 overflow-hidden rounded-tl-lg rounded-bl-lg"
        >
          <img
            :src="images[0]"
            class="absolute w-full h-full object-cover"
            ref="imgBottom"
          />
          <img
            :src="images[1]"
            class="absolute w-full h-full object-cover"
            ref="imgTop"
          />
        </div>
        <div
          class="w-8/12 py-10 pr-6 bg-linear-to-br from-black/10 to-base/5 border border-base/10 rounded-tr-lg rounded-br-lg backdrop-blur-xl"
        >
          <div
            class="p-10 border border-l-0 bg-base/5 border-base/20 rounded-tr-md rounded-br-md"
          >
            <h1 class="text-4xl font-orbitron font-semibold text-base">
              {{ props.content.title }}
            </h1>
            <p
              class="mt-6 font-inter text-base/60 text-sm"
              v-html="props.content.desc"
            ></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from "vue";
import * as THREE from "three";
import { gsap } from "gsap";

const props = defineProps(["content"]);
const container = ref(null);
const images = props.content.images;

const imgTop = ref(null);
const imgBottom = ref(null);
const cardContainer = ref(null);

let currentIndex = 0;
let scene, camera, renderer, mesh, uniforms, animationId;

onMounted(async () => {
  await nextTick();
  const width = window.innerWidth;
  const height = window.innerHeight;

  // PENTING: Cek apakah refs sudah tersedia
  if (!imgTop.value || !imgBottom.value) {
    console.error("Image refs are not available");
    return;
  }

  // Set initial state
  gsap.set(imgBottom.value, { opacity: 1, zIndex: 1 });
  gsap.set(imgTop.value, { opacity: 0, zIndex: 2 });

  gsap.set(cardContainer.value, { scale: 0 });

  gsap.to(cardContainer.value, {
    scale: 1,
    duration: 1,
    ease: "back.out(1.4)",
    delay: 0.3,
  });

  // Setup scene + camera
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.value.append(renderer.domElement);

  // Shader uniforms
  uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(width, height) },
    u_color1: { value: new THREE.Color("#00ffcc") },
    u_color2: { value: new THREE.Color("#33ccff") },
    u_color3: { value: new THREE.Color("#cc33ff") },
  };

  // Shader material
  const material = new THREE.ShaderMaterial({
    uniforms,
    fragmentShader: `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
      uniform vec3 u_color3;
      varying vec2 vUv;

      float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = rand(i);
        float b = rand(i + vec2(1.0,0.0));
        float c = rand(i + vec2(0.0,1.0));
        float d = rand(i + vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }

      float fbm(vec2 p){
        float v = 0.0;
        float a = 0.5;
        for(int i=0;i<5;i++){
          v += a*noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * vec2(3.0, 4.0);
        float t = u_time * 0.2;

        // Tirai aurora bergerak
        float wave = sin(uv.x * 10.0 + t) * 0.1 + sin(uv.x * 5.0 - t*1.5) * 0.05;
        p.y += wave;

        float n = fbm(p + vec2(0.0, t));
        float band = smoothstep(0.3, 0.8, n);

        // Gradasi warna aurora
        vec3 col = mix(u_color1, u_color2, band);
        col = mix(col, u_color3, pow(band, 2.0));

        vec3 finalColor = col * (0.5 + pow(band, 1.5));
        gl_FragColor = vec4(finalColor, band * 0.4);
      }
    `,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position,1.0);
      }
    `,
    transparent: true,
  });

  // Plane fullscreen
  const geometry = new THREE.PlaneGeometry(2, 2);
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Animasi shader time
  function animate() {
    uniforms.u_time.value += 0.05;
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }
  animate();

  // Animasi gradasi warna dengan GSAP
  gsap.to(uniforms.u_color1.value, {
    r: Math.random(),
    g: Math.random(),
    b: Math.random(),
    duration: 8,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(uniforms.u_color3.value, {
    r: Math.random(),
    g: Math.random(),
    b: Math.random(),
    duration: 12,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  window.addEventListener("resize", onResize);

  function crossFade() {
    if (!imgTop.value || !imgBottom.value) return;

    const nextIndex = (currentIndex + 1) % images.length;

    // Load gambar baru ke layer atas
    imgTop.value.src = images[nextIndex];

    // Animate: fade in top, fade out bottom
    const tl = gsap.timeline({
      onComplete: () => {
        // Swap: copy top ke bottom, reset top
        imgBottom.value.src = imgTop.value.src;
        gsap.set(imgBottom.value, { opacity: 1 });
        gsap.set(imgTop.value, { opacity: 0 });

        currentIndex = nextIndex;
        setTimeout(crossFade, 3000);
      },
    });

    tl.to(
      imgTop.value,
      {
        opacity: 1,
        duration: 1.5,
        ease: "power2.inOut",
      },
      0
    );

    tl.to(
      imgBottom.value,
      {
        opacity: 0,
        duration: 1.5,
        ease: "power2.inOut",
      },
      0
    );
  }

  setTimeout(crossFade, 3000);
});

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  uniforms.u_resolution.value.set(width, height);
}

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId);
  renderer.dispose();
});
</script>
