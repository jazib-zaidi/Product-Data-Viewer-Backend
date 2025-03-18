const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

const API_KEY = 'x1k9qu01e1lvv60sj3kwhqtvs7hle928';

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to My Express API');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from Express API' });
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
  console.log(`Server running at http://localhost:${PORT}`);
});
