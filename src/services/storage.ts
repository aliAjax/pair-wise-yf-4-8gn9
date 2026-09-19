import type { WindowScene, SketchBatch } from '@/types'

const SCENES_KEY = 'bus_window_scenes'
const BATCHES_KEY = 'bus_sketch_batches'

function readJSON<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeJSON<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** 兼容批次功能上线前的旧记录：补齐 needsReview / batchId 字段 */
function normalizeScene(raw: WindowScene): WindowScene {
  return {
    ...raw,
    needsReview: raw.needsReview ?? false,
    batchId: raw.batchId ?? null,
  }
}

export function getAllScenes(): WindowScene[] {
  return readJSON<WindowScene>(SCENES_KEY).map(normalizeScene)
}

export function getAllBatches(): SketchBatch[] {
  return readJSON<SketchBatch>(BATCHES_KEY)
}

export function saveScene(scene: WindowScene): void {
  const scenes = getAllScenes()
  scenes.push(scene)
  writeJSON(SCENES_KEY, scenes)
}

export function updateScene(
  id: string,
  patch: Partial<Pick<WindowScene, 'note' | 'needsReview'>>,
): void {
  const scenes = getAllScenes().map((s) =>
    s.id === id ? { ...s, ...patch } : s,
  )
  writeJSON(SCENES_KEY, scenes)
}

export function saveBatch(batch: SketchBatch): void {
  const batches = getAllBatches()
  batches.push(batch)
  writeJSON(BATCHES_KEY, batches)
}

export function updateBatch(id: string, patch: Partial<SketchBatch>): void {
  const batches = getAllBatches().map((b) =>
    b.id === id ? { ...b, ...patch } : b,
  )
  writeJSON(BATCHES_KEY, batches)
}

/** 已封存批次下的全部记录（时间线、灵感、进度的唯一数据源） */
export function getSealedScenes(): WindowScene[] {
  const sealedIds = new Set(
    getAllBatches()
      .filter((b) => b.status === 'sealed')
      .map((b) => b.id),
  )
  return getAllScenes().filter((s) => s.batchId !== null && sealedIds.has(s.batchId))
}

/** 未归批次的旧记录：封存时间线外继续可见 */
export function getUnassignedScenes(): WindowScene[] {
  return getAllScenes()
    .filter((s) => s.batchId === null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/** 随机灵感只采集已封存批次的记录（空笔记不构成灵感素材，选取时排除） */
export function getRandomSealedScene(): WindowScene | null {
  const scenes = getSealedScenes().filter((s) => s.note.trim().length > 0)
  if (scenes.length === 0) return null
  return scenes[Math.floor(Math.random() * scenes.length)]
}
