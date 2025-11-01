<template>
  <div class="absolute inset-0 bg-black z-999 flex items-center justify-center">
    <nav class="w-full fixed top-0 left-0 z-900 p-4">
      <div class="container mx-auto">
        <div class="flex justify-center items-center">
          <ul
            class="w-72 flex justify-between items-center p-1 rounded-full bg-base/5 backdrop-blur-sm border border-base/20"
          >
            <template v-for="(planet, index) in menu" :key="index">
              <li
                v-if="planet.id != 99"
                class="flex justify-center items-center w-10 h-10 rounded-full group cursor-pointer"
                :class="{
                  'bg-base/5 border border-base/10 ':
                    planetData?.id == planet.id,
                }"
              >
                <Icon
                  :name="planet.icon"
                  class="text-xl text-base/40 group-hover:text-base/70 transition-all duration-100 ease-in-out"
                  :class="{
                    'text-base!': planetData?.id == planet.id,
                  }"
                />
              </li>
              <li
                v-else
                class="flex justify-center items-center w-10 h-10 rounded-full bg-linear-to-br from-black/20 to-base/5 cursor-pointer group"
              >
                <Icon
                  :name="planet.icon"
                  class="text-xl text-base opacity-40 group-hover:opacity-100 transition-all duration-200 ease-in-out"
                />
              </li>
            </template>
          </ul>
        </div>
      </div>
    </nav>

    <div
      class="detail-panel w-full h-screen max-h-screen overflow-hidden z-800"
      ref="panelRef"
    >
      <transition name="fade-content" mode="out-in" @enter="onEnter">
        <component
          v-if="planetData.detail_planet"
          :is="planetData.detail_planet"
          :key="planetData.id"
          :content="planetData.detail_content"
          ref="detailComp"
        />
      </transition>
    </div>

    <button
      class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/10 text-white border border-white/20 px-6 py-2 rounded-xl backdrop-blur-md hover:bg-white/20 transition-all duration-300"
      @click="close"
      :disabled="isClosing"
    >
      ← Back
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import gsap from "gsap";

const props = defineProps({
  planetData: Object,
  listPlanets: Array,
});
const emit = defineEmits(["back"]);

const menu = [...props.listPlanets];
menu.unshift({
  id: 99,
  name: "Back",
  icon: "mingcute:home-3-line",
});

const detailComp = ref(null);
const panelRef = ref(null);
const isClosing = ref(false);

// --- Masuk: fade-in dari bawah
function onEnter(el, done) {
  gsap.fromTo(
    el,
    { opacity: 0, y: 20, scale: 0.95 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      ease: "power2.out",
      onComplete: done,
    }
  );
}

// --- Keluar: zoom-out halus sambil fade-out
async function close() {
  if (isClosing.value) return;
  isClosing.value = true;

  await nextTick();

  const compEl = detailComp.value?.$el || detailComp.value;
  const panelEl = panelRef.value;

  // zoom-out lembut + fade-out
  if (compEl) {
    await new Promise((resolve) => {
      gsap.to(compEl, {
        opacity: 0,
        duration: 0.8, // lebih lambat & elegan
        ease: "power3.inOut",
        onComplete: resolve,
      });
    });
  }

  // hilangkan komponen
  props.planetData.detail_planet = null;
  isClosing.value = false;

  emit("back");
}
</script>

<style scoped>
.fade-content-enter-active,
.fade-content-leave-active {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
