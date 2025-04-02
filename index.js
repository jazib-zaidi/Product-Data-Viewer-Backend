const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

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
    let productId = id;

    // Handle Shopify global ID format (shopify_CA_xxxx_xxxx)
    if (id.includes('_')) {
      const optimizeId = id.split('_');
      productId = optimizeId.length == 4 ? optimizeId[2] : optimizeId[0];
    }

    // If productId is purely numeric, check if it's a variant ID
    if (!isNaN(productId)) {
      const variantUrl = `https://${STORE_HASH}.myshopify.com/admin/api/${API_VERSION}/variants/${productId}.json`;
      const variantResponse = await fetch(variantUrl, { headers });

      if (variantResponse.ok) {
        const variantData = await variantResponse.json();
        productId = variantData.variant.product_id; // Extract the actual product ID
      }
    }

    if (!productId) {
      return res.status(400).json({ error: 'Invalid productId parameter' });
    }

    // Fetch product details
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

    // Fetch product metafields
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
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

app.get('/api/products/:sku', async (req, res) => {
  const { sku } = req.params;
  const api_key = req.query.api_key;
  const domain = req.query.domain;

  const apiUrl = `https://${domain}/rest/V1/products/${sku}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${api_key}`,
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
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `Server running at https://product-data-viewer-backend.onrender.com/`
  );
});
