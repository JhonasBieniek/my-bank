const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { env } = require('./config/env');
const authRouter = require('./routes/auth');
const healthRouter = require('./routes/health');
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

app.use(errorHandler);

module.exports = app;
