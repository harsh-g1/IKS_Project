import { useState, useEffect, useRef } from 'react';
import { BreathingGuide } from './components/BreathingGuide';
import { MantraCounter } from './components/MantraCounter';
import { SessionStats } from './components/SessionStats';
import { HapticFeedback } from './utils/hapticFeedback';
import { HeartRateMonitor } from './components/HeartRateMonitor';
import './App.css';

type SessionPhase = 'setup' | 'calibration' | 'active' | 'completed';
type BreathPhase = 'inhale' | 'exhale' | 'hold';

interface MantraClickMetrics {
  currentBPM: number;
  averageBPM: number;
  isInSync: boolean;
}

interface CalibrationResult {
  rate: number;
  hrv: number;
  avgHeartRate: number;
}

interface HeartRateReading {
  rate: number;
  timestamp: number;
}

export default function App() {
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('setup');
  const [targetMantras, setTargetMantras] = useState(108);
  const [completedMantras, setCompletedMantras] = useState(0);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('inhale');
  const [cycleProgress, setCycleProgress] = useState(0);
  const [metrics, setMetrics] = useState<MantraClickMetrics>({
    currentBPM: 0,
    averageBPM: 0,
    isInSync: false,
  });
  const [syncPercentage, setSyncPercentage] = useState(0);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [tempMantras, setTempMantras] = useState('108');
  const [error, setError] = useState('');
  const [showTapFeedback, setShowTapFeedback] = useState(false);
  const [optimalRate, setOptimalRate] = useState(6); // Default to 6 BPM
  const [calibrationResults, setCalibrationResults] = useState<CalibrationResult[]>([]);
  const [currentCalibrationRate, setCurrentCalibrationRate] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationTapCount, setCalibrationTapCount] = useState(0);

  const hapticRef = useRef<HapticFeedback | null>(null);
  const animationRef = useRef<number>();
  const sessionStartRef = useRef<number>();
  const tapTimestampsRef = useRef<number[]>([]);
  const syncCheckRef = useRef<number[]>([]);
  const cycleStartRef = useRef<number>(0);
  const halfCycleCountRef = useRef<number>(-1);
  const appContainerRef = useRef<HTMLDivElement>(null);
  const heartRateHistoryRef = useRef<HeartRateReading[]>([]);
  const calibrationStartRef = useRef<number>(0);
  const calibrationTapsRef = useRef<number[]>([]);

  // Calculate HRV (Heart Rate Variability) from heart rate data
  const calculateHRV = (heartRates: number[]): number => {
    if (heartRates.length < 5) return 0;

    // Calculate RR intervals (time between beats) from heart rates
    const rrIntervals: number[] = [];
    for (let i = 1; i < heartRates.length; i++) {
      // Convert heart rate to milliseconds between beats
      const rrInterval = (60 / heartRates[i]) * 1000;
      rrIntervals.push(rrInterval);
    }

    if (rrIntervals.length < 2) return 0;

    // Calculate standard deviation of RR intervals (basic HRV measure)
    const mean = rrIntervals.reduce((a, b) => a + b) / rrIntervals.length;
    const variance = rrIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rrIntervals.length;
    const hrv = Math.sqrt(variance);

    return Math.round(hrv * 100) / 100; // Round to 2 decimal places
  };

  // Start calibration process (5-minute session)
  const startCalibration = () => {
    setCalibrationResults([]);
    setCurrentCalibrationRate(0);
    setCalibrationProgress(0);
    setCalibrationTapCount(0);
    setSessionPhase('calibration');
    heartRateHistoryRef.current = [];
    calibrationTapsRef.current = [];
    calibrationStartRef.current = Date.now();
    cycleStartRef.current = Date.now();

    // Start base breathing rhythm for guidance (6 BPM)
    startBreathingCycle(6);
  };

  // Detect current chanting rate from recent taps
  const getCurrentChantingRate = (): number => {
    if (calibrationTapsRef.current.length < 2) return 0;

    const now = Date.now();
    const recentTaps = calibrationTapsRef.current.filter(
      (t) => now - t < 10000 // Last 10 seconds
    );

    if (recentTaps.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < recentTaps.length; i++) {
      intervals.push(recentTaps[i] - recentTaps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const detectedBPM = 60000 / avgInterval; // Convert ms to BPM

    return Math.round(detectedBPM * 10) / 10; // Round to 1 decimal place
  };

  // Record a tap during calibration
  const recordCalibrationTap = () => {
    const now = Date.now();
    calibrationTapsRef.current.push(now);

    // Keep only last 30 seconds of taps for rate calculation
    calibrationTapsRef.current = calibrationTapsRef.current.filter(
      (t) => now - t < 30000
    );

    setCalibrationTapCount((prev) => prev + 1);

    // Haptic feedback
    if (hapticRef.current) {
      hapticRef.current.doubleTap();
    }
  };

  // Complete calibration and analyze results
  const completeCalibration = () => {
    // Group heart rates by detected chanting rate
    const rateMap = new Map<number, number[]>();

    for (const reading of heartRateHistoryRef.current) {
      // For each heart rate, find the chanting rate at that time
      const readingTime = reading.timestamp;
      
      // Look at taps around the time of this heart rate reading (±5 seconds window)
      const tapsAround = calibrationTapsRef.current.filter(
        (tapTime) => Math.abs(tapTime - readingTime) <= 5000
      );

      if (tapsAround.length >= 2) {
        // Calculate the chanting rate from these taps
        const intervals: number[] = [];
        for (let i = 1; i < tapsAround.length; i++) {
          intervals.push(tapsAround[i] - tapsAround[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const rate = Math.round((60000 / avgInterval) * 10) / 10;

        if (!rateMap.has(rate)) {
          rateMap.set(rate, []);
        }
        rateMap.get(rate)!.push(reading.rate);
      }
    }

    // Calculate HRV for each rate and find optimal
    const results: CalibrationResult[] = [];
    let maxHRV = 0;
    let optimalRateValue = 6;

    rateMap.forEach((heartRates, rate) => {
      if (heartRates.length >= 5) {
        const hrv = calculateHRV(heartRates);
        const avgHeartRate = heartRates.reduce((a, b) => a + b) / heartRates.length;

        results.push({
          rate,
          hrv,
          avgHeartRate: Math.round(avgHeartRate * 10) / 10,
        });

        if (hrv > maxHRV) {
          maxHRV = hrv;
          optimalRateValue = rate;
        }
      }
    });

    // Sort results by rate for display
    results.sort((a, b) => a.rate - b.rate);

    setCalibrationResults(results);
    setOptimalRate(optimalRateValue);
    setSessionPhase('setup');
  };

  // Handle heart rate data for calibration
  const handleHeartRateData = (heartRate: number) => {
    if (sessionPhase === 'calibration' && heartRate > 0) {
      heartRateHistoryRef.current.push({
        rate: heartRate,
        timestamp: Date.now()
      });
      // Keep last 5 minutes of data
      const calibrationDuration = 5 * 60 * 1000;
      const now = Date.now();
      heartRateHistoryRef.current = heartRateHistoryRef.current.filter(
        (reading) => now - reading.timestamp < calibrationDuration
      );

      // Update current detected chanting rate
      const detectedRate = getCurrentChantingRate();
      setCurrentCalibrationRate(detectedRate);
    }
  };

  // Calibration timer effect
  useEffect(() => {
    if (sessionPhase !== 'calibration') return;

    const calibrationDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    const startTime = Date.now();

    const timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / calibrationDuration) * 100, 100);
      setCalibrationProgress(progress);

      if (elapsed >= calibrationDuration) {
        clearInterval(timerInterval);
        completeCalibration();
      }
    }, 500);

    return () => clearInterval(timerInterval);
  }, [sessionPhase]);

  // Initialize haptic feedback and keyboard listeners
  useEffect(() => {
    if (sessionPhase === 'active' || sessionPhase === 'calibration') {
      hapticRef.current = new HapticFeedback();
      
      if (hapticRef.current.isVibrationSupported()) {
        console.log('✓ Haptic feedback available on this device');
      } else {
        console.log('ℹ Haptic feedback not available - using visual/audio feedback instead');
      }

      // Start breathing rhythm
      cycleStartRef.current = Date.now();
      if (sessionPhase === 'active') {
        startBreathingCycle(optimalRate);
      } else if (sessionPhase === 'calibration') {
        startBreathingCycle(6); // Base 6 BPM for calibration guidance
      }

      // Keyboard listener for laptop
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          if (sessionPhase === 'active') {
            recordMantraInput();
          } else if (sessionPhase === 'calibration') {
            recordCalibrationTap();
          }
        }
      };

      window.addEventListener('keydown', handleKeyPress);

      return () => {
        window.removeEventListener('keydown', handleKeyPress);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (hapticRef.current) {
          hapticRef.current.stop();
        }
      };
    }
  }, [sessionPhase]);

  // Recording mantra input (from tap or key press)
  const recordMantraInput = () => {
    const now = Date.now();
    tapTimestampsRef.current.push(now);

    // Keep only last 60 seconds of taps
    tapTimestampsRef.current = tapTimestampsRef.current.filter(
      (t) => now - t < 60000
    );

    // Show tap feedback
    setShowTapFeedback(true);
    setTimeout(() => setShowTapFeedback(false), 200);

    setCompletedMantras((prev) => {
      const newCount = prev + 1;

      // Haptic/Audio feedback for mantra completion
      if (hapticRef.current) {
        hapticRef.current.doubleTap();
      }

      // Calculate BPM from recent taps
      if (tapTimestampsRef.current.length > 1) {
        const intervals = [];
        for (let i = tapTimestampsRef.current.length - 1; i > 0; i--) {
          intervals.push(
            tapTimestampsRef.current[i] - tapTimestampsRef.current[i - 1]
          );
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const detectedBPM = 60000 / avgInterval; // Convert ms to breaths per minute

        setMetrics((prev) => ({
          currentBPM: Math.round(detectedBPM * 10) / 10,
          averageBPM: prev.averageBPM,
          isInSync: Math.abs(detectedBPM - 6) <= 1.5,
        }));

        syncCheckRef.current.push(detectedBPM);
        if (syncCheckRef.current.length > 60) {
          syncCheckRef.current.shift();
        }

        // Recalculate sync percentage
        if (syncCheckRef.current.length > 0) {
          const inSyncCount = syncCheckRef.current.filter(
            (bpm) => Math.abs(bpm - 6) <= 1.5
          ).length;
          setSyncPercentage(Math.round((inSyncCount / syncCheckRef.current.length) * 100));
        }

        // Update average BPM
        const avgBPM =
          syncCheckRef.current.reduce((a, b) => a + b, 0) / syncCheckRef.current.length;
        setMetrics((prev) => ({
          ...prev,
          averageBPM: Math.round(avgBPM * 10) / 10,
        }));

        // Adaptive feedback
        if (hapticRef.current && Math.abs(detectedBPM - 6) <= 1.5) {
          hapticRef.current.strong();
          playFeedbackSound('sync');
        } else {
          if (hapticRef.current) {
            hapticRef.current.warning();
          }
          playFeedbackSound('detect');
        }
      }

      return newCount;
    });
  };

  // Play audio feedback for desktop users
  const playFeedbackSound = (type: 'complete' | 'sync' | 'detect') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      switch (type) {
        case 'complete': // Double beep
          const osc1 = audioContext.createOscillator();
          const gain1 = audioContext.createGain();
          osc1.connect(gain1);
          gain1.connect(audioContext.destination);
          osc1.frequency.value = 800;
          gain1.gain.setValueAtTime(0.1, now);
          gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc1.start(now);
          osc1.stop(now + 0.1);

          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          gain2.gain.setValueAtTime(0.1, now + 0.15);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          osc2.start(now + 0.15);
          osc2.stop(now + 0.25);
          break;

        case 'sync': // Higher pitch for in-sync
          const osc3 = audioContext.createOscillator();
          const gain3 = audioContext.createGain();
          osc3.connect(gain3);
          gain3.connect(audioContext.destination);
          osc3.frequency.value = 1200;
          gain3.gain.setValueAtTime(0.15, now);
          gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          osc3.start(now);
          osc3.stop(now + 0.15);
          break;

        case 'detect': // Single lower beep
          const osc4 = audioContext.createOscillator();
          const gain4 = audioContext.createGain();
          osc4.connect(gain4);
          gain4.connect(audioContext.destination);
          osc4.frequency.value = 600;
          gain4.gain.setValueAtTime(0.08, now);
          gain4.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc4.start(now);
          osc4.stop(now + 0.1);
          break;
      }
    } catch (e) {
      console.log('Audio feedback not available');
    }
  };

  // Breathing cycle animation (variable rate based on breathingRate)
  const startBreathingCycle = (breathingRate: number = 6) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const cycleDuration = (60 / breathingRate) * 1000; // Convert BPM to milliseconds per cycle
    const halfCycle = cycleDuration / 2; // Inhale/exhale duration
    halfCycleCountRef.current = -1;

    const cycle = () => {
      const now = Date.now();
      const elapsed = now - cycleStartRef.current;
      const cycleTime = (elapsed % cycleDuration) / cycleDuration;

      if (cycleTime < 0.5) {
        setBreathPhase('inhale');
        setCycleProgress(cycleTime * 2);
      } else {
        setBreathPhase('exhale');
        setCycleProgress((cycleTime - 0.5) * 2);
      }

      const halfCycleIndex = Math.floor(elapsed / halfCycle);
      if (halfCycleIndex !== halfCycleCountRef.current) {
        halfCycleCountRef.current = halfCycleIndex;
        if (hapticRef.current) {
          hapticRef.current.rhythmicGuide();
        }
      }

      animationRef.current = requestAnimationFrame(cycle);
    };

    animationRef.current = requestAnimationFrame(cycle);
  };

  // Session timer
  useEffect(() => {
    if (sessionPhase === 'active') {
      sessionStartRef.current = Date.now();

      const timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (sessionStartRef.current || Date.now())) / 1000);
        setSessionDuration(elapsed);
      }, 1000);

      return () => clearInterval(timerInterval);
    }
  }, [sessionPhase]);

  // Check if session is complete
  useEffect(() => {
    if (completedMantras >= targetMantras && sessionPhase === 'active') {
      setSessionPhase('completed');
      if (hapticRef.current) {
        hapticRef.current.success();
        playFeedbackSound('complete');
      }
    }
  }, [completedMantras, targetMantras, sessionPhase]);



  const handleStartSession = () => {
    const count = parseInt(tempMantras, 10);
    if (isNaN(count) || count < 1) {
      setError('Please enter a valid number greater than 0');
      return;
    }
    setTargetMantras(count);
    setCompletedMantras(0);
    setSessionDuration(0);
    setError('');
    setSessionPhase('active');
  };

  const handleReset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setSessionPhase('setup');
    setCompletedMantras(0);
    setTempMantras('108');
    setError('');
    tapTimestampsRef.current = [];
    syncCheckRef.current = [];
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1> Haptic-Mantra Mala</h1>
        <p className="subtitle">
          Chant at the perfect rhythm for your nervous system health
        </p>
      </header>

      <main className="app-main">
        {sessionPhase === 'calibration' && (
          <div className="calibration-phase">
            <div className="calibration-card">
              <h2>Finding Your Optimal Breathing Rate</h2>
              <p className="calibration-description">
                Chant at different rates for 5 minutes. We'll analyze your heart rate variability to find your optimal rate for maximum HRV.
              </p>

              <div className="calibration-progress">
                <div className="progress-info">
                  <span className="time-remaining">
                    {Math.floor((100 - calibrationProgress) / 20)} min {Math.round(((100 - calibrationProgress) % 20) * 3)} sec remaining
                  </span>
                  <span className="progress-text">
                    {Math.round(calibrationProgress)}% complete
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${calibrationProgress}%` }}
                  />
                </div>
              </div>

              <BreathingGuide
                isActive={true}
                phase={breathPhase}
                cycleProgress={cycleProgress}
                breathingRate={6}
              />

              <div className="calibration-current-stats">
                <div className="stat-box">
                  <span className="stat-label">Current Chanting Rate:</span>
                  <span className="stat-value">{currentCalibrationRate} BPM</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Taps Recorded:</span>
                  <span className="stat-value">{calibrationTapCount}</span>
                </div>
              </div>

              <HeartRateMonitor
                sessionActive={true}
                onHeartRateData={handleHeartRateData}
              />

              <div className="calibration-actions">
                <button className="exit-calibration-button" onClick={completeCalibration}>
                  Stop Calibration Early
                </button>
              </div>

              <div className="tap-zone tap-zone-centered" onClick={recordCalibrationTap}>
                <div className="tap-instruction">
                  <p className="tap-instruction-primary">TAP to record your chanting</p>
                  <p className="tap-instruction-secondary">
                    Try different chanting speeds (Or press <span className="key-badge">SPACE</span> / <span className="key-badge">ENTER</span>)
                  </p>
                </div>
              </div>

              {calibrationResults.length > 0 && (
                <div className="calibration-results">
                  <h3>Rates Detected:</h3>
                  <div className="results-grid">
                    {calibrationResults.map((result) => (
                      <div key={Math.round(result.rate * 10)} className="result-item">
                        <span className="rate">{result.rate} BPM</span>
                        <span className="hrv">HRV: {result.hrv}</span>
                        <span className="avg-hr">Avg HR: {result.avgHeartRate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="calibration-status">
                <p>Try chanting at different speeds and we'll find your optimal rate.</p>
              </div>
            </div>
          </div>
        )}

        {sessionPhase === 'setup' && (
          <div className="setup-phase">
            <div className="setup-card">
              <h2>Prepare Your Session</h2>

              <div className="setup-section">
                <label htmlFor="mantras">Number of Mantras:</label>
                <div className="input-group">
                  <input
                    id="mantras"
                    type="number"
                    min="1"
                    max="1000"
                    value={tempMantras}
                    onChange={(e) => setTempMantras(e.target.value)}
                    className="mantra-input"
                  />
                  <div className="preset-buttons">
                    <button
                      onClick={() => setTempMantras('27')}
                      className="preset-btn"
                    >
                      27
                    </button>
                    <button
                      onClick={() => setTempMantras('54')}
                      className="preset-btn"
                    >
                      54
                    </button>
                    <button
                      onClick={() => setTempMantras('108')}
                      className="preset-btn"
                    >
                      108
                    </button>
                  </div>
                </div>
              </div>

              <div className="setup-info">
                <h3>How it works:</h3>
                <ul>
                  <li>First, calibrate to find your optimal breathing rate for maximum HRV</li>
                  <li>The app guides you to chant at your <strong>personal optimal rate</strong></li>
                  <li>Tap the screen (mobile) or press SPACE/ENTER (laptop) for each mantra</li>
                  <li>Receive haptic feedback (vibration) or audio cues to stay in sync</li>
                  <li>Track your sync score and rhythm for HRV improvement</li>
                </ul>
              </div>

              <div className="optimal-rate-display">
                <p>Optimal Rate: <strong>{optimalRate} breaths/min</strong></p>
                {optimalRate !== 6 && (
                  <p className="rate-note">Calibrated for your physiology</p>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="setup-buttons">
                <button
                  onClick={startCalibration}
                  className="calibrate-button"
                >
                  Calibrate Optimal Rate
                </button>

                <button
                  onClick={handleStartSession}
                  className="start-button"
                  disabled={optimalRate === 0}
                >
                  Start Session ({optimalRate} BPM)
                </button>
              </div>
            </div>
          </div>
        )}

        {sessionPhase === 'active' && (
          <div className="active-phase">
            <BreathingGuide
              isActive={true}
              phase={breathPhase}
              cycleProgress={cycleProgress}
              breathingRate={optimalRate}
            />
            <div className="metrics-display">
              <div className="metric">
                <span className="metric-label">Current BPM:</span>
                <span className="metric-value">{metrics.currentBPM}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Avg BPM:</span>
                <span className="metric-value">
                  {metrics.averageBPM.toFixed(1)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Status:</span>
                <span
                  className={`metric-value ${metrics.isInSync ? 'in-sync' : ''}`}
                >
                  {metrics.isInSync ? '✓ Synced' : '○ Detecting...'}
                </span>
              </div>
            </div>

            <MantraCounter
              currentCount={completedMantras}
              targetCount={targetMantras}
              isInSync={metrics.isInSync}
              syncPercentage={syncPercentage}
            />

            <div
              className={`tap-zone ${showTapFeedback ? 'active' : ''}`}
              onClick={recordMantraInput}
              ref={appContainerRef}
            >
              <div className="tap-instruction">
                <p className="tap-instruction-primary">TAP to record mantra</p>
                <p className="tap-instruction-secondary">
                  (Or press <span className="key-badge">SPACE</span> / <span className="key-badge">ENTER</span>)
                </p>
              </div>
            </div>

            <button onClick={handleReset} className="stop-button">
              Stop Session
            </button>
          </div>
        )}

        {sessionPhase === 'completed' && (
          <div className="completed-phase">
            <SessionStats
              syncPercentage={syncPercentage}
              averageBPM={metrics.averageBPM}
              completedMantras={completedMantras}
              targetMantras={targetMantras}
              sessionDuration={sessionDuration}
            />

            <button onClick={handleReset} className="restart-button">
              Start New Session
            </button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Heart Rate Variability (HRV) improves with consistent practice at 6
          breaths per minute
        </p>
      </footer>
    </div>
  );
}
