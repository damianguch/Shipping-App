import express from 'express';
import crypto from 'crypto';
import redis from 'redis';
import { promisify } from 'util';
import { User } from './models';

const router = express.Router();

// Redis client setup
const redisClient = redis.createClient({
  host: 'redis-server', // Replace with your Redis server address
  port: 6379
});

const redisGet = promisify(redisClient.get).bind(redisClient);
const redisSet = promisify(redisClient.set).bind(redisClient);
const redisDelete = promisify(redisClient.del).bind(redisClient);

// Generate a random OTP code
function generateOTPCode(): string {
  return crypto.randomBytes(3).toString('hex').slice(0, 6);
}

// Account creation route with OTP verification
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  // Generate a new OTP code
  const otpCode = generateOTPCode();

  // Store user details and OTP in Redis with a temporary ID
  const tempId = crypto.randomBytes(8).toString('hex');
  await redisSet(
    `temp_user_${tempId}`,
    JSON.stringify({ name, email, password, otpCode })
  );

  // Send the OTP to the user (e.g. via SMS or email)
  await sendOTPToUser(email, otpCode);

  res.status(200).json({ tempId });
});

// OTP verification route
router.post('/verify-otp', async (req, res) => {
  const { tempId, otpCode } = req.body;

  // Retrieve user details and OTP from Redis
  const tempUserData = JSON.parse(await redisGet(`temp_user_${tempId}`));
  if (!tempUserData) {
    return res.status(400).json({ error: 'Invalid temporary ID' });
  }

  // Verify the OTP code
  if (tempUserData.otpCode !== otpCode) {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  // Create the user account
  const newUser = await User.create({
    name: tempUserData.name,
    email: tempUserData.email,
    password: tempUserData.password
  });

  // Remove the temporary data from Redis
  await redisDelete(`temp_user_${tempId}`);

  res.status(201).json(newUser);
});

function sendOTPToUser(email: string, otpCode: string): Promise<void> {
  // Implementation to send the OTP to the user (e.g. via SMS or email)
  return new Promise((resolve) => {
    console.log(`Sent OTP code ${otpCode} to ${email}`);
    resolve();
  });
}

export default router;
