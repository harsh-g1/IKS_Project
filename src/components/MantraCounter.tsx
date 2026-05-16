import React from 'react';
import './MantraCounter.css';

interface MantraCounterProps {
  currentCount: number;
  targetCount: number;
  isInSync: boolean;
  syncPercentage: number;
}

export const MantraCounter: React.FC<MantraCounterProps> = ({
  currentCount,
  targetCount,
  isInSync,
  syncPercentage,
}) => {
  const progress = (currentCount / targetCount) * 100;
  const completed = currentCount >= targetCount;

  return (
    <div className="mantra-counter">
      <div className="counter-display">
        <div className="counter-number">
          <span className="current">{currentCount}</span>
          <span className="separator">/</span>
          <span className="target">{targetCount}</span>
        </div>
        <div className="counter-label">Mantras</div>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="sync-info">
        <div className={`sync-status ${isInSync ? 'in-sync' : 'out-of-sync'}`}>
          <span className="status-dot"></span>
          {isInSync ? 'In Sync' : 'Out of Sync'}
        </div>
        <div className="sync-percentage">{syncPercentage}% sync</div>
      </div>

      {completed && (
        <div className="completion-message">
          🎉 Fantastic! Session Complete!
        </div>
      )}
    </div>
  );
};
