import { prisma } from "../db/prisma.js";

// Save frame with only the exact structure specified
export async function saveFrame(params: {
  framId: string;
  camId: string;
  cameraName: string;
  cameraSort: string;
  cameraLocation: string;
  cameraInstitute: string;
  timestamp: Date;
  imageWidth: number;
  imageHeight: number;
  objects: Array<{
    objId: string;
    type?: string;
    lat: number;
    lng: number;
    alt: number;
    speedKt: number;
  }>;
}) {
  const rec = await (prisma as any).frame.create({
    data: {
      framId: params.framId,
      camId: params.camId,
      cameraName: params.cameraName,
      cameraSort: params.cameraSort,
      cameraLocation: params.cameraLocation,
      cameraInstitute: params.cameraInstitute,
      timestamp: params.timestamp,
      imageWidth: params.imageWidth,
      imageHeight: params.imageHeight,
      objects: {
        create: params.objects.map(obj => ({
          objId: obj.objId,
          type: obj.type ?? null,
          lat: obj.lat,
          lng: obj.lng,
          alt: obj.alt,
          speedKt: obj.speedKt,
        })),
      },
    },
    select: { id: true }
  });
  return rec.id;
}

// Get latest frame
export async function getLatestFrame() {
  return (prisma as any).frame.findFirst({
    orderBy: { timestamp: "desc" },
    include: {
      objects: true,
    },
  });
}

// Get frames by cam_id
export async function getFramesByCamId(camId: string, limit = 100) {
  return (prisma as any).frame.findMany({
    where: { camId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      objects: true,
    },
  });
}

// Get all frames
export async function getAllFrames(limit = 100) {
  return (prisma as any).frame.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      objects: true,
    },
  });
}


