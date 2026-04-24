import express from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Firm } from "../models/Firm.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();
const googleClient = env.googleClientId ? new OAuth2Client(env.googleClientId) : null;

function createToken(userId) {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, firmName, gstNumber, address, mobileNumber } = req.body;

    if (!name || !email || !phone || !password || !firmName || !address || !mobileNumber) {
      throw httpError(400, "All user and firm fields are required");
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    });

    if (existingUser) {
      throw httpError(409, "Email or phone already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
    });

    const firm = await Firm.create({
      owner: user._id,
      firmName,
      gstNumber: gstNumber || "",
      address,
      mobileNumber,
    });

    const token = createToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      firm,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      throw httpError(400, "Identity and password are required");
    }

    const user = await User.findOne({
      $or: [{ email: identity.toLowerCase() }, { phone: identity }],
    });

    if (!user) {
      throw httpError(401, "Invalid credentials");
    }

    if (!user.passwordHash) {
      throw httpError(401, "Use Google login for this account");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw httpError(401, "Invalid credentials");
    }

    const firm = await Firm.findOne({ owner: user._id });
    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      firm,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    if (!googleClient || !env.googleClientId) {
      throw httpError(400, "Google login is not configured");
    }

    const { credential } = req.body;

    if (!credential) {
      throw httpError(400, "Google credential is required");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload?.email) {
      throw httpError(400, "Invalid Google account payload");
    }

    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }],
    });

    if (!user) {
      user = await User.create({
        name: payload.name || payload.email.split("@")[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        avatar: payload.picture || "",
      });

      await Firm.create({
        owner: user._id,
        firmName: payload.name ? `${payload.name}'s Firm` : "My Firm",
        gstNumber: "",
        address: "",
        mobileNumber: "",
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.avatar = payload.picture || user.avatar || "";
      if (!user.name && payload.name) {
        user.name = payload.name;
      }
      await user.save();
    }

    const firm = await Firm.findOne({ owner: user._id });
    const token = createToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
      firm,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const firm = await Firm.findOne({ owner: req.user._id });
    res.json({
      user: req.user,
      firm,
    });
  } catch (error) {
    next(error);
  }
});

router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    const nextEmail = typeof email === "string" ? email.toLowerCase().trim() : req.user.email;
    const nextPhone = typeof phone === "string" ? phone.trim() : req.user.phone;

    if (!name || !nextEmail) {
      throw httpError(400, "Name and email are required");
    }

    const duplicateUser = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [{ email: nextEmail }, ...(nextPhone ? [{ phone: nextPhone }] : [])],
    });

    if (duplicateUser) {
      throw httpError(409, "Email or phone already belongs to another account");
    }

    req.user.name = name.trim();
    req.user.email = nextEmail;
    req.user.phone = nextPhone;
    await req.user.save();

    res.json({
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
