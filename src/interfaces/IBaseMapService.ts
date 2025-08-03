export interface IMapInitOptions {
    baseOptions?: object
    addLayerOptions?: object
    addSourceData?: { name: string, data: object }
    onLoad?: () => Promise<void> | void
    onMapMoveEnd?: () => Promise<void> | void
    onHover?: (e: mapboxgl.MapMouseEvent) => Promise<void> | void
    onClick?: (e: mapboxgl.MapMouseEvent) => Promise<void> | void
}

export interface IBaseMapService {
    initMap(
        container: HTMLElement,
        centerPosition: [number, number],
        options: IMapInitOptions
    ): void;
    getMapInstance(): mapboxgl.Map;
    destroyMap(): void;
}
