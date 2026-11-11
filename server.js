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

// 🟢 Schema សម្រាប់ផលិតផល (បន្ថែម colors សម្រាប់ជម្រើសពណ៌ផ្សេងៗ)
const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    stock: Number,
    image: String,
    colors: Array // ឧទាហរណ៍: [{colorName: "ផ្កាឈូក", image: "..."}, {colorName: "ស", image: "..."}]
});
const Product = mongoose.model('Product', productSchema);

// 🟢 Schema សម្រាប់ប្រវត្តិការបញ្ជាទិញ
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

// 🟢 បញ្ចូលទិន្នន័យផលិតផលដើម (ជាមួយជម្រើសពណ៌ស្រាប់)
async function seedProducts() {
    try {
        let count = await Product.countDocuments();
        if (count === 0) {
            await Product.insertMany([
                { 
                    id: 1, 
                    name: "អាវយឺត SNOOPY FREE SIZE", 
                    price: 3.75, 
                    stock: 5, 
                    image: "https://i.postimg.cc/0NrGyrGt/858535232-122143330293104345-8003998162307616562-n.jpg",
                    colors: [
                        { colorName: "ផ្កាឈូក", image: "https://i.postimg.cc/sXKR4V0f/859784793-122143328547104345-5525957976114747478-n.jpg" },
                        { colorName: "លឿងខ្ចី", image: "https://i.postimg.cc/HkY4F6rY/858998600-122143328523104345-9154920380344446311-n.jpg" }
                    ]
                },
                { 
                    id: 2, 
                    name: "អាវយឺត 16 SMILE FREE SIZE", 
                    price: 3.75, 
                    stock: 5, 
                    image: "https://i.postimg.cc/T1R3T7By/859090829-122143330215104345-4641336911256672944-n.jpg",
                    colors: [
                        { colorName: "ស", image: "https://i.postimg.cc/T1R3T7By/859090829-122143330215104345-4641336911256672944-n.jpg" },
                        { colorName: "ផ្កាឈូកខ្ចី", image: "https://i.postimg.cc/k4CnyYJL/859396177-122143328499104345-4898313489564552661-n.jpg" }
                    ]
                }
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

app.get('/api/products', async (req, res) => {
    try {
        let products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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
        res.json({ success: true, tran_id: orderId, amount: amount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/orders/:telegramId', async (req, res) => {
    try {
        let orders = await Order.find({ telegramId: req.params.telegramId }).sort({ _id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { tran_id } = req.body;
        let orderInfo = await Order.findOne({ orderId: tran_id });
        if (orderInfo) {
            orderInfo.status = 'PENDING';
            await orderInfo.save();
            return res.json({ success: true, message: 'Order submitted.' });
        }
        res.json({ success: false, message: 'Order not found' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin APIs
app.put('/api/admin/update-stock', async (req, res) => {
    try {
        const { id, stock } = req.body;
        let product = await Product.findOne({ id: id });
        if (!product) return res.json({ success: false, message: 'រកមិនឃើញផលិតផលទេ' });
        product.stock = stock;
        await product.save();
        res.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/add-product', async (req, res) => {
    try {
        const { id, name, price, stock, image, colors } = req.body;
        let exist = await Product.findOne({ id: id });
        if (exist) return res.json({ success: false, message: 'ID ផលិតផលនេះមានរួចហើយ!' });

        let newProd = new Product({ id, name, price, stock, image, colors: colors || [] });
        await newProd.save();
        res.json({ success: true, message: 'Product added successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/delete-product/:id', async (req, res) => {
    try {
        let productId = req.params.id;
        await Product.deleteOne({ id: productId });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/pending-orders', async (req, res) => {
    try {
        let pendingOrders = await Order.find({ status: 'PENDING' }).sort({ _id: -1 });
        res.json(pendingOrders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/order-action', async (req, res) => {
    try {
        const { orderId, action } = req.body;
        let orderInfo = await Order.findOne({ orderId: orderId });
        if (!orderInfo) return res.json({ success: false, message: 'រកមិនឃើញ Order នេះទេ។' });

        if (action === 'APPROVE') {
            orderInfo.status = 'PAID';
            await orderInfo.save();

            for (let cartItem of orderInfo.cart) {
                let product = await Product.findOne({ id: cartItem.id });
                if (product) {
                    product.stock = Math.max(0, product.stock - cartItem.quantity);
                    await product.save();
                }
            }

            // 🚀 ដាក់ try...catch ការពារពេលដាច់បណ្ដាញ Telegram
            try {
                let orderText = "🎉 *ការបញ្ជាទិញជោគជ័យ (Admin បាន Approve រួចរាល់)!*\n\n";
                orderText += `📦 *កូដបញ្ជាទិញ:* \`${orderInfo.orderId}\`\n\n`;
                orderInfo.cart.forEach((item, index) => {
                    orderText += `${index + 1}. ${item.name} ${item.selectedColor ? `(ពណ៌: ${item.selectedColor})` : ''} ($${item.price} x ${item.quantity})\n`;
                });
                orderText += `\n👤 *ឈ្មោះអ្នកទិញ:* ${orderInfo.name || 'មិនមានឈ្មោះ'}`;
                orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
                orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
                orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
                orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: orderText,
                    parse_mode: 'Markdown'
                });
            } catch (telegramErr) {
                console.error("Telegram Send Error (Ignored):", telegramErr.message);
            }

            return res.json({ success: true, message: 'បាន Approve និងកាត់ស្តុកជោគជ័យ!' });
        } 
        else if (action === 'REJECT') {
            orderInfo.status = 'REJECTED';
            await orderInfo.save();
            return res.json({ success: true, message: 'បានបដិសេធ (Reject) ការបញ្ជាទិញនេះ!' });
        }

        res.json({ success: false, message: 'Action មិនត្រឹមត្រូវ។' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
