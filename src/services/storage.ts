import type { WindowScene, SketchBatch } from '@/types'

const SCENE_STORAGE_KEY = 'bus_window_scenes'
const BATCH_STORAGE_KEY = 'bus_sketch_batches'

/* ------------------------------ 批次 ------------------------------ */

export function getAllBatches(): SketchBatch[] {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SketchBatch[]
  } catch {
    return []
  }
}

function persistBatches(batches: SketchBatch[]): void {
  localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches))
}

export function saveBatch(batch: SketchBatch): void {
  const batches = getAllBatches()
  const idx = batches.findIndex((b) => b.id === batch.id)
  if (idx >= 0) batches[idx] = batch
  else batches.push(batch)
  persistBatches(batches)
}

/** 同一线路同时只能存在一个开放批次 */
export function findOpenBatchByRoute(routeName: string): SketchBatch | undefined {
  return getAllBatches().find(
    (b) => b.routeName === routeName.trim() && b.status === 'open'
  )
}

/* ------------------------------ 记录 ------------------------------ */

export function getAllScenes(): WindowScene[] {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as WindowScene[]
    // 兼容批次功能上线前的旧记录：未归批次、默认无需复核
    return list.map((s) => ({
      needsReview: false,
      ...s,
      batchId: s.batchId ?? null,
    }))
  } catch {
    return []
  }
}

function persistScenes(scenes: WindowScene[]): void {
  localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(scenes))
}

export function saveScene(scene: WindowScene): void {
  const scenes = getAllScenes()
  scenes.push(scene)
  persistScenes(scenes)
}

export function updateScene(id: string, patch: Partial<WindowScene>): void {
  const scenes = getAllScenes().map((s) =>
    s.id === id ? { ...s, ...patch } : s
  )
  persistScenes(scenes)
}

export function deleteScene(id: string): void {
  persistScenes(getAllScenes().filter((s) => s.id !== id))
}

export function getScenesByBatch(batchId: string): WindowScene[] {
  return getAllScenes()
    .filter((s) => s.batchId === batchId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/** 时间线、随机灵感、进度只读取已封存批次内的记录 */
export function getSealedScenes(): WindowScene[] {
  const sealedIds = new Set(
    getAllBatches()
      .filter((b) => b.status === 'sealed')
      .map((b) => b.id)
  )
  return getAllScenes().filter((s) => s.batchId !== null && sealedIds.has(s.batchId))
}

/**
 * 时间线可见记录：已封存批次记录 + 未归批次的旧记录。
 * 开放批次中的记录在封存前不在时间线出现。
 */
export function getReadableScenes(): WindowScene[] {
  const sealedIds = new Set(
    getAllBatches()
      .filter((b) => b.status === 'sealed')
      .map((b) => b.id)
  )
  return getAllScenes().filter(
    (s) => s.batchId === null || sealedIds.has(s.batchId)
  )
}

export function getReadableScenesByRoute(routeName: string): WindowScene[] {
  return getReadableScenes()
    .filter((s) => s.routeName === routeName)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/** 可被时间线筛选到的线路名（含只有旧记录的线路） */
export function getReadableRouteNames(): string[] {
  return Array.from(new Set(getReadableScenes().map((s) => s.routeName))).sort()
}

/**
 * 有效记录：有非空笔记且未标记待复核。
 * 用于批次进度统计与封存判定。
 */
export function getValidScenes(scenes: WindowScene[]): WindowScene[] {
  return scenes.filter((s) => !s.needsReview && s.note.trim().length > 0)
}

/** 随机灵感只从已封存批次中抽取 */
export function getRandomSealedScene(): WindowScene | null {
  const scenes = getSealedScenes()
  if (scenes.length === 0) return null
  return scenes[Math.floor(Math.random() * scenes.length)]
}
