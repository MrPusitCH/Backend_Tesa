-- CreateTable
CREATE TABLE "public"."Mark" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "latDeg" DOUBLE PRECISION NOT NULL,
    "lonDeg" DOUBLE PRECISION NOT NULL,
    "radiusM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mark_createdAt_idx" ON "public"."Mark"("createdAt");

-- CreateIndex
CREATE INDEX "Mark_latDeg_lonDeg_idx" ON "public"."Mark"("latDeg", "lonDeg");
