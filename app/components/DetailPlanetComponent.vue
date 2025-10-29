<script setup>
import { onMounted } from "vue";
import gsap from "gsap";

const props = defineProps({ planet: Number });
const emit = defineEmits(["back"]);

onMounted(() => {
  gsap.fromTo(
    ".detail-panel",
    { opacity: 0, scale: 0.1, y: 200 },
    { opacity: 1, scale: 1, y: 0, duration: 0.9, ease: "power3.out" }
  );
});

function close() {
  gsap.to(".detail-panel", {
    opacity: 0,
    scale: 0.1,
    y: 200,
    duration: 0.7,
    ease: "power3.in",
    onComplete: () => emit("back"),
  });
}

const planetLabel = computed(() => {
  return ["Galaxy Roadmap", "Partners", "Investors", "Social", "Community"][
    props.planet
  ];
});
</script>

<template>
  <div
    class="absolute inset-0 backdrop-blur-[6px] bg-black/60 z-999 flex items-center justify-center"
  >
    <div
      class="detail-panel w-[460px] text-center text-white p-6 rounded-xl bg-black/40 border border-white/10"
    >
      <h1 class="text-3xl font-bold mb-3">{{ planetLabel }}</h1>
      <p class="mb-6 opacity-80">
        Roadmap detail untuk planet {{ planetLabel }}
      </p>
      <button
        @click="close"
        class="mt-4 px-6 py-2 bg-white/10 border border-white/20 rounded-lg"
      >
        Back
      </button>
    </div>
  </div>
</template>
