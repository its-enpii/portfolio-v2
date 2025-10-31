<script setup>
import { onMounted } from "vue";
import gsap from "gsap";

const props = defineProps({ planetData: Object });
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

const detailPlanet = defineAsyncComponent(() =>
  import(`./content/${props.planetData.component}.vue`)
);
const planetLabel = computed(() => {
  console.log(props.planetData);
  return ["Galaxy Roadmap", "Partners", "Investors", "Social", "Community"][
    props.planetData.id
  ];
});
</script>

<template>
  <div
    class="absolute inset-0 backdrop-blur-[6px] bg-black/60 z-999 flex items-center justify-center"
  >
    <div class="detail-panel w-full h-screen max-h-screen overflow-hidden">
      <component :is="detailPlanet" />
    </div>
  </div>
</template>
