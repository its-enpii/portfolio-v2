<template>
  <div class="w-screen h-screen">
    <GalaxyComponent
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
import { ref, shallowRef, nextTick } from "vue";
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

async function onPlanetClicked(planetInfo) {
  // PRELOAD dulu komponen (tanpa render)
  detailPlanet.value = (
    await import(`~/components/content/${planetInfo.component}.vue`)
  ).default;

  const request = await fetch(planetInfo.file);
  detailContent.value = await request.json();
}

// ini dipanggil dari focusPlanet() — saat layar udah mulai gelap
async function onPlanetSelected(planetInfo) {
  // delay kecil biar sinkron dengan fade opacity planet
  await new Promise((r) => setTimeout(r, 200));

  // buat object baru, jangan ubah prop reactive
  activePlanet.value = mainPlanetDefs.find((p) => p.id === planetInfo.id);
  activePlanet.value.detail_planet = detailPlanet.value;
  activePlanet.value.detail_content = detailContent.value;

  // tunggu DOM muncul dulu sebelum transisi opacity isi detail
  await nextTick();

  const el = document.querySelector(".detail-panel");
  if (el) {
    el.style.opacity = 0;
    el.style.transition = "opacity 1s ease";
    requestAnimationFrame(() => (el.style.opacity = 1));
  }

  galaxy.value?.pauseControls?.();
}

function onBack() {
  galaxy.value.backToGalaxy(activePlanet.value);
  activePlanet.value = null;
}
</script>

<style>
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
</style>
