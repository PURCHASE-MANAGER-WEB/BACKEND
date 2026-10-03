require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Coordinator=5000, Manager=5001, Head=5002 → Purchase Manager uses 5003.
const reserved = ['5000', '5001', '5002'];
const PORT = (process.env.PORT && !reserved.includes(String(process.env.PORT))) ? process.env.PORT : 5003;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Purchase Manager API running on http://localhost:${PORT}`));
});
