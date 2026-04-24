import express from "express";
import { Customer } from "../models/Customer.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const customers = await Customer.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, gstNumber, address } = req.body;

    if (!name || !phone) {
      throw httpError(400, "Customer name and phone are required");
    }

    const customer = await Customer.create({
      owner: req.user._id,
      name,
      email,
      phone,
      gstNumber,
      address,
    });

    res.status(201).json(customer);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!customer) {
      throw httpError(404, "Customer not found");
    }

    Object.assign(customer, req.body);
    await customer.save();
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

export default router;
