const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const axios = require('axios');

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

app.get('/api/v1/salsforce/product', async (req, res) => {
  const host = req.query.host;
  const productId = req.query.productId;
  const CLIENT_ID = req.query.clientId;
  const BASE_URL = `${host}/dw/shop/v19_10/products/`;

  if (host && productId && CLIENT_ID) {
    try {
      const url = `${BASE_URL}${productId}?expand=prices,variations,images,availability,links,promotions`;
      const response = await axios.get(url, {
        headers: {
          'x-dw-client-id': CLIENT_ID,
        },
      });

      res.json(response.data);
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error.message);
      res.json(error.message);
    }
  } else {
    return res.json({ field: 'Not Found' });
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

app.get('/api/bigcommerce/products/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const apiToken = req.query.api_token;
  const storeHash = req.query.store_hash;

  if (!apiToken || !storeHash) {
    return res
      .status(400)
      .json({ error: 'Missing api_token or store_hash in query parameters' });
  }

  const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v3/catalog`;

  try {
    let product;
    let productId;

    if (/^\d+$/.test(identifier)) {
      // Fetch product by ID
      const productRes = await fetch(`${baseUrl}/products/${identifier}`, {
        headers: {
          'X-Auth-Token': apiToken,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!productRes.ok)
        throw new Error(`BigCommerce API error: ${productRes.statusText}`);

      const productData = await productRes.json();
      product = productData.data;
      productId = product.id;
    } else {
      // Try finding product by SKU (base product)
      const productRes = await fetch(
        `${baseUrl}/products?sku=${encodeURIComponent(identifier)}`,
        {
          headers: {
            'X-Auth-Token': apiToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!productRes.ok)
        throw new Error(`BigCommerce API error: ${productRes.statusText}`);

      const productData = await productRes.json();

      if (productData.data && productData.data.length > 0) {
        product = productData.data[0];
        productId = product.id;
      } else {
        // Fallback: try to find variant by SKU
        const variantRes = await fetch(
          `${baseUrl}/variants?sku=${encodeURIComponent(identifier)}`,
          {
            headers: {
              'X-Auth-Token': apiToken,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          }
        );

        if (!variantRes.ok)
          throw new Error(
            `BigCommerce API error (variant): ${variantRes.statusText}`
          );

        const variantData = await variantRes.json();

        if (!variantData.data || variantData.data.length === 0) {
          return res
            .status(404)
            .json({ error: 'Product not found (SKU or variant)' });
        }

        productId = variantData.data[0].product_id;

        // Fetch product by ID (from variant)
        const fallbackProductRes = await fetch(
          `${baseUrl}/products/${productId}`,
          {
            headers: {
              'X-Auth-Token': apiToken,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          }
        );

        if (!fallbackProductRes.ok) {
          throw new Error(
            `BigCommerce API error (product fallback): ${fallbackProductRes.statusText}`
          );
        }

        const fallbackProductData = await fallbackProductRes.json();
        product = fallbackProductData.data;
      }
    }

    // Fetch additional data
    const [variantData, imageData, customFieldsData] = await Promise.all([
      fetch(`${baseUrl}/products/${productId}/variants`, {
        headers: { 'X-Auth-Token': apiToken, 'Accept': 'application/json' },
      })
        .then((res) => res.json())
        .then((res) => res.data),

      fetch(`${baseUrl}/products/${productId}/images`, {
        headers: { 'X-Auth-Token': apiToken, 'Accept': 'application/json' },
      })
        .then((res) => res.json())
        .then((res) => res.data),

      fetch(`${baseUrl}/products/${productId}/custom-fields`, {
        headers: { 'X-Auth-Token': apiToken, 'Accept': 'application/json' },
      })
        .then((res) => res.json())
        .then((res) => res.data),
    ]);

    // Brand
    let brand = null;
    if (product.brand_id) {
      const brandRes = await fetch(`${baseUrl}/brands/${product.brand_id}`, {
        headers: { 'X-Auth-Token': apiToken, 'Accept': 'application/json' },
      });
      if (brandRes.ok) {
        const brandData = await brandRes.json();
        brand = brandData.data || null;
      }
    }

    // Categories
    let categories = [];
    if (product.categories && product.categories.length > 0) {
      categories = await Promise.all(
        product.categories.map(async (catId) => {
          const catRes = await fetch(`${baseUrl}/categories/${catId}`, {
            headers: { 'X-Auth-Token': apiToken, 'Accept': 'application/json' },
          });
          if (catRes.ok) {
            const catData = await catRes.json();
            return catData.data;
          }
          return null;
        })
      );
      categories = categories.filter(Boolean);
    }

    res.json({
      ...product,
      brand,
      categories,
      variants: variantData || [],
      images: imageData || [],
      custom_fields: customFieldsData || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `Server running at https://product-data-viewer-backend.onrender.com/`
  );
});
