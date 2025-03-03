import mongoose, { Document, Schema } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();


// Define the interface for Wallet document
interface IWallet extends Document {
  userId: string;
  publicKey: string;
  secretKey: string;
  firstStart: boolean;
  createdAt: Date;
  poolAddress:string;
  positions?: string[]; // Add this line
  autoRebalance:boolean;
  positionAmount:number;
}

// Define the Wallet Schema
export const walletSchema = new Schema<IWallet>({
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
export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);


// Connect to MongoDB
try {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));
} catch (error) {
  console.error('Error connecting to MongoDB:', error);
}

export default Wallet;