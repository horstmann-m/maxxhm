// Bootstraps the single owner account this solo-trader CRM runs as.
// Usage: OWNER_EMAIL=you@example.com OWNER_PASSWORD=... npm run create-owner
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;

if (!email || !password) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD env vars first.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash },
  create: { email, passwordHash, role: "owner" },
});

console.log(`Owner account ready: ${user.email}`);
await prisma.$disconnect();
