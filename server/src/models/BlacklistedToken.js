import mongoose from 'mongoose';

const blacklistedTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, index: true },
    expires_at: { type: Date, required: true, index: { expires: 0 } },
}, {
    collection: 'blacklisted_tokens',
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

export default mongoose.model('BlacklistedToken', blacklistedTokenSchema);
