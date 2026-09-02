import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../services/api';
import type { BacktestConfig } from '../types/api';
import { GlassCard } from '../components/GlassCard';
import { FlagChip } from '../components/FlagChip';

const DEFAULT_CONFIG: BacktestConfig = {
  initial_capital: 10000,
  transaction_fee: 0.0026,
  slippage_pct: 0.001,
  max_positions: 15,
  max_position_pct: 0.2,
  target_decisions: 130,
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  enable_short_selling: false,
  enable_compounding: false,
  enable_trailing_stops: true,
  disable_ai_exits: true,
  pattern_analysis_enabled: true,
  risk_assessment_enabled: true,
  sentiment_analysis_enabled: false,
  correlation_analysis_enabled: true,
  fixed_universe_enabled: true,
  dual_portfolio_enabled: true,
  regime_continuous_enabled: true,
  position_rotation_enabled: true,
  mock_critic: false,
  anti_averaging_down_enabled: true,
  critic_sideways_asset_aware_enabled: false,
  vol_trail_enabled: false,
  vol_trail_multiplier: 1.0,
  vol_trail_floor: 0.02,
  vol_trail_ceiling: 0.15,
};

const FLAG_DEFINITIONS = [
  { key: 'fixed_universe_enabled' as const, label: 'Fixed Universe' },
  { key: 'dual_portfolio_enabled' as const, label: 'Dual Portfolio' },
  { key: 'regime_continuous_enabled' as const, label: 'Regime Continuous' },
  { key: 'position_rotation_enabled' as const, label: 'Position Rotation' },
  { key: 'disable_ai_exits' as const, label: 'Disable AI Exits' },
  { key: 'mock_critic' as const, label: 'Mock Critic' },
  { key: 'anti_averaging_down_enabled' as const, label: 'Anti Avg Down' },
  { key: 'critic_sideways_asset_aware_enabled' as const, label: 'Critic Sideways Asset-Aware' },
  { key: 'vol_trail_enabled' as const, label: 'Vol Trail' },
];

export function ControlTower() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: api.getSystemStatus,
    refetchInterval: 30000,
  });

  const launchMutation = useMutation({
    mutationFn: (newConfig: BacktestConfig) => api.launchBacktest(newConfig),
    onSuccess: () => {
      navigate({ to: '/backtests/live' });
    },
  });

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    launchMutation.mutate(config);
  };

  const handlePreset = (type: 'bull' | 'bear' | 'sideways') => {
    switch (type) {
      case 'bull':
        setConfig({ ...config, start_date: '2023-01-01', end_date: '2024-01-01' });
        break;
      case 'bear':
        setConfig({ ...config, start_date: '2022-01-01', end_date: '2023-01-01' });
        break;
      case 'sideways':
        setConfig({ ...config, start_date: '2023-06-01', end_date: '2023-10-01' });
        break;
    }
  };

  const toggleFlag = (key: keyof BacktestConfig) => {
    setConfig({ ...config, [key]: !config[key] });
  };

  return (
    <div className="animate-fade-in grid gap-4 lg:grid-cols-2">
      <GlassCard>
        <h2 className="page-title mb-5">System Status</h2>
        <div className="flex flex-col gap-3">
          {[
            {
              label: 'Rust Core',
              content: statusLoading ? (
                <span className="badge bg-white/5 text-[var(--color-text-muted)]">Checking</span>
              ) : status ? (
                <span className="badge bg-[var(--color-green-muted)] text-positive">v{status.rust_core_version}</span>
              ) : (
                <span className="badge bg-[var(--color-red-muted)] text-negative">Offline</span>
              ),
            },
            {
              label: 'SIMD Enabled',
              content: (
                <span className={`badge ${status?.rust_simd_enabled ? 'bg-[var(--color-green-muted)] text-positive' : 'bg-white/5 text-[var(--color-text-muted)]'}`}>
                  {status?.rust_simd_enabled ? 'True' : 'False'}
                </span>
              ),
            },
            { label: 'Active Agents', content: <span className="font-mono text-[var(--color-gold-accent)] font-bold">{status?.active_agents || 0}</span> },
            { label: 'LLM Latency', content: <span className="font-mono text-[var(--color-blue)]">{status?.llm_api_latency_ms || 0} ms</span> },
            { label: 'DB Size', content: <span className="font-mono text-[var(--color-blue)]">{status?.database_size_mb || 0} MB</span> },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center py-2 border-b border-[var(--color-border)] last:border-0">
              <span className="text-[var(--color-text-secondary)] text-sm">{row.label}</span>
              {row.content}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard>
        <h2 className="page-title mb-5">Launch Backtest</h2>
        <div className="flex gap-2 mb-5">
          <button type="button" onClick={() => handlePreset('bull')} className="btn btn-success text-xs">Bull Preset</button>
          <button type="button" onClick={() => handlePreset('bear')} className="btn btn-danger text-xs">Bear Preset</button>
          <button type="button" onClick={() => handlePreset('sideways')} className="btn btn-ghost text-xs">Sideways Preset</button>
        </div>

        <form onSubmit={handleLaunch} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
            Initial Capital (USD)
            <input
              type="number"
              value={config.initial_capital}
              onChange={e => setConfig({ ...config, initial_capital: Number(e.target.value) })}
              className="input"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              Start Date
              <input type="date" value={config.start_date} onChange={e => setConfig({ ...config, start_date: e.target.value })} className="input" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
              End Date
              <input type="date" value={config.end_date} onChange={e => setConfig({ ...config, end_date: e.target.value })} className="input" />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="section-title">Configuration Flags</span>
            <div className="flex flex-wrap gap-2">
              {FLAG_DEFINITIONS.map(flag => (
                <FlagChip
                  key={flag.key}
                  label={flag.label}
                  active={!!config[flag.key]}
                  onClick={() => toggleFlag(flag.key)}
                />
              ))}
            </div>
          </div>

          {/* Vol Trail Parameters */}
          {config.vol_trail_enabled && (
            <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--color-bg-hover)] rounded-lg border border-[var(--color-border)]">
              <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
                Multiplier
                <input type="number" step="0.1" value={config.vol_trail_multiplier} onChange={e => setConfig({ ...config, vol_trail_multiplier: Number(e.target.value) })} className="input text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
                Floor (min %)
                <input type="number" step="0.01" value={config.vol_trail_floor} onChange={e => setConfig({ ...config, vol_trail_floor: Number(e.target.value) })} className="input text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
                Ceiling (max %)
                <input type="number" step="0.01" value={config.vol_trail_ceiling} onChange={e => setConfig({ ...config, vol_trail_ceiling: Number(e.target.value) })} className="input text-xs" />
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={launchMutation.isPending}
            className="btn btn-primary mt-2"
          >
            {launchMutation.isPending ? 'Launching…' : 'Execute Backtest'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
