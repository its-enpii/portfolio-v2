<template>
  <div class="w-screen h-screen">
    <!-- Splash Screen -->
    <transition name="fade-splash">
      <div
        v-if="showSplash"
        class="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-b from-black via-primary to-black overflow-hidden"
        @click="skipAnimation"
      >
        <!-- Animated stars background -->
        <div class="stars-bg"></div>
        <div class="stars-bg-2"></div>

        <div class="relative z-10 text-center px-8">
          <!-- Main text -->
          <div class="relative">
            <h1
              ref="splashText"
              class="text-3xl md:text-4xl lg:text-6xl font-inter font-extralight text-base tracking-wide leading-relaxed opacity-0"
            >
              Di tengah ruang hampa,<br />
              <span class="text-secondary">semesta lahir membawa cerita.</span>
            </h1>

            <!-- Glow effect -->
            <div
              ref="glowEffect"
              class="absolute inset-0 blur-3xl bg-blue-500/20 opacity-0 -z-10"
            ></div>
          </div>

          <!-- Tap to continue -->
          <div
            ref="tapText"
            class="mt-16 text-sm font-inter text-base/40 tracking-widest uppercase opacity-0"
          >
            Tap anywhere to continue
          </div>
        </div>
      </div>
    </transition>

    <!-- Galaxy Component -->
    <GalaxyComponent
      v-if="!showSplash"
      ref="galaxy"
      :list-planets="mainPlanetDefs"
      @planet-clicked="onPlanetClicked"
      @planet-selected="onPlanetSelected"
    />

    <transition name="fade-detail">
      <DetailPlanetComponent
        v-if="activePlanet"
        :planetData="activePlanet"
        :listPlanets="mainPlanetDefs"
        @back="onBack"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, shallowRef, nextTick, onMounted } from "vue";
import { gsap } from "gsap";
import GalaxyComponent from "~/components/GalaxyComponent.vue";
import DetailPlanetComponent from "~/components/DetailPlanetComponent.vue";

const mainPlanetDefs = [
  {
    id: 0,
    name: "About Me",
    icon: "icon-park-outline:turn-around",
    file: "/assets/json/about_me.json",
    component: "AboutMeComponent",
    texture: "/textures/planet/about_me.jpg",
  },
  {
    id: 1,
    name: "Skills",
    icon: "mingcute:mind-map-line",
    file: "/assets/json/skills.json",
    component: "SkillsComponent",
    texture: "/textures/planet/skills.jpg",
  },
  {
    id: 2,
    name: "Projects",
    icon: "material-symbols:post-outline-rounded",
    file: "/assets/json/projects.json",
    component: "ProjectsComponent",
    texture: "/textures/planet/projects.jpg",
  },
  {
    id: 3,
    name: "Contact",
    icon: "teenyicons:contact-outline",
    file: "/assets/json/contact.json",
    component: "ContactComponent",
    texture: "/textures/planet/contact.jpg",
  },
];

const galaxy = ref(null);
const detailPlanet = shallowRef(null);
const activePlanet = shallowRef(null);
const detailContent = ref([]);
const showSplash = ref(true);
const splashText = ref(null);
const glowEffect = ref(null);
const tapText = ref(null);
const canSkip = ref(false);
let glowTimeline = null;
let breathingTimeline = null;

provide("galaxyRef", galaxy);

onMounted(() => {
  animateSplashScreen();
});

function animateSplashScreen() {
  const timeline = gsap.timeline();

  // Fade in text dengan scale
  timeline.fromTo(
    splashText.value,
    {
      opacity: 0,
      scale: 0.95,
      y: 30,
    },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 2,
      ease: "power3.out",
    }
  );

  // Glow effect muncul bersamaan
  timeline.fromTo(
    glowEffect.value,
    { opacity: 0, scale: 0.8 },
    {
      opacity: 1,
      scale: 1.2,
      duration: 2,
      ease: "power2.out",
    },
    "-=2"
  );

  // Show tap to continue after 2.5 seconds
  timeline.to(
    tapText.value,
    {
      opacity: 1,
      duration: 1,
      ease: "power2.out",
      onComplete: () => {
        canSkip.value = true;

        // Start glow pulsing
        glowTimeline = gsap.to(glowEffect.value, {
          scale: 1,
          opacity: 0.6,
          duration: 2,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });

        // Start tap text breathing animation
        breathingTimeline = gsap.to(tapText.value, {
          opacity: 0.2,
          duration: 1.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      },
    },
    "+=0.5"
  );
}

function skipAnimation() {
  if (!canSkip.value) return;

  // Kill infinite animations
  if (glowTimeline) glowTimeline.kill();
  if (breathingTimeline) breathingTimeline.kill();

  gsap.to([splashText.value, tapText.value, glowEffect.value], {
    opacity: 0,
    scale: 1.05,
    duration: 0.8,
    ease: "power2.inOut",
    onComplete: () => {
      showSplash.value = false;
    },
  });
}

async function onPlanetClicked(planetInfo) {
  detailPlanet.value = (
    await import(`~/components/content/${planetInfo.component}.vue`)
  ).default;

  const request = await fetch(planetInfo.file);
  detailContent.value = await request.json();
}

async function onPlanetSelected(planetInfo) {
  await new Promise((r) => setTimeout(r, 200));

  activePlanet.value = mainPlanetDefs.find((p) => p.id === planetInfo.id);
  activePlanet.value.detail_planet = detailPlanet.value;
  activePlanet.value.detail_content = detailContent.value;

  await nextTick();

  const el = document.querySelector(".detail-panel");
  if (el) {
    el.style.opacity = 0;
    el.style.transition = "opacity 1s ease";
    requestAnimationFrame(() => (el.style.opacity = 1));
  }

  galaxy.value?.pauseControls?.();
}

function onBack(planet) {
  galaxy.value.backToGalaxy(planet);
  activePlanet.value = null;
}
</script>

<style scoped>
.fade-detail-enter-active,
.fade-detail-leave-active {
  transition: opacity 0.8s ease;
}
.fade-detail-enter-from,
.fade-detail-leave-to {
  opacity: 0;
}
.fade-detail-enter-to,
.fade-detail-leave-from {
  opacity: 1;
}

.fade-splash-leave-active {
  transition: opacity 1.2s ease;
}
.fade-splash-leave-to {
  opacity: 0;
}

/* Animated stars background */
.stars-bg,
.stars-bg-2 {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.stars-bg {
  background-image: radial-gradient(2px 2px at 20% 30%, white, transparent),
    radial-gradient(2px 2px at 60% 70%, white, transparent),
    radial-gradient(1px 1px at 50% 50%, white, transparent),
    radial-gradient(1px 1px at 80% 10%, white, transparent),
    radial-gradient(2px 2px at 90% 60%, white, transparent),
    radial-gradient(1px 1px at 33% 85%, white, transparent),
    radial-gradient(1px 1px at 15% 70%, white, transparent);
  background-size: 200% 200%;
  background-position: 0% 0%;
  opacity: 0.4;
  animation: stars-drift 40s ease-in-out infinite;
}

.stars-bg-2 {
  background-image: radial-gradient(
      1px 1px at 10% 20%,
      rgba(147, 197, 253, 0.8),
      transparent
    ),
    radial-gradient(1px 1px at 40% 80%, rgba(147, 197, 253, 0.8), transparent),
    radial-gradient(1px 1px at 70% 40%, rgba(147, 197, 253, 0.8), transparent),
    radial-gradient(1px 1px at 85% 75%, rgba(147, 197, 253, 0.8), transparent),
    radial-gradient(1px 1px at 25% 55%, rgba(147, 197, 253, 0.8), transparent);
  background-size: 250% 250%;
  background-position: 0% 0%;
  opacity: 0.3;
  animation: stars-drift 60s ease-in-out infinite reverse;
}

@keyframes stars-drift {
  0%,
  100% {
    background-position: 0% 0%;
    opacity: 0.3;
  }
  50% {
    background-position: 100% 100%;
    opacity: 0.5;
  }
}
</style>
