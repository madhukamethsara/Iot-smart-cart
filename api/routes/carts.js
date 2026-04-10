const express = require('express');
const router = express.Router();
const c = require('../controllers/cartController');

// Admin: list all carts
router.get('/', c.getAllCarts);

// Customer: identify cart via QR scan
router.get('/qr/:qr_code', c.getCartByQR);

// Cashier: identify cart via RFID scan
router.get('/rfid/:rfid_code', c.getCartByRFID);

// Cart items
router.get('/:cart_id/items', c.getCartItems);

// ESP32: scan barcode → add item to cart
router.post('/:cart_id/scan', c.scanBarcode);

// Update item quantity
router.put('/:cart_id/items/:product_id', c.updateItem);

// Remove item
router.delete('/:cart_id/items/:product_id', c.removeItem);

module.exports = router;
