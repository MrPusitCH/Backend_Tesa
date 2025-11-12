#!/usr/bin/env python3
"""
Test script to receive frame data from WebSocket server as a viewer
"""

import asyncio
import websockets
import json

WS_URL = "ws://localhost:3000/ws?role=viewer"

async def viewer_client():
    """Connect as a viewer and receive broadcasted frames"""
    print(f"🔌 Connecting to {WS_URL}")
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print("✅ Connected as viewer")
            print("👁️  Waiting for frames...\n")
            
            frame_count = 0
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data.get("kind") == "frame":
                        frame_count += 1
                        meta = data.get("meta", {})
                        image_b64 = data.get("image_jpeg_base64", "")
                        
                        print(f"📦 Frame {frame_count} received:")
                        print(f"   fram_id: {meta.get('fram_id')}")
                        print(f"   cam_id: {meta.get('cam_id')}")
                        print(f"   timestamp: {meta.get('timestamp')}")
                        print(f"   objects: {len(meta.get('objects', []))}")
                        print(f"   image size: {len(image_b64)} chars (base64)")
                        
                        # Show camera info if available
                        if "token_id" in meta and "camera_info" in meta["token_id"]:
                            cam_info = meta["token_id"]["camera_info"]
                            print(f"   camera: {cam_info.get('name')} @ {cam_info.get('location')}")
                        
                        print()
                    else:
                        print(f"📨 Message: {data}")
                        
                except json.JSONDecodeError:
                    print(f"⚠️  Received non-JSON message: {message[:100]}")
                    
    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Starting WebSocket Viewer Client\n")
    asyncio.run(viewer_client())
