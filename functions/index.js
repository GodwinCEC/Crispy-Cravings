/**
 * Cloud Functions for Crispy Cravings
 * Handles Paystack payment webhooks and order processing
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// -------------------------
// Helper: Paystack Secret
// -------------------------
const getPaystackSecret = () => {
    return process.env.PAYSTACK_SECRET_KEY || functions.config().paystack?.secret;
};

// -------------------------
// Helper: Verify Transaction via Paystack API (Optional)
// -------------------------
async function verifyTransactionWithPaystack(reference) {
    const secretKey = getPaystackSecret();
    if (!secretKey) throw new Error("Paystack secret key not configured");

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
        },
    });

    const result = await response.json();
    if (!result.status || !result.data) throw new Error(result.message || "Verification failed");
    if (result.data.status !== "success") throw new Error(`Transaction status is ${result.data.status}`);

    return result.data;
}

// -------------------------
// 1. Callable Function: Manual Payment Verification (Frontend)
// -------------------------
exports.verifyPayment = functions.https.onCall(async (request, context) => {
    // Support both v1 (data) and newer SDK (request.data) signatures
    const data = (request && request.data) ? request.data : request;
    const { reference } = data;

    if (!reference) throw new functions.https.HttpsError("invalid-argument", "Payment reference is required");

    try {
        console.log(`Manual verification for reference: ${reference}`);
        const paymentData = await verifyTransactionWithPaystack(reference);
        await processSuccessfulPayment(paymentData);
        return { success: true, message: "Payment verified and order updated" };
    } catch (error) {
        console.error("Manual verification error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Payment verification failed");
    }
});

// -------------------------
// 2. Paystack Webhook Handler (Backend)
// -------------------------
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
        const secretKey = getPaystackSecret();
        if (!secretKey) return res.status(500).send("Server configuration error");

        // 1. Verify Paystack signature
        const hash = crypto.createHmac("sha512", secretKey).update(JSON.stringify(req.body)).digest("hex");
        if (hash !== req.headers["x-paystack-signature"]) {
            console.warn("Invalid Paystack signature");
            return res.status(401).send("Invalid signature");
        }

        const { event, data } = req.body;
        console.log(`Webhook event received: ${event}, reference: ${data?.reference}`);

        // 2. Handle events
        switch (event) {
            case "charge.success":
                await processSuccessfulPayment(data); // idempotent
                break;
            case "charge.failed":
                await handleChargeFailed(data);
                break;
            default:
                console.log(`Unhandled event type: ${event}`);
        }

        res.status(200).send("OK");
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).send("Internal Server Error");
    }
});

// -------------------------
// 3. Core Logic: Process Successful Payment
// -------------------------
async function processSuccessfulPayment(paymentData) {
    const { reference, amount } = paymentData;

    console.log(`Processing payment: ${reference}, amount: ${amount}`);

    // Prevent duplicate processing
    const paymentRef = db.collection("payments").doc(reference);
    const existingPayment = await paymentRef.get();
    if (existingPayment.exists) {
        console.log(`Payment ${reference} already processed. Skipping.`);
        return;
    }

    // Find corresponding order
    const ordersRef = db.collection("orders");
    let querySnapshot = await ordersRef.where("orderNumber", "==", reference).limit(1).get();
    if (querySnapshot.empty) querySnapshot = await ordersRef.where("payment.reference", "==", reference).limit(1).get();

    if (querySnapshot.empty) {
        console.error(`Order not found for reference: ${reference}`);
        await db.collection("unmatched_payments").doc(reference).set(paymentData);
        return;
    }

    const orderDoc = querySnapshot.docs[0];
    const orderData = orderDoc.data();

    // Validate amount
    const expectedAmountSubunits = Math.round(orderData.totalAmount * 100);
    if (Math.abs(expectedAmountSubunits - amount) > 5) {
        console.error(`Amount mismatch. Paid: ${amount}, Expected: ${expectedAmountSubunits}`);
        await orderDoc.ref.update({
            "payment.status": "fraud_check",
            "payment.warning": `Amount mismatch. Paid: ${amount / 100}, Expected: ${orderData.totalAmount}`,
            "payment.raw_reference": reference,
        });
        return;
    }

    // Update order
    if (orderData.payment?.status !== "paid") {
        await orderDoc.ref.update({
            "payment.status": "paid",
            "payment.reference": reference,
            "payment.paidAt": admin.firestore.FieldValue.serverTimestamp(),
            "payment.method": paymentData.channel,
            status: "confirmed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Order ${orderDoc.id} marked as PAID`);
    }

    // Log payment record (idempotent)
    await paymentRef.set(
        {
            reference,
            amount: amount / 100,
            status: "success",
            channel: paymentData.channel,
            customer: paymentData.customer,
            verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            fullResponse: paymentData,
        },
        { merge: true }
    );
}

// -------------------------
// 4. Handle Failed Payment
// -------------------------
async function handleChargeFailed(data) {
    const { reference } = data;
    console.log(`Processing failed payment: ${reference}`);

    const ordersRef = db.collection("orders");
    const querySnapshot = await ordersRef.where("orderNumber", "==", reference).limit(1).get();

    if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        await orderDoc.ref.update({
            "payment.status": "failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    await db.collection("payments").doc(reference).set({
        reference,
        status: "failed",
        data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// -------------------------
// 5. Callable Function: Track Order (Frontend)
// -------------------------
exports.trackOrder = functions.https.onCall(async (request, context) => {
    // Support both v1 (data) and newer SDK (request.data) signatures
    const data = (request && request.data) ? request.data : request;
    const { orderNumber, phone } = data;

    // Basic validation
    if (!orderNumber || !phone) {
        const receivedKeys = request ? Object.keys(request).join(', ') : 'null';
        const dataKeys = data ? Object.keys(data).join(', ') : 'null';
        throw new functions.https.HttpsError("invalid-argument", `Order number and phone are required. Request keys: [${receivedKeys}]. Data keys: [${dataKeys}]. Values: OrderNum=${orderNumber}, Phone=${phone}`);
    }

    const ordersRef = db.collection("orders");
    const querySnapshot = await ordersRef
        .where("orderNumber", "==", orderNumber.toUpperCase())
        .where("customer.phone", "==", phone)
        .limit(1)
        .get();

    if (querySnapshot.empty) throw new functions.https.HttpsError("not-found", "Order not found");

    const order = querySnapshot.docs[0].data();

    return {
        orderNumber: order.orderNumber,
        status: order.status,
        items: order.items,
        totalAmount: order.totalAmount,
        delivery: order.delivery,
        payment: {
            method: order.payment.method,
            status: order.payment.status,
        },
        customer: {
            name: order.customer.name,
            location: order.customer.location,
        },
        createdAt: order.createdAt,
    };
});
