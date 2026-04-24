import { env } from "../config/env.js";

export async function sendPaymentReminder({ customerPhone, customerName, invoiceNumber, amount, dueDate }) {
  const message = `Hi ${customerName}, reminder for invoice ${invoiceNumber}. Pending amount: Rs ${amount}. Due date: ${new Date(
    dueDate
  ).toLocaleDateString("en-IN")}. Please complete the payment.`;

  const digits = String(customerPhone || "").replace(/\D/g, "");
  const url = `${env.whatsappBaseUrl}/${digits}?text=${encodeURIComponent(message)}`;

  return {
    delivered: false,
    provider: "wa.me-link",
    message,
    url,
  };
}
