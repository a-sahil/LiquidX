import mongoose, { Schema } from 'mongoose';
// Define the Wallet Schema
export const walletSchema = new Schema({
    userId: { type: String, required: true },
    publicKey: { type: String, required: true },
    secretKey: { type: String, required: true },
    firstStart: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    poolAddress: { type: String, default: null },
    positions: { type: String, default: null },
    autoRebalance: { type: Boolean, default: false },
    positionAmount: { type: Number, default: null },
});
// Create and export the Wallet model
export const Wallet = mongoose.model('Wallet', walletSchema);
// Connect to MongoDB
try {
    mongoose.connect('mongodb://localhost:27017/solana_bot')
        .then(() => console.log('Connected to MongoDB'))
        .catch((error) => console.error('MongoDB connection error:', error));
}
catch (error) {
    console.error('Error connecting to MongoDB:', error);
}
export default Wallet;
//# sourceMappingURL=database.js.map