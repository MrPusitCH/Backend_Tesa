// src/services/marks.ts
import { prisma } from "../db/prisma.js";
import type { CreateMarkInput, UpdateMarkInput } from "../schemas/mark.js";

// Generate mark ID: MARK-${timestamp}-${random}
function generateMarkId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `MARK-${timestamp}-${random}`;
}

export async function createMark(input: CreateMarkInput) {
  const [latDeg, lonDeg] = input.pos;
  
  const mark = await (prisma as any).mark.create({
    data: {
      id: generateMarkId(),
      name: input.name,
      color: input.color,
      latDeg,
      lonDeg,
      radiusM: input.radius,
    },
  });
  
  return mark;
}

export async function getMarkById(id: string) {
  return prisma.mark.findUnique({
    where: { id },
  });
}

export async function getAllMarks() {
  return prisma.mark.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function updateMark(id: string, input: UpdateMarkInput) {
  const updateData: any = {};
  
  if (input.name !== undefined) updateData.name = input.name;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.radius !== undefined) updateData.radiusM = input.radius;
  if (input.pos !== undefined) {
    const [latDeg, lonDeg] = input.pos;
    updateData.latDeg = latDeg;
    updateData.lonDeg = lonDeg;
  }
  
  return (prisma as any).mark.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteMark(id: string) {
  return prisma.mark.delete({
    where: { id },
  });
}

export async function clearAllMarks() {
  return prisma.mark.deleteMany({});
}

