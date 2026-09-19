import { create } from 'zustand'
import type { WindowScene, SceneFormData, SketchBatch } from '@/types'
import {
  getAllScenes,
  saveScene as storageSaveScene,
  updateScene as storageUpdateScene,
  deleteScene as storageDeleteScene,
  getScenesByBatch,
  getReadableScenes,
  getReadableRouteNames,
  getReadableScenesByRoute,
  getRandomSealedScene,
  getAllBatches,
  saveBatch,
  findOpenBatchByRoute,
} from '@/services/storage'

export interface BatchInput {
  routeName: string
  targetCount: number
  deadline: string
}

export class BatchRuleError extends Error {}

interface SceneState {
  scenes: WindowScene[]
  batches: SketchBatch[]
  /** 时间线/灵感/进度可读记录：已封存批次记录 + 未归批次旧记录 */
  readableScenes: WindowScene[]
  routeNames: string[]
  selectedRoute: string
  currentRouteScenes: WindowScene[]
  randomScene: WindowScene | null

  loadAll: () => void
  /** 建立批次；同线路已有开放批次时拒绝 */
  createBatch: (input: BatchInput) => SketchBatch
  saveScene: (data: SceneFormData) => void
  toggleReview: (id: string, needsReview: boolean) => void
  deleteScene: (id: string) => void
  /** 封存：存在待复核记录或未达标时拒绝 */
  sealBatch: (batchId: string) => void
  /** 撤回封存以便补录，原记录保留 */
  unsealBatch: (batchId: string) => void
  selectRoute: (routeName: string) => void
  refreshRandom: () => void
}

function sortBatches(batches: SketchBatch[]): SketchBatch[] {
  return [...batches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  batches: [],
  readableScenes: [],
  routeNames: [],
  selectedRoute: '',
  currentRouteScenes: [],
  randomScene: null,

  loadAll: () => {
    const { selectedRoute } = get()
    set({
      scenes: getAllScenes(),
      batches: sortBatches(getAllBatches()),
      readableScenes: getReadableScenes(),
      routeNames: getReadableRouteNames(),
      currentRouteScenes: selectedRoute
        ? getReadableScenesByRoute(selectedRoute)
        : [],
    })
  },

  createBatch: ({ routeName, targetCount, deadline }) => {
    const name = routeName.trim()
    if (!name) throw new BatchRuleError('请填写线路名称')
    if (!Number.isFinite(targetCount) || targetCount < 1)
      throw new BatchRuleError('目标条数至少为 1')
    if (!deadline || Number.isNaN(new Date(deadline).getTime()))
      throw new BatchRuleError('请设置有效的截止时间')

    if (findOpenBatchByRoute(name))
      throw new BatchRuleError('该线路已有开放批次，请先完成或封存它')

    const batch: SketchBatch = {
      id: crypto.randomUUID(),
      routeName: name,
      targetCount,
      deadline: new Date(deadline).toISOString(),
      status: 'open',
      createdAt: new Date().toISOString(),
      sealedAt: null,
    }
    saveBatch(batch)
    set({ batches: sortBatches(getAllBatches()) })
    return batch
  },

  saveScene: (data) => {
    const batch = getAllBatches().find((b) => b.id === data.batchId)
    if (!batch) throw new BatchRuleError('请先选择一个开放批次')
    if (batch.status !== 'open')
      throw new BatchRuleError('批次已封存，需先撤回才能补录')

    const scene: WindowScene = {
      id: crypto.randomUUID(),
      ...data,
      routeName: batch.routeName,
      timestamp: new Date().toISOString(),
    }
    storageSaveScene(scene)
    get().loadAll()
  },

  toggleReview: (id, needsReview) => {
    const scene = getAllScenes().find((s) => s.id === id)
    if (!scene) return
    const batch = scene.batchId
      ? getAllBatches().find((b) => b.id === scene.batchId)
      : undefined
    if (batch && batch.status !== 'open') return
    storageUpdateScene(id, { needsReview })
    get().loadAll()
  },

  deleteScene: (id) => {
    const scene = getAllScenes().find((s) => s.id === id)
    if (!scene) return
    const batch = scene.batchId
      ? getAllBatches().find((b) => b.id === scene.batchId)
      : undefined
    // 已封存批次的记录不允许删除；旧记录可继续删除
    if (batch && batch.status === 'sealed') return
    storageDeleteScene(id)
    get().loadAll()
  },

  sealBatch: (batchId) => {
    const batch = getAllBatches().find((b) => b.id === batchId)
    if (!batch) throw new BatchRuleError('批次不存在')
    if (batch.status === 'sealed') throw new BatchRuleError('批次已封存')

    const batchScenes = getScenesByBatch(batchId)
    if (batchScenes.some((s) => s.needsReview))
      throw new BatchRuleError('仍存在待复核记录，请先处理再封存')

    const validCount = batchScenes.filter(
      (s) => !s.needsReview && s.note.trim().length > 0
    ).length
    if (validCount < batch.targetCount)
      throw new BatchRuleError(`尚未达标：有效记录 ${validCount}/${batch.targetCount}`)

    saveBatch({ ...batch, status: 'sealed', sealedAt: new Date().toISOString() })
    get().loadAll()
  },

  unsealBatch: (batchId) => {
    const batch = getAllBatches().find((b) => b.id === batchId)
    if (!batch || batch.status !== 'sealed') return
    saveBatch({ ...batch, status: 'open', sealedAt: null })
    get().loadAll()
  },

  selectRoute: (routeName) => {
    set({
      selectedRoute: routeName,
      currentRouteScenes: routeName ? getReadableScenesByRoute(routeName) : [],
    })
  },

  refreshRandom: () => {
    set({ randomScene: getRandomSealedScene() })
  },
}))
