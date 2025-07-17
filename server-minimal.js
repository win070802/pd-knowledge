const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Thêm middleware cơ bản
app.use(express.json());

// Xử lý lỗi không bắt được
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Route đơn giản
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/simple-health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Khởi động server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server time: ${new Date().toISOString()}`);
}); 