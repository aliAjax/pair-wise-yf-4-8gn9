export type SeatDirection = '左' | '右'

export type Weather = '晴' | '多云' | '阴' | '小雨' | '大雨' | '雪' | '雾'

export type TreeDensity = '稀疏' | '适中' | '茂密'

export type PedestrianStatus = '稀少' | '零星' | '密集'

export type BatchStatus = 'open' | 'sealed'

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
  /** 标记待复核：不计入有效进度，且批次存在待复核记录时不能封存 */
  needsReview: boolean
  /** 所属采风批次；null 表示批次功能上线前的旧记录 */
  batchId: string | null
}

export interface SceneFormData {
  segment: string
  seatDirection: SeatDirection
  weather: Weather
  signText: string
  treeDensity: TreeDensity
  pedestrianStatus: PedestrianStatus
  note: string
  needsReview: boolean
}

export interface SketchBatch {
  id: string
  routeName: string
  targetCount: number
  /** 截止时间 ISO 字符串 */
  deadline: string
  createdAt: string
  status: BatchStatus
  sealedAt: string | null
}

export interface BatchFormData {
  routeName: string
  targetCount: number
  /** datetime-local 输入值 */
  deadline: string
}
