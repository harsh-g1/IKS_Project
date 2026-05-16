import { useState, useEffect } from 'react';
import { HeartRateSync, HeartRateData } from '../utils/heartRateSync';
import './HeartRateMonitor.css';
import React from 'react';

interface HeartRateMonitorProps {
  sessionActive: boolean;
  onHeartRateData?: (heartRate: number) => void;
}

export function HeartRateMonitor({ sessionActive, onHeartRateData }: HeartRateMonitorProps) {
  const [heartRateData, setHeartRateData] = useState<HeartRateData>({
    current: 0,
    avg: 0,
    isDetected: false,
    syncWithBreathing: 0,
  });
  const [sensorStatus, setSensorStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState('');
  const hrSyncRef = React.useRef<HeartRateSync | null>(null);

  useEffect(() => {
    if (!sessionActive) return;

    const initializeHeartRateMonitoring = async () => {
      try {
        hrSyncRef.current = new HeartRateSync();

        hrSyncRef.current.onData((data) => {
          setHeartRateData(data);
          if (onHeartRateData && data.current > 0) {
            onHeartRateData(data.current);
          }
        });

        hrSyncRef.current.onStatus((status) => {
          if (status.connected) {
            setSensorStatus('connected');
            setError('');
          } else {
            setSensorStatus('disconnected');
            if (status.error) setError(status.error);
          }
        });

        setSensorStatus('connecting');
        const wsUrl = `ws://${window.location.hostname}:3001`;
        await hrSyncRef.current.connect(wsUrl);
      } catch (err) {
        setSensorStatus('disconnected');
        setError(`Failed to connect: ${(err as Error).message}`);
      }
    };

    initializeHeartRateMonitoring();

    return () => {
      if (hrSyncRef.current) {
        hrSyncRef.current.disconnect();
      }
    };
  }, [sessionActive]);

  return (
    <div className="heart-rate-monitor">
      <div className="hr-card">
        <div className="hr-status">
          <span className={`status-indicator ${sensorStatus}`} />
          <span className="status-text">
            {sensorStatus === 'connected' && 'Sensor Connected'}
            {sensorStatus === 'connecting' && 'Connecting...'}
            {sensorStatus === 'disconnected' && 'Sensor Not Connected'}
          </span>
        </div>

        {heartRateData.isDetected && (
          <>
            <div className="hr-display">
              <span className="hr-value">{heartRateData.current}</span>
              <span className="hr-unit">BPM</span>
            </div>

            <div className="hr-sync">
              <div className="sync-bar">
                <div
                  className="sync-fill"
                  style={{
                    width: `${heartRateData.syncWithBreathing}%`,
                  }}
                />
              </div>
              <span className="sync-text">
                {heartRateData.syncWithBreathing}% Sync with Breathing
              </span>
            </div>

            <div className="hr-avg">Avg: {heartRateData.avg} BPM</div>
          </>
        )}

        {!heartRateData.isDetected && sensorStatus === 'connected' && (
          <p className="no-finger">Place finger on sensor...</p>
        )}

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}