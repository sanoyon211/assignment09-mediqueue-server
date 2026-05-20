import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;


let db;
let tutorsCollection;
let bookingsCollection;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const connectDB = async (req, res, next) => {
  try {
    if (!db) {
      await client.connect();
      db = client.db('mediqueue');
      tutorsCollection = db.collection('tutors');
      bookingsCollection = db.collection('bookings');
      console.log('Successfully connected to MongoDB!');
    }
    req.tutorsCollection = tutorsCollection;
    req.bookingsCollection = bookingsCollection;
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res
      .status(500)
      .json({ success: false, message: 'Database connection failed' });
  }
};


app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.CLIENT_URL,
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(connectDB); 


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      success: false,
      error: true,
      message: 'Unauthorized access: No token provided',
    });
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({
        success: false,
        error: true,
        message: 'Forbidden access: Invalid or expired token',
      });
    }
    req.decoded = decoded;
    next();
  });
};


app.get('/', (req, res) => {
  res.send('MediQueue Server is running smoothly 🚀');
});

app.post('/api/tutors', async (req, res) => {
  try {
    const tutorData = req.body;
    const tutorsCollection = req.tutorsCollection;

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

    const formattedTutor = {
      tutorName: tutorData.tutorName,
      photo: tutorData.photo,
      subject: tutorData.subject,
      language: tutorData.language,
      description: tutorData.description,
      availableDays: tutorData.availableDays,
      availableTime: tutorData.availableTime,
      hourlyFee: parseFloat(tutorData.hourlyFee),
      totalSlot: parseInt(tutorData.totalSlot),
      sessionStartDate: tutorData.sessionStartDate,
      institution: tutorData.institution,
      experience: tutorData.experience,
      location: tutorData.location,
      teachingMode: tutorData.teachingMode,
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
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/tutors', async (req, res) => {
  try {
    const { search, startDate, endDate } = req.query;
    const tutorsCollection = req.tutorsCollection;
    let query = {};

    if (search) {
      query.tutorName = { $regex: search, $options: 'i' };
    }

    if (startDate || endDate) {
      query.sessionStartDate = {};
      if (startDate) {
        query.sessionStartDate.$gte = startDate;
      }
      if (endDate) {
        query.sessionStartDate.$lte = endDate;
      }
    }

    const tutors = await tutorsCollection.find(query).toArray();
    res.status(200).json({ success: true, count: tutors.length, data: tutors });
  } catch (error) {
    console.error('Error fetching tutors:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/tutors/featured', async (req, res) => {
  try {
    const tutorsCollection = req.tutorsCollection;
    const tutors = await tutorsCollection.find({}).limit(6).toArray();
    res.status(200).json({ success: true, count: tutors.length, data: tutors });
  } catch (error) {
    console.error('Error fetching featured tutors:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/tutors/my-tutors', verifyJWT, async (req, res) => {
  try {
    const decodedEmail = req.decoded.email;
    const emailQuery = req.query.email;
    const tutorsCollection = req.tutorsCollection;

    if (decodedEmail !== emailQuery) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden access: Email mismatch.',
      });
    }

    const myTutors = await tutorsCollection
      .find({ creatorEmail: emailQuery })
      .toArray();
    res
      .status(200)
      .json({ success: true, count: myTutors.length, data: myTutors });
  } catch (error) {
    console.error('Error fetching my tutors:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.get('/api/tutors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tutorsCollection = req.tutorsCollection;
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
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.post('/api/jwt', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to sign JWT.',
      });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('JWT signing error:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to generate JWT token.' });
  }
});

app.post('/api/bookings', verifyJWT, async (req, res) => {
  try {
    const bookingData = req.body;
    const decodedEmail = req.decoded.email;
    const tutorsCollection = req.tutorsCollection;
    const bookingsCollection = req.bookingsCollection;

    if (decodedEmail !== bookingData.studentEmail) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden access: Email mismatch.',
      });
    }

    if (
      !bookingData.tutorId ||
      !bookingData.studentEmail ||
      !bookingData.phone
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking details.',
      });
    }

    if (!ObjectId.isValid(bookingData.tutorId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid Tutor ID.' });
    }

    const tutor = await tutorsCollection.findOne({
      _id: new ObjectId(bookingData.tutorId),
    });
    if (!tutor) {
      return res
        .status(404)
        .json({ success: false, message: 'Tutor not found.' });
    }

    if (tutor.totalSlot <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No available slots left.' });
    }

    const newBooking = {
      tutorId: new ObjectId(bookingData.tutorId),
      tutorName: tutor.tutorName,
      tutorPhoto: tutor.photo,
      subject: tutor.subject,
      hourlyFee: tutor.hourlyFee,
      studentName: bookingData.studentName,
      studentEmail: bookingData.studentEmail,
      phone: bookingData.phone,
      bookingDate: bookingData.bookingDate,
      bookStatus: 'booked',
      bookedAt: new Date(),
    };

    const bookingResult = await bookingsCollection.insertOne(newBooking);

    await tutorsCollection.updateOne(
      { _id: new ObjectId(bookingData.tutorId) },
      { $inc: { totalSlot: -1 } },
    );

    res.status(201).json({
      success: true,
      message: 'Session successfully booked! Slot has been reserved.',
      bookingId: bookingResult.insertedId,
      data: newBooking,
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during booking.',
    });
  }
});

app.put('/api/tutors/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const decodedEmail = req.decoded.email;
    const tutorsCollection = req.tutorsCollection;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid Tutor ID.' });
    }

    const existingTutor = await tutorsCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!existingTutor) {
      return res
        .status(404)
        .json({ success: false, message: 'Tutor not found.' });
    }

    if (existingTutor.creatorEmail !== decodedEmail) {
      return res.status(403).json({
        success: false,
        message:
          'Forbidden: You are not authorized to update this tutor profile.',
      });
    }

    const formattedUpdate = {
      tutorName: updateData.tutorName,
      photo: updateData.photo,
      subject: updateData.subject,
      language: updateData.language,
      description: updateData.description,
      availableDays: updateData.availableDays,
      availableTime: updateData.availableTime,
      hourlyFee: parseFloat(updateData.hourlyFee),
      totalSlot: parseInt(updateData.totalSlot),
      sessionStartDate: updateData.sessionStartDate,
      institution: updateData.institution,
      experience: updateData.experience,
      location: updateData.location,
      teachingMode: updateData.teachingMode,
    };

    const result = await tutorsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: formattedUpdate },
    );

    res.status(200).json({
      success: true,
      message: 'Tutor profile updated successfully!',
      modifiedCount: result.modifiedCount,
      data: formattedUpdate,
    });
  } catch (error) {
    console.error('Error updating tutor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during update.',
    });
  }
});

app.delete('/api/tutors/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedEmail = req.decoded.email;
    const tutorsCollection = req.tutorsCollection;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid Tutor ID.' });
    }

    const existingTutor = await tutorsCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!existingTutor) {
      return res
        .status(404)
        .json({ success: false, message: 'Tutor not found.' });
    }

    if (existingTutor.creatorEmail !== decodedEmail) {
      return res.status(403).json({
        success: false,
        message:
          'Forbidden: You are not authorized to delete this tutor profile.',
      });
    }

    const result = await tutorsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: 'Tutor profile successfully deleted!',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting tutor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during deletion.',
    });
  }
});

app.get('/api/bookings/my-bookings', verifyJWT, async (req, res) => {
  try {
    const decodedEmail = req.decoded.email;
    const emailQuery = req.query.email;
    const bookingsCollection = req.bookingsCollection;

    if (decodedEmail !== emailQuery) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden access: Email mismatch.',
      });
    }

    const myBookings = await bookingsCollection
      .find({ studentEmail: emailQuery })
      .toArray();
    res
      .status(200)
      .json({ success: true, count: myBookings.length, data: myBookings });
  } catch (error) {
    console.error('Error fetching my bookings:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

app.patch('/api/bookings/:id/cancel', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const decodedEmail = req.decoded.email;
    const tutorsCollection = req.tutorsCollection;
    const bookingsCollection = req.bookingsCollection;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid Booking ID.' });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found.' });
    }

    if (booking.studentEmail !== decodedEmail) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to cancel this booking.',
      });
    }

    if (booking.bookStatus === 'cancelled') {
      return res
        .status(400)
        .json({ success: false, message: 'Booking is already cancelled.' });
    }

    const result = await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { bookStatus: 'cancelled' } },
    );

    await tutorsCollection.updateOne(
      { _id: new ObjectId(booking.tutorId) },
      { $inc: { totalSlot: 1 } },
    );

    res.status(200).json({
      success: true,
      message:
        'Booking cancelled successfully! Slot has been returned to the tutor.',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during cancellation.',
    });
  }
});


app.use((err, req, res, next) => {
  console.error(' Unhandled Global Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server!',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});


if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(` Server is running on port ${port}`);
  });
}


export default app;
