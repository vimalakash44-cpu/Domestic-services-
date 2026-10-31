const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const authRoutes = require("./routes/auth");
const companyRoutes = require("./routes/company");
const companyRequestsRoutes = require("./routes/companyRequests");
const customerRoutes = require("./routes/customer");
const adminRoutes = require("./routes/admin");
const chatRoutes = require("./routes/chat");
const workerRoutes = require("./routes/worker");
const complaintRoutes = require("./routes/complaint");
const walletRoutes = require("./routes/wallet");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

// Root route: redirect to login page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/domestic_services";

// Helper to ensure the default admin user exists whenever the app connects to the database
async function seedDefaultAdmin() {
    try {
        const existingAdmin = await User.findOne({ email: "admin@domesticservices.com" });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash("Admin@123", 10);
            const admin = new User({
                name: "System Admin",
                email: "admin@domesticservices.com",
                password: hashedPassword,
                role: "admin"
            });
            await admin.save();
            console.log("Default admin account created: admin@domesticservices.com");
        } else {
            console.log("Admin account verified in database.");
        }
    } catch (err) {
        console.error("Error seeding default admin:", err.message);
    }
}

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log("MongoDB connected");
        await seedDefaultAdmin();
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
    });

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/company", companyRequestsRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/worker", workerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/complaint", complaintRoutes);
app.use("/api/wallet", walletRoutes);

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API route not found."
        });
    }

    res.status(404).send("Page not found.");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
