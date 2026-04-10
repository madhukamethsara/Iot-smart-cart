const Cart = require('../models/Cart');
const Product = require('../models/Product');

// GET /api/cart/qr/:qr_code - Customer scans QR to identify cart
exports.getCartByQR = async (req, res) => {
  try {
    const cart = await Cart.getByQR(req.params.qr_code);
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Activate cart if it's available
    if (cart.status === 'available') {
      await Cart.activate(cart.id);
      cart.status = 'active';
    }

    const items = await Cart.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.json({ success: true, data: { cart, items, total: total.toFixed(2) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/cart/rfid/:rfid_code - Cashier scans RFID
exports.getCartByRFID = async (req, res) => {
  try {
    const cart = await Cart.getByRFID(req.params.rfid_code);
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    if (cart.status !== 'active') {
      return res.status(400).json({ success: false, message: `Cart is ${cart.status}, not active` });
    }

    const items = await Cart.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.json({ success: true, data: { cart, items, total: total.toFixed(2) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cart/:cart_id/scan - ESP32 scans a barcode and adds item
exports.scanBarcode = async (req, res) => {
  try {
    const { cart_id } = req.params;
    const { barcode, quantity = 1 } = req.body;

    if (!barcode) return res.status(400).json({ success: false, message: 'barcode is required' });

    const cart = await Cart.getById(cart_id);
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    if (cart.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Cart is not active' });
    }

    const product = await Product.getByBarcode(barcode);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    await Cart.addItem(cart_id, product.id, quantity);

    const items = await Cart.getItems(cart_id);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.json({
      success: true,
      message: `${product.name} added to cart`,
      data: { product, items, total: total.toFixed(2) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/cart/:cart_id/items - Get all items in a cart
exports.getCartItems = async (req, res) => {
  try {
    const items = await Cart.getItems(req.params.cart_id);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ success: true, data: { items, total: total.toFixed(2) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/cart/:cart_id/items/:product_id - Update quantity
exports.updateItem = async (req, res) => {
  try {
    const { cart_id, product_id } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ success: false, message: 'quantity is required' });
    }
    await Cart.updateItemQty(cart_id, product_id, quantity);
    res.json({ success: true, message: 'Item updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/cart/:cart_id/items/:product_id - Remove item
exports.removeItem = async (req, res) => {
  try {
    const { cart_id, product_id } = req.params;
    await Cart.removeItem(cart_id, product_id);
    res.json({ success: true, message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/cart - Get all carts (admin view)
exports.getAllCarts = async (req, res) => {
  try {
    const carts = await Cart.getAll();
    res.json({ success: true, data: carts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
