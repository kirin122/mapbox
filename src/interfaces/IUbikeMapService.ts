import type { Ref } from 'vue'

export interface IUbikeMapService {
    updateRoute(start: [number, number]): Promise<void>

    loadMap(
        container: HTMLElement,
        start: [number, number],
        options?: {
            selectedUbike?: Ref<[number, number] | null>,
            selectedUbikeName?: Ref<string>,
            selectedUbikeInfo?: Ref<{ sbi: number, bemp: number } | null>
        }
    ): Promise<void>
}