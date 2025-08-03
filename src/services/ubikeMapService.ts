import mapboxgl from 'mapbox-gl'
import { getDirections } from '../api/directions'
import { getUbikeNearby } from '../api/ubike'
import type { IUbikeMapService } from '../interfaces/IUbikeMapService'
import type { IUbikeFeature, IUbikeFeatureCollection } from '../interfaces/IUbike'
import type { FeatureCollection, LineString, Geometry } from 'geojson'
import type { Ref } from 'vue'
import { BaseMapService } from './baseMapService'

/**
 * 建立標準 popup
 * @param label 
 * @returns 
 */
function createPopup(label: string): mapboxgl.Popup {
    return new mapboxgl.Popup({
        offset: 30,
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        focusAfterOpen: false
    }).setText(label)
}

export class UbikeMapService extends BaseMapService implements IUbikeMapService {
    // 所有站點與目前顯示資料
    private ubikeData: IUbikeFeature[] = []
    private allUbike: IUbikeFeatureCollection | null = null

    // 當前標記與 Popup
    private currentMarkers: mapboxgl.Marker[] = []
    private midStationPopup: mapboxgl.Popup | null = null
    private hoverPopup: mapboxgl.Popup | null = null

    // 狀態參考資料
    private selectedUbike: Ref<[number, number] | null>
    private start: [number, number]
    private end: [number, number]
    private selectedUbikeName: Ref<string>
    private selectedUbikeInfo: Ref<{ sbi: number; bemp: number } | null>

    constructor(
        selectedUbike: Ref<[number, number] | null>,
        start: [number, number],
        end: [number, number],
        selectedUbikeName: Ref<string>,
        selectedUbikeInfo: Ref<{ sbi: number; bemp: number } | null>
    ) {
        super()
        this.selectedUbike = selectedUbike
        this.start = start
        this.end = end
        this.selectedUbikeName = selectedUbikeName
        this.selectedUbikeInfo = selectedUbikeInfo
    }

    /**
     * Hover：顯示 popup
     * @param e 
     */
    private handleHover = (e: mapboxgl.MapMouseEvent): void => {
        const map = this.getMapInstance()
        const features = map.queryRenderedFeatures(e.point, { layers: ['ubike-layer'] })
        map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : 'default'

        if (features.length > 0) {
            const raw = features[0] as any
            const coords = raw.geometry.coordinates as [number, number]
            const props = raw.properties as { name: string; sbi: number; bemp: number }
            const content = `${props.name}<br/>🚲 ${props.sbi} 可借 / ${props.bemp} 空位`

            if (!this.hoverPopup) {
                this.hoverPopup = new mapboxgl.Popup({
                    offset: 20,
                    closeButton: false,
                    closeOnClick: false,
                    className: 'hover-popup'
                }).setLngLat(coords).setHTML(content).addTo(map)
            } else {
                this.hoverPopup.setLngLat(coords).setHTML(content)
            }
        } else if (this.hoverPopup) {
            this.hoverPopup.remove()
            this.hoverPopup = null
        }
    }

    /**
     * Click：沒有點中Ubike站點時，恢復預設
     * @param e 
     */
    private handleClick = (e: mapboxgl.MapMouseEvent): void => {
        const raw = e.features?.[0]
            || this.getMapInstance().queryRenderedFeatures(e.point, { layers: ['ubike-layer'] })[0]
        if (!raw || raw.geometry.type !== 'Point') return

        const coords = raw.geometry.coordinates as [number, number]
        const props = raw.properties as { name: string; sbi: number; bemp: number }

        if (coords && props && this.selectedUbike && this.selectedUbikeName && this.selectedUbikeInfo) {
            this.selectedUbike.value = coords
            this.selectedUbikeName.value = props.name
            this.selectedUbikeInfo.value = {
                sbi: props.sbi,
                bemp: props.bemp
            }
            this.updateRoute()
        }

        const features = this.getMapInstance().queryRenderedFeatures(e.point, { layers: ['ubike-layer'] })
        if (!features.length) this.getMapInstance().getCanvas().style.cursor = 'default'
    }


    /**
     * 更新：目前畫面內的 Ubike 站
     */
    private async updateUbikeInView(): Promise<void> {
        const map = this.getMapInstance()
        const center = map.getCenter()
        await this.fetchUbikeData([center.lng, center.lat])

        const bounds = this.map.getBounds()
        const visibleStations: FeatureCollection<Geometry> = {
            type: 'FeatureCollection',
            features: this.ubikeData.filter(({ geometry: { coordinates: [lng, lat] } }) => (
                lat < bounds!.getNorth() && lat > bounds!.getSouth() &&
                lng < bounds!.getEast() && lng > bounds!.getWest()
            ))
        }
        const source = this.map.getSource('ubike') as mapboxgl.GeoJSONSource | undefined
        source?.setData(visibleStations)
    }

    /**
     * 取得目前範圍內 Ubike 資料
     * @param center 
     */
    private async fetchUbikeData(center: [number, number]): Promise<void> {
        this.allUbike = await getUbikeNearby(center)
        this.ubikeData = this.allUbike?.features || []

        if (!this.selectedUbike.value) {
            const nearest = this.findNearestUbike(center, true) || this.findNearestUbike(center, false)
            if (nearest) {
                this.selectedUbike.value = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]]
                this.selectedUbikeName.value = nearest.properties.name
                this.selectedUbikeInfo.value = {
                    sbi: nearest.properties.sbi,
                    bemp: nearest.properties.bemp
                }
            }
        }
    }

    /**
     * 新增單一 marker 並加上 popup
     * @param coords 
     * @param color 
     * @param label 
     * @returns 
     */
    private createMarker(coords: [number, number], color: string, label?: string): mapboxgl.Marker {
        const marker = new mapboxgl.Marker({ color }).setLngLat(coords)
        if (label) {
            const popup = createPopup(label)
            marker.setPopup(popup)
            marker.getElement().addEventListener('click', e => e.stopPropagation())
        }
        return marker.addTo(this.map)
    }

    /**
     * 渲染方向路徑
     * @param routeData 
     * @returns 
     */
    private renderRoute(routeData: FeatureCollection<LineString>): void {
        const routeSource = this.map.getSource('route') as mapboxgl.GeoJSONSource | undefined

        if (routeSource?.setData) {
            routeSource.setData(routeData)
            return
        }

        if (this.map.getLayer('route-line')) this.map.removeLayer('route-line')
        if (this.map.getSource('route')) this.map.removeSource('route')

        this.map.addSource('route', { type: 'geojson', data: routeData })
        this.map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#3b82f6', 'line-width': 6 }
        })
    }

    /**
     * 移除目前所有標記和popup
     */
    private clearMarkers(): void {
        this.currentMarkers.forEach(marker => marker.remove())
        this.currentMarkers = []
        this.midStationPopup?.remove()
        this.midStationPopup = null
    }

    /**
     * 設定：起點、停靠、終點
     * @param param0 
     */
    private async setMarkers({ start, mid, end, destinationName }: {
        start: [number, number]
        mid: [number, number]
        end: [number, number]
        destinationName: string
    }): Promise<void> {
        this.clearMarkers()

        const startMarker = this.createMarker(start, '#f87171', '目前位置')
        const midMarker = this.createMarker(mid, '#ffef02')
        const endMarker = this.createMarker(end, '#0ca5e9', destinationName)

        startMarker.togglePopup()
        endMarker.togglePopup()

        this.currentMarkers.push(startMarker, midMarker, endMarker)

        this.midStationPopup = new mapboxgl.Popup({
            offset: 0,
            closeButton: false,
            closeOnClick: false,
            closeOnMove: false,
            className: 'mid-station-popup',
            focusAfterOpen: false
        })
            .setLngLat(mid)
            .setHTML(`<div style="font-size: 24px;background:#ffef02">🚲</div>`)
            .addTo(this.map)

        const routeData = await getDirections({
            profile: 'mapbox/cycling',
            coordinates: `${start.join(',')};${mid.join(',')};${end.join(',')}`
        }) as FeatureCollection<LineString>

        if (routeData.features.length) {
            this.renderRoute(routeData)
        }
    }

    /**
     * 找出最近的 Ubike 站
     * @param target 
     * @param requireAvailable 
     * @returns 
     */
    private findNearestUbike(target: [number, number], requireAvailable = true): IUbikeFeature | null {
        return this.ubikeData.reduce<{ nearest: IUbikeFeature | null, dist: number }>((acc, station) => {
            if (requireAvailable && station.properties.sbi <= 0) return acc
            const dist = UbikeMapService.haversine(target, [station.geometry.coordinates[0], station.geometry.coordinates[1]])
            return dist < acc.dist ? { nearest: station, dist } : acc
        }, { nearest: null, dist: Infinity }).nearest
    }

    /**
     * 初始化預載指定位置附近站點
     */
    public async init(): Promise<void> {
        await this.fetchUbikeData(this.start)
    }

    /**
     * 重新計算路線
     * @returns 
     */
    public async updateRoute(): Promise<void> {
        try {
            let mid: [number, number]
            let nearest: IUbikeFeature | null = null

            if (this.selectedUbike.value && this.allUbike) {
                mid = this.selectedUbike.value
                nearest = this.allUbike.features.find(
                    s => s.geometry.coordinates[0] === mid[0] && s.geometry.coordinates[1] === mid[1]
                ) || null
            } else {
                nearest = this.findNearestUbike(this.start, true) || this.findNearestUbike(this.start, false)
                if (!nearest) return
                mid = [nearest.geometry.coordinates[0], nearest.geometry.coordinates[1]]
                this.selectedUbikeName.value = nearest.properties.name
                this.selectedUbikeInfo.value = {
                    sbi: nearest.properties.sbi,
                    bemp: nearest.properties.bemp
                }
            }

            await this.setMarkers({
                start: this.start,
                mid,
                end: this.end,
                destinationName: '目的地'
            })
        } catch (err) {
            console.error('🚨 錯誤：', err)
        }
    }

    /**
     * 計算座標距離（公里）AI提供公式 待確認
     * @param param0 
     * @param param1 
     * @returns 
     */
    public static haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
        // 角度轉弧度
        const toRad = (deg: number) => (deg * Math.PI) / 180
        // 地球半徑（公里）
        const R = 6371

        const dLat = toRad(lat2 - lat1)
        const dLng = toRad(lng2 - lng1)

        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c
    }

    /**
     * 載入地圖+初始化圖層事件
     * @param container 
     * @param start 
     * @param options 
     * @returns 
     */
    public async loadMap(
        container: HTMLElement,
        start: [number, number]
    ): Promise<void> {

        const baseOptions = {
            container,
            style: {
                version: 8,
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    }
                },
                layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
            },
            center: start,
            zoom: 14
        }

        const addSourceData = {
            name: 'ubike',
            data: {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] } as FeatureCollection<Geometry>
            }
        }

        const addLayerOptions = {
            id: 'ubike-layer',
            type: 'circle',
            source: 'ubike',
            paint: {
                'circle-radius': 8,
                'circle-color': '#ffef02',
                'circle-opacity': 0.7
            }
        }

        const onLoad = async () => {
            await this.updateUbikeInView()
            await this.updateRoute()
        }

        /** 
         * NOTE: 
         * 這裡的 this 指向 UbikeMapService 實例
         * 這樣可以直接使用 this.getMapInstance() 取得地圖實例
         */
        this.initMap(
            container,
            start,
            {
                baseOptions: baseOptions,
                addSourceData: addSourceData,
                addLayerOptions: addLayerOptions,
                onLoad: onLoad,
                onClick: this.handleClick.bind(this),
                onHover: this.handleHover.bind(this),
                onMapMoveEnd: this.updateUbikeInView.bind(this)
            }
        )
    }

    /**
     * GC
     */
    public destroy(): void {
        this.destroyMap
        this.clearMarkers()
        this.hoverPopup?.remove()
        this.hoverPopup = null
    }
}
