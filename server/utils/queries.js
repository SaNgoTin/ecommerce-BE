const Mongoose = require("mongoose");

exports.getStoreProductsQuery = (min, max) => {
  max = Number(max);
  min = Number(min);

  const priceFilter = min && max ? { price: { $gte: min, $lte: max } } : {};

  const matchQuery = {
    price: priceFilter.price,
  };

  const basicQuery = [
    {
      $match: matchQuery,
    },
  ];

  return basicQuery;
};
