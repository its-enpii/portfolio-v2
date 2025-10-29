<template>
  <div
    class="w-screen h-screen bg-black flex items-center justify-center relative"
  >
    <div ref="container" class="w-full h-full relative">
      <div class="absolute top-4 left-4 z-50 text-white">
        <h1 class="text-xl font-semibold">
          Nuxt Galaxy — click a planet to zoom
        </h1>
      </div>

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

onMounted(async () => {
  await nextTick();

  const THREE = await import("three");
  const examples = await import("three/examples/jsm/controls/OrbitControls");
  const gsapModule = await import("gsap");
  const d3 = await import("d3");

  const gsap = gsapModule.default;
  const OrbitControls = examples.OrbitControls;

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
    MeshBasicMaterial,
    BackSide,
    SpriteMaterial,
    Sprite,
    CanvasTexture,
    LineBasicMaterial,
    Line,
  } = THREE;

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

  const scene = new Scene();
  const camera = new PerspectiveCamera(45, w / h, 0.1, 5000);
  camera.position.set(0, 120, 320);
  const initialCameraPosition = camera.position.clone();

  const renderer = new WebGLRenderer({
    canvas: canvas.value ?? undefined,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.physicallyCorrectLights = true;

  const ambient = new AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 0.8);
  dir.position.set(50, 100, 50);
  scene.add(dir);

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

  const haloGeo = new SphereGeometry(38, 32, 32);
  const haloMat = new MeshStandardMaterial({
    color: 0x2a9dff,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
  });
  const halo = new Mesh(haloGeo, haloMat);
  scene.add(halo);

  const particleCount = 720;
  const radius = 80;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = radius + d3.randomNormal(0, 6)();
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
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

  const mainPlanetDefs = [
    { id: 0, name: "Galaxy Roadmap", hue: 200 },
    { id: 1, name: "Partners", hue: 160 },
    { id: 2, name: "Investors", hue: 30 },
    { id: 3, name: "Social", hue: 280 },
  ];

  const clickablePlanets = [];

  // Fungsi untuk membuat texture label dari canvas
  function createLabelTexture(text) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set font dulu untuk mengukur text
    const fontSize = 48;
    ctx.font = `bold ${fontSize}px Orbitron, sans-serif`;

    // Ukur lebar text
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Padding
    const paddingX = 40;
    const paddingY = 25;

    // Set ukuran canvas berdasarkan text + padding
    const borderRadius = 50;
    canvas.width = textWidth + paddingX * 2;
    canvas.height = fontSize + paddingY * 2;

    // Set font lagi setelah canvas resize (canvas resize akan reset context)
    ctx.font = `bold ${fontSize}px Orbitron, sans-serif`;

    // Background pill
    ctx.fillStyle = "rgba(10, 20, 28, 0.85)";
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, borderRadius);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, borderRadius);
    ctx.stroke();

    // Text
    ctx.fillStyle = "#f0f8ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(100, 200, 255, 0.5)";
    ctx.shadowBlur = 15;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);

    // Return texture dan aspect ratio untuk scaling sprite
    return {
      texture,
      aspectRatio: canvas.width / canvas.height,
    };
  }

  function createPlanet(rDistance, theta, phi, def) {
    const planetGeo = new SphereGeometry(2.8, 24, 24);
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

    planet.userData = {
      basePos: planet.position.clone(),
      name: def.name,
      id: def.id,
    };
    scene.add(planet);

    // White outline ring
    const outlineGeo = new SphereGeometry(2.3, 32, 32);
    const outlineMat = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: BackSide,
    });
    const outline = new Mesh(outlineGeo, outlineMat);
    planet.add(outline);

    const glowMat = new MeshBasicMaterial({
      color: new Color(0x66e6ff),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new Mesh(planetGeo.clone(), glowMat);
    glowMesh.scale.multiplyScalar(1.6);
    glowMesh.renderOrder = 999;
    planet.add(glowMesh);

    planet.userData.glowMat = glowMat;
    planet.userData.glowMesh = glowMesh;

    // Buat label sprite
    const labelData = createLabelTexture(`Galaxy "${def.name}"`);
    const labelMat = new SpriteMaterial({
      map: labelData.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const labelSprite = new Sprite(labelMat);

    // Scale berdasarkan aspect ratio, tinggi tetap 5
    const spriteHeight = 10;
    labelSprite.scale.set(
      spriteHeight * labelData.aspectRatio,
      spriteHeight,
      1
    );
    labelSprite.position.set(0, 10, 0);
    planet.add(labelSprite);
    planet.userData.labelSprite = labelSprite;

    clickablePlanets.push(planet);
  }

  mainPlanetDefs.forEach((def, idx) => {
    const t = (idx / mainPlanetDefs.length) * Math.PI * 2 + Math.random() * 0.6;
    const p = Math.random() * Math.PI;
    const rDist = radius - 6 + (Math.random() * 12 - 6);
    createPlanet(rDist, t, p, def);
  });

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.dampingFactor = 0.07;
  controls.minDistance = 40;
  controls.maxDistance = 1200;

  let rafId;
  const clock = new THREE.Clock();
  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    particles.rotation.y = t * 0.02;

    clickablePlanets.forEach((pl, i) => {
      const base = pl.userData.basePos;
      pl.position.x = base.x + Math.sin(t * 0.4 + i) * 0.3;
      pl.position.y = base.y + Math.cos(t * 0.35 + i * 1.1) * 0.25;
      pl.position.z = base.z + Math.cos(t * 0.25 + i * 0.6) * 0.3;

      // Label sprite otomatis ikut karena child dari planet
      // Tapi kita perlu update connector line endpoint
      if (pl.userData.connectorLine) {
        const positions =
          pl.userData.connectorLine.geometry.attributes.position;
        positions.array[3] = 0;
        positions.array[4] = 6;
        positions.array[5] = 0;
        positions.needsUpdate = true;
      }
    });

    sun.scale.setScalar(1 + Math.sin(t * 2.0) * 0.03);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const { w: nw, h: nh } = getSize();
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  }
  window.addEventListener("resize", onResize);

  function onClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(clickablePlanets, true);
    if (intersects.length) {
      let target = intersects[0].object;
      while (target && (!target.userData || target.userData.id === undefined))
        target = target.parent;
      if (target) focusPlanet(target);
    }
  }
  renderer.domElement.addEventListener("click", onClick);

  function focusPlanet(planet) {
    const planetCenter = planet.position.clone();
    const insideOffset = -2;
    const endPos = planetCenter
      .clone()
      .add(planetCenter.clone().normalize().multiplyScalar(insideOffset));
    controls.enabled = false;

    try {
      const glowMat = planet.userData.glowMat;
      const glowMesh = planet.userData.glowMesh;
      if (glowMat) {
        gsap.killTweensOf(glowMat);
        if (glowMesh) gsap.killTweensOf(glowMesh.scale);
        const tl = gsap.timeline();
        tl.to(glowMat, { opacity: 1.0, duration: 0.08, ease: "power2.out" }, 0);
        if (glowMesh) {
          tl.fromTo(
            glowMesh.scale,
            { x: 1.2, y: 1.2, z: 1.2 },
            { x: 2.6, y: 2.6, z: 2.6, duration: 0.14, ease: "power2.out" },
            0
          );
          tl.to(
            glowMesh.scale,
            { x: 1.6, y: 1.6, z: 1.6, duration: 0.9, ease: "power2.inOut" },
            "+=0.02"
          );
        }
        tl.to(
          glowMat,
          { opacity: 0.0, duration: 0.9, ease: "power2.inOut" },
          "+=0.06"
        );
      }
    } catch (e) {}

    const startDist = camera.position.distanceTo(planetCenter);
    const endDist = endPos.distanceTo(planetCenter);
    let detailShown = false;
    const ct = gsap.timeline({
      onUpdate: () => {
        camera.lookAt(planetCenter);
        const currentDist = camera.position.distanceTo(planetCenter);
        const progress = 1 - (currentDist - endDist) / (startDist - endDist);
        if (!detailShown && progress > 0.99) {
          detailShown = true;
          emit("planet-selected", planet.userData.id);
        }
      },
    });

    ct.to(camera.position, {
      x: endPos.x,
      y: endPos.y,
      z: endPos.z,
      duration: 3.0,
      ease: "power2.inOut",
    });
    ct.to(
      planet.material,
      { opacity: 0.12, duration: 2.2, ease: "power1.inOut" },
      "<"
    );
  }

  pauseControls = () => {
    if (controls) controls.enabled = false;
  };
  resumeControls = () => {
    if (controls) controls.enabled = true;
  };
  backToGalaxy = (planetOrId) => {
    const planet =
      typeof planetOrId === "object"
        ? planetOrId
        : clickablePlanets.find((p) => p.userData.id === planetOrId);
    const planetCenter = planet
      ? planet.userData.basePos.clone()
      : new Vector3(0, 0, 0);
    const exitPos = initialCameraPosition.clone();
    const tl = gsap.timeline({
      onUpdate: () => camera.lookAt(planetCenter),
      onComplete: () => {
        if (planet) planet.material.opacity = 1;
        if (planet && planet.userData && planet.userData.glowMat) {
          planet.userData.glowMat.opacity = 0;
          if (planet.userData.glowMesh)
            planet.userData.glowMesh.scale.set(1.6, 1.6, 1.6);
        }
        resumeControls();
        emit("planet-exit");
      },
    });
    tl.to(camera.position, {
      x: exitPos.x,
      y: exitPos.y,
      z: exitPos.z,
      duration: 2.2,
      ease: "power2.inOut",
    });
    tl.to(
      planet ? planet.material : {},
      { opacity: 1, duration: 1.6, ease: "power1.inOut" },
      "<"
    );
  };
  getPlanetById = (id) =>
    clickablePlanets.find((p) => p.userData.id === id) || null;

  onBeforeUnmount(() => {
    cancelAnimationFrame(rafId);
    renderer.domElement.removeEventListener("click", onClick);
    window.removeEventListener("resize", onResize);
    try {
      particlesGeo.dispose();
      particlesMat.dispose();
      sun.geometry.dispose();
      sun.material.dispose();
      halo.geometry.dispose();
      halo.material.dispose();
      renderer.dispose();
    } catch (e) {}
  });
});
</script>

<style>
/* Tidak perlu style CSS untuk label lagi karena semuanya di canvas */
</style>
