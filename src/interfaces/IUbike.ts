export interface IUbikeRaw {
    sna: string // 站名
    sbi: number // 可借
    bemp: number // 可還
    tot: number // 總車位
    lat: number
    lng: number
    available_rent_bikes?: number     // 可借
    available_return_bikes?: number   // 可還
    Quantity?: number                 // 總車位
    longitude?: number                // 經
    latitude?: number                 // 緯
}

export interface IUbikeFeature {
    type: 'Feature'
    geometry: {
        type: 'Point'
        coordinates: [number, number, number]
    }
    properties: {
        name: string
        sbi: number
        bemp: number
        tot: number
    }
}

export interface IUbikeFeatureCollection {
    type: 'FeatureCollection'
    features: IUbikeFeature[]
}
