const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./User");
mongoose.connect("mongodb://127.0.0.1:27017/domestic_services").then(async () => {
        console.log("MongoDB connected");
        const existingAdmin = await User.findOne({
            role: "admin"
        });
        if (existingAdmin) {
            console.log("Admin already exists");
            await mongoose.connection.close();
            return;
        }
        const hashedPassword =await bcrypt.hash("Admin@123", 10);
        const admin = new User({
            name: "System Admin",
            email: "admin@domesticservices.com",
            password: hashedPassword,
            role: "admin"
        });
        await admin.save();
        console.log("Admin created successfully");
        await mongoose.connection.close();
    })
    .catch((error) => {
        console.log(error);
    });