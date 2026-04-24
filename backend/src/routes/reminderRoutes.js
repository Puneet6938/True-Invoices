import express from "express";
import { Invoice } from "../models/Invoice.js";
import { sendPaymentReminder } from "../services/whatsappService.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

router.post("/:invoiceId/whatsapp", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      owner: req.user._id,
    }).populate("customer");

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    if (!invoice.customer?.phone) {
      throw httpError(400, "Customer phone number is required");
    }

    const result = await sendPaymentReminder({
      customerPhone: invoice.customer.phone,
      customerName: invoice.customer.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.balanceDue,
      dueDate: invoice.dueDate,
    });

    invoice.lastReminderAt = new Date();
    await invoice.save();

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
