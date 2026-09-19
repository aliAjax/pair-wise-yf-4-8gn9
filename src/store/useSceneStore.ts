import { create } from 'zustand'
import type { WindowScene, SceneFormData, SketchBatch, BatchFormData } from '@/types'
import {
  getAllScenes,
  getAllBatches,
  saveScene as storageSaveScene,
  updateScene as storageUpdateScene,
  saveBatch,
  updateBatch,
  getRandomSealedScene,
} from '@/services/storage'

interface SceneState {
  scenes: WindowScene[]
  batches: SketchBatch[]
  /** 当前工作台中打开的批次（必然为开放状态） */
  activeBatch: SketchBatch | null
  randomScene: WindowScene | null

  loadAll: () => void
  createBatch: (data: BatchFormData) => SketchBatch
  selectBatch: (id: string) => void
  closeWorkspace: () => void
  saveScene: (data: SceneFormData) => void
  updateSceneReview: (id: string, patch: { note?: string; needsReview?: boolean }) => void
  sealActiveBatch: () => void
  unsealBatch: (id: string) => void
  refreshRandom: () => void
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: [],
  batches: [],
  activeBatch: null,
  randomScene: null,

  loadAll: () => {
    set({ scenes: getAllScenes(), batches: getAllBatches() })
  },

  createBatch: (data) => {
    const routeName = data.routeName.trim()
    const targetCount = Math.floor(data.targetCount)
    if (!routeName) throw new Error('请填写线路名称')
    if (!Number.isFinite(targetCount) || targetCount < 1) {
      throw new Error('目标条数至少为 1 条')
    }
    const deadlineMs = new Date(data.deadline).getTime()
    if (!data.deadline || Number.isNaN(deadlineMs)) {
      throw new Error('请设置截止时间')
    }
    if (deadlineMs <= Date.now()) throw new Error('截止时间需晚于当前时间')

    const duplicated = get()
      .batches.some((b) => b.status === 'open' && b.routeName === routeName)
    if (duplicated) throw new Error(`「${routeName}」已有开放批次，请直接进入该批次补录`)

    const batch: SketchBatch = {
      id: crypto.randomUUID(),
      routeName,
      targetCount,
      deadline: new Date(data.deadline).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'open',
      sealedAt: null,
    }
    saveBatch(batch)
    set({ batches: getAllBatches(), activeBatch: batch })
    return batch
  },

  selectBatch: (id) => {
    const batch = get().batches.find((b) => b.id === id)
    if (batch && batch.status === 'open') set({ activeBatch: batch })
  },

  closeWorkspace: () => set({ activeBatch: null }),

  saveScene: (data) => {
    const batch = get().activeBatch
    if (!batch) throw new Error('请先选择一条线路的开放批次')
    const scene: WindowScene = {
      ...data,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      routeName: batch.routeName,
      needsReview: data.needsReview,
      batchId: batch.id,
    }
    storageSaveScene(scene)
    set({ scenes: getAllScenes() })
  },

  updateSceneReview: (id, patch) => {
    storageUpdateScene(id, patch)
    set({ scenes: getAllScenes() })
  },

  sealActiveBatch: () => {
    const batch = get().activeBatch
    if (!batch) return
    const batchScenes = get().scenes.filter((s) => s.batchId === batch.id)
    const pending = batchScenes.filter((s) => s.needsReview).length
    if (pending > 0) {
      throw new Error(`还有 ${pending} 条待复核记录，处理后才能封存`)
    }
    const effective = batchScenes.filter(
      (s) => s.note.trim().length > 0 && !s.needsReview,
    ).length
    if (effective < batch.targetCount) {
      throw new Error(`有效记录 ${effective}/${batch.targetCount}，尚未达标`)
    }
    updateBatch(batch.id, { status: 'sealed', sealedAt: new Date().toISOString() })
    set({ batches: getAllBatches(), activeBatch: null })
  },

  unsealBatch: (id) => {
    const batches = get().batches
    const batch = batches.find((b) => b.id === id)
    if (!batch || batch.status !== 'sealed') return
    // 撤回封存前，同线路不能存在其他开放批次（开放批次唯一）
    const conflict = batches.some(
      (b) => b.status === 'open' && b.routeName === batch.routeName && b.id !== id,
    )
    if (conflict) {
      throw new Error(`「${batch.routeName}」已有新的开放批次，请先处理`)
    }
    updateBatch(id, { status: 'open', sealedAt: null })
    const reopened = getAllBatches().find((b) => b.id === id) ?? null
    set({ batches: getAllBatches(), activeBatch: reopened })
  },

  refreshRandom: () => {
    set({ randomScene: getRandomSealedScene() })
  },
}))
