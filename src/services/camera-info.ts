// src/services/camera-info.ts
import axios from "axios";
import { z } from "zod";

// Zod schema for camera_info validation
const cameraInfoSchema = z.object({
  name: z.string(),
  sort: z.string(),
  location: z.string(),
  institute: z.string(),
});

// Type for the API response (flexible to handle various response shapes)
type CameraApiResponse = {
  success?: boolean;
  data?: {
    name?: string;
    sort?: string | number;
    location?: string;
    Institute?: string;
    institute?: string;
    [key: string]: unknown;
  };
  // Also support direct structure (fallback)
  name?: string;
  sort?: string | number;
  location?: string;
  Institute?: string;
  institute?: string;
  [key: string]: unknown;
};

// Type for the input payload
type PayloadWithCamId = {
  fram_id: string;
  cam_id: string;
  [key: string]: unknown;
};

// Type for the output payload
type PayloadWithTokenId = PayloadWithCamId & {
  token_id: {
    camera_info: {
      name: string;
      sort: string;
      location: string;
      institute: string;
    };
  };
};

/**
 * Maps camera information from external API to the frame payload structure.
 * 
 * @param payload - Payload containing fram_id and cam_id
 * @param token - Camera token for API authentication
 * @returns Merged payload with token_id.camera_info populated
 * @throws Error if API call fails or response is invalid
 * 
 * @example
 * ```typescript
 * const payload = {
 *   fram_id: "123",
 *   cam_id: "camera-1",
 *   timestamp: new Date().toISOString(),
 *   image_info: { width: 1920, height: 1080 },
 *   objects: []
 * };
 * 
 * const token = "your-camera-token";
 * 
 * try {
 *   const enriched = await mapCameraInfo(payload, token);
 *   console.log(enriched.token_id.camera_info);
 * } catch (error) {
 *   console.error("Failed to map camera info:", error);
 * }
 * ```
 */
export async function mapCameraInfo(
  payload: PayloadWithCamId,
  token: string
): Promise<PayloadWithTokenId> {
  const { cam_id } = payload;

  if (!cam_id) {
    throw new Error("cam_id is required in payload");
  }

  if (!token) {
    throw new Error("token is required");
  }

  try {
    // Call external API to get camera information
    const apiUrl = `https://tesa-api.crma.dev/api/object-detection/info/${cam_id}`;
    console.log(`📡 Fetching camera info from API: ${apiUrl} with cam_id: ${cam_id}`);
    
    const response = await axios.get<CameraApiResponse>(
      apiUrl,
      {
        headers: {
          "x-camera-token": token,
          "Accept": "application/json",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    const apiResponse = response.data;
    console.log(`✅ API Response received:`, JSON.stringify(apiResponse, null, 2));

    // Handle nested response structure (data property) or direct structure
    const apiData = apiResponse.data || apiResponse;
    console.log(`📦 Extracted camera data:`, JSON.stringify(apiData, null, 2));

    // Map API response to camera_info structure
    // Extract and convert fields with proper fallbacks
    const name = typeof apiData.name === "string" ? apiData.name : "";
    const sort = apiData.sort !== undefined ? String(apiData.sort) : "";
    const location = typeof apiData.location === "string" ? apiData.location : "";
    
    // Use "Institute" or "institute" from response (case-insensitive)
    const institute = 
      (typeof apiData.Institute === "string" ? apiData.Institute : null) ||
      (typeof apiData.institute === "string" ? apiData.institute : null) ||
      "";

    // Validate the mapped data with Zod
    const cameraInfo = cameraInfoSchema.parse({
      name,
      sort,
      location,
      institute,
    });

    console.log(`✅ Mapped camera_info:`, cameraInfo);

    // Return merged payload with token_id.camera_info
    return {
      ...payload,
      token_id: {
        camera_info: cameraInfo,
      },
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // API returned an error response
        throw new Error(
          `API error: ${error.response.status} - ${error.response.statusText}. ` +
          `Failed to fetch camera info for cam_id: ${cam_id}`
        );
      } else if (error.request) {
        // Request was made but no response received
        throw new Error(
          `No response from API. Failed to fetch camera info for cam_id: ${cam_id}`
        );
      } else {
        // Error setting up the request
        throw new Error(`Request setup error: ${error.message}`);
      }
    } else if (error instanceof z.ZodError) {
      // Zod validation error
      throw new Error(
        `Invalid camera info structure: ${error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    } else {
      // Unknown error
      throw new Error(
        `Unexpected error while mapping camera info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

