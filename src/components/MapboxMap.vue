<template>
    <main>
        <div v-if="isLoading" class="loading-overlay">
            <div class="spinner" />
        </div>

        <div v-else class="controls" :class="{ mobile: isMobile }">
            <div>
                <div class="buttons">
                    <button @click="goToStartOrEnd()">回到起點</button>
                    <button @click="goToStartOrEnd(true)">回到終點</button>
                </div>
                <div class="input">
                    <label for="start">起點</label><br />
                    <input id="start" type="text" v-model="startText" placeholder="例如：121.56611, 25.04111" />
                </div>
                <p>
                    <strong>停靠站：</strong>{{ selectedUbikeName }}
                    <br />
                    <span v-if="selectedUbikeInfo">
                        (可借{{ selectedUbikeInfo.sbi }}輛 / 尚有{{ selectedUbikeInfo.bemp }}空位)
                    </span>
                </p>
                <div class="input">
                    <label for="end">終點</label><br />
                    <input id="end" type="text" v-model="endText" placeholder="例如：121.562954, 25.032697" />
                </div>
            </div>
        </div>

        <div ref="mapContainer" class="mapboxgl-map" />
    </main>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick, onMounted, type Ref, computed, watch } from 'vue'
import { useUbikeMap } from '../composables/useUbikeMap'
import { useMediaQuery } from '../composables/useMediaQuery'

const isLoading = ref(true)
const mapContainer = ref<HTMLElement | null>(null)

const start: Ref<[number, number]> = ref([121.56611, 25.04111])
const end: Ref<[number, number]> = ref([121.562954, 25.032697])
const midpoint: [number, number] = [
    (start.value[0] + end.value[0]) / 2,
    (start.value[1] + end.value[1]) / 2
]

const selectedUbike = ref<[number, number] | null>(null)
const selectedUbikeName = ref('搜尋中..')
const selectedUbikeInfo = ref<{ sbi: number; bemp: number } | null>(null)
const isMobile = useMediaQuery('(max-width: 768px)')
const { loadMap, destroy, updateRoute, goToStartOrEnd } = useUbikeMap(selectedUbike, start, end, selectedUbikeName, selectedUbikeInfo)


const startText = computed<string>({
    get() {
        return start.value.join(', ')
    },
    set(newVal: string) {
        const parts = newVal.split(',').map((x) => parseFloat(x.trim()))
        if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
            start.value = [parts[0], parts[1]]
        }
    },
})


const endText = computed<string>({
    get() {
        return end.value.join(', ')
    },
    set(newVal: string) {
        const parts = newVal.split(',').map((x) => parseFloat(x.trim()))
        if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
            end.value = [parts[0], parts[1]]
        }
    },
})

watch(() => start.value, () => {
    updateRoute(start.value)
}, { deep: true })

watch(() => end.value, () => {
    updateRoute(end.value)
}, { deep: true })

onMounted(async () => {
    isLoading.value = true
    await nextTick()
    await loadMap(mapContainer.value!, midpoint)
    isLoading.value = false
})

onBeforeUnmount(() => {
    destroy()
})
</script>

<style lang="css" scoped>
.mapboxgl-map {
    position: relative;
    width: 100%;
    height: 100%;
}

.controls {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    background: white;
    border-radius: 8px 8px 0 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
    padding: 15px;
    width: 100%;
    max-width: 400px;
    font-size: 14px;
}

.controls p,
.controls span {
    margin: 0;
    line-height: 1.7;
    padding: 4px 0;
}

.controls.mobile {
    max-width: 100%;
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 20;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
}

.spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #3b82f6;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>

<style lang="css">
.mapboxgl-popup-content {
    padding: 5px !important;
    box-shadow: none !important;
}

.mid-station-popup .mapboxgl-popup-content {
    background: #ffef02;
}

.mid-station-popup .mapboxgl-popup-tip {
    border-top-color: #ffef02 !important;
}

.buttons {
    display: flex;
    gap: 10px;
    padding-bottom: 15px;
}

.input {
    display: flex;
    gap: 5px;
}
</style>
