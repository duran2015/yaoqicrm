export function signedQuantity(type: string, quantity: number) {
  if (!Number.isInteger(quantity)) throw new Error("数量必须为整数");
  if (quantity === 0) throw new Error("数量不能为 0");
  if (type === "ADJUST") return quantity;
  if (quantity < 0) throw new Error("数量必须为正整数");
  if (type === "RECEIVE") return quantity;
  if (type === "DISTRIBUTE" || type === "RETURN") return -quantity;
  throw new Error(`未知样品事务类型: ${type}`);
}
