export function calculateInvoiceTotals(items) {
  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const gstRate = Number(item.gstRate);
    const discountRate = Number(item.discountRate || 0);
    const base = quantity * unitPrice;
    const discountAmount = Number(((base * discountRate) / 100).toFixed(2));
    const taxableAmount = Number((base - discountAmount).toFixed(2));
    const tax = (taxableAmount * gstRate) / 100;
    const lineTotal = Number((taxableAmount + tax).toFixed(2));

    return {
      ...item,
      quantity,
      unitPrice,
      gstRate,
      discountRate,
      discountAmount,
      lineTotal,
    };
  });

  const subtotal = Number(
    normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)
  );
  const discountAmount = Number(normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0).toFixed(2));
  const grossTotal = Number(normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const taxAmount = Number((grossTotal - (subtotal - discountAmount)).toFixed(2));
  const totalAmount = Math.round(grossTotal);
  const roundOff = Number((totalAmount - grossTotal).toFixed(2));

  return {
    normalizedItems,
    subtotal,
    discountAmount,
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
