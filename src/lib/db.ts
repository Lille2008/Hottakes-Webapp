// Prisma-Client-Initialisierung mit Singleton-Pattern für Entwicklungsmodus.
// Stellt sicher, dass bei Hot-Reload nicht mehrere DB-Verbindungen geöffnet werden.
import { PrismaClient } from '@prisma/client';

// Optionales Mapping älterer ENV-Variablennamen -> erwartet wird DATABASE_URL
if (!process.env.DATABASE_URL && process.env.DB_URL) {
  process.env.DATABASE_URL = process.env.DB_URL;
}

// Globalen Container nutzen, um Prisma-Instanz wiederzuverwenden
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Existierende Instanz nutzen oder neue erstellen
const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Nur außerhalb von Production im Global-Scope cachen
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma; // Standard-Export für DB-Zugriff
