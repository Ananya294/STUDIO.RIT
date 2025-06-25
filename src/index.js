require("dotenv").config();
const express = require("express");
const dbConnect = require("./config/dbConnect");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const projectRoutes = require("./routes/projectRoutes");

dbConnect();

const app = express();

//Middleware
app.use(express.json());

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects",projectRoutes);

//Start the server
const PORT = process.env.PORT || 7002;

app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
});
