const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { verifyToken, checkRole } = require('../middleware/auth');

// Protect all normal user routes
router.use(verifyToken, checkRole(['NORMAL_USER']));

// @route   GET /api/stores
// @desc    Get all stores with average rating, current user's rating, search & sort
router.get('/stores', async (req, res) => {
  const { name, address, search, sortBy, sortOrder } = req.query;
  const userId = req.user.id;

  try {
    const pool = getPool();
    
    let query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.address, 
        COALESCE(AVG(r.rating), 0) as overallRating,
        COALESCE((SELECT rating FROM ratings WHERE store_id = u.id AND user_id = ?), 0) as userRating
      FROM users u
      LEFT JOIN ratings r ON u.id = r.store_id
      WHERE u.role = 'STORE_OWNER'
    `;
    
    const queryParams = [userId];

    if (name) {
      query += ' AND u.name LIKE ?';
      queryParams.push(`%${name}%`);
    }
    if (address) {
      query += ' AND u.address LIKE ?';
      queryParams.push(`%${address}%`);
    }
    if (search) {
      query += ' AND (u.name LIKE ? OR u.address LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY u.id';

    // Sorting
    const validSortFields = ['name', 'address', 'overallRating'];
    const validSortOrders = ['ASC', 'DESC'];

    const activeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
    const activeSortOrder = validSortOrders.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    if (activeSortBy === 'overallRating') {
      query += ` ORDER BY overallRating ${activeSortOrder}`;
    } else {
      query += ` ORDER BY u.${activeSortBy} ${activeSortOrder}`;
    }

    const [stores] = await pool.query(query, queryParams);
    res.json(stores);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/stores/:id/rate
// @desc    Submit or modify a rating (1-5) for a store
router.post('/stores/:id/rate', async (req, res) => {
  const storeId = req.params.id;
  const userId = req.user.id;
  const { rating } = req.body;

  const numericRating = parseInt(rating, 10);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5' });
  }

  try {
    const pool = getPool();

    // Check if store exists and is actually a store
    const [storeCheck] = await pool.query('SELECT id FROM users WHERE id = ? AND role = "STORE_OWNER"', [storeId]);
    if (storeCheck.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Insert or update rating
    await pool.query(
      `INSERT INTO ratings (store_id, user_id, rating) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE rating = ?`,
      [storeId, userId, numericRating, numericRating]
    );

    res.json({ message: 'Rating submitted successfully' });
  } catch (error) {
    console.error('Rate store error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
