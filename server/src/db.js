// ============================================
// DATABASE — MongoDB Atlas via Mongoose
// UniVote ACSES UMaT E-Voting System
// ============================================
import mongoose from 'mongoose';
import dns from 'dns';

// Use Google Public DNS to resolve SRV records (fixes local DNS issues)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed');
  process.exit(0);
});

export default mongoose;
