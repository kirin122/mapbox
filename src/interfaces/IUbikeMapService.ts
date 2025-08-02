import type { Ref } from 'vue'
import type { IUbikeFeature } from './IUbike'

export interface IUbikeMapService {
    updateUbikeInView(): void

    findNearestUbike(
        target: [number, number],
        requireAvailable?: boolean
    ): IUbikeFeature | null

    updateRoute(): Promise<void>

    loadMap(
        container: HTMLElement,
        start: [number, number],
        onMapReady: () => Promise<void>,
        options?: {
            mapReady?: { value: boolean },
            isLoading?: { value: boolean },
            selectedUbike?: Ref<[number, number] | null>,
            selectedUbikeName?: Ref<string>,
            selectedUbikeInfo?: Ref<{ sbi: number, bemp: number } | null>
        }
    ): Promise<void>
}