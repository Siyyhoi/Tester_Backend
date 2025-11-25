require('dotenv').config(); // โหลดค่าจาก .env

const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());

// ใช้ค่าจาก .env
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Route ทดสอบการเชื่อมต่อ
app.get('/ping', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    res.json({ status: 'ok', time: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET users
app.get('/users/', async (req, res) => {
  const { id } =req.params;
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET By id users
app.get('/users/:id', async (req, res) => {
  const { id } =req.params;
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users WHERE id = ?', [id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});


app.post('/users', async (req, res) => {
  const { txt_firstname, txt_fullname, txt_lastname } = req.body;
  try {
    const [result] = await db.query('INSERT INTO tbl_users (firstname, fullname, lastname) VALUES (?, ?, ?)', [firstname, fullname, lastname]);
    res.json({ id: result.insertId, txt_firstname, txt_fullname, txt_lastname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));