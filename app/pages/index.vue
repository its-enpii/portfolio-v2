<template>
  <div class="w-screen h-screen">
    <GalaxyComponent
      ref="galaxy"
      @planet-clicked="onPlanetClicked"
      @planet-selected="onPlanetSelected"
    />

    <transition name="fade-detail">
      <DetailPlanetComponent
        v-if="activePlanet"
        :planetData="activePlanet"
        @back="onBack"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, shallowRef, nextTick } from "vue";
import GalaxyComponent from "~/components/GalaxyComponent.vue";
import DetailPlanetComponent from "~/components/DetailPlanetComponent.vue";

const galaxy = ref(null);
const detailPlanet = shallowRef(null);
const activePlanet = shallowRef(null);

async function onPlanetClicked(planetInfo) {
  // PRELOAD dulu komponen (tanpa render)
  detailPlanet.value = (
    await import(`~/components/content/${planetInfo.component}.vue`)
  ).default;
}

// ini dipanggil dari focusPlanet() — saat layar udah mulai gelap
async function onPlanetSelected(planetInfo) {
  // delay kecil biar sinkron sama fade opacity planet di GSAP
  await new Promise((r) => setTimeout(r, 200));

  planetInfo.detail_planet = detailPlanet.value;
  activePlanet.value = planetInfo;

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
