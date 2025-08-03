import mapboxgl, {
    type CustomSourceInterface,
    type SourceSpecification,
} from "mapbox-gl";
import type { IBaseMapService, IMapInitOptions } from "../interfaces/IBaseMapService";

export class BaseMapService implements IBaseMapService {

    protected map!: mapboxgl.Map;

    // 移除綁定事件用
    private eventListeners: { type: string; handler: (...args: any[]) => void }[] = []

    /**
     * 默認的地圖初始化選項
     * @param container 
     * @param center 
     * @returns 
     */
    private getDefaultBaseOptions(
        container: HTMLElement,
        center: [number, number]
    ): mapboxgl.MapboxOptions {
        return {
            container,
            style: "mapbox://styles/mapbox/streets-v11",
            center,
            zoom: 14,
        };
    }

    /**
     * 初始化地圖
     * @param container 
     * @param centerPosition 
     * @param options 
     */
    public initMap(
        container: HTMLElement,
        centerPosition: [number, number],
        options: IMapInitOptions
    ): void {
        mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

        const mapOptions = {
            ...this.getDefaultBaseOptions(container, centerPosition),
            ...options.baseOptions,
        };

        this.map = new mapboxgl.Map(mapOptions);

        this.map.addControl(new mapboxgl.NavigationControl());

        this.map.on("load", async () => {
            if (options.addSourceData) {
                this.map.addSource(
                    options.addSourceData.name,
                    options.addSourceData.data as
                    | SourceSpecification
                    | CustomSourceInterface<unknown>
                );
            }

            if (options.addLayerOptions) {
                this.map.addLayer(
                    options.addLayerOptions as mapboxgl.LayerSpecification
                );
            }

            if (options.onHover) {
                const handler = (e: mapboxgl.MapMouseEvent) => options.onHover!(e);
                this.map.on("mousemove", (e) => options.onHover!(e));
                this.eventListeners.push({ type: "mousemove", handler });

            }

            if (options.onClick) {
                const handler = (e: mapboxgl.MapMouseEvent) => options.onClick!(e);
                this.map.on("click", (e) => options.onClick!(e));
                this.eventListeners.push({ type: "click", handler });

            }

            if (options.onMapMoveEnd) {
                const handler = () => options.onMapMoveEnd!();
                this.map.on("moveend", () => options.onMapMoveEnd!());
                this.eventListeners.push({ type: "moveend", handler });

            }

            if (options.onLoad) {
                await options.onLoad();
            }
        });
    }

    /**
     * 取得地圖實例
     * @returns 
     */
    public getMapInstance(): mapboxgl.Map {
        return this.map;
    }

    /**
     * 銷毀地圖實例
     */
    public destroyMap(): void {
        if (!this.map) return;

        // 移除所有綁定事件
        for (const { type, handler } of this.eventListeners) {
            this.map.off(type as any, handler);
        }
        this.eventListeners = [];
        this.map.remove();
    }
}
