import React from 'react';
import './SessionStats.css';

interface SessionStatsProps {
  syncPercentage: number;
  averageBPM: number;
  completedMantras: number;
  targetMantras: number;
  sessionDuration: number; // in seconds
}

export const SessionStats: React.FC<SessionStatsProps> = ({
  syncPercentage,
  averageBPM,
  completedMantras,
  targetMantras,
  sessionDuration,
}) => {
  const minutes = Math.floor(sessionDuration / 60);
  const seconds = sessionDuration % 60;

  const getSyncQuality = (percentage: number) => {
    if (percentage >= 80) return { label: 'Excellent', color: '#4ade80' };
    if (percentage >= 60) return { label: 'Good', color: '#fbbf24' };
    if (percentage >= 40) return { label: 'Fair', color: '#f97316' };
    return { label: 'Needs Work', color: '#f87171' };
  };

  const quality = getSyncQuality(syncPercentage);

  return (
    <div className="session-stats">
      <h2 className="stats-title">Session Summary</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Sync Score</div>
          <div className="stat-value" style={{ color: quality.color }}>
            {syncPercentage}%
          </div>
          <div className="stat-quality">{quality.label}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Average Heart Rate</div>
          <div className="stat-value">{averageBPM.toFixed(1)}</div>
          <div className="stat-target">Healthy Range: 60-100 BPM</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Mantras Completed</div>
          <div className="stat-value">
            {completedMantras}/{targetMantras}
          </div>
          <div className="stat-detail">
            {completedMantras === targetMantras
              ? 'Full session!'
              : `${targetMantras - completedMantras} remaining`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Session Duration</div>
          <div className="stat-value">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          <div className="stat-detail">minutes</div>
        </div>
      </div>

      <div className="stats-insights">
        <h3>Insights</h3>
        <ul className="insights-list">
          <li>
            ✓ Keep practicing to improve your sync score and heart rate
            variability
          </li>
          <li>
            ✓ Focus on maintaining steady, deep breaths at 6 breaths per minute
          </li>
          <li>
            ✓ Regular practice helps synchronize your nervous system with your
            breathing
          </li>
        </ul>
      </div>
    </div>
  );
};
