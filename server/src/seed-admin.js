// ============================================
// SEED — Create Admin Account & Default Departments in MongoDB Atlas
// ============================================
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Use Google DNS for Atlas SRV resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

import User from './models/User.js';
import Department from './models/Department.js';

const MONGODB_URI = process.env.MONGODB_URI;

const defaultDepts = [
  { _id: 'dept-cs', name: 'Computer Science & Engineering', code: 'CSE', faculty: 'Faculty of Computing & IT' },
  { _id: 'dept-geo', name: 'Geomatic Engineering', code: 'GEO', faculty: 'Faculty of Engineering' },
  { _id: 'dept-min', name: 'Mining Engineering', code: 'MIN', faculty: 'Faculty of Engineering' },
  { _id: 'dept-ee', name: 'Electrical & Electronic Engineering', code: 'EEE', faculty: 'Faculty of Engineering' },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas');

  // 1. Seed Departments
  for (const dept of defaultDepts) {
    const existingDept = await Department.findById(dept._id);
    if (existingDept) {
      await Department.updateOne({ _id: dept._id }, { $set: dept });
      console.log(`ℹ️  Department ${dept.code} updated.`);
    } else {
      await Department.create(dept);
      console.log(`✅ Department ${dept.code} created.`);
    }
  }

  // 2. Seed Admin
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const adminData = {
    _id: 'user-admin-001',
    student_id: 'ADMIN001',
    name: 'System Administrator',
    email: 'admin@univote.umat.edu.gh',
    password_hash: bcrypt.hashSync(adminPassword, 10),
    department_id: null,
    role: 'admin',
    status: 'active',
    phone_number: null,
    year: null,
  };

  const existingAdmin = await User.findOne({ student_id: adminData.student_id });
  if (existingAdmin) {
    console.log('⚠️  Admin account already exists. Skipping.');
  } else {
    await User.create(adminData);
    console.log('✅ Admin account created successfully!');
  }

  console.log('\n── Admin Login Credentials ──');
  console.log(`   Student ID : ${adminData.student_id}`);
  console.log(`   Password   : ${adminPassword}`);
  console.log('────────────────────────────\n');

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
