import mapboxgl, {
    type CustomSourceInterface,
    type SourceSpecification,
} from "mapbox-gl";
import type { IBaseMapService, IMapInitOptions } from "../interfaces/IBaseMapService";

export class BaseMapService implements IBaseMapService {

    protected map!: mapboxgl.Map;

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
                this.map.on("mousemove", (e) => options.onHover!(e));
            }

            if (options.onClick) {
                this.map.on("click", (e) => options.onClick!(e));
            }

            if (options.onMapMoveEnd) {
                this.map.on("moveend", (e) => options.onMapMoveEnd!());
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
        this.map?.remove();
    }
}
