const { WebSocketServer } = require('ws');

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

const createHeartRateMessage = (current, avg) => ({
  type: 'heartrate',
  current,
  avg,
});

const createStatusMessage = (connected, error = null) => ({
  type: 'status',
  connected,
  error,
});

const getRandomHeartRate = () => {
  const variation = Math.random() * 2 - 1; // ±1 BPM variation
  return Math.round((6 + variation) * 10) / 10;
};

wss.on('connection', (ws) => {
  console.log('Mock heart rate client connected');
  ws.send(JSON.stringify(createStatusMessage(true)));

  let heartRateHistory = [];
  let interval = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;

    const current = getRandomHeartRate();
    heartRateHistory.push(current);
    if (heartRateHistory.length > 20) {
      heartRateHistory.shift();
    }

    const avg = Math.round(
      (heartRateHistory.reduce((sum, value) => sum + value, 0) / heartRateHistory.length) * 10
    ) / 10;

    ws.send(JSON.stringify(createHeartRateMessage(current, avg)));
  }, 1000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('Mock heart rate client disconnected');
  });

  ws.on('error', (error) => {
    console.error('Mock heart rate socket error:', error);
  });
});

wss.on('listening', () => {
  console.log(`Mock heart rate WebSocket server running on ws://localhost:${PORT}`);
});
