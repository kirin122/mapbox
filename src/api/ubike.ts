import axios from 'axios'
import type { IUbikeFeature, IUbikeFeatureCollection, IUbikeRaw } from '../interfaces/IUbike'

const UBIKE_API_URL =
    'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json'


/**
 * 取得全部 Ubike 資料
 */
async function getAllUbike(): Promise<IUbikeFeatureCollection> {
    try {
        const { data } = await axios.get<IUbikeRaw[]>(UBIKE_API_URL)
        const features: IUbikeFeature[] = data.map(transformIUbikeRawToFeature)

        const result: IUbikeFeatureCollection = {
            type: 'FeatureCollection',
            features
        }

        return result
    } catch (error) {
        console.error('Failed to fetch Ubike data:', error)
        return emptyIUbikeFeatureCollection()
    }
}

/**
 * 取得指定範圍內的 Ubike 站點
 * @param center 中心點座標 [lng, lat]
 * @param radius 半徑（公尺）
 */
export async function getUbikeNearby(
    center: [number, number],
    radius = 1000
): Promise<IUbikeFeatureCollection> {
    const all = await getAllUbike()

    const nearby = all.features.filter(f => {
        const d = getDistanceInMeters(center, [
            f.geometry.coordinates[0],
            f.geometry.coordinates[1]
        ])
        return d <= radius
    })

    return {
        type: 'FeatureCollection',
        features: nearby
    }
}

/**
 * 將原始資料轉換為 GeoJSON Feature
 * @param item 
 * @returns 
 */
function transformIUbikeRawToFeature(item: IUbikeRaw): IUbikeFeature {
    return {
        type: 'Feature',
        properties: {
            name: item.sna,
            sbi: item.available_rent_bikes ?? item.sbi ?? 0,
            bemp: item.available_return_bikes ?? item.bemp ?? 0,
            tot: item.Quantity ?? item.tot ?? 0
        },
        geometry: {
            type: 'Point',
            coordinates: [
                item.longitude ?? item.lng,
                item.latitude ?? item.lat,
                0.0
            ]
        }
    }
}

/**
 * 空的 fallback
 * @returns 
 */
function emptyIUbikeFeatureCollection(): IUbikeFeatureCollection {
    return {
        type: 'FeatureCollection',
        features: []
    }
}

/**
 * 計算兩點距離（公尺）
 * 把「角度」餵給 Math.cos, Math.sin, Math.atan2 只接受 弧度 的 API
 */
function deg2rad(deg: number): number {
    return (deg * Math.PI) / 180
}

/**
 * 計算兩點之間的距離（公尺）AI提供
 * 使用 Haversine 公式計算
 * @param a 第一點 [lng, lat]
 * @param b 第二點 [lng, lat]
 * @returns 距離（公尺）
 */
function getDistanceInMeters(a: [number, number], b: [number, number]): number {
    const R = 6371e3 // 地球半徑 (m)
    const dLat = deg2rad(b[1] - a[1])
    const dLon = deg2rad(b[0] - a[0])
    const lat1 = deg2rad(a[1])
    const lat2 = deg2rad(b[1])

    const aVal =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
    return R * c
}

