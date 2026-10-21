const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
    {
        customer_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        company_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company",
            required: true
        },
        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        sender_role: {
            type: String,
            enum: ["customer", "company", "bot", "system"],
            required: true
        },
        sender_name: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        msg_type: {
            type: String,
            enum: [
                "text",
                "photo",
                "request",
                "quotation",
                "worker_details",
                "daily_update",
                "invoice",
                "complaint",
                "date_reschedule_proposal"
            ],
            default: "text"
        },
        request_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ServiceRequest"
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        read: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
