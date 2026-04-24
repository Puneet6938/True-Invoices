import mongoose from "mongoose";

const firmSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    firmName: {
      type: String,
      required: true,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    signatureName: {
      type: String,
      trim: true,
      default: "",
    },
    signatureLabel: {
      type: String,
      trim: true,
      default: "Authorized Signatory",
    },
    showSignature: {
      type: Boolean,
      default: false,
    },
    showPaidStamp: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Firm = mongoose.model("Firm", firmSchema);
