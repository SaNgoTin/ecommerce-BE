const router = require("express").Router();

const authRoutes = require("./auth");
const userRoutes = require("./user");
const productRoutes = require("./product");
const categoryRoutes = require("./category");
const cartRoutes = require("./cart");

// auth routes
router.use("/auth", authRoutes);

// user routes
router.use("/user", userRoutes);

// product routes
router.use("/product", productRoutes);

// category routes
router.use("/category", categoryRoutes);

// cart routes
router.use("/cart", cartRoutes);

module.exports = router;
