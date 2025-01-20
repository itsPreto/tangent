// TangentLogo.vue
<template>
  <div
    class="w-[180px] h-[36px] relative perspective-[1000px] rounded-lg overflow-hidden"
  >
    <div
      ref="gridRef"
      class="w-full h-full grid relative gap-0"
      :style="{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`
      }"
    >
      <div
        v-for="(_, i) in cells"
        :key="i"
        class="relative transition-transform duration-1000 ease-in-out cell"
        :style="{
          transformStyle: 'preserve-3d',
          border: 'none',
          backgroundColor: 'transparent'
        }"
      >
        <div
          class="absolute w-full h-full overflow-hidden front"
          :style="{
            backfaceVisibility: 'hidden',
            backgroundColor: 'transparent'
          }"
        >
          <div
            class="w-[180px] h-[36px] relative"
            :style="{
              transform: `translate(${-(i % COLS) * (180 / COLS)}px, ${-Math.floor(i / COLS) * (36 / ROWS)}px)`
            }"
          >
            <LogoSVG />
          </div>
        </div>
        <div
          class="absolute w-full h-full overflow-hidden back"
          :style="{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: 'transparent'
          }"
        >
          <div
            class="absolute w-[180px] h-[36px]"
            :style="{
              transform: `translate(${-(i % COLS) * (180 / COLS)}px, ${-Math.floor(i / COLS) * (36 / ROWS)}px)`
            }"
          >
            <div class="font-sans text-[24px] font-bold w-full h-full ps-4 flex items-center justify-center text-foreground">
              TANGENT
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import LogoSVG from './LogoSVG.vue';

const COLS = 15;
const ROWS = 5;
const cells = Array.from({ length: ROWS * COLS });

const isShowingFront = ref(true);
const gridRef = ref<HTMLDivElement | null>(null);

const flipCell = (cell: HTMLElement, delay: number) => {
  setTimeout(() => {
    if (cell) {
      cell.style.transform = isShowingFront.value ? 'rotateY(180deg)' : 'rotateY(0deg)';
    }
  }, delay);
};

const animateFlip = () => {
  if (!gridRef.value) return;
  const cells = Array.from(gridRef.value.querySelectorAll('.cell'));

  // Organize cells into columns
  const columns: HTMLElement[][] = Array.from({ length: COLS }, () => []);
  cells.forEach((cell, index) => {
    const col = index % COLS;
    columns[col].push(cell as HTMLElement);
  });

  const delayBetweenColumns = 50;
  const middle = Math.floor(COLS / 2);
  let columnOrder = [middle];
  
  for (let offset = 1; offset <= middle; offset++) {
    if (middle - offset >= 0) columnOrder.push(middle - offset);
    if (middle + offset < COLS) columnOrder.push(middle + offset);
  }

  if (!isShowingFront.value) {
    columnOrder = columnOrder.reverse();
  }

  columnOrder.forEach((colIndex, index) => {
    setTimeout(() => {
      columns[colIndex].forEach((cell) => {
        flipCell(cell, 0);
      });
    }, index * delayBetweenColumns);
  });

  setTimeout(() => {
    isShowingFront.value = !isShowingFront.value;
  }, columnOrder.length * delayBetweenColumns + 500);
};

let intervalId: number;

onMounted(() => {
  intervalId = window.setInterval(animateFlip, 5000);
});

onBeforeUnmount(() => {
  clearInterval(intervalId);
});
</script>