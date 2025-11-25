require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// ค่า Config
const SECRET_KEY = process.env.JWT_SECRET;
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT 
});

// Middleware เช็ค Token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // ตัดคำว่า Bearer ออก

  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

app.get('/ping', async (req, res) => {
  try {
    const connection = await db.getConnection(); 
    await connection.ping(); 
    connection.release();
    res.json({ message: 'Pong: Database connected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM tbl_customers WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign(
      { id: user.id, firstname: user.firstname, lastname: user.lastname },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/register', async (req, res) => {
  const { prefix, firstname, lastname, username, password, address, email, phone_number } = req.body;

  try {
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO tbl_customers (prefix, firstname, lastname, username, password, address, email, phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [prefix, firstname, lastname, username, hashedPassword, address, email, phone_number]
    );

    res.json({ message: "Register successful", id: result.insertId });

  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username or Email already exists!' });
    }
    res.status(500).json({ error: 'Insert failed', details: err.message });
  }
});

app.get('/customers', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tbl_customers');
    res.json(rows); 
  } catch (err) {
    console.error(err); 
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/menus', async (req, res) => {
  try {
    const sql = `
      SELECT 
        tbl_menus.menu_id,
        tbl_menus.menu_name,
        tbl_menus.menu_description,
        tbl_menus.price,
        tbl_restaurants.shop_id,
        tbl_restaurants.shop_name,
        tbl_restaurants.shop_address
      FROM tbl_menus
      INNER JOIN tbl_restaurants ON tbl_menus.shop_id = tbl_restaurants.shop_id
    `;

    const [rows] = await db.query(sql);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

app.post('/orders', verifyToken, async (req, res) => {
  const { shop_id, menu_id, quantity } = req.body;

    const customer_id = req.user.id; 

  try {
    const [menus] = await db.query('SELECT price FROM tbl_menus WHERE menu_id = ?', [menu_id]);

    if (menus.length === 0) {
      return res.status(404).json({ error: 'Menu not found' });
    }

    const price = menus[0].price;
    
    const total = price * quantity;

    const sql = `
      INSERT INTO tbl_orders 
      (customer_id, shop_id, menu_id, quantity, price, total, order_date) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await db.query(sql, [customer_id, shop_id, menu_id, quantity, price, total]);

    // ส่งผลลัพธ์กลับ
    res.status(201).json({ 
      message: 'Order placed successfully', 
      order_id: result.insertId,
      customer_id: customer_id,
      quantity: quantity,
      price: price,
      total: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to place order', details: err.message });
  }
});

app.get('/orders/summary', verifyToken, async (req, res) => {
  const customer_id = req.user.id;

  try {
    const sql = `
      SELECT 
        CONCAT(tbl_customers.firstname, ' ', tbl_customers.lastname) AS customer_name,
        SUM(tbl_orders.total) AS total_amount
      FROM tbl_orders
      INNER JOIN tbl_customers ON tbl_orders.customer_id = tbl_customers.id
      INNER JOIN tbl_menus ON tbl_orders.menu_id = tbl_menus.menu_id
      WHERE tbl_orders.customer_id = ?
    `;

    const [rows] = await db.query(sql, [customer_id]);
    const result = rows[0];

    const responseData = {
      customer_name: result.customer_name || req.user.firstname,
      total_amount: result.total_amount || 0
    };

    res.json(responseData);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get summary', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
