const { PrismaClient } = require("./node_modules/.prisma/client");

const client = new PrismaClient();

module.exports = client;
module.exports.default = client;
