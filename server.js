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

// Create logs folder for your research data
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// PATH FIX: Matches your GitHub screenshot exactly
const manualPath = path.join(__dirname, 'Binventory.txt');
const manualContent = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : "Manual missing.";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `Use ONLY: "${manualContent}". Rules: 1. No outside info. 2. Short sentences. 3. Bullet points. 4. Minimize cognitive load.`
});

// Serve your "Index" file (no extension, as seen in your screenshot)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Index'), { headers: { 'Content-Type': 'text/html' } });
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
        
        // Save log for your Master's thesis analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] User: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        res.status(500).json({ error: "Gemini error." });
    }
});

// Important: Listen on 0.0.0.0 so Railway can see the app
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
