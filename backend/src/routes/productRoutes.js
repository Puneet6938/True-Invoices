import express from "express";
import { Product } from "../models/Product.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, sku, unit, price, gstRate, stock, description } = req.body;

    if (!name || price === undefined) {
      throw httpError(400, "Product name and price are required");
    }

    const product = await Product.create({
      owner: req.user._id,
      name,
      sku,
      unit,
      price,
      gstRate,
      stock: stock ?? 0,
      description,
    });

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!product) {
      throw httpError(404, "Product not found");
    }

    Object.assign(product, {
      ...req.body,
      stock: req.body.stock ?? product.stock,
    });
    await product.save();
    res.json(product);
  } catch (error) {
    next(error);
  }
});

export default router;
