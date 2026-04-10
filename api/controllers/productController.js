const Product = require('../models/Product');

// GET /api/products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.getAll();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/products/barcode/:barcode
exports.getProductByBarcode = async (req, res) => {
  try {
    const product = await Product.getByBarcode(req.params.barcode);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/products
exports.createProduct = async (req, res) => {
  try {
    const { name, barcode, price, stock, category, image_url } = req.body;
    if (!name || !barcode || !price) {
      return res.status(400).json({ success: false, message: 'name, barcode, and price are required' });
    }
    const id = await Product.create({ name, barcode, price, stock: stock || 0, category, image_url });
    res.status(201).json({ success: true, message: 'Product created', data: { id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Barcode already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const affected = await Product.update(req.params.id, req.body);
    if (!affected) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const affected = await Product.delete(req.params.id);
    if (!affected) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
