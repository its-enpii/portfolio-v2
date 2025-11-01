<template>
  <div class="absolute inset-0 bg-black z-999 flex items-center justify-center">
    <div
      class="detail-panel w-full h-screen max-h-screen overflow-hidden"
      ref="panelRef"
    >
      <transition name="fade-content" mode="out-in" @enter="onEnter">
        <component
          v-if="planetData.detail_planet"
          :is="planetData.detail_planet"
          :key="planetData.detail_planet"
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

const props = defineProps({ planetData: Object });
const emit = defineEmits(["back"]);

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
