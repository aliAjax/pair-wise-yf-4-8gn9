import { useEffect, useMemo, useState } from 'react'
import {
  Search, Route, Lock, Inbox, PackageCheck, ListChecks,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { countEffective, formatDate, sortBatchesDesc } from '@/utils/batchHelpers'
import SceneCard from '@/components/SceneCard'

export default function TimelinePage() {
  const { scenes, batches, loadAll } = useSceneStore()
  const [search, setSearch] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')

  useEffect(() => {
    loadAll()
  }, [loadAll])

  /** 时间线只读取已封存批次 */
  const sealedBatches = useMemo(
    () => batches.filter((b) => b.status === 'sealed').sort(sortBatchesDesc),
    [batches],
  )

  /** 未归批次的旧记录继续可见（不进入开放批次的记录，即 batchId === null） */
  const unassigned = useMemo(
    () =>
      scenes
        .filter((s) => s.batchId === null)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [scenes],
  )

  const routeNames = useMemo(() => {
    const set = new Set<string>()
    sealedBatches.forEach((b) => set.add(b.routeName))
    if (unassigned.length > 0) set.add('未归批次的旧记录')
    return Array.from(set).sort()
  }, [sealedBatches, unassigned])

  const filteredRoutes = routeNames.filter((r) =>
    r.toLowerCase().includes(search.toLowerCase()),
  )

  const visibleBatches =
    selectedRoute && selectedRoute !== '未归批次的旧记录'
      ? sealedBatches.filter((b) => b.routeName === selectedRoute)
      : selectedRoute === '未归批次的旧记录'
        ? []
        : sealedBatches

  const visibleUnassigned =
    !selectedRoute || selectedRoute === '未归批次的旧记录' ? unassigned : []

  const scenesByBatch = useMemo(() => {
    const map = new Map<string, typeof scenes>()
    for (const b of sealedBatches) {
      map.set(
        b.id,
        scenes
          .filter((s) => s.batchId === b.id)
          .sort((a, c) => new Date(c.timestamp).getTime() - new Date(a.timestamp).getTime()),
      )
    }
    return map
  }, [scenes, sealedBatches])

  // 进度概览（仅统计已封存批次）
  const totalSealedScenes = sealedBatches.reduce(
    (sum, b) => sum + countEffective(scenesByBatch.get(b.id) ?? []),
    0,
  )

  const isEmpty = sealedBatches.length === 0 && unassigned.length === 0

  return (
    <div className="min-h-screen bg-teal-950 font-serif text-mist-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold tracking-wide text-dusk-400">窗景时间线</h1>
        <p className="mb-6 text-xs text-mist-500">仅收录已封存的采风批次；未归批次的旧记录保留在末尾。</p>

        {!isEmpty && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatCard
              icon={<PackageCheck className="w-4 h-4" />}
              label="已封存批次"
              value={sealedBatches.length}
            />
            <StatCard
              icon={<ListChecks className="w-4 h-4" />}
              label="有效记录"
              value={totalSealedScenes}
            />
            <StatCard
              icon={<Inbox className="w-4 h-4" />}
              label="未归旧记录"
              value={unassigned.length}
            />
          </div>
        )}

        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-mist-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索线路..."
              className="w-full rounded-lg border border-teal-800 bg-teal-900/60 py-2.5 pl-10 pr-4 text-sm text-mist-100 placeholder:text-mist-500 focus:border-dusk-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedRoute('')}
              className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                !selectedRoute
                  ? 'bg-dusk-400 text-teal-950'
                  : 'bg-teal-900 text-mist-300 hover:bg-teal-800'
              }`}
            >
              全部
            </button>
            {filteredRoutes.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedRoute(name)}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                  selectedRoute === name
                    ? 'bg-dusk-400 text-teal-950'
                    : 'bg-teal-900 text-mist-300 hover:bg-teal-800'
                }`}
              >
                {name === '未归批次的旧记录' ? (
                  <Inbox className="mr-1 inline w-3 h-3" />
                ) : (
                  <Route className="mr-1 inline w-3 h-3" />
                )}
                {name}
              </button>
            ))}
          </div>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-mist-400">
            <div className="mb-4 text-6xl opacity-30">🪟</div>
            <p className="text-lg">还没有任何窗景记录</p>
            <p className="text-sm mt-1">去「记录」页建立第一个采风批次</p>
          </div>
        ) : (
          <div className="space-y-10">
            {visibleBatches.map((batch) => {
              const list = scenesByBatch.get(batch.id) ?? []
              const effective = countEffective(list)
              return (
                <section key={batch.id}>
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-teal-800 bg-teal-900/50 px-4 py-3">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-base font-semibold text-mist-100">{batch.routeName}</span>
                    <span className="text-xs text-mist-400">
                      目标 {batch.targetCount} 条 · 有效 {effective} 条 · 共 {list.length} 条
                    </span>
                    <span className="ml-auto text-[11px] text-mist-500">
                      建于 {formatDate(batch.createdAt)} · {batch.sealedAt ? formatDate(batch.sealedAt) : ''}封存
                    </span>
                  </div>
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-teal-800" />
                    <div className="space-y-3">
                      {list.map((scene) => (
                        <div key={scene.id} className="relative">
                          <div className="absolute -left-[1.35rem] top-4 h-2.5 w-2.5 rounded-full bg-dusk-400 ring-4 ring-teal-950" />
                          <SceneCard scene={scene} />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )
            })}

            {visibleUnassigned.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-teal-800/70 bg-teal-900/30 px-4 py-3">
                  <Inbox className="w-4 h-4 text-mist-400" />
                  <span className="text-base font-semibold text-mist-200">未归批次的旧记录</span>
                  <span className="text-xs text-mist-500">{visibleUnassigned.length} 条 · 继续可见，但不计入采风进度</span>
                </div>
                <div className="relative pl-8">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-teal-800" />
                  <div className="space-y-3">
                    {visibleUnassigned.map((scene) => (
                      <div key={scene.id} className="relative">
                        <div className="absolute -left-[1.35rem] top-4 h-2.5 w-2.5 rounded-full bg-mist-500 ring-4 ring-teal-950" />
                        <SceneCard scene={scene} />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-teal-800 bg-teal-900/40 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-mist-400">
        <span className="text-dusk-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-mist-100">{value}</p>
    </div>
  )
}
