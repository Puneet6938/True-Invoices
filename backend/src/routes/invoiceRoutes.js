import express from "express";
import { Customer } from "../models/Customer.js";
import { Invoice } from "../models/Invoice.js";
import { Payment } from "../models/Payment.js";
import { Product } from "../models/Product.js";
import { calculateInvoiceTotals, deriveInvoiceStatus } from "../utils/invoiceMath.js";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber.js";
import { httpError } from "../utils/httpError.js";
import { parseVoiceInvoiceCommand } from "../utils/voiceInvoiceParser.js";

const router = express.Router();

async function syncInvoiceStatuses(ownerId) {
  const invoices = await Invoice.find({ owner: ownerId });

  await Promise.all(
    invoices.map(async (invoice) => {
      const nextStatus = deriveInvoiceStatus(invoice);

      if (nextStatus !== invoice.status) {
        invoice.status = nextStatus;
        await invoice.save();
      }
    })
  );
}

function getProductQuantityMap(items = []) {
  return items.reduce((map, item) => {
    if (!item.product) {
      return map;
    }

    const productId = String(item.product);
    map.set(productId, (map.get(productId) || 0) + Number(item.quantity || 0));
    return map;
  }, new Map());
}

async function restoreInvoiceStock(items = []) {
  const quantityMap = getProductQuantityMap(items);

  if (quantityMap.size === 0) {
    return;
  }

  await Product.bulkWrite(
    Array.from(quantityMap.entries()).map(([productId, quantity]) => ({
      updateOne: {
        filter: { _id: productId },
        update: { $inc: { stock: quantity } },
      },
    }))
  );
}

async function reduceInvoiceStock(ownerId, items = []) {
  const quantityMap = getProductQuantityMap(items);

  if (quantityMap.size === 0) {
    return;
  }

  const productIds = Array.from(quantityMap.keys());
  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
  });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const [productId, quantity] of quantityMap.entries()) {
    const product = productMap.get(productId);

    if (!product) {
      throw httpError(400, "One or more products are invalid");
    }

    if (Number(product.stock || 0) < quantity) {
      throw httpError(400, `Only ${product.stock} ${product.unit || "units"} available for ${product.name}`);
    }
  }

  await Product.bulkWrite(
    Array.from(quantityMap.entries()).map(([productId, quantity]) => ({
      updateOne: {
        filter: { _id: productId, owner: ownerId, stock: { $gte: quantity } },
        update: { $inc: { stock: -quantity } },
      },
    }))
  );
}

async function buildInvoiceItems(ownerId, items = []) {
  const productIds = items.map((item) => item.productId).filter(Boolean);

  if (productIds.length !== items.length) {
    throw httpError(400, "Each invoice item must use a saved product from stock");
  }

  const products = await Product.find({
    _id: { $in: productIds },
    owner: ownerId,
  });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const rawItems = items.map((item) => {
    const product = productMap.get(String(item.productId));

    if (!product) {
      throw httpError(400, "One or more products are invalid");
    }

    return {
      product: product._id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? product.price,
      gstRate: item.gstRate ?? product.gstRate ?? 0,
      discountRate: item.discountRate ?? 0,
    };
  });

  if (
    rawItems.some(
      (item) =>
        !item.name ||
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        !Number.isFinite(Number(item.unitPrice)) ||
        Number(item.unitPrice) < 0 ||
        !Number.isFinite(Number(item.gstRate)) ||
        Number(item.gstRate) < 0 ||
        !Number.isFinite(Number(item.discountRate)) ||
        Number(item.discountRate) < 0 ||
        Number(item.discountRate) > 100
    )
  ) {
    throw httpError(400, "Each invoice item must have product, quantity, unit price, and discount between 0 and 100");
  }

  return rawItems;
}

router.get("/stats/overview", async (req, res, next) => {
  try {
    await syncInvoiceStatuses(req.user._id);
    const invoices = await Invoice.find({ owner: req.user._id });

    const overview = invoices.reduce(
      (acc, invoice) => {
        acc.totalInvoices += 1;
        acc.totalRevenue += invoice.totalAmount;
        acc.totalCollected += invoice.amountPaid;
        acc.totalPending += invoice.balanceDue;
        acc[invoice.status] += 1;
        return acc;
      },
      {
        totalInvoices: 0,
        totalRevenue: 0,
        totalCollected: 0,
        totalPending: 0,
        unpaid: 0,
        partial: 0,
        paid: 0,
        overdue: 0,
      }
    );

    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    await syncInvoiceStatuses(req.user._id);
    const invoices = await Invoice.find({ owner: req.user._id })
      .populate("customer")
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      owner: req.user._id,
    }).populate("customer");

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    const nextStatus = deriveInvoiceStatus(invoice);
    if (nextStatus !== invoice.status) {
      invoice.status = nextStatus;
      await invoice.save();
    }

    const payments = await Payment.find({
      owner: req.user._id,
      invoice: invoice._id,
    }).sort({ paymentDate: -1 });

    res.json({ invoice, payments });
  } catch (error) {
    next(error);
  }
});

router.post("/voice-draft", async (req, res, next) => {
  try {
    const { command } = req.body;

    if (!String(command || "").trim()) {
      throw httpError(400, "Voice command is required");
    }

    const [customers, products] = await Promise.all([
      Customer.find({ owner: req.user._id }),
      Product.find({ owner: req.user._id }),
    ]);

    const parsed = parseVoiceInvoiceCommand(command, { customers, products });
    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { customerId, issueDate, dueDate, items, notes } = req.body;

    if (!customerId || !issueDate || !dueDate || !Array.isArray(items) || items.length === 0) {
      throw httpError(400, "Customer, dates, and invoice items are required");
    }

    const customer = await Customer.findOne({
      _id: customerId,
      owner: req.user._id,
    });

    if (!customer) {
      throw httpError(404, "Customer not found");
    }

    const rawItems = await buildInvoiceItems(req.user._id, items);
    const { normalizedItems, subtotal, discountAmount, taxAmount, roundOff, totalAmount } =
      calculateInvoiceTotals(rawItems);
    await reduceInvoiceStock(req.user._id, normalizedItems);

    let invoice;
    try {
      invoice = await Invoice.create({
        owner: req.user._id,
        customer: customer._id,
        invoiceNumber: generateInvoiceNumber(),
        issueDate,
        dueDate,
        items: normalizedItems,
        subtotal,
        discountAmount,
        taxAmount,
        roundOff,
        totalAmount,
        amountPaid: 0,
        balanceDue: totalAmount,
        status: "unpaid",
        notes,
      });
    } catch (error) {
      await restoreInvoiceStock(normalizedItems);
      throw error;
    }

    const populatedInvoice = await Invoice.findById(invoice._id).populate("customer");
    res.status(201).json(populatedInvoice);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { customerId, issueDate, dueDate, items, notes } = req.body;

    if (!customerId || !issueDate || !dueDate || !Array.isArray(items) || items.length === 0) {
      throw httpError(400, "Customer, dates, and invoice items are required");
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    const customer = await Customer.findOne({
      _id: customerId,
      owner: req.user._id,
    });

    if (!customer) {
      throw httpError(404, "Customer not found");
    }

    const rawItems = await buildInvoiceItems(req.user._id, items);
    const { normalizedItems, subtotal, discountAmount, taxAmount, roundOff, totalAmount } =
      calculateInvoiceTotals(rawItems);

    if (invoice.amountPaid > totalAmount) {
      throw httpError(400, "Invoice total cannot be lower than the amount already paid");
    }

    const previousItems = invoice.items.map((item) => item.toObject());

    await restoreInvoiceStock(previousItems);
    try {
      await reduceInvoiceStock(req.user._id, normalizedItems);

      invoice.customer = customer._id;
      invoice.issueDate = issueDate;
      invoice.dueDate = dueDate;
      invoice.items = normalizedItems;
      invoice.subtotal = subtotal;
      invoice.discountAmount = discountAmount;
      invoice.taxAmount = taxAmount;
      invoice.roundOff = roundOff;
      invoice.totalAmount = totalAmount;
      invoice.balanceDue = Number((totalAmount - invoice.amountPaid).toFixed(2));
      invoice.status = deriveInvoiceStatus(invoice);
      invoice.notes = notes ?? "";
      await invoice.save();
    } catch (error) {
      await reduceInvoiceStock(req.user._id, previousItems);
      throw error;
    }

    const populatedInvoice = await Invoice.findById(invoice._id).populate("customer");
    res.json(populatedInvoice);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    await Payment.deleteMany({
      owner: req.user._id,
      invoice: invoice._id,
    });
    await restoreInvoiceStock(invoice.items);
    await invoice.deleteOne();

    res.json({ message: "Invoice deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/recalculate-status", async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!invoice) {
      throw httpError(404, "Invoice not found");
    }

    invoice.status = deriveInvoiceStatus(invoice);
    await invoice.save();
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

export default router;
