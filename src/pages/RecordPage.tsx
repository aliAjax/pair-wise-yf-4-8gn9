import { useEffect, useMemo, useState } from 'react'
import {
  Bus, MapPin, Armchair, Clock, Signpost, TreePine, Users,
  FileText, Send, Target, CalendarDays, Lock, LockOpen, AlertTriangle,
  ArrowLeft, PackageCheck, RotateCcw, CheckCircle2, ListChecks, Archive,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { getWeatherIcon, getTreeIcon, getPedestrianIcon, formatTimestamp } from '@/utils/sceneHelpers'
import {
  countEffective, countPendingReview, countEmptyNote, canSeal,
  formatDeadlineRemaining, formatDate, sortBatchesDesc, isExpired,
} from '@/utils/batchHelpers'
import SceneCard from '@/components/SceneCard'
import ProgressBar from '@/components/ProgressBar'
import type {
  SceneFormData, Weather, TreeDensity, PedestrianStatus, SeatDirection,
  BatchFormData, SketchBatch, WindowScene,
} from '@/types'

const WEATHERS: Weather[] = ['晴', '多云', '阴', '小雨', '大雨', '雪', '雾']
const TREES: TreeDensity[] = ['稀疏', '适中', '茂密']
const PEDESTRIANS: PedestrianStatus[] = ['稀少', '零星', '密集']

const initialForm: SceneFormData = {
  segment: '',
  seatDirection: '左',
  weather: '晴',
  signText: '',
  treeDensity: '适中',
  pedestrianStatus: '稀少',
  note: '',
  needsReview: false,
}

/** datetime-local 默认值：当前时间 + 7 天 */
function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function RecordPage() {
  const {
    scenes, batches, activeBatch, loadAll, createBatch, selectBatch,
    closeWorkspace, saveScene, sealActiveBatch, unsealBatch,
  } = useSceneStore()
  const [now, setNow] = useState(new Date())
  const [formError, setFormError] = useState('')

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const openBatches = useMemo(
    () => batches.filter((b) => b.status === 'open').sort(sortBatchesDesc),
    [batches],
  )
  const sealedBatches = useMemo(
    () => batches.filter((b) => b.status === 'sealed').sort(sortBatchesDesc),
    [batches],
  )

  const scenesOf = useMemo(() => {
    const map = new Map<string, ReturnType<typeof scenes.filter>>()
    for (const b of batches) {
      map.set(
        b.id,
        scenes
          .filter((s) => s.batchId === b.id)
          .sort((a, c) => new Date(c.timestamp).getTime() - new Date(a.timestamp).getTime()),
      )
    }
    return map
  }, [scenes, batches])

  const knownRoutes = useMemo(
    () => Array.from(new Set(batches.map((b) => b.routeName))).sort(),
    [batches],
  )

  return (
    <div className="relative min-h-full bg-teal-950 p-4 pb-24">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center gap-2 mb-5">
          <Bus className="w-6 h-6 text-dusk-400" />
          <h1 className="text-mist-100 font-serif text-2xl">线路采风批次</h1>
        </div>

        {activeBatch ? (
          <BatchWorkspace
            key={activeBatch.id}
            batch={activeBatch}
            batchScenes={scenesOf.get(activeBatch.id) ?? []}
            now={now}
            onBack={closeWorkspace}
            onSubmit={saveScene}
            onSeal={sealActiveBatch}
          />
        ) : (
          <div className="space-y-7">
            <CreateBatchForm
              knownRoutes={knownRoutes}
              openBatches={openBatches}
              onSubmit={(data) => {
                try {
                  createBatch(data)
                  setFormError('')
                } catch (e) {
                  setFormError(e instanceof Error ? e.message : '建立批次失败')
                }
              }}
              formError={formError}
            />

            {openBatches.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
                  <LockOpen className="w-4 h-4" />进行中的批次
                </h2>
                {openBatches.map((b) => (
                  <OpenBatchRow
                    key={b.id}
                    batch={b}
                    count={countEffective(scenesOf.get(b.id) ?? [])}
                    pending={countPendingReview(scenesOf.get(b.id) ?? [])}
                    now={now}
                    onEnter={() => selectBatch(b.id)}
                  />
                ))}
              </section>
            )}

            {sealedBatches.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
                  <Archive className="w-4 h-4" />已封存批次
                </h2>
                {sealedBatches.map((b) => {
                  const list = scenesOf.get(b.id) ?? []
                  return (
                    <SealedBatchRow
                      key={b.id}
                      batch={b}
                      effective={countEffective(list)}
                      total={list.length}
                      onUnseal={() => {
                        try {
                          unsealBatch(b.id)
                        } catch (e) {
                          setFormError(e instanceof Error ? e.message : '撤回失败')
                        }
                      }}
                    />
                  )
                })}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- 建立批次 ---------------- */

function CreateBatchForm({
  knownRoutes, openBatches, onSubmit, formError,
}: {
  knownRoutes: string[]
  openBatches: SketchBatch[]
  onSubmit: (data: BatchFormData) => void
  formError: string
}) {
  const [routeName, setRouteName] = useState('')
  const [targetCount, setTargetCount] = useState(10)
  const [deadline, setDeadline] = useState(defaultDeadline())
  const [localError, setLocalError] = useState('')

  const openRouteSet = new Set(openBatches.map((b) => b.routeName))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate({ routeName, targetCount, deadline })
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError('')
    onSubmit({ routeName: routeName.trim(), targetCount, deadline })
  }

  const error = localError || formError

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-teal-800 bg-teal-900/40 p-4">
      <h2 className="text-dusk-400 font-serif text-lg flex items-center gap-2">
        <Target className="w-4 h-4" />建立采风批次
      </h2>
      <p className="text-xs text-mist-400 -mt-2">
        先选一条线路建立批次；记录只能归入同线路的开放批次。每条线路同时只有一个开放批次。
      </p>

      <div>
        <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
          <Bus className="w-3 h-3" />线路
        </label>
        <input
          list="known-routes"
          className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
          value={routeName}
          onChange={(e) => setRouteName(e.target.value)}
          placeholder="如：118 路"
          required
        />
        <datalist id="known-routes">
          {knownRoutes.map((r) => (
            <option key={r} value={r} disabled={openRouteSet.has(r)} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
            <ListChecks className="w-3 h-3" />目标条数
          </label>
          <input
            type="number"
            min={1}
            className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />截止时间
          </label>
          <input
            type="datetime-local"
            className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 [color-scheme:dark]"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1.5 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5" />{error}
        </p>
      )}

      <button
        type="submit"
        className="w-full py-3 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
      >
        <Send className="w-4 h-4" />建立批次并开始采风
      </button>
    </form>
  )
}

function validate(data: { routeName: string; targetCount: number; deadline: string }): string {
  if (!data.routeName.trim()) return '请填写线路名称'
  if (!Number.isFinite(data.targetCount) || data.targetCount < 1) return '目标条数至少为 1 条'
  if (!data.deadline) return '请设置截止时间'
  if (new Date(data.deadline).getTime() <= Date.now()) return '截止时间需晚于当前时间'
  return ''
}

/* ---------------- 开放批次行 ---------------- */

function OpenBatchRow({
  batch, count, pending, now, onEnter,
}: {
  batch: SketchBatch
  count: number
  pending: number
  now: Date
  onEnter: () => void
}) {
  const expired = isExpired(batch.deadline, now)
  return (
    <button
      onClick={onEnter}
      className="w-full text-left rounded-2xl border border-teal-800 bg-teal-900/40 p-4 hover:border-dusk-400/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-mist-100 font-medium">
          <Bus className="w-4 h-4 text-dusk-400" />{batch.routeName}
        </span>
        <span className={`text-xs ${expired ? 'text-red-300' : 'text-mist-400'}`}>
          {formatDeadlineRemaining(batch.deadline, now)}
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={count} target={batch.targetCount} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-mist-500">
        <span>{count}/{batch.targetCount} 条有效</span>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-300">
            <AlertTriangle className="w-3 h-3" />{pending} 条待复核
          </span>
        )}
      </div>
    </button>
  )
}

/* ---------------- 已封存批次行 ---------------- */

function SealedBatchRow({
  batch, effective, total, onUnseal,
}: {
  batch: SketchBatch
  effective: number
  total: number
  onUnseal: () => void
}) {
  return (
    <div className="rounded-2xl border border-teal-800/70 bg-teal-900/25 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-mist-200 font-medium">
          <Lock className="w-3.5 h-3.5 text-mist-400" />{batch.routeName}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {batch.sealedAt ? formatDate(batch.sealedAt) : ''} 封存
        </span>
      </div>
      <p className="mt-2 text-xs text-mist-400">
        目标 {batch.targetCount} 条 · 有效 {effective} 条 · 共 {total} 条记录
      </p>
      <button
        onClick={onUnseal}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-teal-700 px-3 py-1.5 text-xs text-mist-300 hover:border-dusk-400/50 hover:text-dusk-300 transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />撤回封存以补录
      </button>
    </div>
  )
}

/* ---------------- 批次工作台 ---------------- */

type ListFilter = 'all' | 'pending'

function BatchWorkspace({
  batch, batchScenes, now, onBack, onSubmit, onSeal,
}: {
  batch: SketchBatch
  batchScenes: WindowScene[]
  now: Date
  onBack: () => void
  onSubmit: (data: SceneFormData) => void
  onSeal: () => void
}) {
  const [form, setForm] = useState<SceneFormData>(initialForm)
  const [filter, setFilter] = useState<ListFilter>('all')
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const effective = countEffective(batchScenes)
  const pending = countPendingReview(batchScenes)
  const empty = countEmptyNote(batchScenes)
  const sealable = canSeal(batch, batchScenes)
  const expired = isExpired(batch.deadline, now)

  const shown = filter === 'pending' ? batchScenes.filter((s) => s.needsReview) : batchScenes

  const update = <K extends keyof SceneFormData>(key: K, val: SceneFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.segment.trim()) {
      setError('请填写区间')
      return
    }
    onSubmit({ ...form, segment: form.segment.trim(), signText: form.signText.trim() })
    setForm(initialForm)
    setError('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1400)
  }

  const sealHint =
    pending > 0
      ? `还有 ${pending} 条待复核记录，处理后才能封存`
      : effective < batch.targetCount
        ? `有效记录 ${effective}/${batch.targetCount}，达标后可封存（空笔记或待复核不计入）`
        : ''

  return (
    <div className="space-y-6">
      {/* 批次状态卡 */}
      <section className="rounded-2xl border border-dusk-400/25 bg-dusk-400/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs text-mist-400 hover:text-mist-200 mb-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />批次列表
            </button>
            <h2 className="font-serif text-xl text-mist-100 flex items-center gap-2">
              <Bus className="w-5 h-5 text-dusk-400" />{batch.routeName}
            </h2>
            <p className="mt-0.5 text-[11px] text-mist-500">
              建于 {formatTimestamp(batch.createdAt)} · 截止 {formatTimestamp(batch.deadline)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] ${
              expired ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {formatDeadlineRemaining(batch.deadline, now)}
          </span>
        </div>
        <ProgressBar value={effective} target={batch.targetCount} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mist-400">
          <span className="inline-flex items-center gap-1">
            <Target className="w-3 h-3" />目标 {batch.targetCount} 条
          </span>
          {pending > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <AlertTriangle className="w-3 h-3" />待复核 {pending}
            </span>
          )}
          {empty > 0 && (
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />空笔记 {empty}
            </span>
          )}
        </div>
      </section>

      {/* 记录表单 */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl bg-teal-900/40 border border-teal-800 p-3 text-xs text-mist-300 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-dusk-400" />
          本记录将归入 <span className="text-dusk-300 font-medium">{batch.routeName}</span> 的当前开放批次
        </div>

        <section className="space-y-3">
          <h3 className="text-dusk-400 font-serif text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />窗景信息
          </h3>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" />区间
            </label>
            <input
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              value={form.segment}
              onChange={(e) => update('segment', e.target.value)}
              placeholder="如：人民广场 — 南京东路"
              required
            />
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Armchair className="w-3 h-3" />座位方向
            </label>
            <div className="flex gap-2">
              {(['左', '右'] as SeatDirection[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => update('seatDirection', d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                    form.seatDirection === d
                      ? 'bg-dusk-400/20 text-dusk-400 border border-dusk-400'
                      : 'bg-teal-850 text-mist-300 border border-transparent'
                  }`}
                >
                  {d}侧
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 block">天气</label>
            <div className="grid grid-cols-4 gap-2">
              {WEATHERS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => update('weather', w)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs transition ${
                    form.weather === w
                      ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400'
                      : 'bg-teal-850 border border-transparent text-mist-300'
                  }`}
                >
                  {getWeatherIcon(w)}{w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Signpost className="w-3 h-3" />招牌文字
            </label>
            <input
              className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400"
              value={form.signText}
              onChange={(e) => update('signText', e.target.value)}
            />
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <TreePine className="w-3 h-3" />树木密度
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TREES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update('treeDensity', t)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${
                    form.treeDensity === t
                      ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400'
                      : 'bg-teal-850 border border-transparent text-mist-300'
                  }`}
                >
                  {getTreeIcon(t)}{t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-mist-300 text-xs mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" />行人状态
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PEDESTRIANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => update('pedestrianStatus', p)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs transition ${
                    form.pedestrianStatus === p
                      ? 'bg-dusk-400/20 border border-dusk-400 text-dusk-400'
                      : 'bg-teal-850 border border-transparent text-mist-300'
                  }`}
                >
                  {getPedestrianIcon(p)}{p}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-dusk-400 font-serif text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />观察笔记
          </h3>
          <textarea
            className="w-full bg-teal-850 text-mist-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-dusk-400 resize-none h-24"
            value={form.note}
            onChange={(e) => update('note', e.target.value)}
            placeholder="留空则不计入有效进度"
          />
          <button
            type="button"
            onClick={() => update('needsReview', !form.needsReview)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
              form.needsReview
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-teal-850 text-mist-400 border border-transparent hover:text-mist-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {form.needsReview ? '将标记为待复核' : '标记待复核'}
          </button>
        </section>

        <div className="flex items-center gap-2 text-mist-400 text-xs">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(now.toISOString())}</span>
        </div>

        {error && (
          <p className="inline-flex items-center gap-1.5 text-xs text-red-300">
            <AlertTriangle className="w-3.5 h-3.5" />{error}
          </p>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-dusk-400 text-teal-950 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition relative"
        >
          <Send className="w-4 h-4" />保存记录
          {savedFlash && (
            <span className="absolute inset-0 rounded-xl bg-emerald-500/90 text-teal-950 flex items-center justify-center gap-1.5 font-medium animate-scale-in">
              <CheckCircle2 className="w-4 h-4" />已归入批次
            </span>
          )}
        </button>
      </form>

      {/* 本批次记录 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-dusk-400 font-serif text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4" />本批次记录（{batchScenes.length}）
          </h3>
          <div className="flex gap-1.5">
            {(['all', 'pending'] as ListFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  filter === f
                    ? 'bg-dusk-400 text-teal-950'
                    : 'bg-teal-850 text-mist-400 hover:text-mist-200'
                }`}
              >
                {f === 'all' ? `全部 ${batchScenes.length}` : `待复核 ${pending}`}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-dashed border-teal-800 py-8 text-center text-xs text-mist-500">
            {filter === 'pending' ? '没有待复核记录' : '还没有记录，先在上方保存第一条'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {shown.map((s) => (
              <SceneCard key={s.id} scene={s} editable />
            ))}
          </div>
        )}
      </section>

      {/* 封存 */}
      <section className="rounded-2xl border border-teal-800 bg-teal-900/40 p-4 space-y-3">
        <h3 className="font-serif text-base text-mist-100 flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-dusk-400" />封存批次
        </h3>
        <p className="text-xs text-mist-400">
          封存后该批次进入时间线与随机灵感；后续补录须先撤回封存，原记录不会删除。
        </p>
        {sealHint && (
          <p className="inline-flex items-center gap-1.5 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />{sealHint}
          </p>
        )}
        <button
          onClick={() => {
            try {
              onSeal()
            } catch (e) {
              setError(e instanceof Error ? e.message : '封存失败')
            }
          }}
          disabled={!sealable}
          className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${
            sealable
              ? 'bg-emerald-500 text-teal-950 active:scale-[0.98]'
              : 'bg-teal-850 text-mist-500 cursor-not-allowed'
          }`}
        >
          <Lock className="w-4 h-4" />达标封存
        </button>
      </section>
    </div>
  )
}
