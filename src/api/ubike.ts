import axios from 'axios'
import { getDistanceInMeters } from '../utils/geo'
import type { IUbikeFeature, IUbikeFeatureCollection, IUbikeRaw } from '../interfaces/IUbike'

const UBIKE_API_URL =
    'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json'


/**
 * 取得全部 Ubike 資料
 */
export async function getAllUbike(): Promise<IUbikeFeatureCollection> {
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
 * @param allData 全部 Ubike 資料
 * @return 範圍內的 Ubike 
 */
export async function getUbikeNearby(
    center: [number, number],
    radius = 1000,
    allData: IUbikeFeatureCollection | null
): Promise<IUbikeFeatureCollection> {

    if (!allData || !allData.features?.length) {
        return emptyIUbikeFeatureCollection()
    }

    const nearby = allData.features.filter(f => {
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
 * 將原始資料轉換為 GeoJSON
 * @param item 
 * @returns 
 */
function transformIUbikeRawToFeature(item: IUbikeRaw): IUbikeFeature {
    return {
        type: 'Feature',
        id: item.sno,
        properties: {
            name: item.sna,
            sbi: item.available_rent_bikes ?? item.sbi ?? 0,
            bemp: item.available_return_bikes ?? item.bemp ?? 0,
            tot: item.Quantity ?? item.tot ?? 0,
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

