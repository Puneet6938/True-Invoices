function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getRoundOffAmount(invoice) {
  if (typeof invoice?.roundOff === "number") {
    return invoice.roundOff;
  }

  return 0;
}

function getRoundedTotalAmount(invoice) {
  return Number(Number(invoice?.totalAmount || 0).toFixed(2));
}

function numberToWordsUnderThousand(value) {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (value < 20) {
    return ones[value];
  }

  if (value < 100) {
    return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`.trim();
  }

  return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${numberToWordsUnderThousand(value % 100)}` : ""}`.trim();
}

function amountToWords(value) {
  const number = Math.floor(Number(value || 0));

  if (!number) {
    return "Zero Rupees Only";
  }

  const parts = [
    { value: 10000000, label: "Crore" },
    { value: 100000, label: "Lakh" },
    { value: 1000, label: "Thousand" },
    { value: 1, label: "" },
  ];

  let remaining = number;
  const words = [];

  parts.forEach((part) => {
    if (remaining >= part.value) {
      const chunk = Math.floor(remaining / part.value);
      remaining %= part.value;
      const text = numberToWordsUnderThousand(chunk);
      if (text) {
        words.push([text, part.label].filter(Boolean).join(" "));
      }
    }
  });

  return `${words.join(" ")} Rupees Only`;
}

export function InvoicePrint({ invoice, firm, user }) {
  if (!invoice || !firm) return null;

  const isPaid = invoice.status === "paid" || Number(invoice.balanceDue || 0) <= 0;
  const roundedTotalAmount = getRoundedTotalAmount(invoice);
  const roundOff = getRoundOffAmount(invoice);

  return (
    <div className="print-sheet">
      {firm.showPaidStamp && isPaid ? <div className="print-paid-stamp">Paid</div> : null}

      <div className="print-banner">
        <div>
          <p className="print-eyebrow">GST Ready Billing</p>
          <h1>{firm.firmName}</h1>
          <p>{firm.address}</p>
        </div>
        <div className="print-status-block">
          <h2>Tax Invoice</h2>
          <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
        </div>
      </div>

      <div className="print-meta-grid">
        <div className="print-info-card">
          <span className="print-label">From</span>
          <strong>{firm.firmName}</strong>
          <p>Mobile: {firm.mobileNumber || "-"}</p>
          <p>Email: {user?.email || "-"}</p>
          <p>GSTIN: {firm.gstNumber || "-"}</p>
        </div>

        <div className="print-info-card">
          <span className="print-label">Bill To</span>
          <strong>{invoice.customer?.name || "-"}</strong>
          <p>{invoice.customer?.address || "-"}</p>
          <p>Phone: {invoice.customer?.phone || "-"}</p>
          <p>GSTIN: {invoice.customer?.gstNumber || "-"}</p>
        </div>

        <div className="print-info-card">
          <span className="print-label">Invoice Details</span>
          <p>Invoice No: {invoice.invoiceNumber}</p>
          <p>Issue Date: {new Date(invoice.issueDate).toLocaleDateString("en-IN")}</p>
          <p>Due Date: {new Date(invoice.dueDate).toLocaleDateString("en-IN")}</p>
          <p>Prepared By: {user?.name || "True Invoices"}</p>
        </div>
      </div>

      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Disc %</th>
            <th>GST %</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{index + 1}</td>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{formatCurrency(item.unitPrice)}</td>
              <td>{Number(item.discountRate || 0)}%</td>
              <td>{item.gstRate}%</td>
              <td>{formatCurrency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-summary-grid">
        <div className="print-summary-card">
          <span className="print-label">Amount In Words</span>
          <strong>{amountToWords(roundedTotalAmount)}</strong>
          {invoice.notes ? <p>Notes: {invoice.notes}</p> : <p>Thank you for your business.</p>}
        </div>

        <div className="print-totals-card">
          <div className="print-total-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(invoice.subtotal)}</strong>
          </div>
          <div className="print-total-row">
            <span>Discount</span>
            <strong>{formatCurrency(invoice.discountAmount)}</strong>
          </div>
          <div className="print-total-row">
            <span>Tax</span>
            <strong>{formatCurrency(invoice.taxAmount)}</strong>
          </div>
          <div className="print-total-row">
            <span>Round Off</span>
            <strong>{formatCurrency(roundOff)}</strong>
          </div>
          <div className="print-total-row">
            <span>Final Total</span>
            <strong>{formatCurrency(roundedTotalAmount)}</strong>
          </div>
          <div className="print-total-row">
            <span>Paid</span>
            <strong>{formatCurrency(invoice.amountPaid)}</strong>
          </div>
          <div className="print-total-row balance">
            <span>Balance Due</span>
            <strong>{formatCurrency(invoice.balanceDue)}</strong>
          </div>
        </div>
      </div>

      <div className="print-footer">
        <div className="print-footer-note">
          <span className="print-label">Status</span>
          <p>{invoice.status}</p>
        </div>

        {firm.showSignature ? (
          <div className="print-signature">
            <span className="print-label">{firm.signatureLabel || "Authorized Signatory"}</span>
            <div className="signature-line" />
            <strong>{firm.signatureName || user?.name || firm.firmName}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
