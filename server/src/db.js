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
    console.warn('⚠️  MongoDB Atlas connection error:', err.message);
    const localUri = 'mongodb://127.0.0.1:27017/evote';
    console.log(`🔌 Attempting local MongoDB fallback connection: ${localUri}...`);
    try {
      await mongoose.connect(localUri);
      console.log('✅ Connected to Local MongoDB');
    } catch (localErr) {
      console.error('❌ MongoDB Atlas & Local Fallback connections failed:', localErr.message);
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed');
  process.exit(0);
});

export default mongoose;
