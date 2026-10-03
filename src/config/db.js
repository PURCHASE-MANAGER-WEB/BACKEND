const mongoose = require('mongoose');

// Connects to the SAME MongoDB database the rest of the CRM uses.
// No separate database is created — only new purchase_* collections live here.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`Purchase Manager API — MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
