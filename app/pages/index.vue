<template>
  <div class="w-screen h-screen">
    <GalaxyComponent ref="galaxy" @planet-selected="onPlanetSelected" />
    <DetailPlanetComponent
      v-if="activePlanet !== null"
      :planetData="activePlanet"
      @back="onBack"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import GalaxyComponent from "~/components/GalaxyComponent.vue";
import DetailPlanetComponent from "~/components/DetailPlanetComponent.vue";

const galaxy = ref(null);
const activePlanet = ref(null);

function onPlanetSelected(planetInfo) {
  activePlanet.value = planetInfo;
  galaxy.value?.pauseControls?.();
}

function onBack() {
  if (!galaxy.value || activePlanet.value === null) {
    activePlanet.value = null;
    return;
  }

  galaxy.value.backToGalaxy(activePlanet.value);
  activePlanet.value = null;
}
</script>
