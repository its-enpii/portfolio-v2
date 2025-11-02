<template>
  <div class="absolute inset-0 bg-black z-999 flex items-center justify-center">
    <div
      class="detail-panel w-full h-screen max-h-screen overflow-hidden z-800"
      ref="panelRef"
    >
      <nav class="w-full fixed top-0 left-0 z-900 p-4">
        <div class="container mx-auto">
          <div class="flex justify-center items-center">
            <ul
              ref="navigation"
              class="w-72 flex justify-between items-center p-1 rounded-full bg-base/5 backdrop-blur-sm border border-base/20"
            >
              <template v-for="(planet, index) in menu" :key="index">
                <li
                  v-if="planet.id != 99"
                  class="flex justify-center items-center w-10 h-10 rounded-full group cursor-pointer"
                  :class="{
                    'bg-base/5 border border-base/10 ':
                      content?.id == planet.id,
                  }"
                >
                  <Icon
                    :name="planet.icon"
                    class="text-xl text-base/40 group-hover:text-base/70 transition-all duration-100 ease-in-out"
                    :class="{
                      'text-base!': content?.id == planet.id,
                    }"
                  />
                </li>
                <li
                  v-else
                  class="flex justify-center items-center w-10 h-10 rounded-full scale-120 ring-2 ring-base bg-black/10 hover:bg-black/20 transition-all duration-200 ease-in-out cursor-pointer group"
                  @click="close"
                >
                  <Icon
                    :name="planet.icon"
                    class="text-xl text-base/60 group-hover:text-base transition-all duration-200 ease-in-out"
                  />
                </li>
              </template>
            </ul>
          </div>
        </div>
      </nav>

      <transition name="fade-content" mode="out-in" @enter="onEnter">
        <component
          v-if="content.detail_planet"
          :is="content.detail_planet"
          :key="content.id"
          :content="content.detail_content"
          ref="detailComp"
        />
      </transition>
    </div>
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

const content = shallowRef(props.planetData);
const menu = [...props.listPlanets];
const middleMenu = Math.floor(menu.length / 2);
menu.splice(middleMenu, 0, {
  id: 99,
  name: "Back",
  icon: "mingcute:home-3-line",
});

const navigation = ref(null);
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
  const navEl = navigation.value; // ambil elemen <ul ref="navigation">

  // Jalankan animasi fade-out bersamaan
  if (navEl) {
    gsap.to(navEl, {
      opacity: 0,
      y: 10,
      duration: 0.6,
      ease: "power2.inOut",
    });
  }

  if (compEl) {
    gsap.to(compEl, {
      opacity: 0,
      duration: 0.8,
      ease: "power3.inOut",
    });
  }

  // Tunggu durasi animasi paling lama
  await new Promise((resolve) => setTimeout(resolve, 800));

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
