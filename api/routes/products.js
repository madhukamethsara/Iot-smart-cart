const express = require('express');
const router = express.Router();
const c = require('../controllers/productController');

router.get('/', c.getAllProducts);
router.get('/barcode/:barcode', c.getProductByBarcode);  // must be before /:id
router.get('/:id', c.getProductById);
router.post('/', c.createProduct);
router.put('/:id', c.updateProduct);
router.delete('/:id', c.deleteProduct);

module.exports = router;
