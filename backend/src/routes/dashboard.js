const express = require('express');
const { prisma } = require('../lib/prisma');
const { sanitizeUser } = require('../lib/sanitizeUser');
const { sanitizeLedgerEntry } = require('../lib/sanitizeLedgerEntry');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { accountType: 'User', accountId: userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    res.json({
      user: sanitizeUser(user),
      ledger_entries: ledgerEntries.map(sanitizeLedgerEntry),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
