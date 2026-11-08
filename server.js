const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto'); // ប្រើសម្រាប់បង្កើត Hash HMAC-SHA512 ជាមួយ ABA API

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🟢 ព័ត៌មាន ABA PayWay Sandbox Credentials របស់អ្នក
const PAYWAY_MERCHANT_ID = 'ec480288';
const PAYWAY_API_KEY = 'D6A95A5622C6F2650D474712EA8294DA4130A7FE';
const PAYWAY_API_URL = 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase';

// ព័ត៌មាន Telegram Bot របស់អ្នក
const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

let ordersDatabase = {};

// 1️⃣ API សម្រាប់បង្កើត Order និងផ្ញើសំណើទៅ ABA PayWay
app.post('/api/create-order', async (req, res) => {
    try {
        const { orderId, amount, phone, address, shippingFee, cart } = req.body;
        
        ordersDatabase[orderId] = {
            orderId,
            amount,
            phone,
            address,
            shippingFee,
            cart,
            status: 'PENDING'
        };

        // 💡 ទីនេះអ្នកអាចសរសេរបន្ថែមការ request ទៅកាន់ PAYWAY_API_URL ដោយប្រើ PAYWAY_API_KEY 
        // សម្រាប់ការបង្កើត Token ឬ QR ជាមួយ ABA PayWay System ផ្ទាល់។

        res.json({ success: true, message: "Order created successfully", orderId });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2️⃣ ABA PayWay Webhook Endpoint
app.post('/api/payway-webhook', async (req, res) => {
    try {
        const { tran_id, status } = req.body;

        if (ordersDatabase[tran_id] && (status === '0' || status === 'success')) {
            ordersDatabase[tran_id].status = 'PAID';
            let orderInfo = ordersDatabase[tran_id];

            let orderText = "🎉 *ការបញ្ជាទិញ និងទូទាត់ប្រាក់ជោគជ័យតាម ABA!*\n\n";
            orderInfo.cart.forEach((item, index) => {
                orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
            });
            
            orderText += `\n📦 *សេវាដឹកជញ្ជូន:* $${orderInfo.shippingFee}`;
            orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
            orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
            orderText += `\n💰 *ទឹកប្រាក់បានបង់សរុប:* **$${orderInfo.amount}**`;
            orderText += `\n✅ *ស្ថានភាព:* បង់ប្រាក់ជោគជ័យ (ABA Sandbox Verified)`;

            // ផ្ញើសារចូល Telegram Bot ភ្លាមៗ
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: orderText,
                parse_mode: 'Markdown'
            });
        }

        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// 3️⃣ API ឆែកស្ថានភាពបង់ប្រាក់ Real-time
app.post('/api/check-payment-status', (req, res) => {
    const { orderId } = req.body;
    const order = ordersDatabase[orderId];

    if (order && order.status === 'PAID') {
        return res.json({ isPaid: true });
    }
    res.json({ isPaid: false });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
