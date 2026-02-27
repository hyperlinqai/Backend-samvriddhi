import { prisma } from '../../infrastructure/database/prisma';

/**
 * Get all subordinate user IDs for a given user by recursively
 * walking the reportingTo chain using a raw recursive CTE query.
 *
 * Returns [selfId, ...allSubordinateIds]
 */
export async function getDownlineUserIds(userId: string): Promise<string[]> {
    const result = await prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE downline AS (
            SELECT id FROM users WHERE id = ${userId}
            UNION ALL
            SELECT u.id FROM users u
            INNER JOIN downline d ON u."reportingTo" = d.id
        )
        SELECT id FROM downline
    `;

    return result.map((r) => r.id);
}

/**
 * Get the list of user IDs visible to the current request user.
 * - Super Admin: returns null (meaning "all users", no filter needed)
 * - Everyone else: returns their own downline IDs
 */
export async function getVisibleUserIds(
    userId: string,
    roleName: string
): Promise<string[] | null> {
    if (roleName === 'SUPER_ADMIN') {
        return null; // null = no filter, see everything
    }

    return getDownlineUserIds(userId);
}
