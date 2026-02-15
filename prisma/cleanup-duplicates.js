/**
 * Cleanup script to remove duplicate items from database
 * Run with: node prisma/cleanup-duplicates.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting duplicate cleanup...\n');

    // Find duplicate items (same title and user)
    const duplicates = await prisma.$queryRaw`
        SELECT title, user_id, COUNT(*) as count, MIN(id) as keep_id
        FROM items 
        GROUP BY title, user_id 
        HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} sets of duplicates\n`);

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found!');
        return;
    }

    let totalDeleted = 0;

    for (const dup of duplicates) {
        console.log(`📦 "${dup.title}" (user ${dup.user_id}): ${dup.count} copies, keeping id ${dup.keep_id}`);

        // Delete all duplicates except the one with the lowest ID
        const result = await prisma.item.deleteMany({
            where: {
                title: dup.title,
                userId: dup.user_id,
                id: { not: Number(dup.keep_id) }
            }
        });

        totalDeleted += result.count;
        console.log(`   ✓ Deleted ${result.count} duplicates`);
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalDeleted} duplicate items.`);
}

main()
    .catch((e) => {
        console.error('❌ Cleanup error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
