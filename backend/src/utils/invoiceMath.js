export function calculateInvoiceTotals(items) {
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const gstRate = Number(item.gstRate);
    const base = quantity * unitPrice;
    const tax = (base * gstRate) / 100;
    const lineTotal = Number((base + tax).toFixed(2));

    return {
      ...item,
      quantity,
      unitPrice,
      gstRate,
      lineTotal,
    };
  });

  const subtotal = Number(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)
  );
  const grossTotal = Number(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const taxAmount = Number((grossTotal - subtotal).toFixed(2));
  const totalAmount = Math.round(grossTotal);
  const roundOff = Number((totalAmount - grossTotal).toFixed(2));

  return {
    normalizedItems,
    subtotal,
    taxAmount,
    roundOff,
    totalAmount,
  };
}

export function deriveInvoiceStatus(invoice) {
  if (invoice.balanceDue <= 0) {
    return "paid";
  }

  if (invoice.amountPaid > 0 && invoice.balanceDue > 0) {
    return "partial";
  }

  if (new Date(invoice.dueDate) < new Date()) {
    return "overdue";
  }

  return "unpaid";
}
