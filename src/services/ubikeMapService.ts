import mapboxgl from "mapbox-gl";
import type { Ref } from "vue";
import { getDirections } from "../api/directions";
import { getAllUbike, getUbikeNearby } from "../api/ubike";
import { BaseMapService } from "./baseMapService";
import { getDistanceInMeters } from "../utils/geo";
import type { IUbikeMapService } from "../interfaces/IUbikeMapService";
import type {
    IUbikeFeature,
    IUbikeFeatureCollection,
} from "../interfaces/IUbike";
import type { FeatureCollection, LineString, Geometry } from "geojson";

/**
 * 建立標準 popup
 * @param label
 * @returns
 */
function createPopup({
    text,
    html,
    offset = 30,
    coords,
    className = "default-popup",
}: {
    text?: string;
    html?: string;
    offset?: number;
    coords?: [number, number];
    className?: string;
}): mapboxgl.Popup {
    const popup = new mapboxgl.Popup({
        className: className,
        offset: offset,
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        focusAfterOpen: false,
    });

    if (html) {
        popup.setHTML(html);
    } else if (text) {
        popup.setText(text);
    }

    if (coords) {
        popup.setLngLat(coords);
    }

    return popup;
}

export class UbikeMapService
    extends BaseMapService
    implements IUbikeMapService {
    // 所有站點與目前顯示資料
    private allUbikeData: IUbikeFeatureCollection | null = null;
    private ubikeData: IUbikeFeature[] = [];

    // 當前標記與 Popup
    private currentMarkers: mapboxgl.Marker[] = [];
    private midStationPopup: mapboxgl.Popup | null = null;
    private hoverPopup: mapboxgl.Popup | null = null;

    // 狀態參考資料
    private selectedUbike: Ref<[number, number] | null>;
    private start: [number, number];
    private end: [number, number];
    private selectedUbikeName: Ref<string>;
    private selectedUbikeInfo: Ref<{ sbi: number; bemp: number } | null>;

    constructor(
        selectedUbike: Ref<[number, number] | null>,
        start: [number, number],
        end: [number, number],
        selectedUbikeName: Ref<string>,
        selectedUbikeInfo: Ref<{ sbi: number; bemp: number } | null>
    ) {
        super();
        this.selectedUbike = selectedUbike;
        this.start = start;
        this.end = end;
        this.selectedUbikeName = selectedUbikeName;
        this.selectedUbikeInfo = selectedUbikeInfo;
    }

    private ubikeFeatureMap: Map<string, IUbikeFeature> = new Map();

    /**
     * Hover：顯示 popup
     * @param e
     */
    private handleHover = (e: mapboxgl.MapMouseEvent) => {
        const map = this.getMapInstance();
        const features = map.queryRenderedFeatures(e.point, {
            layers: ["ubike-layer"],
        });

        // 切換 cursor
        map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "default";

        // 沒有站點
        if (features.length === 0) {
            if (this.hoverPopup) {
                this.hoverPopup.remove();
                this.hoverPopup = null;
            }
            return;
        }

        const feature = features[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const [lng, lat] = feature.geometry.coordinates as [number, number];
        const { sbi, bemp } = feature.properties as {
            sbi: number;
            bemp: number;
        };

        const htmlContent = `可借：${sbi}<br/>空位：${bemp}`.trim();

        // 更新或建立 popup
        if (!this.hoverPopup) {
            this.hoverPopup = createPopup({
                offset: 20,
                coords: [lng, lat],
                html: htmlContent,
                className: "hover-popup",
            });
            this.hoverPopup.addTo(map);
        } else {
            this.hoverPopup.setLngLat([lng, lat]).setHTML(htmlContent);
        }
    };

    /**
     * Click：沒有點中Ubike站點恢復預設，點中更新路線
     * @param e
     */
    private handleClick = (e: mapboxgl.MapMouseEvent) => {
        const map = this.getMapInstance();
        const clickedFeature =
            e.features?.[0] ??
            map.queryRenderedFeatures(e.point, { layers: ["ubike-layer"] })[0];

        // 不能點
        if (!clickedFeature || clickedFeature.geometry.type !== "Point") {
            map.getCanvas().style.cursor = "default";
            return;
        }

        // 能點
        const [lng, lat] = clickedFeature.geometry.coordinates as [number, number];
        const { name, sbi, bemp } = clickedFeature.properties as {
            name: string;
            sbi: number;
            bemp: number;
        };

        this.selectedUbike.value = [lng, lat];
        this.selectedUbikeName.value = name;
        this.selectedUbikeInfo.value = { sbi, bemp };
        this.updateRoute(true);
    };

    /**
     * 更新：目前畫面內的 Ubike 站
     */
    private async updateUbikeInView() {
        try {
            const map = this.getMapInstance();
            const center = map.getCenter();
            const bounds = map.getBounds()!;

            // 1km 內
            const nearby = await getUbikeNearby(
                [center.lng, center.lat],
                1000,
                this.allUbikeData!
            );
            this.ubikeData = nearby.features;

            // 過濾
            const visibleStations: FeatureCollection<Geometry> = {
                type: "FeatureCollection",
                features: this.ubikeData.filter(
                    ({
                        geometry: {
                            coordinates: [lng, lat],
                        },
                    }) => {
                        const inLatRange =
                            lat >= bounds.getSouth() && lat <= bounds.getNorth();
                        const inLngRange =
                            lng >= bounds.getWest() && lng <= bounds.getEast();
                        return inLatRange && inLngRange;
                    }
                ),
            };

            // 更新
            const ubikeSource = map.getSource("ubike") as
                | mapboxgl.GeoJSONSource
                | undefined;
            ubikeSource?.setData(visibleStations);
        } catch (err) {
            this.handleError(err);
        }
    }

    /**
     * 新增單一 marker 並加上 popup
     * @param coords
     * @param color
     * @param label
     * @returns
     */
    private createMarker(
        coords: [number, number],
        color: string,
        label?: string
    ): mapboxgl.Marker {
        const map = this.getMapInstance();
        const marker = new mapboxgl.Marker({ color }).setLngLat(coords);
        if (label) {
            const popup = createPopup({ text: label });
            marker.setPopup(popup);
        }
        return marker.addTo(map);
    }

    /**
     * 渲染路徑
     * @param routeData
     */
    private renderRoute(routeData: FeatureCollection<LineString>) {
        const map = this.getMapInstance();
        const addLayerOptions = {
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#3b82f6", "line-width": 6 },
        };
        const addSourceData = {
            name: "route",
            data: { type: "geojson", data: routeData },
        };

        // 清除舊的路徑
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getSource("route")) map.removeSource("route");

        map.addSource(
            addSourceData.name,
            addSourceData.data as mapboxgl.GeoJSONSourceSpecification
        );
        map.addLayer(addLayerOptions as mapboxgl.LineLayer);
    }

    /**
     * 移除目前所有標記和popup
     */
    private clearMarkers(onlyUbike?: boolean) {
        if (onlyUbike) {
            this.midStationPopup?.remove();
            this.midStationPopup = null;
            const oldMid = this.currentMarkers[1];
            if (oldMid) oldMid.remove();
            return;
        }

        this.currentMarkers.forEach((marker) => marker.remove());
        this.currentMarkers = [];
        this.midStationPopup?.remove();
        this.midStationPopup = null;
    }

    /**
     * 設定：起點、中途、終點
     * @param start
     * @param mid
     * @param end
     * @param destinationName
     * @param changeUbike
     */
    private async setMarkers({
        start,
        mid,
        end,
        destinationName,
        onlyChangeUbike = false,
    }: {
        start: [number, number];
        mid: [number, number];
        end: [number, number];
        destinationName: string;
        onlyChangeUbike?: boolean;
    }) {
        try {
            const map = this.getMapInstance();
            const midMarker = this.createMarker(mid, "#ffef02");

            // 只改變中途
            if (onlyChangeUbike) {
                this.clearMarkers(true);
                this.currentMarkers[1] = midMarker;
            } else {
                this.clearMarkers();
                const startMarker = this.createMarker(start, "#f87171", "目前位置");
                const endMarker = this.createMarker(end, "#0ca5e9", destinationName);
                startMarker.togglePopup();
                endMarker.togglePopup();
                this.currentMarkers.push(startMarker, midMarker, endMarker);
            }

            this.midStationPopup = createPopup({
                offset: 0,
                className: "mid-station-popup",
                html: `<div style="font-size: 24px;background:#ffef02">🚲</div>`,
                coords: mid,
            });
            this.midStationPopup.addTo(map);

            // 重新計算路線
            const routeData = await getDirections({
                profile: "mapbox/cycling",
                coordinates: `${start.join(",")};${mid.join(",")};${end.join(",")}`,
            });

            if (routeData.features.length) {
                this.renderRoute(routeData);
            }
        } catch (err) {
            this.handleError(err);
        }
    }

    /**
     * 找出最近的 Ubike 站
     * @param target
     */
    private findNearestUbike(target: [number, number]): IUbikeFeature | null {
        let nearestStation: IUbikeFeature | null = null;
        let shortestDistance = Infinity;

        for (const station of this.ubikeData) {
            const { sbi } = station.properties;
            const [lng, lat] = station.geometry.coordinates;

            // 沒車跳過
            if (sbi <= 0) continue;

            const distance = getDistanceInMeters(target, [lng, lat]);
            if (distance < shortestDistance) {
                nearestStation = station;
                shortestDistance = distance;
            }
        }

        return nearestStation;
    }

    /**
     * 取得Ubike 資料
     */
    private async getUbikeData() {
        try {
            this.allUbikeData = await getAllUbike();
            this.ubikeData = this.allUbikeData?.features || [];
        } catch (err) {
            this.handleError(err);
        }
    }

    /**
     * 處理錯誤
     * @param err
     */
    private handleError(err: unknown) {
        alert(`錯誤: ${err}`);
    }

    /**
     * 重新計算路線
     */
    public async updateRoute(onlyChangeUbike?: boolean) {
        try {
            let mid: [number, number];
            let nearest: IUbikeFeature | null = null;

            if (onlyChangeUbike) {
                mid = this.selectedUbike.value!;
                nearest =
                    this.allUbikeData!.features.find(
                        (s) =>
                            s.geometry.coordinates[0] === mid[0] &&
                            s.geometry.coordinates[1] === mid[1]
                    ) || null;
            } else {
                nearest = this.findNearestUbike(this.start);
                if (!nearest) return;
                mid = [
                    nearest.geometry.coordinates[0],
                    nearest.geometry.coordinates[1],
                ];
                this.selectedUbikeName.value = nearest.properties.name;
                this.selectedUbikeInfo.value = {
                    sbi: nearest.properties.sbi,
                    bemp: nearest.properties.bemp,
                };
            }

            await this.setMarkers({
                start: this.start,
                mid,
                end: this.end,
                destinationName: "目的地",
                onlyChangeUbike,
            });
        } catch (err) {
            this.handleError(err);
        }
    }

    /**
     * 載入地圖
     * @param container
     * @param start
     * @param options
     */
    public async loadMap(container: HTMLElement, center: [number, number]) {
        // 地圖圖層 (使用 OpenStreetMap CDN)
        const baseOptions = {
            container,
            style: {
                version: 8,
                glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
                sources: {
                    osm: {
                        type: "raster",
                        tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
                        tileSize: 256,
                        attribution: "© OpenStreetMap contributors",
                    },
                },
                layers: [{ id: "osm", type: "raster", source: "osm" }],
            },
            center: center,
            zoom: 14,
        };

        // Ubike 資料來源
        const addSourceData = {
            name: "ubike",
            data: {
                type: "geojson",
                data: {
                    type: "FeatureCollection",
                    features: [],
                } as FeatureCollection<Geometry>,
            },
        };

        // Ubike 圖層 (不使用透明度，避免GPU多次運算)
        const addLayerOptions = {
            id: "ubike-layer",
            type: "circle",
            source: "ubike",
            paint: {
                "circle-radius": 7,
                "circle-color": "#ffef02",
            },
        };

        // 地圖載入完成後的處理
        const onLoad = async () => {
            await this.getUbikeData();
            await this.updateUbikeInView();
            await this.updateRoute();
        };

        /**
         * 初始化地圖
         * NOTE:
         * 這裡的 this 指向 UbikeMapService 實例
         * 這樣可以直接使用 this.getMapInstance() 取得地圖實例
         */
        this.initMap(container, center, {
            baseOptions: baseOptions,
            addSourceData: addSourceData,
            addLayerOptions: addLayerOptions,
            onLoad: onLoad,
            onClick: this.handleClick.bind(this),
            onHover: this.handleHover.bind(this),
            onMapMoveEnd: this.updateUbikeInView.bind(this),
        });
    }

    /**
     * GC
     */
    public destroy(): void {
        this.destroyMap();
        this.clearMarkers();
        this.hoverPopup?.remove();
        this.hoverPopup = null;
    }
}
