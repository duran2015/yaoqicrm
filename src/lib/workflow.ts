export function assertTransition(
  current: string,
  next: string,
  allowed: Record<string, readonly string[]>
) {
  if (!allowed[current]?.includes(next)) {
    throw new Error(`状态不能从 ${current} 变更为 ${next}`);
  }
}

export function calculateInventory(
  transactions: Array<{ type: string; quantity: number }>
) {
  return transactions.reduce((sum, transaction) => {
    if (transaction.type === "RECEIVE") return sum + transaction.quantity;
    if (transaction.type === "DISTRIBUTE" || transaction.type === "RETURN") {
      return sum - transaction.quantity;
    }
    if (transaction.type === "ADJUST") return sum + transaction.quantity;
    throw new Error(`未知样品事务类型: ${transaction.type}`);
  }, 0);
}
