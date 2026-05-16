export interface HeartRateData {
  current: number;
  avg: number;
  isDetected: boolean;
  syncWithBreathing: number; // % sync with 6 BPM breathing
}

export class HeartRateSync {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private onDataCallback: ((data: HeartRateData) => void) | null = null;
  private onStatusCallback: ((status: any) => void) | null = null;

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('Connected to heart rate sensor');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          if (message.type === 'heartrate') {
            const isDetected = message.current > 0;
            const syncPercent = this.calculateBreathingSync(message.current);

            const data: HeartRateData = {
              current: message.current,
              avg: message.avg,
              isDetected,
              syncWithBreathing: syncPercent,
            };

            if (this.onDataCallback) this.onDataCallback(data);
          } else if (message.type === 'status') {
            if (this.onStatusCallback) this.onStatusCallback(message);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.attemptReconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private calculateBreathingSync(heartRate: number): number {
    // Heart rate variability (HRV) indicates parasympathetic nervous system activation
    // during synchronized breathing (6 breaths/minute)
    // A stable, healthy resting heart rate (60-100 BPM) indicates good sync with breathing
    
    if (heartRate === 0) return 0;

    // Check if heart rate is in healthy resting range (60-100 BPM)
    // Perfect sync = stable heart rate in optimal zone (60-80 BPM)
    if (heartRate >= 60 && heartRate <= 80) {
      return 85; // High sync score for optimal zone
    } else if (heartRate > 80 && heartRate <= 100) {
      return 70; // Good sync for slightly elevated range
    } else if (heartRate < 60 && heartRate >= 50) {
      return 70; // Good sync for slightly low range
    } else {
      // Outside healthy resting range
      return Math.max(20, 100 - Math.abs(heartRate - 70) / 10);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        const wsUrl = `ws://${window.location.hostname}:3001`;
        this.connect(wsUrl).catch(() => {
          /* Already logged */
        });
      }, this.reconnectDelay);
    }
  }

  onData(callback: (data: HeartRateData) => void) {
    this.onDataCallback = callback;
  }

  onStatus(callback: (status: any) => void) {
    this.onStatusCallback = callback;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
