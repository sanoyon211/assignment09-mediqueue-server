import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', process.env.CLIENT_URL],
    credentials: true,
  }),
);
app.use(express.json());

// MongoDB connection URI
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log('🎯 Successfully connected to MongoDB!');

    // Database and Collections
    const db = client.db('mediqueue');
    const tutorsCollection = db.collection('tutors');
    const bookingsCollection = db.collection('bookings');

    // Basic Root Route
    app.get('/', (req, res) => {
      res.send('MediQueue Server is running smoothly 🚀');
    });
  } finally {
    // Keep connection open
  }
}
run().catch(console.dir);

// Start Server
app.listen(port, () => {
  console.log(`💻 Server is running on port ${port}`);
});
