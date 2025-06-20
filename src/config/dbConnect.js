const mongoose = require('mongoose');

const dbConnect = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI not found in environment variables');
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log('MongoDB Connected');
};

module.exports = dbConnect;
