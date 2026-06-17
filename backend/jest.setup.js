const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://test:test@127.0.0.1:3306/test';
process.env.SESSION_SECRET ??= 'test-session-secret-for-jest';
