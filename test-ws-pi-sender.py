#!/usr/bin/env python3
"""
Test script to send frame data to WebSocket server (pi-receiver.ts)
Simulates a Raspberry Pi camera sending metadata + JPEG image
"""

import asyncio
import websockets
import json
import base64
from datetime import datetime
from io import BytesIO
from PIL import Image

# Configuration
WS_URL = "ws://localhost:3000/ws"
CAM_ID = "e8a76237-df96-4a6a-9375-baa4d74f5f12"
TOKEN = "257c87b4-9469-44fe-9132-8937f69723bd"
SOURCE_ID = "CAM001"

def create_dummy_jpeg():
    """Create a dummy JPEG image for testing"""
    # Create a simple colored image
    img = Image.new('RGB', (640, 480), color=(73, 109, 137))
    
    # Add some text or pattern (optional)
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), f"Test Frame {datetime.now().isoformat()}", fill=(255, 255, 255))
    
    # Convert to JPEG bytes
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    return buffer.getvalue()

def create_frame_metadata(frame_id: int):
    """Create frame metadata matching the frameSchema"""
    return {
        "fram_id": str(frame_id),
        "cam_id": CAM_ID,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "image_info": {
            "width": 640,
            "height": 480
        },
        "objects": [
            {
                "obj_id": f"DRONE_{frame_id}_001",
                "type": "quadcopter",
                "lat": 13.7563 + (frame_id * 0.0001),
                "lng": 100.5018 + (frame_id * 0.0001),
                "alt": 50.0 + (frame_id * 0.5),
                "speed_kt": 15.0 + (frame_id * 0.1)
            },
            {
                "obj_id": f"DRONE_{frame_id}_002",
                "type": "fixed-wing",
                "lat": 13.7563 - (frame_id * 0.0001),
                "lng": 100.5018 - (frame_id * 0.0001),
                "alt": 100.0 + (frame_id * 0.3),
                "speed_kt": 25.0 + (frame_id * 0.2)
            }
        ]
    }

async def send_frame(websocket, frame_id: int):
    """Send one complete frame (metadata + image)"""
    # Step 1: Send metadata as JSON
    metadata = create_frame_metadata(frame_id)
    metadata_json = json.dumps(metadata)
    await websocket.send(metadata_json)
    print(f"✅ Sent metadata for frame {frame_id}")
    
    # Small delay to simulate processing
    await asyncio.sleep(0.1)
    
    # Step 2: Send JPEG image as binary
    jpeg_bytes = create_dummy_jpeg()
    await websocket.send(jpeg_bytes)
    print(f"✅ Sent image for frame {frame_id} ({len(jpeg_bytes)} bytes)")

async def pi_camera_simulator():
    """Main function to simulate Pi camera sending frames"""
    # Build WebSocket URL with query parameters
    url = f"{WS_URL}?role=pi&source_id={SOURCE_ID}&cam_id={CAM_ID}&token={TOKEN}"
    
    print(f"🔌 Connecting to {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected to WebSocket server")
            
            # Send 5 test frames
            for frame_id in range(1, 6):
                print(f"\n📸 Sending frame {frame_id}...")
                await send_frame(websocket, frame_id)
                
                # Wait 2 seconds between frames
                await asyncio.sleep(2)
            
            print("\n✅ All frames sent successfully!")
            
    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Starting Pi Camera WebSocket Test")
    print(f"   Camera ID: {CAM_ID}")
    print(f"   Token: {TOKEN}")
    print(f"   Source ID: {SOURCE_ID}")
    print()
    
    asyncio.run(pi_camera_simulator())
