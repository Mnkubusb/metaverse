// Promotes an existing account to Admin. Signup always creates regular users.
// Usage: pnpm db:make-admin <username>
const client = require("../client.js");

async function main() {
    const username = process.argv[2];
    if (!username) {
        console.error("Usage: pnpm db:make-admin <username>");
        process.exitCode = 1;
        return;
    }
    const user = await client.user.findUnique({ where: { username } });
    if (!user) {
        console.error(`No user named "${username}". Sign up first, then run this again.`);
        process.exitCode = 1;
        return;
    }
    await client.user.update({ where: { id: user.id }, data: { role: "Admin" } });
    console.log(`${username} is now an Admin. They need to sign in again to get an admin token.`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => client.$disconnect());
