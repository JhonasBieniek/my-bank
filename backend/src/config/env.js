const path = require("path");
require("dotenv").config({
    path: path.resolve(__dirname, "../../../.env"),
});

function requireEnv(name) {
    const value = process.env[name];
    if(!value){
        throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
    }
    return value;
}

const env = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.API_PORT ?? 3000),
    databaseUrl: requireEnv('DATABASE_URL'),
    sessionSecret: requireEnv('SESSION_SECRET'),
}

module.exports = { env };
