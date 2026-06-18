const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const { env } = require('./config/env');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const transfersRouter = require('./routes/transfers');
const storeRouter = require('./routes/store');
const healthRouter = require('./routes/health');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

if (env.isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
    },
  })
);

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/dashboard', requireAuth, dashboardRouter);
app.use('/transfers', requireAuth, transfersRouter);
app.use('/store', storeRouter);

app.use(errorHandler);

module.exports = app;
