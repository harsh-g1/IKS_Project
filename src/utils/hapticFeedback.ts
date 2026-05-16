/**
 * Haptic Feedback Module
 * Provides vibration patterns to guide users to the target breathing rate
 */

export interface VibrationPattern {
  pattern: number[];
  name: string;
}

export class HapticFeedback {
  private isSupported: boolean;
  private lastVibrationTime = 0;
  private vibrationCooldown = 100; // Minimum time between vibrations (ms)

  constructor() {
    // Check if Vibration API is supported
    this.isSupported = !!(
      navigator.vibrate ||
      (navigator as any).webkitVibrate ||
      (navigator as any).mozVibrate ||
      (navigator as any).msVibrate
    );
  }

  private canVibrate(): boolean {
    return this.isSupported && 'vibrate' in navigator;
  }

  private vibratePattern(pattern: number | number[]): void {
    if (!this.canVibrate()) return;

    const now = Date.now();
    if (now - this.lastVibrationTime < this.vibrationCooldown) return;

    this.lastVibrationTime = now;
    navigator.vibrate(pattern);
  }

  /**
   * Vibrate with a simple pulse
   * @param duration Duration of vibration in milliseconds
   */
  pulse(duration: number = 50): void {
    this.vibratePattern(duration);
  }

  /**
   * Gentle guidance - subtle pulse to encourage towards target
   */
  gentle(): void {
    this.pulse(30);
  }

  /**
   * Strong feedback - pronounced pulse when in sync
   */
  strong(): void {
    this.vibratePattern([60, 40, 60]);
  }

  /**
   * Double tap - feedback for mantra completion
   */
  doubleTap(): void {
    this.vibratePattern([30, 50, 30]);
  }

  /**
   * Success pattern - when session completes or good sync achieved
   */
  success(): void {
    this.vibratePattern([50, 100, 50]);
  }

  /**
   * Warning pattern - when going out of sync
   */
  warning(): void {
    this.vibratePattern([100, 50, 100]);
  }

  /**
   * Rhythm guidance - pulse at target rate (6 bpm = 10 seconds per breath)
   * This is called at cycle transitions to guide inhalation and exhalation
   */
  rhythmicGuide(): void {
    this.vibratePattern([40, 60, 40]);
  }

  /**
   * Adaptive feedback based on sync status
   * @param isInSync Whether user is in sync with target rate
   * @param syncPercentage Percentage of time in sync
   */
  adaptiveFeedback(isInSync: boolean, syncPercentage: number): void {
    if (isInSync) {
      if (syncPercentage > 80) {
        this.strong(); // Very good sync
      } else if (syncPercentage > 50) {
        this.gentle(); // Good sync
      }
    } else {
      if (syncPercentage < 30) {
        this.warning(); // Needs adjustment
      }
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stop(): void {
    if (this.isSupported) {
      navigator.vibrate(0);
    }
  }

  /**
   * Check if vibration is supported on this device
   */
  isVibrationSupported(): boolean {
    return this.isSupported;
  }
}
