<template>
  <div
    class="w-screen h-screen bg-black flex items-center justify-center relative"
  >
    <div ref="container" class="w-full h-full relative">
      <!-- overlay UI -->
      <div class="absolute top-4 left-4 z-50 text-white">
        <h1 class="text-xl font-semibold">
          Nuxt Galaxy — click a planet to zoom
        </h1>
      </div>

      <!-- labels will be rendered into this overlay by CSS2DRenderer (absolute) -->
      <div
        ref="labelRoot"
        class="absolute inset-0 pointer-events-none z-40"
      ></div>

      <canvas ref="canvas" class="w-full h-full block"></canvas>
    </div>
  </div>
</template>

<script setup>
// Nuxt 4 + Vue 3 single-file component
// Requirements: three, gsap, d3
// npm i three gsap d3

import { onMounted, onBeforeUnmount, ref } from "vue";

let THREE, OrbitControls, CSS2DRenderer, gsap, d3;
const canvas = ref(null);
const container = ref(null);
const labelRoot = ref(null);

onMounted(async () => {
  if (process.server) return;

  // dynamic imports so SSR doesn't break
  THREE = await import("three");
  const examples = await import("three/examples/jsm/controls/OrbitControls");
  OrbitControls = examples.OrbitControls;
  const labelModule = await import(
    "three/examples/jsm/renderers/CSS2DRenderer"
  );
  CSS2DRenderer = labelModule.CSS2DRenderer;
  gsap = (await import("gsap")).default;
  d3 = await import("d3");

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
  } = THREE;

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    45,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    5000
  );
  camera.position.set(0, 120, 320);

  const renderer = new WebGLRenderer({
    canvas: canvas.value,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.physicallyCorrectLights = true;

  // Label renderer (for 2D HTML labels that follow 3D objects)
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(
    container.value.clientWidth,
    container.value.clientHeight
  );
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.classList.add("pointer-events-none");
  // attach to the provided overlay root so Nuxt/CSS layering is consistent
  labelRoot.value.appendChild(labelRenderer.domElement);

  // Lights
  const ambient = new AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 0.8);
  dir.position.set(50, 100, 50);
  scene.add(dir);

  // Center glowing sun (using emissive material)
  const sunGeo = new SphereGeometry(18, 32, 32);
  const sunMat = new MeshStandardMaterial({
    emissive: new Color(0x2a9dff),
    emissiveIntensity: 2.2,
    metalness: 0.1,
    roughness: 0.4,
  });
  const sun = new Mesh(sunGeo, sunMat);
  sun.position.set(0, 0, 0);
  scene.add(sun);

  // Subtle bloom-like illusion: add a larger transparent sphere to create halo
  const haloGeo = new SphereGeometry(38, 32, 32);
  const haloMat = new MeshStandardMaterial({
    color: 0x2a9dff,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });
  const halo = new Mesh(haloGeo, haloMat);
  scene.add(halo);

  // --- Background particle sphere ---
  const particleCount = 3500;
  const radius = 160;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    // spherical coordinates for uniform-ish distribution
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = radius + d3.randomNormal(0, 6)();

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    sizes[i] = Math.max(0.5, 1.2 + d3.randomNormal(0, 0.7)());
  }

  const particlesGeo = new BufferGeometry();
  particlesGeo.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3)
  );
  particlesGeo.setAttribute("size", new Float32BufferAttribute(sizes, 1));

  const particlesMat = new PointsMaterial({
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
  });
  particlesMat.color = new Color(0xa8f0d8);
  particlesMat.opacity = 0.95;

  const particles = new Points(particlesGeo, particlesMat);
  scene.add(particles);

  // --- Clickable planets (actual Mesh objects) ---
  // We'll create a set of main planets on the sphere with larger scale and attach labels
  const mainPlanetDefs = [
    { name: "Galaxy Roadmap", hue: 200 },
    { name: "Partners", hue: 160 },
    { name: "Investors", hue: 30 },
    { name: "Social", hue: 280 },
    { name: "Community", hue: 100 },
  ];

  const clickablePlanets = [];
  const labelElements = [];

  function createPlanetOnSphere(rDistance, theta, phi, def) {
    const planetGeo = new SphereGeometry(4.8, 24, 24);
    const color = new Color().setHSL((def.hue % 360) / 360, 0.75, 0.5);
    const planetMat = new MeshStandardMaterial({
      color,
      metalness: 0.2,
      roughness: 0.5,
    });
    const planet = new Mesh(planetGeo, planetMat);

    const x = rDistance * Math.sin(phi) * Math.cos(theta);
    const y = rDistance * Math.cos(phi);
    const z = rDistance * Math.sin(phi) * Math.sin(theta);

    planet.position.set(x, y, z);

    // Optional subtle rotation axis as property
    planet.userData = { basePos: planet.position.clone(), name: def.name };

    scene.add(planet);

    // Buat label HTML
    const div = document.createElement("div");
    div.className = "planet-label pointer-events-auto";
    div.style.padding = "6px 10px";
    div.style.borderRadius = "999px";
    div.style.background = "rgba(0,0,0,0.45)";
    div.style.color = "white";
    div.style.fontSize = "13px";
    div.style.fontFamily = "Inter, sans-serif";
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.gap = "8px";
    div.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${
      "#" + color.getHexString()
    };display:inline-block"></span><span>${def.name}</span>`;

    const cssObj = new labelModule.CSS2DObject(div);
    scene.add(cssObj);
    planet.userData.labelObj = cssObj;

    clickablePlanets.push(planet);
    labelElements.push(div);
  }

  // place main planets evenly-ish around the sphere
  mainPlanetDefs.forEach((def, idx) => {
    const t = (idx / mainPlanetDefs.length) * Math.PI * 2 + Math.random() * 0.6;
    const p = Math.random() * Math.PI;
    const rDist = radius - 6 + (Math.random() * 12 - 6);
    createPlanetOnSphere(rDist, t, p, def);
  });

  // Raycaster for interactions
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.minDistance = 40;
  controls.maxDistance = 1200;

  // Animation
  let rafId;
  const clock = new THREE.Clock();

  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // rotate the particle sphere slowly
    particles.rotation.y = t * 0.02;

    // rotate each clickable planet slowly around its base position to look lively
    clickablePlanets.forEach((pl, i) => {
      const base = pl.userData.basePos;
      // small wobble
      pl.position.x = base.x + Math.sin(t * 0.4 + i) * 1.2;
      pl.position.y = base.y + Math.cos(t * 0.35 + i * 1.1) * 1.0;
      pl.position.z = base.z + Math.cos(t * 0.25 + i * 0.6) * 1.2;
      // ensure label follows
      pl.children.forEach((c) => {
        if (c.isCSS2DObject) c.position.copy(pl.position);
      });

      // Update posisi label agar menempel di atas planet
      if (pl.userData.labelObj) {
        const labelPos = pl.position.clone();
        const normal = labelPos.clone().normalize();
        labelPos.addScaledVector(normal, 5.8); // 5.8 = jarak di atas permukaan planet (radius 4.8 + margin 1)
        pl.userData.labelObj.position.copy(labelPos);
      }
    });

    sun.scale.setScalar(1 + Math.sin(t * 2.0) * 0.03);

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  animate();

  // Resize
  function onResize() {
    camera.aspect = container.value.clientWidth / container.value.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.value.clientWidth, container.value.clientHeight);
    labelRenderer.setSize(
      container.value.clientWidth,
      container.value.clientHeight
    );
  }
  window.addEventListener("resize", onResize);

  // Click handling using raycast against clickablePlanets
  function onClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(clickablePlanets, true);
    if (intersects.length > 0) {
      const planet = intersects[0].object;
      // Find top-level mesh if clicked on child
      const top = clickablePlanets.find(
        (p) =>
          p === planet || p.children.includes(planet) || p.uuid === planet.uuid
      );
      if (top) {
        focusPlanet(top);
      }
    }
  }

  function focusPlanet(planet) {
    // Ambil posisi dunia planet (bukan lokal)
    const targetPos = new THREE.Vector3();
    planet.getWorldPosition(targetPos);

    // Ambil posisi kamera sekarang
    const start = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    // Tentukan posisi kamera yang baru — agak menjauh dari planet
    const dir = targetPos.clone().normalize();
    const end = {
      x: targetPos.x + dir.x * 60,
      y: targetPos.y + dir.y * 20,
      z: targetPos.z + dir.z * 60,
    };

    // Animasi pergerakan kamera menuju planet
    gsap.to(start, {
      x: end.x,
      y: end.y,
      z: end.z,
      duration: 1.4,
      ease: "power2.inOut",
      onUpdate: () => {
        camera.position.set(start.x, start.y, start.z);
        camera.lookAt(targetPos);
      },
    });

    // Efek “pulse” pada planet saat di klik
    const origScale = planet.scale.clone();
    gsap.to(planet.scale, {
      x: origScale.x * 1.25,
      y: origScale.y * 1.25,
      z: origScale.z * 1.25,
      yoyo: true,
      repeat: 1,
      duration: 0.6,
    });
  }

  renderer.domElement.addEventListener("click", onClick);

  // cleanup
  onBeforeUnmount(() => {
    cancelAnimationFrame(rafId);
    renderer.domElement.removeEventListener("click", onClick);
    window.removeEventListener("resize", onResize);

    particlesGeo.dispose();
    particlesMat.dispose();
    sun.geometry.dispose();
    sun.material.dispose();
    halo.geometry.dispose();
    halo.material.dispose();
    renderer.dispose();
    // remove label DOM
    if (labelRenderer.domElement && labelRenderer.domElement.parentNode)
      labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
  });
});
</script>

<style scoped>
/* basic label styling - CSS2DRenderer will render these elements */
.planet-label {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
</style>
