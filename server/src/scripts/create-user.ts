// Creates an account by hand, since self-service registration is off by default.
// Usage: npm run create-user -w server -- <email> <name>   (password read from GERARD_NEW_PASSWORD)
import { PrismaClient } from "@prisma/client";
// @ts-ignore
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const [email, name] = process.argv.slice(2);
  const password = process.env.GERARD_NEW_PASSWORD;
  if (!email || !name || !password) {
    console.error("Usage: GERARD_NEW_PASSWORD=... npm run create-user -w server -- <email> <name>");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters long.");
    process.exit(1);
  }
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Created user ${user.id} <${user.email}>`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
