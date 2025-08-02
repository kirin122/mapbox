import { UbikeMapService } from '../services/ubikeMapService'
import type { Ref } from 'vue'

export function useUbikeMap(
    selectedUbike: Ref<[number, number] | null>,
    start: [number, number],
    end: [number, number],
    selectedUbikeName: Ref<string>,
    selectedUbikeInfo: Ref<{ sbi: number; bemp: number } | null>
) {
    const controller = new UbikeMapService(
        selectedUbike,
        start,
        end,
        selectedUbikeName,
        selectedUbikeInfo
    )

    return {
        loadMap: controller.loadMap.bind(controller),
        init: controller.init.bind(controller),
        destroy: controller.destroy.bind(controller),
        waitUntilReady: () => controller.init(),
        updateRoute: controller.updateRoute.bind(controller)
    }
}
