# WebSocket Real-Time System

## Architecture

```
Pi Camera → WebSocket Server (port 3001) → Frontend Viewers
```

## Setup

### 1. Start Server
```bash
npm install
npm run dev
```

Server runs on: `ws://localhost:3000/ws`

### 2. Test with Python Scripts

**Terminal 1 - Start Viewer:**
```bash
pip install -r requirements-ws-test.txt
python test-ws-viewer.py
```

**Terminal 2 - Send Test Frames:**
```bash
python test-ws-pi-sender.py
```

## Frontend Integration

### Connect as Viewer (React/Next.js example)

```javascript
import { useEffect, useState } from 'react';

function DroneMonitor() {
  const [frames, setFrames] = useState([]);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const websocket = new WebSocket('ws://localhost:3000/ws?role=viewer');
    
    websocket.onopen = () => {
      console.log('✅ Connected to WebSocket');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.kind === 'frame') {
        console.log('📦 Received frame:', data.meta.fram_id);
        
        // Add to frames list
        setFrames(prev => [data, ...prev].slice(0, 10)); // Keep last 10
      }
    };
    
    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };
    
    websocket.onclose = () => {
      console.log('🔌 Disconnected');
    };
    
    setWs(websocket);
    
    return () => websocket.close();
  }, []);

  return (
    <div>
      <h1>Live Drone Monitor</h1>
      {frames.map((frame) => (
        <div key={frame.meta.fram_id}>
          <h3>Frame {frame.meta.fram_id}</h3>
          <p>Camera: {frame.meta.cam_id}</p>
          <p>Time: {frame.meta.timestamp}</p>
          
          {/* Display image */}
          <img 
            src={`data:image/jpeg;base64,${frame.image_jpeg_base64}`}
            alt="Frame"
            style={{ maxWidth: '100%' }}
          />
          
          {/* Display objects */}
          <h4>Detected Objects: {frame.meta.objects.length}</h4>
          {frame.meta.objects.map((obj) => (
            <div key={obj.obj_id}>
              <p>{obj.type} - {obj.obj_id}</p>
              <p>Position: {obj.lat}, {obj.lng}</p>
              <p>Altitude: {obj.alt}m, Speed: {obj.speed_kt}kt</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Data Format

### Frame Message (sent to viewers)
```json
{
  "kind": "frame",
  "meta": {
    "fram_id": "1",
    "cam_id": "e8a76237-df96-4a6a-9375-baa4d74f5f12",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "token_id": {
      "camera_info": {
        "name": "Camera 1",
        "sort": "outdoor",
        "location": "Building A",
        "institute": "University"
      }
    },
    "image_info": {
      "width": 640,
      "height": 480
    },
    "objects": [
      {
        "obj_id": "DRONE_1_001",
        "type": "quadcopter",
        "lat": 13.7563,
        "lng": 100.5018,
        "alt": 50.0,
        "speed_kt": 15.0
      }
    ]
  },
  "image_jpeg_base64": "/9j/4AAQSkZJRgABAQAA..."
}
```

## Pi Camera Connection

Your Raspberry Pi should connect with:
```
ws://your-server:3000/ws?role=pi&source_id=CAM001&cam_id=e8a76237-df96-4a6a-9375-baa4d74f5f12&token=257c87b4-9469-44fe-9132-8937f69723bd
```

Send two messages per frame:
1. JSON metadata (matching frameSchema)
2. Binary JPEG image bytes

## Ports

- **3000**: Main API server + WebSocket (unified)
- **5432**: PostgreSQL
- **1883**: MQTT (if needed later)

## Environment Variables

Create `.env`:
```env
WS_PORT=3001
```
