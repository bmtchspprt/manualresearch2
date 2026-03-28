require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. SERVE FRONTEND: This tells the app to look inside the 'public' folder for your HTML
app.use(express.static(path.join(__dirname, 'public')));

// Create logs folder for research data
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// 2. PATH FIX: Looks inside 'data2' for your manual
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
const manualContent = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : "Manual missing.";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a technical assistant. Use ONLY: "${manualContent}". Rules: 1. No outside info. 2. Short sentences. 3. Bullet points. 4. Minimize cognitive load.`
});

// Home route serves the index.html inside /public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
    const { message, sessionId, history } = req.body;
    try {
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
            })),
        });
        const result = await chat.sendMessage(message);
        const aiResponse = result.response.text();
        
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] User: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        res.status(500).json({ error: "Gemini connection error." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
