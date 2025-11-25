require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

// ตั้งค่า Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// 1. แก้ไข Syntax Error: เพิ่ม try และ query ทดสอบ
app.get('/ping', async (req, res) => {
  try {
    await db.query('SELECT 1'); // ทดสอบ query ง่ายๆ
    res.json({ message: 'Pong: Database connected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET users (ลบ password ออกจากผลลัพธ์)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, firstname, fullname, lastname, username, status, created_at, updated_at FROM tbl_users'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET user by id (ลบ password ออกจากผลลัพธ์)
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id, firstname, fullname, lastname, username, status, created_at, updated_at FROM tbl_users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// POST: เพิ่มผู้ใช้ใหม่
app.post('/users', async (req, res) => {
  const { firstname, fullname, lastname, username, password, status } = req.body;

  try {
    if (!password) return res.status(400).json({ error: 'Password is required' });

    // เข้ารหัส password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO tbl_users (firstname, fullname, lastname, username, password, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [firstname, fullname, lastname, username, hashedPassword, status]
    );

    // Return user ใหม่ (ไม่ส่ง password กลับไป)
    const [newRows] = await db.query(
      'SELECT id, firstname, fullname, lastname, username, status, created_at, updated_at FROM tbl_users WHERE id = ?',
      [result.insertId]
    );
    res.json(newRows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// PUT: อัปเดตข้อมูลผู้ใช้
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { firstname, fullname, lastname, username, password, status } = req.body;

  try {
    const fields = [];
    const params = [];

    if (firstname !== undefined) {
      fields.push('firstname = ?');
      params.push(firstname);
    }
    if (fullname !== undefined) {
      fields.push('fullname = ?');
      params.push(fullname);
    }
    if (lastname !== undefined) {
      fields.push('lastname = ?');
      params.push(lastname);
    }
    if (username !== undefined) {
      fields.push('username = ?');
      params.push(username);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      params.push(status);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      params.push(hashedPassword);
    }

    // Always update updated_at
    fields.push('updated_at = NOW()');

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const query = `UPDATE tbl_users SET ${fields.join(', ')} WHERE id = ?`;
    params.push(id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user ที่อัปเดตแล้ว (ไม่ส่ง password กลับไป)
    const [rows] = await db.query(
      'SELECT id, firstname, fullname, lastname, username, status, created_at, updated_at FROM tbl_users WHERE id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE user
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM tbl_users WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// 2. แก้ไข Logout: ตัด localStorage ออก (เป็นหน้าที่ของ Frontend)
app.post('/logout', (req, res) => {

  res.json({ message: "Logged out successfully" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));