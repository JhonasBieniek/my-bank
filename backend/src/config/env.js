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
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
    storeFeePercent: Number(process.env.STORE_FEE_PERCENT ?? 2),
    uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR ?? 'uploads/products'),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024),
    isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
}

module.exports = { env };
