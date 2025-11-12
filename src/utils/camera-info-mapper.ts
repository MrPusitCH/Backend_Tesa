import axios from "axios";
import { z } from "zod";

const cameraInfoSchema = z.object({
  name: z.string(),
  sort: z.string(),
  location: z.string(),
  institute: z.string(),
});

interface BasePayload {
  fram_id: string;
  cam_id: string;
  [key: string]: any;
}

export async function mapCameraInfo(payload: BasePayload, token: string) {
  try {
    const response = await axios.get(
      `https://tesa-api.crma.dev/api/object-detection/info/${payload.cam_id}`,
      {
        headers: {
          "x-camera-token": token,
          "Accept": "application/json",
        },
      }
    );

    const apiData = response.data;
    
    const cameraInfo = {
      name: String(apiData.name || ""),
      sort: String(apiData.sort || ""),
      location: String(apiData.location || ""),
      institute: String(apiData.Institute || apiData.institute || ""),
    };

    const validated = cameraInfoSchema.parse(cameraInfo);

    return {
      ...payload,
      token_id: {
        camera_info: validated,
      },
    };
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`API call failed: ${error.message}`);
    }
    throw new Error(`Failed to map camera info: ${error}`);
  }
}

// Usage example:
// const payload = {
//   fram_id: "1",
//   cam_id: "CAM001",
//   timestamp: new Date(),
//   objects: [],
// };
// 
// const token = "your-camera-token-here";
// const enrichedPayload = await mapCameraInfo(payload, token);
// console.log(enrichedPayload);
