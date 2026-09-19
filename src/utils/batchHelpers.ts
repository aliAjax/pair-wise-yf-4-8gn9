import type { SketchBatch, WindowScene } from '@/types'

/** 计入进度的记录：笔记非空且未标记待复核 */
export function isEffective(scene: WindowScene): boolean {
  return scene.note.trim().length > 0 && !scene.needsReview
}

export function countEffective(scenes: WindowScene[]): number {
  return scenes.filter(isEffective).length
}

export function countPendingReview(scenes: WindowScene[]): number {
  return scenes.filter((s) => s.needsReview).length
}

export function countEmptyNote(scenes: WindowScene[]): number {
  return scenes.filter((s) => s.note.trim().length === 0).length
}

export function isBatchMet(batch: SketchBatch, scenes: WindowScene[]): boolean {
  return countEffective(scenes) >= batch.targetCount
}

export function canSeal(batch: SketchBatch, scenes: WindowScene[]): boolean {
  return isBatchMet(batch, scenes) && countPendingReview(scenes) === 0
}

export function isExpired(deadline: string, now: Date = new Date()): boolean {
  return new Date(deadline).getTime() < now.getTime()
}

/** 截止时间剩余描述（开放批次用） */
export function formatDeadlineRemaining(
  deadline: string,
  now: Date = new Date(),
): string {
  const diff = new Date(deadline).getTime() - now.getTime()
  if (diff <= 0) return '已过截止时间'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `剩 ${days} 天 ${hours % 24} 小时`
  if (hours > 0) return `剩 ${hours} 小时 ${minutes % 60} 分`
  return `剩 ${Math.max(minutes, 0)} 分钟`
}

/** 截止时间 / 封存时间的简短日期 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

export function sortBatchesDesc(a: SketchBatch, b: SketchBatch): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}
