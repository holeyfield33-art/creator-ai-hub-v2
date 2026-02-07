import { PrismaClient } from '@prisma/client'

// Shared PrismaClient singleton to prevent connection pool exhaustion.
// Each file previously created its own instance; now they all share this one.
const prisma = new PrismaClient()

export default prisma
