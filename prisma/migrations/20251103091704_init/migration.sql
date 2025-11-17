-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tenantId" INTEGER,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "log" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Upload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FatoConferencia" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tenantId" INTEGER,
    "uploadId" INTEGER NOT NULL,
    "datahora" DATETIME,
    "datadia" DATETIME,
    "conferente" TEXT,
    "cidade" TEXT,
    "endereco" TEXT,
    "qtdpedidos" INTEGER NOT NULL DEFAULT 1,
    "qtditens" INTEGER,
    CONSTRAINT "FatoConferencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FatoConferencia_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FatoConferencia_datadia_idx" ON "FatoConferencia"("datadia");

-- CreateIndex
CREATE INDEX "FatoConferencia_conferente_idx" ON "FatoConferencia"("conferente");

-- CreateIndex
CREATE INDEX "FatoConferencia_cidade_idx" ON "FatoConferencia"("cidade");
