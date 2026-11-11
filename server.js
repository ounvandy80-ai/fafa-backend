const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const MONGO_URI = "mongodb+srv://ounvandy80_db_user:Ounvandy25012003@cluster0.v5i9ayl.mongodb.net/fafa_shop?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

const productSchema = new mongoose.Schema({
    id: Number,
    name: String,
    price: Number,
    stock: Number,
    image: String,
    colors: Array
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    telegramId: String,
    orderId: String,
    amount: Number,
    name: String,
    phone: String,
    address: String,
    location: Object, // 📍 រក្សាទុកទីតាំង GPS (Latitude, Longitude)
    shippingFee: Number,
    shippingName: String,
    cart: Array,
    status: String, 
    date: String
});
const Order = mongoose.model('Order', orderSchema);

// 👤 Schema សម្រាប់គ្រប់គ្រង User និងสถานະ Block
const userSchema = new mongoose.Schema({
    telegramId: String,
    name: String,
    phone: String,
    isBlocked: { type: Boolean, default: false },
    lastActive: String
});
const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
    res.send('FAFA Clothing Backend with Advanced Admin features is running!');
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

// 🟢 ពិនិត្យសិទ្ធិ User ពេលបើក App និងាប់យករបាយការណ៍ Online
app.post('/api/user/ping', async (req, res) => {
    try {
        let { telegramId, name, phone } = req.body;
        if (!telegramId) return res.json({ success: false });

        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId, name: name || 'Guest', phone: phone || '', isBlocked: false, lastActive: new Date() });
        } else {
            user.lastActive = new Date();
            if (name) user.name = name;
            if (phone) user.phone = phone;
        }
        await user.save();

        res.json({ success: true, isBlocked: user.isBlocked });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/create-order', async (req, res) => {
    try {
        let { telegramId, orderId, amount, name, phone, address, location, shippingFee, shippingName, cart } = req.body;
        
        // ពិនិត្យមើលថាតើ User នេះຖືກ Block ហើយឬยัง
        let userCheck = await User.findOne({ telegramId });
        if (userCheck && userCheck.isBlocked) {
            return res.status(403).json({ success: false, message: 'គណនីរបស់អ្នកត្រូវបានបិទសិទ្ធិ (Blocked) មិនអាចបញ្ជាទិញបានទេ!' });
        }

        let parsedCart = typeof cart === 'string' ? JSON.parse(cart) : cart;

        let newOrder = new Order({
            telegramId: telegramId || 'guest',
            orderId,
            amount,
            name,         
            phone,
            address,
            location: location || null,
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

// ==========================================
// 🛠️ ADMIN APIs (Advanced Management)
// ==========================================

// 1. ទាញយកបញ្ជី User ទាំងអស់ និងចំនួន Online ក្នុងរយៈពេល ៥ នាទីចុងក្រោយ
app.get('/api/admin/users', async (req, res) => {
    try {
        let users = await User.find({}).sort({ lastActive: -1 });
        let fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        let onlineCount = await User.countDocuments({ lastActive: { $gte: fiveMinutesAgo } });

        res.json({ success: true, onlineCount, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. មុខងារ Block ឬ Unblock User
app.post('/api/admin/toggle-block', async (req, res) => {
    try {
        let { telegramId } = req.body;
        let user = await User.findOne({ telegramId });
        if (!user) return res.json({ success: false, message: 'រកមិនឃើញ User ទេ' });

        user.isBlocked = !user.isBlocked;
        await user.save();
        res.json({ success: true, isBlocked: user.isBlocked, message: user.isBlocked ? 'បាន Block ជោគជ័យ!' : 'បាន Unblock ជោគជ័យ!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. ស្វែងរកប្រវត្តិ User តាមរយៈលេខទូរសព្ទ (Phone Search)
app.get('/api/admin/search-user', async (req, res) => {
    try {
        let phoneQuery = req.query.phone;
        let orders = await Order.find({ phone: { $regex: phoneQuery, $options: 'i' } }).sort({ _id: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/admin/update-product', async (req, res) => {
    try {
        const { id, name, price, stock, image, colors } = req.body;
        let product = await Product.findOne({ id: id });
        if (!product) return res.json({ success: false, message: 'រកមិនឃើញផលិតផលទេ' });
        product.name = name;
        product.price = Number(price);
        product.stock = Number(stock);
        product.image = image;
        product.colors = colors || [];
        await product.save();
        res.json({ success: true, message: 'បានកែប្រែផលិតផលជោគជ័យ!' });
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
                    if (cartItem.selectedColor && product.colors && product.colors.length > 0) {
                        let targetColor = cartItem.selectedColor.trim().toLowerCase();
                        let colorObj = product.colors.find(c => {
                            let dbColor = c.colorName.trim().toLowerCase();
                            return dbColor === targetColor || dbColor.includes(targetColor) || targetColor.includes(dbColor);
                        });
                        if (colorObj) {
                            colorObj.stock = Math.max(0, (colorObj.stock || 0) - cartItem.quantity);
                        }
                    }
                    product.markModified('colors');
                    await product.save();
                }
            }

            try {
                let orderText = "🎉 *ការបញ្ជាទិញជោគជ័យ (Admin បាន Approve រួចរាល់)!*\n\n";
                orderText += `📦 *កូដបញ្ជាទិញ:* \`${orderInfo.orderId}\`\n\n`;
                orderInfo.cart.forEach((item, index) => {
                    orderText += `${index + 1}. ${item.name} ${item.selectedColor ? `(ពណ៌: ${item.selectedColor})` : ''} ($${item.price} x ${item.quantity})\n`;
                });
                orderText += `\n👤 *ឈ្មោះអ្នកទិញ:* ${orderInfo.name || 'មិនមានឈ្មោះ'}`;
                orderText += `\n📞 *លេខទូរសព្ទ:* ${orderInfo.phone}`;
                orderText += `\n📍 *ទីតាំង:* ${orderInfo.address}`;
                if (orderInfo.location) {
                    orderText += `\n🗺️ *Google Maps:* [ចុចទីនេះដើម្បីមើលទីតាំង](https://maps.google.com/?q=${orderInfo.location.lat},${orderInfo.location.lng})`;
                }
                orderText += `\n🚚 *សេវាដឹកជញ្ជូន:* ${orderInfo.shippingName} ($${orderInfo.shippingFee})`;
                orderText += `\n💰 *ទឹកប្រាក់សរុប:* **$${orderInfo.amount}**`;

                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: TELEGRAM_CHAT_ID,
                    text: orderText,
                    parse_mode: 'Markdown'
                });
            } catch (telegramErr) {
                console.error("Telegram Send Error:", telegramErr.message);
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
