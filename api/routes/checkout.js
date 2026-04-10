const express = require('express');
const router = express.Router();
const c = require('../controllers/checkoutController');

// Finalize payment and generate bill
router.post('/', c.checkout);

// Get all bills (admin/cashier report)
router.get('/bills', c.getAllBills);

// Get specific bill by bill number
router.get('/bill/:bill_number', c.getBill);

module.exports = router;
