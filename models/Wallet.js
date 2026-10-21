const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        balance: {
            type: Number,
            default: 0,
            min: 0
        },
        transactions: [
            {
                type: {
                    type: String,
                    enum: ["credit", "debit"],
                    required: true
                },
                amount: {
                    type: Number,
                    required: true
                },
                description: {
                    type: String,
                    default: ""
                },
                reference_id: {
                    type: mongoose.Schema.Types.ObjectId
                },
                reference_type: {
                    type: String,
                    enum: [
                        "add_money",
                        "booking_confirmation",
                        "material_payment",
                        "final_payment",
                        "refund"
                    ],
                    default: "add_money"
                },
                status: {
                    type: String,
                    enum: ["pending", "completed", "failed"],
                    default: "completed"
                },
                balance_after: {
                    type: Number,
                    default: 0
                },
                created_at: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Wallet", walletSchema);
