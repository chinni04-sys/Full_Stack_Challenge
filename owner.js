const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const { verifyToken, checkRole } = require('../middleware/auth');

// Protect all store owner routes
router.use(verifyToken, checkRole(['STORE_OWNER']));

// @route   GET /api/owner/dashboard
// @desc    Get average rating and list of users who have rated the store owner's store
router.get('/dashboard', async (req, res) => {
  const storeId = req.user.id;
  const { sortBy, sortOrder } = req.query;

  try {
    const pool = getPool();

    // 1. Get average rating
    const [avgRes] = await pool.query(
      'SELECT COALESCE(AVG(rating), 0) as averageRating, COUNT(rating) as totalRatings FROM ratings WHERE store_id = ?',
      [storeId]
    );
    const averageRating = parseFloat(avgRes[0].averageRating).toFixed(1);
    const totalRatings = avgRes[0].totalRatings;

    // 2. Get list of users who rated with details and support sorting
    let query = `
      SELECT 
        r.rating,
        r.created_at as ratedAt,
        u.id as userId,
        u.name as userName,
        u.email as userEmail,
        u.address as userAddress
      FROM ratings r
      JOIN users u ON r.user_id = u.id
      WHERE r.store_id = ?
    `;

    // Sorting fields: userName, userEmail, rating, ratedAt
    const validSortFields = ['userName', 'userEmail', 'rating', 'ratedAt'];
    const validSortOrders = ['ASC', 'DESC'];

    const activeSortBy = validSortFields.includes(sortBy) ? sortBy : 'userName';
    const activeSortOrder = validSortOrders.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    if (activeSortBy === 'userName') {
      query += ` ORDER BY u.name ${activeSortOrder}`;
    } else if (activeSortBy === 'userEmail') {
      query += ` ORDER BY u.email ${activeSortOrder}`;
    } else if (activeSortBy === 'rating') {
      query += ` ORDER BY r.rating ${activeSortOrder}`;
    } else {
      query += ` ORDER BY r.created_at ${activeSortOrder}`;
    }

    const [ratings] = await pool.query(query, [storeId]);

    res.json({
      averageRating,
      totalRatings,
      ratings
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
