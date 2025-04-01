const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

const API_KEY = 'x1k9qu01e1lvv60sj3kwhqtvs7hle928';

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ test: 'test' });
});

app.get('/api/v1/shopify/product', async (req, res) => {
  const API_VERSION = '2024-01';
  const id = req.query.productId;
  const STORE_HASH = req.query.storeHash;
  const ACCESS_TOKEN = req.query.accessToken;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': `${ACCESS_TOKEN}`,
  };

  try {
    if (id) {
      // Extract Product ID from Shopify's Global ID
      const optimizeId = id.split('_');
      const productId = optimizeId.length == 4 ? optimizeId[2] : optimizeId[0];

      if (!productId) {
        return res.status(400).json({ error: 'Invalid productId parameter' });
      }

      console.log(`Fetching Product ID: ${productId}`);

      // Fetch single product details
      const productUrl = `https://${STORE_HASH}.myshopify.com/admin/api/${API_VERSION}/products/${productId}.json`;
      const productResponse = await fetch(productUrl, { headers });

      if (!productResponse.ok) {
        return res.status(productResponse.status).json({
          error: 'Shopify API Error',
          status: productResponse.status,
          message: await productResponse.text(),
        });
      }

      const productData = await productResponse.json();
      const product = productData.product;

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Fetch metafields for the product
      const metafieldsUrl = `https://${STORE_HASH}.myshopify.com/admin/api/${API_VERSION}/products/${productId}/metafields.json`;
      const metafieldsResponse = await fetch(metafieldsUrl, { headers });
      let metafields = [];

      if (metafieldsResponse.ok) {
        const metafieldsData = await metafieldsResponse.json();
        metafields = metafieldsData.metafields || [];
      }

      res.json({
        status: 'success',
        data: {
          product,
          metafields,
        },
      });
    } else {
      console.log(`Fetching First 10 Products`);

      // Fetch the first 10 products
      const productsUrl = `https://${STORE_HASH}.myshopify.com/admin/api/${API_VERSION}/products.json?limit=1`;
      const productsResponse = await fetch(productsUrl, { headers });

      if (!productsResponse.ok) {
        return res.status(productsResponse.status).json({
          error: 'Shopify API Error',
          status: productsResponse.status,
          message: await productsResponse.text(),
        });
      }

      const productsData = await productsResponse.json();
      const products = productsData.products || [];

      // Fetch variants & metafields for each product
      const productsWithDetails = await Promise.all(
        products.map(async (product) => {
          const productId = product.id;

          // Fetch metafields
          const metafieldsUrl = `https://${STORE_HASH}.myshopify.com/admin/api/${API_VERSION}/products/${productId}/metafields.json`;
          const metafieldsResponse = await fetch(metafieldsUrl, { headers });

          let metafields = [];
          if (metafieldsResponse.ok) {
            const metafieldsData = await metafieldsResponse.json();
            metafields = metafieldsData.metafields || [];
          }

          return {
            ...product,
            variants: product.variants,
            metafields,
          };
        })
      );

      res.json({
        status: 'success',
        data: productsWithDetails,
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  const { sku } = req.params;
  const apiUrl = `https://www.dymocks.com.au/rest/V1/products/${sku}`;
  console.log(apiUrl);
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `Server running at https://product-data-viewer-backend.onrender.com/`
  );
});
