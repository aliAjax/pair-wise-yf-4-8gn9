import { useState, useEffect, useMemo } from 'react'
import {
  Bus, MapPin, Armchair, Clock, CloudSun, Signpost, TreePine, Users, FileText, Send,
  ArrowLeft, Plus, Lock, Undo2, AlertTriangle, CalendarClock, ClipboardCheck, Trash2,
  CircleSlash, Flag, FolderOpen, Archive,
} from 'lucide-react'
import { useSceneStore, BatchRuleError } from '@/store/useSceneStore'
import {
  getWeatherIcon, getTreeIcon, getPedestrianIcon, formatTimestamp,
  getValidCount, getReviewCount, getEmptyNoteCount, formatDeadline, isOverdue,
  defaultDeadlineInput,
} from '@/utils/sceneHelpers'
import type {
  SceneFormData, Weather, TreeDensity, PedestrianStatus, SeatDirection,
  SketchBatch, WindowScene,
} from '@/types'

const WEATHERS: Weather[] = ['晴', '多云', '阴', '小雨', '大雨', '雪', '雾']
const TREES: TreeDensity[] = ['稀疏', '适中', '茂密']
const PEDESTRIANS: PedestrianStatus[] = ['稀少', '零星', '密集']

type FormState = Omit<SceneFormData, 'batchId'>

const initialForm: FormState = {
  segment: '',
  seatDirection: '左',
  weather: '晴',
  signText: '',
  treeDensity: '适中',
  pedestrianStatus: '稀少',
  note: '',
  needsReview: false,
}

export default function RecordPage() {
  const loadAll = useSceneStore((s) => s.loadAll)
  const batches = useSceneStore((s) => s.batches)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [loadAll])

  const activeBatch = batches.find((b) => b.id === activeBatchId) ?? null

  return (
    <div className="min-h-screen bg-teal-950 p-4 pb-24">
      {activeBatch ? (
        <BatchWorkspace batch={activeBatch} onBack={() => setActiveBatchId(null)} />
      ) : (
        <BatchOverview
          batches={batches}
          onEnter={(id) => setActiveBatchId(id)}
        />
      )}
    </div>
  )
}

/* ============================ 批次总览 ============================ */

/** 采风成果（进度）：只统计已封存批次；开放批次与未归批次旧记录不计入 */
function SealedAchievements() {
  const batches = useSceneStore((s) => s.batches)
  const scenes = useSceneStore((s) => s.scenes)
  const sealedBatches = batches.filter((b) => b.status === 'sealed')
  const sealedIds = new Set(sealedBatches.map((b) => b.id))
  const sealedScenes = scenes.filter((s) => s.batchId !== null && sealedIds.has(s.batchId))
  const valid = getValidCount(sealedScenes)
  const targetSum = sealedBatches.reduce((sum, b) => sum + b.targetCount, 0)

  if (sealedBatches.length === 0) return null

  return (
    <div className="rounded-2xl border border-mist-400/15 bg-mist-400/5 p-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-mist-300 text-xs">
        <Archive className="w-4 h-4 text-mist-400" />
        已封存采风成果
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-mist-300">{sealedBatches.length} 个批次</span>
        <span className="text-mist-300">
          有效记录 <span className="text-dusk-300 font-medium">{valid}</span>
          {targetSum > 0 && <span className="text-mist-500"> / 目标 {targetSum}</span>}
        </span>
      </div>
    </div>
  )
}

function BatchOverview({
  batches, onEnter,
}: {
  batches: SketchBatch[]
  onEnter: (id: string) => void
}) {
  const createBatch = useSceneStore((s) => s.createBatch)
  const scenes = useSceneStore((s) => s.scenes)
  const routeNames = useSceneStore((s) => s.routeNames)
  const [routeName, setRouteName] = useState('')
  const [targetCount, setTargetCount] = useState(10)
  const [deadline, setDeadline] = useState(defaultDeadlineInput())
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const openBatches = batches.filter((b) => b.status === 'open')
  const sealedBatches = batches.filter((b) => b.status === 'sealed')

  const suggestions = useMemo(() => {
    const set = new Set(routeNames)
    batches.forEach((b) => set.add(b.routeName))
    return Array.from(set).sort()
  }, [routeNames, batches])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const batch = createBatch({ routeName, targetCount, deadline })
      setRouteName('')
      setTargetCount(10)
      setDeadline(defaultDeadlineInput())
      setError('')
      setShowForm(false)
      onEnter(batch.id)
    } catch (err) {
      setError(err instanceof BatchRuleError ? err.message : '建立批次失败')
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-2">
        <Bus className="w-6 h-6 text-dusk-400" />
        <h1 className="text-mist-100 font-serif text-2xl">线路采风批次</h1>
      </div>

      <SealedAchievements />

      {/* 建立批次 */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border border-dashed border-dusk-400/50 bg-dusk-400/5 py-5 text-dusk-300
            flex items-center justify-center gap-2 text-sm font-medium hover:bg-dusk-400/10 transition"
        >
          <Plus className="w-4 h-4" />
          选择一条线路，建立新风批次
        </button>
      ) : (
        <form onSubmit={handleCreate} className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5 space-y-4 animate-slide-up">
          <h2 className="text-dusk-400 font-serif text-base flex items-center gap-2">
            <Flag className="w-4 h-4" />建立批次
          </h2>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Bus className="w-3 h-3" />线路</label>
            <input
              list="route-suggestions"
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="如：37路"
              autoFocus
            />
            <datalist id="route-suggestions">
              {suggestions.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><ClipboardCheck className="w-3 h-3" />目标条数</label>
              <input
                type="number" min={1}
                className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><CalendarClock className="w-3 h-3" />截止时间</label>
              <input
                type="datetime-local"
                className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 [color-scheme:dark]"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />{error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError('') }}
              className="flex-1 py-2.5 rounded-xl bg-teal-850 text-mist-300 text-sm">
              取消
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition">
              <Plus className="w-4 h-4" />建立批次
            </button>
          </div>
        </form>
      )}

      {/* 开放批次 */}
      {openBatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-mist-300 font-serif text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-dusk-400" />进行中的批次（{openBatches.length}）
          </h2>
          {openBatches.map((b) => {
            const batchScenes = scenes.filter((s) => s.batchId === b.id)
            return (
              <BatchCard key={b.id} batch={b} scenes={batchScenes} onEnter={() => onEnter(b.id)} />
            )
          })}
        </section>
      )}

      {/* 已封存批次 */}
      {sealedBatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-mist-300 font-serif text-sm flex items-center gap-2">
            <Archive className="w-4 h-4 text-mist-400" />已封存批次（{sealedBatches.length}）
          </h2>
          {sealedBatches.map((b) => {
            const batchScenes = scenes.filter((s) => s.batchId === b.id)
            return (
              <BatchCard key={b.id} batch={b} scenes={batchScenes} onEnter={() => onEnter(b.id)} />
            )
          })}
        </section>
      )}

      {batches.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-mist-400 text-center">
          <Bus className="w-12 h-12 text-dusk-400/30 mb-4" />
          <p className="font-serif text-sm">还没有采风批次</p>
          <p className="text-xs text-mist-500 mt-1">先选一条线路建立批次，再逐条记录窗景</p>
        </div>
      )}
    </div>
  )
}

function BatchCard({ batch, scenes, onEnter }: {
  batch: SketchBatch
  scenes: WindowScene[]
  onEnter: () => void
}) {
  const valid = getValidCount(scenes)
  const pct = Math.min(100, Math.round((valid / batch.targetCount) * 100))
  const overdue = batch.status === 'open' && isOverdue(batch.deadline)

  return (
    <button
      onClick={onEnter}
      className="w-full text-left rounded-2xl border border-teal-800 bg-teal-900/50 p-4 hover:border-dusk-400/40 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif text-base text-mist-100">{batch.routeName}</span>
          {batch.status === 'sealed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-mist-400/10 px-2 py-0.5 text-[10px] text-mist-300">
              <Lock className="w-3 h-3" />已封存
            </span>
          ) : overdue ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-900/40 px-2 py-0.5 text-[10px] text-red-300">
              <Clock className="w-3 h-3" />已逾期
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-dusk-400/15 px-2 py-0.5 text-[10px] text-dusk-300">
              <span className="w-1.5 h-1.5 rounded-full bg-dusk-400 animate-pulse" />采风中
            </span>
          )}
        </div>
        <span className="text-xs text-dusk-400">{valid}/{batch.targetCount}</span>
      </div>
      <div className="h-1.5 rounded-full bg-teal-850 overflow-hidden mb-2">
        <div className="h-full rounded-full bg-dusk-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-mist-500">
        <span className="flex items-center gap-1">
          <CalendarClock className="w-3 h-3" />
          截止 {formatDeadline(batch.deadline)}
        </span>
        {batch.sealedAt && <span>封存于 {formatTimestamp(batch.sealedAt)}</span>}
      </div>
    </button>
  )
}

/* ============================ 批次工作台 ============================ */

function BatchWorkspace({ batch, onBack }: { batch: SketchBatch; onBack: () => void }) {
  const scenes = useSceneStore((s) => s.scenes)
  const batchScenes = useMemo(
    () => scenes.filter((s) => s.batchId === batch.id),
    [scenes, batch.id]
  )
  const isOpen = batch.status === 'open'
  const valid = getValidCount(batchScenes)
  const reviewCount = getReviewCount(batchScenes)
  const emptyCount = getEmptyNoteCount(batchScenes)
  const reached = valid >= batch.targetCount
  const overdue = isOverdue(batch.deadline)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-mist-400 text-xs hover:text-mist-200 transition">
        <ArrowLeft className="w-3.5 h-3.5" />返回批次列表
      </button>

      {/* 批次头 */}
      <div className="rounded-2xl border border-teal-800 bg-teal-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus className="w-5 h-5 text-dusk-400" />
            <h1 className="text-mist-100 font-serif text-xl">{batch.routeName}</h1>
          </div>
          {isOpen ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] ${
              overdue ? 'bg-red-900/40 text-red-300' : 'bg-dusk-400/15 text-dusk-300'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${overdue ? 'bg-red-400' : 'bg-dusk-400 animate-pulse'}`} />
              {overdue ? '已逾期' : '采风中'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-mist-400/10 px-2.5 py-1 text-[11px] text-mist-300">
              <Lock className="w-3 h-3" />已封存
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-mist-400 mb-1.5">
            <span className="flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" />采风进度</span>
            <span className={reached ? 'text-dusk-300 font-medium' : ''}>
              有效 {valid}/{batch.targetCount}
            </span>
          </div>
          <div className="h-2 rounded-full bg-teal-850 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${reached ? 'bg-dusk-400' : 'bg-dusk-600'}`}
              style={{ width: `${Math.min(100, Math.round((valid / batch.targetCount) * 100))}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist-500">
            <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" />截止 {formatDeadline(batch.deadline)}</span>
            {reviewCount > 0 && <span className="flex items-center gap-1 text-amber-300/90"><AlertTriangle className="w-3 h-3" />待复核 {reviewCount}</span>}
            {emptyCount > 0 && <span className="flex items-center gap-1"><CircleSlash className="w-3 h-3" />空笔记 {emptyCount}</span>}
            {batch.sealedAt && <span>封存于 {formatTimestamp(batch.sealedAt)}</span>}
          </div>
        </div>

        <SealControl
          batch={batch} valid={valid} reviewCount={reviewCount} reached={reached}
        />
      </div>

      {/* 记录表单 / 封存提示 */}
      {isOpen ? (
        <SceneForm batch={batch} />
      ) : (
        <div className="rounded-2xl border border-teal-800 bg-teal-900/30 p-5 text-center space-y-2">
          <Lock className="w-6 h-6 text-mist-500 mx-auto" />
          <p className="text-sm text-mist-300 font-serif">批次已封存，记录已固定</p>
          <p className="text-xs text-mist-500">时间线与随机灵感已可读取本批次；如需补录，请先撤回封存（原记录不会删除）。</p>
        </div>
      )}

      {/* 批次内记录 */}
      <BatchRecordList scenes={batchScenes} canEdit={isOpen} />
    </div>
  )
}

function SealControl({ batch, valid, reviewCount, reached }: {
  batch: SketchBatch
  valid: number
  reviewCount: number
  reached: boolean
}) {
  const sealBatch = useSceneStore((s) => s.sealBatch)
  const unsealBatch = useSceneStore((s) => s.unsealBatch)
  const [error, setError] = useState('')
  const [confirmUnseal, setConfirmUnseal] = useState(false)

  if (batch.status === 'sealed') {
    return confirmUnseal ? (
      <div className="rounded-xl border border-dusk-400/30 bg-dusk-400/5 p-3 space-y-2 animate-slide-down">
        <p className="text-xs text-mist-300">撤回后批次重新开放，可补录记录；原记录全部保留。确认撤回？</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmUnseal(false)}
            className="flex-1 py-2 rounded-lg bg-teal-850 text-mist-300 text-xs">取消</button>
          <button onClick={() => { unsealBatch(batch.id); setConfirmUnseal(false) }}
            className="flex-1 py-2 rounded-lg bg-dusk-400 text-teal-950 text-xs font-medium flex items-center justify-center gap-1">
            <Undo2 className="w-3.5 h-3.5" />确认撤回
          </button>
        </div>
      </div>
    ) : (
      <button onClick={() => setConfirmUnseal(true)}
        className="w-full py-2.5 rounded-xl border border-dusk-400/40 text-dusk-300 text-sm flex items-center justify-center gap-2 hover:bg-dusk-400/10 transition">
        <Undo2 className="w-4 h-4" />撤回封存以便补录
      </button>
    )
  }

  const blocked = reviewCount > 0 || !reached
  const reason = reviewCount > 0
    ? `存在 ${reviewCount} 条待复核记录，不能封存`
    : !reached ? `再完成 ${batch.targetCount - valid} 条有效记录即可封存` : ''

  const handleSeal = () => {
    try {
      sealBatch(batch.id)
      setError('')
    } catch (err) {
      setError(err instanceof BatchRuleError ? err.message : '封存失败')
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleSeal}
        disabled={blocked}
        className={`w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition ${
          blocked
            ? 'bg-teal-850 text-mist-500 cursor-not-allowed'
            : 'bg-dusk-400 text-teal-950 font-medium active:scale-[0.98]'
        }`}
      >
        <Lock className="w-4 h-4" />{reached ? '达标，封存批次' : '封存批次'}
      </button>
      {(blocked || error) && (
        <p className="text-[11px] flex items-center gap-1 justify-center text-center text-amber-300/90">
          <AlertTriangle className="w-3 h-3" />{error || reason}
        </p>
      )}
    </div>
  )
}

function SceneForm({ batch }: { batch: SketchBatch }) {
  const saveScene = useSceneStore((s) => s.saveScene)
  const [form, setForm] = useState<FormState>(initialForm)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const update = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      saveScene({ ...form, batchId: batch.id })
      setError('')
      setShowSuccess(true)
      setTimeout(() => {
        setShowSuccess(false)
        setForm(initialForm)
      }, 1500)
    } catch (err) {
      setError(err instanceof BatchRuleError ? err.message : '保存失败')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2" style={{ animation: 'fadeInUp 1.5s ease forwards' }}>
            <Bus className="w-16 h-16 text-dusk-400" />
            <span className="text-mist-100 font-serif text-lg">记录已归入批次</span>
          </div>
          <style>{`@keyframes fadeInUp { 0% { opacity:0; transform:translateY(20px) } 40% { opacity:1; transform:translateY(0) } 100% { opacity:0; transform:translateY(-40px) } }`}</style>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
          <MapPin className="w-4 h-4" />采风信息
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Bus className="w-3 h-3" />线路</label>
            <input disabled
              className="w-full bg-teal-850/70 text-mist-400 rounded-xl px-3 py-2 text-sm cursor-not-allowed border border-teal-800"
              value={batch.routeName} />
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />区间</label>
            <input className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              value={form.segment} onChange={(e) => update('segment', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Armchair className="w-3 h-3" />座位方向</label>
          <div className="flex gap-2">
            {(['左', '右'] as SeatDirection[]).map((d) => (
              <button key={d} type="button" onClick={() => update('seatDirection', d)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${form.seatDirection === d ? 'bg-dusk-400/20 text-dusk-400 border border-dusk-400' : 'bg-teal-850 text-mist-300 border border-transparent'}`}>
                {d}侧
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
          <CloudSun className="w-4 h-4" />窗景信息
        </h2>
        <div>
          <label className="text-mist-300 text-xs mb-1 block">天气</label>
          <div className="grid grid-cols-4 gap-2">
            {WEATHERS.map((w) => (
              <button key={w} type="button" onClick={() => update('weather', w)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition ${form.weather === w ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                {getWeatherIcon(w)}{w}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Signpost className="w-3 h-3" />招牌文字</label>
          <input className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
            value={form.signText} onChange={(e) => update('signText', e.target.value)} />
        </div>
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><TreePine className="w-3 h-3" />树木密度</label>
          <div className="grid grid-cols-3 gap-2">
            {TREES.map((t) => (
              <button key={t} type="button" onClick={() => update('treeDensity', t)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${form.treeDensity === t ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                {getTreeIcon(t)}{t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1"><Users className="w-3 h-3" />行人状态</label>
          <div className="grid grid-cols-3 gap-2">
            {PEDESTRIANS.map((p) => (
              <button key={p} type="button" onClick={() => update('pedestrianStatus', p)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${form.pedestrianStatus === p ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400' : 'bg-teal-850 border border-transparent text-mist-300'}`}>
                {getPedestrianIcon(p)}{p}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
          <FileText className="w-4 h-4" />观察笔记
        </h2>
        <textarea className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 resize-none h-24"
          value={form.note} onChange={(e) => update('note', e.target.value)}
          placeholder="留空则不计入有效条数" />
        <label className="flex items-center gap-2 text-xs text-mist-300 cursor-pointer select-none">
          <input type="checkbox" checked={form.needsReview}
            onChange={(e) => update('needsReview', e.target.checked)}
            className="w-4 h-4 rounded accent-dusk-400" />
          <AlertTriangle className="w-3.5 h-3.5 text-amber-300/80" />
          标记待复核（不计入进度，且未处理前不能封存）
        </label>
      </section>

      {error && (
        <p className="text-xs text-red-300 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />{error}
        </p>
      )}

      <button type="submit"
        className="w-full py-3 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition">
        <Send className="w-4 h-4" />保存到本批次
      </button>
    </form>
  )
}

function BatchRecordList({ scenes, canEdit }: { scenes: WindowScene[]; canEdit: boolean }) {
  const toggleReview = useSceneStore((s) => s.toggleReview)
  const deleteScene = useSceneStore((s) => s.deleteScene)

  if (scenes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-teal-800 py-10 text-center text-mist-500 text-xs">
        本批次还没有记录
      </div>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="text-mist-300 font-serif text-sm flex items-center gap-2">
        <Clock className="w-4 h-4" />本批次记录（{scenes.length}）
      </h2>
      {scenes.map((s) => {
        const empty = s.note.trim().length === 0
        return (
          <div key={s.id}
            className={`rounded-xl border p-3 ${
              s.needsReview ? 'border-amber-500/40 bg-amber-900/10'
                : empty ? 'border-teal-800 bg-teal-900/30'
                : 'border-teal-800 bg-teal-900/50'
            }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {getWeatherIcon(s.weather)}
                <span className="text-sm text-mist-100 truncate">{s.segment}</span>
                {s.needsReview && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-300">
                    <AlertTriangle className="w-2.5 h-2.5" />待复核
                  </span>
                )}
                {!s.needsReview && empty && (
                  <span className="shrink-0 rounded-full bg-teal-800 px-1.5 py-0.5 text-[10px] text-mist-400">
                    空笔记
                  </span>
                )}
                {!s.needsReview && !empty && (
                  <span className="shrink-0 rounded-full bg-dusk-400/15 px-1.5 py-0.5 text-[10px] text-dusk-300">
                    有效
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-mist-500">{formatTimestamp(s.timestamp)}</span>
            </div>
            {s.note && <p className="mt-1.5 text-xs text-mist-400 line-clamp-2">{s.note}</p>}
            {canEdit && (
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => toggleReview(s.id, !s.needsReview)}
                  className="text-[11px] text-mist-400 hover:text-amber-300 transition flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {s.needsReview ? '取消待复核' : '标记待复核'}
                </button>
                <button
                  onClick={() => deleteScene(s.id)}
                  className="text-[11px] text-mist-500 hover:text-red-300 transition flex items-center gap-1 ml-auto">
                  <Trash2 className="w-3 h-3" />删除
                </button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
