import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../services/api';
import type { BacktestConfig } from '../types/api';

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
};

export function ControlTower() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['systemStatus'],
    queryFn: api.getSystemStatus,
    refetchInterval: 30000, // Poll every 30s
  });

  const launchMutation = useMutation({
    mutationFn: (newConfig: BacktestConfig) => api.launchBacktest(newConfig),
    onSuccess: (data) => {
      if (data.job_id) {
        navigate({ to: '/backtests/jobs/$jobId', params: { jobId: data.job_id } });
      }
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
    <div className="animate-fade-in grid gap-8 md:grid-cols-2">
      <div className="glass-panel">
        <h2 className="text-gold text-2xl mb-6">System Status</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400">Rust Core</span>
            {statusLoading ? (
              <span className="text-gray-500 font-medium px-2 py-1 bg-gray-500/10 rounded">Checking</span>
            ) : status ? (
              <span className="text-emerald-500 font-medium px-2 py-1 bg-emerald-500/10 rounded">v{status.rust_core_version}</span>
            ) : (
              <span className="text-rose-500 font-medium px-2 py-1 bg-rose-500/10 rounded">Offline</span>
            )}
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400">SIMD Enabled</span>
            <span className={`font-medium px-2 py-1 rounded ${status?.rust_simd_enabled ? 'text-emerald-500 bg-emerald-500/10' : 'text-gray-500 bg-gray-500/10'}`}>
              {status?.rust_simd_enabled ? 'True' : 'False'}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400">Active Agents</span>
            <span className="text-[var(--color-gold-accent)] font-bold">{status?.active_agents || 0}</span>
          </div>
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <span className="text-gray-400">LLM Latency</span>
            <span className="text-blue-400 font-mono">{status?.llm_api_latency_ms || 0} ms</span>
          </div>
          <div className="flex justify-between items-center pb-2">
            <span className="text-gray-400">DB Size</span>
            <span className="text-blue-400 font-mono">{status?.database_size_mb || 0} MB</span>
          </div>
        </div>
      </div>
      
      <div className="glass-panel">
        <h2 className="text-gold text-2xl mb-6">Launch Backtest</h2>
        <div className="flex gap-2 mb-6">
          <button type="button" onClick={() => handlePreset('bull')} className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors text-sm">Bull Preset</button>
          <button type="button" onClick={() => handlePreset('bear')} className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded hover:bg-rose-500/30 transition-colors text-sm">Bear Preset</button>
          <button type="button" onClick={() => handlePreset('sideways')} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm">Sideways Preset</button>
        </div>
        
        <form onSubmit={handleLaunch} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm text-gray-300">
            Initial Capital (USD)
            <input 
              type="number" 
              value={config.initial_capital}
              onChange={e => setConfig({ ...config, initial_capital: Number(e.target.value) })}
              className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white p-3 rounded-lg focus:border-[var(--color-gold-accent)] focus:ring-1 focus:ring-[var(--color-gold-accent)] outline-none transition-all"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              Start Date
              <input type="date" value={config.start_date} onChange={e => setConfig({ ...config, start_date: e.target.value })} className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white p-3 rounded-lg focus:border-[var(--color-gold-accent)] outline-none" />
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-300">
              End Date
              <input type="date" value={config.end_date} onChange={e => setConfig({ ...config, end_date: e.target.value })} className="bg-[var(--color-dark-bg)] border border-[var(--color-dark-border)] text-white p-3 rounded-lg focus:border-[var(--color-gold-accent)] outline-none" />
            </label>
          </div>
          
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-sm text-gray-300">Configuration Flags</span>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'fixed_universe_enabled', label: 'Fixed Universe' },
                { key: 'dual_portfolio_enabled', label: 'Dual Portfolio' },
                { key: 'regime_continuous_enabled', label: 'Regime Continuous' },
                { key: 'position_rotation_enabled', label: 'Position Rotation' },
                { key: 'disable_ai_exits', label: 'Disable AI Exits' },
                { key: 'mock_critic', label: 'Mock Critic' },
              ].map(flag => {
                const isActive = config[flag.key as keyof BacktestConfig];
                return (
                  <button
                    key={flag.key}
                    type="button"
                    onClick={() => toggleFlag(flag.key as keyof BacktestConfig)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${isActive ? 'bg-[var(--color-gold-accent)]/20 text-[var(--color-gold-accent)] border-[var(--color-gold-accent)]/50' : 'bg-transparent text-gray-400 border-gray-600 hover:border-gray-400'}`}
                  >
                    {flag.label}
                  </button>
                )
              })}
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={launchMutation.isPending}
            className="mt-4 btn-gold disabled:opacity-50"
          >
            {launchMutation.isPending ? 'Launching...' : 'Execute Backtest'}
          </button>
        </form>
      </div>
    </div>
  );
}
