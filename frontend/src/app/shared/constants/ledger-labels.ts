const LEDGER_LABELS: Record<string, string> = {
  opening_balance: 'Saldo inicial',
  transfer_debit: 'Transferência enviada',
  transfer_credit: 'Transferência recebida',
  purchase_debit: 'Compra',
  purchase_credit: 'Venda',
  purchase_fee: 'Taxa da loja',
  purchase_cashback: 'Cashback',
};

export function ledgerKindLabel(kind: string): string {
  return LEDGER_LABELS[kind] ?? kind;
}
