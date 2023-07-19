const express = require("express");
const router = express.Router();
const multer = require("multer");
const Mongoose = require("mongoose");

// Bring in Models & Utils
const Product = require("../../models/product");
const Category = require("../../models/category");
const auth = require("../../middleware/auth");
const role = require("../../middleware/role");
const checkAuth = require("../../utils/auth");
const { getStoreProductsQuery } = require("../../utils/queries");
const { ROLES } = require("../../constants");
const { app } = require("../../config/keys");

const uploadCloud = require("../../utils/storage");

// fetch product slug api
router.get("/item/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const productDoc = await Product.findOne({ slug });

    if (!productDoc) {
      return res.status(404).json({
        message: "No product found.",
      });
    }

    res.status(200).json({
      product: productDoc,
    });
  } catch (error) {
    res.status(400).json({
      error: "Your request could not be processed. Please try again.",
    });
  }
});

// fetch product name search api
router.get("/list/search/:name", async (req, res) => {
  try {
    const name = req.params.name;

    const productDoc = await Product.find(
      { name: { $regex: new RegExp(name), $options: "is" } },
      { name: 1, slug: 1, imageUrl: 1, price: 1, _id: 0 }
    );

    if (productDoc.length < 0) {
      return res.status(404).json({
        message: "No product found.",
      });
    }

    res.status(200).json({
      products: productDoc,
    });
  } catch (error) {
    res.status(400).json({
      error: "Your request could not be processed. Please try again.",
    });
  }
});

// fetch store products by advanced filters api
router.get("/list", async (req, res) => {
  try {
    let { sortOrder, max, min, category, page = 1, limit = 10 } = req.query;
    limit = 8;
    sortOrder = JSON.parse(sortOrder);

    const categoryFilter = category ? { category } : {};
    const basicQuery = getStoreProductsQuery(min, max);

    const categoryDoc = await Category.findOne(
      { slug: categoryFilter.category },
      "products -_id"
    );

    if (categoryDoc && categoryFilter !== category) {
      basicQuery.push({
        $match: {
          _id: {
            $in: Array.from(categoryDoc.products),
          },
        },
      });
    }

    let products = null;
    const productsCount = await Product.aggregate(basicQuery);
    const count = productsCount.length;
    const size = count > limit ? page - 1 : 0;
    const currentPage = count > limit ? Number(page) : 1;

    // paginate query
    const paginateQuery = [
      { $sort: sortOrder },
      { $skip: size * limit },
      { $limit: limit * 1 },
    ];
    products = await Product.aggregate(basicQuery.concat(paginateQuery));

    res.status(200).json({
      products,
      totalPages: Math.ceil(count / limit),
      currentPage,
      count,
    });
  } catch (error) {
    console.log("error", error);
    res.status(400).json({
      error: "Your request could not be processed. Please try again.",
    });
  }
});

router.get("/list/select", auth, async (req, res) => {
  try {
    const products = await Product.find({}, "name");

    res.status(200).json({
      products,
    });
  } catch (error) {
    res.status(400).json({
      error: "Your request could not be processed. Please try again.",
    });
  }
});

// add product api
router.post(
  "/add",
  auth,
  role.check(ROLES.Admin),
  uploadCloud.single("image"),
  async (req, res) => {
    try {
      const name = req.body.name;
      const description = req.body.description;
      const quantity = req.body.quantity;
      const price = req.body.price;
      const imageUrl = req.file.path;

      if (!description || !name) {
        return res
          .status(400)
          .json({ error: "You must enter description & name." });
      }

      if (!quantity) {
        return res.status(400).json({ error: "You must enter a quantity." });
      }

      if (!price) {
        return res.status(400).json({ error: "You must enter a price." });
      }

      const product = new Product({
        name,
        description,
        quantity,
        price,
        imageUrl,
      });

      const savedProduct = await product.save();

      res.status(200).json({
        success: true,
        message: `Product has been added successfully!`,
        product: savedProduct,
      });
    } catch (error) {
      return res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

// fetch products api
router.get(
  "/",
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      let products = [];

      products = await Product.find({});

      res.status(200).json({
        products,
      });
    } catch (error) {
      res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

// fetch product api
router.get(
  "/:id",
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const productId = req.params.id;

      let productDoc = null;

      if (req.user.merchant) {
        const brands = await Brand.find({
          merchant: req.user.merchant,
        }).populate("merchant", "_id");

        const brandId = brands[0]["_id"];

        productDoc = await Product.findOne({ _id: productId })
          .populate({
            path: "brand",
            select: "name",
          })
          .where("brand", brandId);
      } else {
        productDoc = await Product.findOne({ _id: productId }).populate({
          path: "brand",
          select: "name",
        });
      }

      if (!productDoc) {
        return res.status(404).json({
          message: "No product found.",
        });
      }

      res.status(200).json({
        product: productDoc,
      });
    } catch (error) {
      res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

router.put(
  "/:id",
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const productId = req.params.id;
      const update = req.body.product;
      const query = { _id: productId };
      const { sku, slug } = req.body.product;

      const foundProduct = await Product.findOne({
        $or: [{ slug }, { sku }],
      });

      if (foundProduct && foundProduct._id != productId) {
        return res
          .status(400)
          .json({ error: "Sku or slug is already in use." });
      }

      await Product.findOneAndUpdate(query, update, {
        new: true,
      });

      res.status(200).json({
        success: true,
        message: "Product has been updated successfully!",
      });
    } catch (error) {
      res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

router.put(
  "/:id/active",
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const productId = req.params.id;
      const update = req.body.product;
      const query = { _id: productId };

      await Product.findOneAndUpdate(query, update, {
        new: true,
      });

      res.status(200).json({
        success: true,
        message: "Product has been updated successfully!",
      });
    } catch (error) {
      res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

router.delete(
  "/delete/:id",
  auth,
  role.check(ROLES.Admin, ROLES.Merchant),
  async (req, res) => {
    try {
      const product = await Product.deleteOne({ _id: req.params.id });

      res.status(200).json({
        success: true,
        message: `Product has been deleted successfully!`,
        product,
      });
    } catch (error) {
      res.status(400).json({
        error: "Your request could not be processed. Please try again.",
      });
    }
  }
);

module.exports = router;
