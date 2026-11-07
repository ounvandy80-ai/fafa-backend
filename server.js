const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ព័ត៌មាន Telegram Bot របស់អ្នក (យកពី BotFather)
const TELEGRAM_BOT_TOKEN = '8874550522:AAFGmUQYmGUngNyhuXeOmObvVmQGiVTafEU';
const TELEGRAM_CHAT_ID = '7488093549'; // លេខ Chat ID របស់អ្នក

// API សម្រាប់ទទួលការបញ្ជាទិញ និងផ្ញើសារចូល Telegram
app.post('/api/checkout', async (req, res) => {
    try {
        const { cart, phone, address, shippingFee, totalAmount, paymentStatus } = req.body;

        if (paymentStatus !== 'PAID') {
            return res.status(400).json({ success: false, message: 'សូមបង់ប្រាក់ជាមុនសិន!' });
        }

        // រៀបចំអត្ថបទវិក្កយបត្រផ្ញើចូល Telegram
        let orderText = "🎉 *ការបញ្ជាទិញ និងទូទាត់ប្រាក់ជោគជ័យ!*\n\n";
        cart.forEach((item, index) => {
            orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
        });
        
        orderText += `\n📦 *សេវាដឹកជញ្ជូន:* $${shippingFee}`;
        orderText += `\n📞 *លេខទូរសព្ទ:* ${phone}`;
        orderText += `\n📍 *ទីតាំង:* ${address}`;
        orderText += `\n💰 *ទឹកប្រាក់បានបង់សរុប:* **$${totalAmount}**`;
        orderText += `\n✅ *ស្ថានភាព:* បានស្កេនបង់ប្រាក់តាម ABA រួចរាល់ (Verified)`;

        // ផ្ញើសារចូល Telegram Bot API របស់អ្នក
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: orderText,
            parse_mode: 'Markdown'
        });

        res.json({ success: true, message: 'បញ្ជាទិញបានជោគជ័យ និងបញ្ជូនទៅ Telegram រួចរាល់!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));