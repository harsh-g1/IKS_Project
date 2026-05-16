import React, { useEffect, useState } from 'react';
import './BreathingGuide.css';

interface BreathingGuideProps {
  isActive: boolean;
  phase: 'inhale' | 'exhale' | 'hold';
  cycleProgress: number; // 0-1
  breathingRate?: number; // BPM, defaults to 6
}

export const BreathingGuide: React.FC<BreathingGuideProps> = ({
  isActive,
  phase,
  cycleProgress,
  breathingRate = 6,
}) => {
  const [displayText, setDisplayText] = useState('Ready');

  useEffect(() => {
    if (!isActive) {
      setDisplayText('Ready');
      return;
    }

    if (phase === 'inhale') {
      setDisplayText('Inhale');
    } else if (phase === 'exhale') {
      setDisplayText('Exhale');
    } else {
      setDisplayText('Hold');
    }
  }, [phase, isActive]);

  const scale = 1 + cycleProgress * 0.5;
  const opacity = 0.5 + cycleProgress * 0.5;

  return (
    <div className={`breathing-container ${isActive ? 'active' : 'inactive'}`}>
      <div className="breathing-guide">
        <svg viewBox="0 0 200 200" className="breathing-circle">
          <circle
            cx="100"
            cy="100"
            r="80"
            className={`circle-outer ${phase}`}
            style={{
              transform: `scale(${scale})`,
              opacity: opacity,
            }}
          />
          <circle
            cx="100"
            cy="100"
            r="60"
            className="circle-inner"
            style={{
              transform: `scale(${1 - cycleProgress * 0.2})`,
            }}
          />
        </svg>

        <div className="breathing-text">
          <h2>{displayText}</h2>
          <p className="progress-indicator">
            {Math.round(cycleProgress * 100)}%
          </p>
        </div>
      </div>

      <div className="breath-timer">
        <div className="timer-display">
          {Math.round((1 - cycleProgress) * (60 / breathingRate) / 2)} sec
        </div>
        <div className="timer-label">
          {phase === 'inhale' ? 'Inhale' : phase === 'exhale' ? 'Exhale' : 'Hold'}
        </div>
      </div>
    </div>
  );
};
