import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

import Department from './src/models/Department.js';
import User from './src/models/User.js';

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const depts = await Department.find().lean();
  console.log('--- DEPARTMENTS IN DB ---');
  console.log(JSON.stringify(depts, null, 2));

  const users = await User.find({ role: 'voter' }).limit(5).lean();
  console.log('--- FIRST 5 VOTERS IN DB ---');
  console.log(JSON.stringify(users, null, 2));

  await mongoose.connection.close();
}

checkDb().catch(console.error);
