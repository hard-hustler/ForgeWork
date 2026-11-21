import React from 'react';
import {
  Volume2,
  VolumeX,
  HelpCircle,
  Layers,
  Save,
  Cpu,
  Footprints,
  Orbit,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useFactoryStore } from '../state/useFactoryStore';
import { HeatmapMode, SimSpeed } from '../types/factory';

const SPEEDS: Array<{ val: SimSpeed; label: string }> = [
  { val: 0, label: 'Pause' },
  { val: 1, label: '1x' },
  { val: 2, label: '2x' },
  { val: 5, label: '5x' },
  { val: 20, label: '20x' },
];

export const TopBar: React.FC = () => {
  const metrics = useFactoryStore((s) => s.metrics);
  const speed = useFactoryStore((s) => s.speed);
  const cameraMode = useFactoryStore((s) => s.cameraMode);
  const heatmapMode = useFactoryStore((s) => s.heatmapMode);
  const audioMuted = useFactoryStore((s) => s.audioMuted);
  const perfStats = useFactoryStore((s) => s.perfStats);
  const entities = useFactoryStore((s) => s.entities);

  const setSpeed = useFactoryStore((s) => s.setSpeed);
  const setCameraMode = useFactoryStore((s) => s.setCameraMode);
  const setHeatmapMode = useFactoryStore((s) => s.setHeatmapMode);
  const setActiveModal = useFactoryStore((s) => s.setActiveModal);
  const toggleAudioMute = useFactoryStore((s) => s.toggleAudioMute);
  const setDayTime = useFactoryStore((s) => s.setDayTime);

  const hour = Math.floor(metrics.dayTime * 24);
  const min = Math.floor((metrics.dayTime * 24 - hour) * 60);
  const clockStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const isNight = Math.sin(metrics.dayTime * Math.PI * 2 - Math.PI / 2) < 0.16;
  const powerOk = metrics.powerSupplyKW >= metrics.powerDemandKW;

  return (
    <>
      <header
        className="fixed top-2.5 left-2.5 right-2.5 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#111720]/95 border border-[#2a3648] shadow-xl"
        aria-label="Factory Telemetry and Controls"
      >
        {/* Zone 1: Brand & Core Telemetry */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-bold tracking-[0.12em] text-lg text-[#f8fafc] whitespace-nowrap shrink-0 pr-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            FORGEWORKS
          </span>

          <div className="flex items-center gap-3 text-xs border-l border-[#2a3648] pl-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#7c90ac] leading-tight">
                Funds
              </span>
              <span
                className="font-mono font-semibold text-[#10b981] tabular-nums"
                data-testid="metric-money"
              >
                ${metrics.money.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col border-l border-[#2a3648] pl-3">
              <span className="text-[10px] text-[#7c90ac] leading-tight">
                Research
              </span>
              <span
                className="font-mono font-semibold text-[#38bdf8] tabular-nums"
                data-testid="metric-rp"
              >
                {metrics.researchPoints} RP
              </span>
            </div>

            <div className="flex flex-col border-l border-[#2a3648] pl-3">
              <span className="text-[10px] text-[#7c90ac] leading-tight">
                Power Grid
              </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  powerOk ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                }`}
                data-testid="metric-power"
              >
                {metrics.powerDemandKW}/{metrics.powerSupplyKW} kW
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 border-l border-[#2a3648] pl-3">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#7c90ac] leading-tight">
                  Cycle
                </span>
                <span className="font-mono font-semibold text-[#e2e8f0] tabular-nums">
                  {clockStr}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDayTime(isNight ? 0.36 : 0.92)}
                className="p-1.5 rounded bg-[#1b2432] hover:bg-[#253145] border border-[#2e3c52] text-[#cbd5e1] cursor-pointer transition-colors"
                aria-label={isNight ? 'Switch to Daytime' : 'Switch to Nighttime'}
                title={isNight ? 'Jump to Day' : 'Jump to Night (Factory Lamps)'}
              >
                {isNight ? <Moon size={13} /> : <Sun size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Zone 2: Speed & View Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className="flex items-center bg-[#0d1219] p-0.5 rounded-md border border-[#263244]"
            role="group"
            aria-label="Simulation Speed"
          >
            {SPEEDS.map((s) => (
              <button
                key={s.val}
                type="button"
                onClick={() => setSpeed(s.val)}
                className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  speed === s.val
                    ? 'bg-[#f59e0b] text-[#0c1016] font-semibold'
                    : 'text-[#9fb0c7] hover:text-white hover:bg-[#1b2432]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="heatmap-select">
            Floor Heatmap Overlay
          </label>
          <select
            id="heatmap-select"
            aria-label="Floor Heatmap Overlay"
            value={heatmapMode}
            onChange={(e) => setHeatmapMode(e.target.value as HeatmapMode)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043] cursor-pointer"
          >
            <option value="none">Heatmap: Off</option>
            <option value="congestion">Heatmap: Congestion</option>
            <option value="power">Heatmap: Power</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setCameraMode(cameraMode === 'orbit' ? 'fps' : 'orbit')
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              cameraMode === 'fps'
                ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#fbbf24]'
                : 'bg-[#1b2432] border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043]'
            }`}
          >
            {cameraMode === 'fps' ? <Orbit size={13} /> : <Footprints size={13} />}
            <span>{cameraMode === 'fps' ? 'Orbit (F)' : 'Walk (F)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('tech')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Sparkles size={13} className="text-[#f59e0b]" />
            <span>Tech Tree</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('blueprints')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Layers size={13} />
            <span>Blueprints</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('saveLoad')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Save size={13} />
            <span>Save</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('architecture')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#e2e8f0] hover:bg-[#243043] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Cpu size={13} />
            <span>Architecture</span>
          </button>

          <button
            type="button"
            onClick={toggleAudioMute}
            className="p-1.5 rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#cbd5e1] hover:bg-[#243043] cursor-pointer transition-colors"
            aria-label={audioMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('help')}
            className="p-1.5 rounded-md bg-[#1b2432] border border-[#2e3c52] text-[#cbd5e1] hover:bg-[#243043] cursor-pointer transition-colors"
            aria-label="Keyboard Shortcuts and Help"
            title="Shortcuts (?)"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </header>

      {/* Performance Overlay: FPS / Draw Calls / Entities / Instanced Belt Items */}
      <div
        className="fixed top-[62px] left-2.5 z-10 flex items-center gap-3 px-3 py-1.5 rounded-md bg-[#111720]/90 border border-[#263244] font-mono text-[11px] text-[#9fb0c7] tabular-nums"
        data-testid="perf-overlay"
      >
        <span>
          FPS{' '}
          <strong
            className={
              perfStats.fps >= 45 ? 'text-[#10b981]' : 'text-[#f59e0b]'
            }
          >
            {perfStats.fps}
          </strong>
        </span>
        <span aria-hidden="true" className="text-[#3b4b63]">
          /
        </span>
        <span>Calls {perfStats.drawCalls}</span>
        <span aria-hidden="true" className="text-[#3b4b63]">
          /
        </span>
        <span>Entities {entities.length}</span>
        <span aria-hidden="true" className="text-[#3b4b63]">
          /
        </span>
        <span>Items {metrics.activeItemCount}</span>
      </div>
    </>
  );
};
