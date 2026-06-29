const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { validateSignup, validatePassword } = require('../utils/validators');

// @route   POST /api/auth/signup
// @desc    Register a normal user
router.post('/signup', async (req, res) => {
  const { name, email, password, address } = req.body;

  const validation = validateSignup(name, email, password, address);
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  try {
    const pool = getPool();
    // Check if user exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ errors: { email: 'Email is already registered' } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Normal users always sign up with role NORMAL_USER
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, address, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.trim(), hashedPassword, address.trim(), 'NORMAL_USER']
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const pool = getPool();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'super_secret_jwt_token_for_authentication_123!',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        address: user.address,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/update-password
// @desc    Update password for authenticated user
router.put('/update-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  const passError = validatePassword(newPassword);
  if (passError) {
    return res.status(400).json({ message: passError });
  }

  try {
    const pool = getPool();
    const [users] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
