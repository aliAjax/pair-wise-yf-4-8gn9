export type SeatDirection = '左' | '右'

export type Weather = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪' | '雾'

export type TreeDensity = '稀疏' | '适中' | '茂密'

export type PedestrianStatus = '稀少' | '零星' | '密集'

export type BatchStatus = 'open' | 'sealed'

/** 线路采风批次：先选线路建立，设置目标条数与截止时间 */
export interface SketchBatch {
  id: string
  routeName: string
  targetCount: number
  /** 截止时间 ISO */
  deadline: string
  status: BatchStatus
  createdAt: string
  sealedAt: string | null
}

export interface WindowScene {
  id: string
  routeName: string
  segment: string
  seatDirection: SeatDirection
  timestamp: string
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
  /** 所属批次；null 表示批次功能上线前未归批次的旧记录 */
  batchId: string | null
  /** 待复核标记：为 true 时不计入进度，且批次不能封存 */
  needsReview: boolean
}

export interface SceneFormData {
  batchId: string
  segment: string
  seatDirection: SeatDirection
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
  needsReview: boolean
}
