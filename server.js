const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

// Create Express app
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve the HTML file

// In-memory storage (for demo - would use database in production)
let orderCounter = 1001;
let salesData = [];

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Checkout endpoint
app.post('/checkout', async (req, res) => {
    try {
        const order = req.body;
        const orderNumber = orderCounter++;
        
        // Add order number and timestamp
        const completeOrder = {
            ...order,
            orderNumber: orderNumber,
            date: new Date().toISOString(),
            status: 'completed'
        };
        
        // Save to memory
        salesData.push(completeOrder);
        
        // Save to file (simulating database)
        await saveOrderToFile(completeOrder);
        
        console.log(`✅ Order #${orderNumber} received: $${order.total.toFixed(2)}`);
        
        // Send success response
        res.json({
            success: true,
            orderNumber: orderNumber,
            message: 'Order processed successfully'
        });
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing order'
        });
    }
});

// Get sales report
app.get('/sales-report', (req, res) => {
    const totalSales = salesData.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = salesData.length;
    
    res.json({
        totalOrders: totalOrders,
        totalRevenue: totalSales.toFixed(2),
        averageOrderValue: totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0,
        orders: salesData
    });
});

// Save order to file
async function saveOrderToFile(order) {
    try {
        const fileName = `orders/order_${order.orderNumber}.json`;
        
        // Create orders directory if it doesn't exist
        await fs.mkdir('orders', { recursive: true });
        
        // Write order to file
        await fs.writeFile(fileName, JSON.stringify(order, null, 2));
        
        // Also append to daily sales file
        const today = new Date().toISOString().split('T')[0];
        const dailyFile = `orders/daily_${today}.json`;
        
        let dailyOrders = [];
        try {
            const data = await fs.readFile(dailyFile, 'utf8');
            dailyOrders = JSON.parse(data);
        } catch (err) {
            // File doesn't exist yet, that's fine
        }
        
        dailyOrders.push(order);
        await fs.writeFile(dailyFile, JSON.stringify(dailyOrders, null, 2));
        
    } catch (error) {
        console.error('Error saving order:', error);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 UP Kitchen POS Server running at:`);
    console.log(`   ➡️  http://localhost:${PORT}`);
    console.log(`\n📱 Open the above link in your browser`);
    console.log(`💳 To view sales report: http://localhost:${PORT}/sales-report`);
    console.log(`\n🛎️  Server is ready to take orders!`);
});
