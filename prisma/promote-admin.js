/**
 * Promote a user to admin by email.
 * Usage:  node prisma/promote-admin.js
 * Reads ADMIN_EMAIL from .env
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL;
    if (!email) {
        console.error('❌ Set ADMIN_EMAIL in your .env file first.');
        process.exit(1);
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
        console.error(`❌ No user found with email: ${email}`);
        process.exit(1);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true }
    });

    console.log(`✅ ${user.name} (${user.email}) is now an admin!`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
