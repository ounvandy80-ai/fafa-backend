const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🟢 ភ្ជាប់ទៅកាន់ MongoDB Atlas
const MONGO_URI = "mongodb+srv://ounvandy80_db_user:Ounvandy25012003@cluster0.v5i9ayl.mongodb.net/fafa_shop?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// 🟢 Schema សម្រាប់ផលិតផលនិងស្តុក
const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    stock: Number,
    image: String
});
const Product = mongoose.model('Product', productSchema);

// 🟢 Schema សម្រាប់ប្រវត្តិការបញ្ជាទិញ (បន្ថែម telegramId)
const orderSchema = new mongoose.Schema({
    telegramId: String,
    orderId: String,
    amount: Number,
    name: String,
    phone: String,
    address: String,
    shippingFee: Number,
    shippingName: String,
    cart: Array,
    status: String,
    date: String
});
const Order = mongoose.model('Order', orderSchema);

// 🟢 បញ្ចូលទិន្នន័យផលិតផលដើមចូល Database ប្រសិនបើទទេ
async function seedProducts() {
    try {
        let count = await Product.countDocuments();
        if (count === 0) {
            await Product.insertMany([
                { id: 1, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/0NrGyrGt/858535232-122143330293104345-8003998162307616562-n.jpg" },
                { id: 2, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/HkY4F6rY/858998600-122143328523104345-9154920380344446311-n.jpg" },
                { id: 3, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/T1R3T7By/859090829-122143330215104345-4641336911256672944-n.jpg" },
                { id: 4, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/k4CnyYJL/859396177-122143328499104345-4898313489564552661-n.jpg" },
                { id: 5, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/kG1qqnQn/859396179-122143328535104345-7526329722242687048-n.jpg" },
                { id: 6, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/sXKR4V0f/859784793-122143328547104345-5525957976114747478-n.jpg" },
                { id: 7, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/brJf6KKV/859980286-122143330197104345-5978106523108566575-n.jpg" },
                { id: 8, name: "អាវយឺត FREE SIZE", price: 3.75, stock: 1, image: "https://i.postimg.cc/XqzStsWV/863325406-122143330281104345-4670333600097983632-n.jpg" }
            ]);
            console.log('Default products seeded successfully!');
        }
    } catch (err) {
        console.error('Error seeding products:', err);
    }
}
seedProducts();

app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend with MongoDB is running successfully!');
});

const TELEGRAM_BOT_TOKEN = '9071654545:AAG6Ur9Nt2k-TQiEhlPu65Ib1gbmdh-7sgs';
const TELEGRAM_CHAT_ID = '7488093549';

// API សម្រាប់ Frontend ទាញយកស្តុកចុងក្រោយពី Database
app.get('/api/products', async (req, res) => {
    try {
        let products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API ទទួលការបញ្ជាទិញ (រក្សាទុក telegramId ចូល Database)
app.post('/api/create-order', async (req, res) => {
    try {
        let { telegramId, orderId, amount, name, phone, address, shippingFee, shippingName, cart } = req.body;
        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        let newOrder = new Order({
            telegramId: telegramId || 'guest',
            orderId,
            amount,
            name,          
            phone,
            address,
            shippingFee,
            shippingName,  
            cart: parsedCart,
            status: 'PENDING',
            date: new Date().toLocaleString('en-GB')
        });

        await newOrder.save();

        res.json({
            success: true,
            tran_id: orderId,
            amount: amount
        });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🟢 API សម្រាប់ Frontend ទាញយកប្រវត្តិទិញតាម Telegram ID ពី Database
app.get('/api/orders/:telegramId', async (req, res) => {
    try {
        let orders = await Order.find({ telegramId: req.params.telegramId, status: 'PAID' }).sort({ _id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// API បញ្ជាក់ការបង់ប្រាក់ និងកាត់ស្តុកអចិន្ត្រៃយ៍លើ Database
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { tran_id } = req.body;

        let orderInfo = await Order.findOne({ orderId: tran_id });

        if (orderInfo) {
            orderInfo.status = 'PAID';
            await orderInfo.save();

            for (let cartItem of orderInfo.cart) {
                let product = await Product.findOne({ id: cartItem.id });
                if (product) {
                    product.stock = Math.max(0, product.stock - cartItem.quantity);
                    await product.save();
                }
            }

            let orderText = "🎉 *ការបញ្ជាទិញថ្មី (បង់ប្រាក់រួចរាល់)!*\n\n";
            orderText += `📦 *កូដបញ្ជាទិញ:* \`${orderInfo.orderId}\`\n\n`;

            orderInfo.cart.forEach((item, index) => {
                orderText += `${index + 1}. ${item.name} ($${item.price} x ${item.quantity})\n`;
            });
            
            orderText += `\n👤 *ឈ្មោះអ្នកទិញ:* ${orderInfo.name || 'មិនមានឈ្មោះ'}`;
            orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
            orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
            orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
            orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;
            orderText += `\n🏦 *គណនី ABA:* SRY VANDY (500258373)`;
            orderText += `\n✅ *ស្ថានភាព:* អតិថិជនបានបញ្ជាក់ការបង់ប្រាក់ (កាត់ស្តុកលើ Database រួចរាល់)`;

            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: TELEGRAM_CHAT_ID,
                text: orderText,
                parse_mode: 'Markdown'
            });

            let updatedProducts = await Product.find({});
            return res.json({ success: true, products: updatedProducts });
        }

        res.json({ success: false, message: 'Order not found' });
    } catch (error) {
        console.error("Confirmation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
