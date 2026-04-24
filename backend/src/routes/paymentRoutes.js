import express from "express";
import { Invoice } from "../models/Invoice.js";
import { Payment } from "../models/Payment.js";
import { deriveInvoiceStatus } from "../utils/invoiceMath.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

async function recalculateInvoice(invoiceId, ownerId) {
  const invoice = await Invoice.findOne({
    _id: invoiceId,
    owner: ownerId,
  });

  if (!invoice) {
    throw httpError(404, "Invoice not found");
  }

  const payments = await Payment.find({
    owner: ownerId,
    invoice: invoiceId,
  });

  const amountPaid = Number(payments.reduce((sum, payment) => sum + Number(payment.amount), 0).toFixed(2));
  invoice.amountPaid = amountPaid;
  invoice.balanceDue = Number((invoice.totalAmount - amountPaid).toFixed(2));
  invoice.status = deriveInvoiceStatus(invoice);
  await invoice.save();

  return invoice;
}

router.post("/", async (req, res, next) => {
  try {
    const { invoiceId, amount, paymentDate, method, note } = req.body;
    const normalizedAmount = Number(amount);

    if (!invoiceId || Number.isNaN(normalizedAmount) || normalizedAmount <= 0 || !paymentDate) {
      throw httpError(400, "Invoice, amount, and payment date are required");
    }

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      owner: req.user._id,
    });

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    if (normalizedAmount > invoice.balanceDue) {
      throw httpError(400, "Payment cannot exceed the balance due");
    }

    const payment = await Payment.create({
      owner: req.user._id,
      invoice: invoice._id,
      amount: normalizedAmount,
      paymentDate,
      method,
      note,
    });

    const updatedInvoice = await recalculateInvoice(invoice._id, req.user._id);

    res.status(201).json({ payment, invoice: updatedInvoice });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!payment) {
      throw httpError(404, "Payment not found");
    }

    const { amount, paymentDate, method, note } = req.body;
    const normalizedAmount = Number(amount);

    if (Number.isNaN(normalizedAmount) || normalizedAmount <= 0 || !paymentDate) {
      throw httpError(400, "Valid payment amount and payment date are required");
    }

    const invoice = await Invoice.findOne({
      _id: payment.invoice,
      owner: req.user._id,
    });

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    const siblingPayments = await Payment.find({
      owner: req.user._id,
      invoice: invoice._id,
      _id: { $ne: payment._id },
    });

    const otherPaidAmount = siblingPayments.reduce((sum, item) => sum + Number(item.amount), 0);
    if (otherPaidAmount + normalizedAmount > invoice.totalAmount) {
      throw httpError(400, "Updated payment exceeds the invoice total");
    }

    payment.amount = normalizedAmount;
    payment.paymentDate = paymentDate;
    payment.method = method;
    payment.note = note ?? "";
    await payment.save();

    const updatedInvoice = await recalculateInvoice(invoice._id, req.user._id);

    res.json({ payment, invoice: updatedInvoice });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const payments = await Payment.find({ owner: req.user._id })
      .populate({
        path: "invoice",
        populate: { path: "customer" },
      })
      .sort({ paymentDate: -1 });

    res.json(payments);
  } catch (error) {
    next(error);
  }
});

export default router;
