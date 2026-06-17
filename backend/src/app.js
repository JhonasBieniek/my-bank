const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { env } = require('./config/env');
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const transfersRouter = require('./routes/transfers');
const healthRouter = require('./routes/health');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/dashboard', requireAuth, dashboardRouter);
app.use('/transfers', requireAuth, transfersRouter);

app.use(errorHandler);

module.exports = app;
