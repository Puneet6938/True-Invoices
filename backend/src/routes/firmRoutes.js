import express from "express";
import { Firm } from "../models/Firm.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const firm = await Firm.findOne({ owner: req.user._id });
    res.json(firm);
  } catch (error) {
    next(error);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const { firmName, gstNumber, address, mobileNumber, signatureName, signatureLabel, showSignature, showPaidStamp } =
      req.body;
    const firm = await Firm.findOne({ owner: req.user._id });

    if (!firm) {
      throw httpError(404, "Firm not found");
    }

    firm.firmName = firmName ?? firm.firmName;
    firm.gstNumber = gstNumber ?? firm.gstNumber;
    firm.address = address ?? firm.address;
    firm.mobileNumber = mobileNumber ?? firm.mobileNumber;
    firm.signatureName = signatureName ?? firm.signatureName;
    firm.signatureLabel = signatureLabel ?? firm.signatureLabel;
    firm.showSignature = showSignature ?? firm.showSignature;
    firm.showPaidStamp = showPaidStamp ?? firm.showPaidStamp;

    await firm.save();
    res.json(firm);
  } catch (error) {
    next(error);
  }
});

export default router;
