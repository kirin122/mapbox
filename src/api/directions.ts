import axios from 'axios'
import type { FeatureCollection, LineString, GeoJsonProperties } from 'geojson'
import type { IDirectionParams } from '../interfaces/IDirection'



/**
 * Mapbox Directions API 取得路徑
 * @param profile - ex: mapbox/driving, mapbox/walking, mapbox/cycling
 * @param coordinates - ex: "121.5,25.0;121.6,25.1"
 */
export async function getDirections({
    profile,
    coordinates,
}: IDirectionParams): Promise<FeatureCollection<LineString, GeoJsonProperties>> {
    const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

    const endpoint = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}`

    try {
        const response = await axios.get(endpoint, {
            params: {
                geometries: 'geojson',
                alternatives: false,
                steps: false,
                overview: 'full',
                access_token: MAPBOX_TOKEN
            },
        })

        const route = response.data?.routes?.[0]

        if (!route?.geometry) {
            console.warn('Error Mapbox res 缺少 geometry or routes')
            return emptyFeatureCollection()
        }

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: route.geometry as LineString,
                    properties: {
                        distance: route.distance,
                        duration: route.duration,
                    }
                }
            ]
        }
    } catch (error) {
        console.error('Error Mapbox Directions API:', error)
        return emptyFeatureCollection()
    }
}

/**
 * 空的 fallback
 * @returns 
 */
function emptyFeatureCollection(): FeatureCollection<LineString, GeoJsonProperties> {
    return {
        type: 'FeatureCollection',
        features: []
    }
}
