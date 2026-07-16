<template>
  <span class="pcard" :class="[sizeClass, colorClass, { back: isBack }]">
    <template v-if="!isBack">
      <span class="r">{{ rankStr }}</span>
      <span class="s">{{ suitStr }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  card?: { suit: string; rank: number } | null
  face?: boolean
  size?: 'mini' | 'normal' | 'big'
}>()

const isBack = computed(() => !props.card || props.face === false)
const colorClass = computed(() => {
  if (isBack.value) return ''
  return props.card!.suit === 'H' || props.card!.suit === 'D' ? 'red' : ''
})
const sizeClass = computed(() => (props.size && props.size !== 'normal' ? props.size : ''))
const rankStr = computed(() => {
  const r = props.card?.rank
  if (!r) return ''
  const map: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
  return map[r] || String(r)
})
const suitStr = computed(() => {
  const map: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' }
  return map[props.card?.suit as string] || ''
})
</script>
