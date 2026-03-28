require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Railway provides the PORT automatically
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ensure logs folder exists for your research data
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Fix: Read manual from the root where it sits in your screenshot
const manualPath = path.join(__dirname, 'Binventory.txt');
const manualContent = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : "Manual content not found.";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a technical assistant. Use ONLY this text: "${manualContent}". Rules: 1. No outside info. 2. Short sentences. 3. Bullet points. 4. Minimize cognitive load. 5. If confused, simplify further.`
});

// Serve your "Index" file as the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Index'));
});

// Chat Endpoint
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
        
        // Log to file for research analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] User: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Connection failed." });
    }
});

// Start server on 0.0.0.0 (required for Railway/Render)
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
