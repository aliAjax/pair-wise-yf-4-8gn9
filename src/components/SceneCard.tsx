import { useEffect, useState } from 'react'
import { AlertTriangle, FileText, Pencil, Save, X, Clock, MapPin } from 'lucide-react'
import {
  formatTimestamp,
  getTimeOfDay,
  getWeatherIcon,
  getTreeIcon,
  getPedestrianIcon,
} from '@/utils/sceneHelpers'
import { useSceneStore } from '@/store/useSceneStore'
import type { WindowScene } from '@/types'

interface Props {
  scene: WindowScene
  /** 是否允许修改笔记 / 待复核（仅开放批次） */
  editable?: boolean
}

/** 单条记录卡：可点开详情；开放批次中可编辑笔记并切换待复核 */
export default function SceneCard({ scene, editable = false }: Props) {
  const updateSceneReview = useSceneStore((s) => s.updateSceneReview)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(scene.note)
  const [needsReview, setNeedsReview] = useState(scene.needsReview)

  useEffect(() => {
    setNote(scene.note)
    setNeedsReview(scene.needsReview)
  }, [scene.note, scene.needsReview])

  const saveEdit = () => {
    updateSceneReview(scene.id, { note: note.trim(), needsReview })
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-teal-800 bg-teal-900/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-3.5 text-left flex items-start gap-3"
      >
        <span className="pt-0.5 shrink-0">{getWeatherIcon(scene.weather)}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-mist-100">{scene.segment}</span>
            <span className="text-[10px] text-mist-500">{formatTimestamp(scene.timestamp)}</span>
            {scene.needsReview && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                <AlertTriangle className="w-3 h-3" />待复核
              </span>
            )}
            {!scene.note.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-800/70 px-2 py-0.5 text-[10px] text-mist-400">
                <FileText className="w-3 h-3" />无笔记
              </span>
            )}
          </span>
          {scene.note && (
            <span className="mt-1 block text-xs text-mist-400 line-clamp-2">{scene.note}</span>
          )}
          <span className="mt-1.5 flex items-center gap-2 text-mist-500">
            {getTreeIcon(scene.treeDensity)}
            {getPedestrianIcon(scene.pedestrianStatus)}
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {scene.seatDirection}侧
            </span>
            {scene.signText && <span className="text-[10px] text-mist-400">「{scene.signText}」</span>}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-teal-800/70 p-3.5 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-mist-300 text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-dusk-400" />
              {formatTimestamp(scene.timestamp)} · {getTimeOfDay(scene.timestamp)}
            </span>
            <span className="inline-flex items-center gap-1">
              {getTreeIcon(scene.treeDensity)}树木{scene.treeDensity}
            </span>
            <span className="inline-flex items-center gap-1">
              {getPedestrianIcon(scene.pedestrianStatus)}行人{scene.pedestrianStatus}
            </span>
          </div>

          {scene.signText && (
            <div className="rounded-lg bg-teal-800/50 px-3 py-2 text-mist-200 text-xs">
              招牌：{scene.signText}
            </div>
          )}

          {!editing ? (
            <div className="rounded-lg border border-teal-800 px-3 py-2 text-mist-300 text-xs min-h-[2.5rem]">
              {scene.note || <span className="text-mist-500">暂无观察笔记</span>}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg border border-dusk-400/40 bg-teal-850 px-3 py-2 text-xs text-mist-100 outline-none focus:border-dusk-400 resize-none h-20"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="补写观察笔记，补全后才会计入进度"
              />
              <button
                type="button"
                onClick={() => setNeedsReview((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  needsReview
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-teal-800 text-mist-300 border border-transparent'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {needsReview ? '已标记待复核' : '标记为待复核'}
              </button>
            </div>
          )}

          {editable && (
            <div className="flex gap-2">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-800 py-2 text-xs text-mist-200 hover:bg-teal-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />修改笔记 / 复核状态
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-dusk-400 py-2 text-xs text-teal-950 font-medium"
                  >
                    <Save className="w-3.5 h-3.5" />保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setNote(scene.note)
                      setNeedsReview(scene.needsReview)
                    }}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-teal-800 px-3 py-2 text-xs text-mist-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
