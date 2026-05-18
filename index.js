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

    // ==========================================
    // TUTORS API ENDPOINTS
    // ==========================================

    // 1. Add a new tutor
    app.post('/api/tutors', async (req, res) => {
      try {
        const tutorData = req.body;

        // Basic server-side validation
        if (
          !tutorData.tutorName ||
          !tutorData.photo ||
          !tutorData.subject ||
          !tutorData.hourlyFee
        ) {
          return res
            .status(400)
            .json({ success: false, message: 'Missing required fields.' });
        }

        // Data টাইপ কাস্টিং ও ফরমেটিং নিশ্চিত করা
        const formattedTutor = {
          tutorName: tutorData.tutorName,
          photo: tutorData.photo,
          subject: tutorData.subject,
          availableDays: tutorData.availableDays, // e.g. ["Sun", "Mon", "Tue"] or String
          availableTime: tutorData.availableTime, // e.g. "5:00 PM - 8:00 PM"
          hourlyFee: parseFloat(tutorData.hourlyFee),
          totalSlot: parseInt(tutorData.totalSlot),
          sessionStartDate: tutorData.sessionStartDate, // format: YYYY-MM-DD
          institution: tutorData.institution,
          experience: tutorData.experience,
          location: tutorData.location,
          teachingMode: tutorData.teachingMode, // Online, Offline, Both

          // Creator Details (যিনি অ্যাড করছেন)
          creatorEmail: tutorData.creatorEmail,
          creatorName: tutorData.creatorName,
          creatorPhoto: tutorData.creatorPhoto,

          createdAt: new Date(),
        };

        const result = await tutorsCollection.insertOne(formattedTutor);

        res.status(201).json({
          success: true,
          message: 'Tutor successfully registered!',
          insertedId: result.insertedId,
          data: formattedTutor,
        });
      } catch (error) {
        console.error('Error creating tutor:', error);
        res
          .status(500)
          .json({ success: false, message: 'Internal server error.' });
      }
    });

    // 2. Get all tutors (with optional search and date filtering)
    app.get('/api/tutors', async (req, res) => {
      try {
        const { search, startDate, endDate } = req.query;
        let query = {};

        // Case-insensitive search by tutor name
        if (search) {
          query.tutorName = { $regex: search, $options: 'i' };
        }

        // Date range filtering on sessionStartDate ($gte & $lte)
        if (startDate || endDate) {
          query.sessionStartDate = {};
          if (startDate) {
            query.sessionStartDate.$gte = startDate; // format: "YYYY-MM-DD"
          }
          if (endDate) {
            query.sessionStartDate.$lte = endDate; // format: "YYYY-MM-DD"
          }
        }

        const tutors = await tutorsCollection.find(query).toArray();
        res
          .status(200)
          .json({ success: true, count: tutors.length, data: tutors });
      } catch (error) {
        console.error('Error fetching tutors:', error);
        res
          .status(500)
          .json({ success: false, message: 'Internal server error.' });
      }
    });

    // 3. Get featured tutors (limit to 6 using .limit() operator)
    app.get('/api/tutors/featured', async (req, res) => {
      try {
        const tutors = await tutorsCollection.find({}).limit(6).toArray();
        res
          .status(200)
          .json({ success: true, count: tutors.length, data: tutors });
      } catch (error) {
        console.error('Error fetching featured tutors:', error);
        res
          .status(500)
          .json({ success: false, message: 'Internal server error.' });
      }
    });

    // 4. Get a single tutor details by ID
    app.get('/api/tutors/:id', async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid Tutor ID' });
        }

        const tutor = await tutorsCollection.findOne({ _id: new ObjectId(id) });
        if (!tutor) {
          return res
            .status(404)
            .json({ success: false, message: 'Tutor not found' });
        }

        res.status(200).json({ success: true, data: tutor });
      } catch (error) {
        console.error('Error fetching tutor details:', error);
        res
          .status(500)
          .json({ success: false, message: 'Internal server error.' });
      }
    });

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
