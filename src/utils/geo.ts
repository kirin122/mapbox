/**
 * 計算座標距離（公里）- 全球距離算法
 * a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
 * c = 2 × atan2(√a, √(1−a))
 * d = R × c
 * @param a 
 * @param b 
 * @returns 
 */
export function getDistanceInKm(a: [number, number], b: [number, number]): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const R = 6371
    const dLat = toRad(b[1] - a[1])
    const dLon = toRad(b[0] - a[0])
    const lat1 = toRad(a[1])
    const lat2 = toRad(b[1])
    const aVal = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))
    return R * c
}

export function getDistanceInMeters(a: [number, number], b: [number, number]) {
    return getDistanceInKm(a, b) * 1000
}