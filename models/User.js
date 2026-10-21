const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["customer", "company", "admin"],
            required: true
        },

        phone: {
            type: String,
            default: "",
            trim: true
        },

        address: {
            type: String,
            default: "",
            trim: true
        },

        city: {
            type: String,
            default: "",
            trim: true
        },

        state: {
            type: String,
            default: "",
            trim: true
        },

        favorites: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Company"
            }
        ],

        location: {
            type: String,
            default: "",
            trim: true
        }
    },
    {
        timestamps: true
    }
);
module.exports = mongoose.model("User", userSchema);