const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-c3bc7b48f9854f3289d3a708e1852ffe';
const HOST = process.env.HOST || 'localhost';

// Configure CORS to allow requests from file:// protocol
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Handle preflight requests
app.options('*', cors());
// Serve static files from the current directory
app.use(express.static(__dirname));
app.use(express.json());

app.post('/tts', async (req, res) => {
    try {
        let { text, voice, format, quality } = req.body;
        
        // Validate and preprocess text
        if (!text || typeof text !== 'string') {
            throw new Error('النص غير صالح');
        }
        
        // Clean and normalize Arabic text
        text = text
            .replace(/[^\u0600-\u06FF\u0750-\u077F\s]/g, '') // Remove non-Arabic characters
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
            
        if (text.length < 3 || text.length > 1000) {
            throw new Error('يجب أن يكون النص بين 3 و1000 حرف');
        }

        // Verify API key
        if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.length !== 51) {
            throw new Error('مفتاح API غير صالح');
        }

        const response = await axios.post('https://api.deepseek.com/v1/tts', {
            text: text,
            voice: voice || { gender: 'male', language: 'ar-SA' },
            format: format || 'mp3',
            quality: quality || 'high',
            language: 'ar',
            rate: 1.0,
            pitch: 1.0
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Accept': 'audio/mpeg'
            },
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'inline');
        res.send(Buffer.from(response.data, 'binary'));
    } catch (error) {
        console.error('Error:', error);
        if (error.response) {
            console.error('API Error:', error.response.data);
            res.status(error.response.status).json({ 
                error: `خطأ من الخادم: ${error.response.data.message || 'حدث خطأ غير متوقع'}`,
                status: error.response.status,
                headers: error.response.headers,
                data: error.response.data
            });
        } else if (error.request) {
            console.error('No response received:', error.request);
            res.status(503).json({ 
                error: 'لم يتم استلام استجابة من الخادم',
                details: error.message 
            });
        } else {
            console.error('Request setup error:', error.message);
            res.status(500).json({ 
                error: 'حدث خطأ أثناء إعداد الطلب',
                details: error.message 
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})
.on('error', (err) => {
    console.error('Server failed to start:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop other services using this port.`);
    }
});
