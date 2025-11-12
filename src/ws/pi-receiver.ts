import { WebSocketServer, WebSocket } from "ws";
import axios from "axios";
import { URL } from "url";
import { frameSchema, type FramePayload } from "../schemas/frame.js";

type FrameMetadata = FramePayload;

interface CameraInfo {
  name: string;
  sort: string;
  location: string;
  institute: string;
}

interface ClientConnection {
  ws: WebSocket;
  role: "pi" | "viewer";
  sourceId?: string | undefined;
  camId?: string | undefined;
  token?: string | undefined;
  pendingMetadata?: FrameMetadata | undefined;
}

const clients = new Map<WebSocket, ClientConnection>();
const viewerClients = new Set<WebSocket>();

// Fetch camera info from API
async function fetchCameraInfo(camId: string, token: string): Promise<CameraInfo | null> {
  try {
    const response = await axios.get(
      `https://tesa-api.crma.dev/api/object-detection/info/${camId}`,
      {
        headers: {
          "x-camera-token": token,
          "Accept": "application/json",
        },
      }
    );

    const apiData = response.data;
    return {
      name: String(apiData.name || ""),
      sort: String(apiData.sort || ""),
      location: String(apiData.location || ""),
      institute: String(apiData.Institute || apiData.institute || ""),
    };
  } catch (error: any) {
    console.error(`❌ Failed to fetch camera info for ${camId}:`, error.message);
    return null;
  }
}

// Register viewer client
function registerViewer(ws: WebSocket) {
  viewerClients.add(ws);
  ws.on("close", () => {
    viewerClients.delete(ws);
  });
}

// Broadcast to all viewers
function broadcast(payload: unknown) {
  const msg = JSON.stringify(payload);
  for (const ws of viewerClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(msg);
      } catch (error) {
        console.error("❌ Broadcast error:", error);
      }
    }
  }
}

// Create WebSocket server
const PORT = Number(process.env.WS_PORT) || 3001;
const wss = new WebSocketServer({ port: PORT, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const role = url.searchParams.get("role") as "pi" | "viewer" | null;
  const sourceId = url.searchParams.get("source_id") || undefined;
  const camId = url.searchParams.get("cam_id") || undefined;
  const token = url.searchParams.get("token") || undefined;

  if (!role || (role !== "pi" && role !== "viewer")) {
    console.log("❌ Invalid role, closing connection");
    ws.close(1008, "Invalid role parameter");
    return;
  }

  const client: ClientConnection = {
    ws,
    role,
    sourceId,
    camId,
    token,
  };

  clients.set(ws, client);

  if (role === "viewer") {
    registerViewer(ws);
    console.log(`👁️  Viewer connected (total viewers: ${viewerClients.size})`);
  } else if (role === "pi") {
    console.log(`📷 Pi camera connected: source_id=${sourceId}, cam_id=${camId}`);
  }

  ws.on("message", async (data: Buffer) => {
    const client = clients.get(ws);
    if (!client || client.role !== "pi") return;

    try {
      // Check if message is text (JSON metadata) or binary (JPEG image)
      if (data[0] === 0x7b || data[0] === 0x22) {
        // Likely JSON (starts with '{' or '"')
        const text = data.toString("utf8");
        const json = JSON.parse(text);
        const metadata = frameSchema.parse(json);
        
        // Store metadata temporarily
        client.pendingMetadata = metadata;
        console.log(`📋 Received metadata for frame ${metadata.fram_id} from ${client.sourceId}`);
      } else {
        // Binary data (JPEG image)
        if (!client.pendingMetadata) {
          console.warn("⚠️  Received image without metadata, ignoring");
          return;
        }

        const metadata = client.pendingMetadata!;
        client.pendingMetadata = undefined;

        // Convert image to base64
        const imageBase64 = data.toString("base64");

        // Fetch camera info if available
        let cameraInfo: CameraInfo | null = null;
        if (client.camId && client.token) {
          cameraInfo = await fetchCameraInfo(client.camId, client.token);
        }

        // Build complete frame object
        const framePayload: any = {
          kind: "frame",
          meta: {
            ...metadata,
            ...(cameraInfo && {
              token_id: {
                camera_info: cameraInfo,
              },
            }),
          },
          image_jpeg_base64: imageBase64,
        };

        // Broadcast to all viewers
        broadcast(framePayload);
        console.log(`📤 Broadcasted frame ${metadata.fram_id} to ${viewerClients.size} viewers`);
      }
    } catch (error: any) {
      console.error("❌ Error processing message:", error.message);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (client.role === "viewer") {
      viewerClients.delete(ws);
      console.log(`👁️  Viewer disconnected (remaining: ${viewerClients.size})`);
    } else if (client.role === "pi") {
      console.log(`📷 Pi camera disconnected: source_id=${client.sourceId}`);
    }
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

console.log(`🚀 WebSocket server listening on ws://localhost:${PORT}/ws`);
console.log("   - Pi cameras: ?role=pi&source_id=CAM001&cam_id=CAM001&token=xxx");
console.log("   - Viewers: ?role=viewer");
