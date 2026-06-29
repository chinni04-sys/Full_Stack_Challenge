const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool } = require('../db');
const { verifyToken, checkRole } = require('../middleware/auth');
const { validateSignup } = require('../utils/validators');

// Protect all admin routes with verifyToken and checkRole(['SYSTEM_ADMIN'])
router.use(verifyToken, checkRole(['SYSTEM_ADMIN']));

// @route   GET /api/admin/dashboard
// @desc    Get counts for users, stores, and ratings
router.get('/dashboard', async (req, res) => {
  try {
    const pool = getPool();
    
    // Total users excluding store owners (as stores are counted separately) OR total actual users of all roles?
    // Let's check: "Total number of users", "Total number of stores", "Total number of submitted ratings"
    // Usually, "Total number of users" means normal users + admin users. Let's count where role IS NOT 'STORE_OWNER'.
    // Or we can count all users, but counting NORMAL_USER + SYSTEM_ADMIN is safer, or we count all.
    // Let's count where role != 'STORE_OWNER' for users, and role = 'STORE_OWNER' for stores.
    
    const [userRes] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role IN ('NORMAL_USER', 'SYSTEM_ADMIN')");
    const [storeRes] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'STORE_OWNER'");
    const [ratingRes] = await pool.query("SELECT COUNT(*) as count FROM ratings");

    res.json({
      totalUsers: userRes[0].count,
      totalStores: storeRes[0].count,
      totalRatings: ratingRes[0].count
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/users
// @desc    Add new user (Normal User, Admin, or Store Owner/Store)
router.post('/users', async (req, res) => {
  const { name, email, password, address, role } = req.body;

  // Validate fields
  const validation = validateSignup(name, email, password, address);
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  // Validate Role
  const allowedRoles = ['NORMAL_USER', 'SYSTEM_ADMIN', 'STORE_OWNER'];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ errors: { role: 'Invalid role provided' } });
  }

  try {
    const pool = getPool();
    // Check email uniqueness
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ errors: { email: 'Email is already registered' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, address, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim(), hashedPassword, address.trim(), role]
    );

    res.status(201).json({ message: `${role.replace('_', ' ')} created successfully` });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get list of normal and admin users (or all users) with sorting and filtering
router.get('/users', async (req, res) => {
  const { name, email, address, role, sortBy, sortOrder } = req.query;

  try {
    const pool = getPool();
    
    // We want to list all users, but we support filtering.
    // The requirement says:
    // "Can view a list of normal and admin users with: Name, Email, Address, Role"
    // "Can view a list of stores with: Name, Email, Address, Rating"
    // "Can apply filters on all listings based on Name, Email, Address, and Role."
    // Let's write a generic query for users, and we filter based on role if needed.
    // If no specific role filter is given, let's include all.
    let query = `
      SELECT u.id, u.name, u.email, u.address, u.role, COALESCE(AVG(r.rating), 0) as averageRating
      FROM users u
      LEFT JOIN ratings r ON u.id = r.store_id
    `;
    
    const queryParams = [];
    const conditions = [];

    if (name) {
      conditions.push('u.name LIKE ?');
      queryParams.push(`%${name}%`);
    }
    if (email) {
      conditions.push('u.email LIKE ?');
      queryParams.push(`%${email}%`);
    }
    if (address) {
      conditions.push('u.address LIKE ?');
      queryParams.push(`%${address}%`);
    }
    if (role) {
      conditions.push('u.role = ?');
      queryParams.push(role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY u.id';

    // Sorting
    // Valid columns to sort by: name, email, address, role, averageRating
    const validSortFields = ['name', 'email', 'address', 'role', 'averageRating'];
    const validSortOrders = ['ASC', 'DESC'];

    const activeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';
    const activeSortOrder = validSortOrders.includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

    if (activeSortBy === 'averageRating') {
      query += ` ORDER BY averageRating ${activeSortOrder}`;
    } else {
      query += ` ORDER BY u.${activeSortBy} ${activeSortOrder}`;
    }

    const [users] = await pool.query(query, queryParams);
    res.json(users);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get user details, including average rating if it's a store owner
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const pool = getPool();
    const query = `
      SELECT u.id, u.name, u.email, u.address, u.role, COALESCE(AVG(r.rating), 0) as averageRating
      FROM users u
      LEFT JOIN ratings r ON u.id = r.store_id
      WHERE u.id = ?
      GROUP BY u.id
    `;
    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = rows[0];
    // If not STORE_OWNER, remove averageRating from response if they don't want it, but keeping it is fine.
    // The requirement: "If the user is a Store Owner, their Rating should also be displayed."
    // We can conditionally display it in the frontend, but we return it here.
    res.json(user);
  } catch (error) {
    console.error('Admin get user detail error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
