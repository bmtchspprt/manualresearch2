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
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// 1. PROJECT-SPECIFIC PATH LOGIC
// Based on your latest screenshot, Binventory.txt is in 'data2' folder
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Error: Manual text file not found in data2/Binventory.txt";

if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded.");
} else {
    console.log("ERROR: Binventory.txt not found at " + manualPath);
}

// 2. API KEY VALIDATION
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.log("ERROR: GEMINI_API_KEY is missing from environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "dummy_key");
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `SYSTEM PROMPT: You are a technical communication assistant. 
    Use ONLY: "${manualContent}". 
    Rules: 1. No outside info. 2. Short sentences. 3. Bullet points. 4. Minimize cognitive load. 5. If confused, simplify.`
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
    const { message, sessionId, history } = req.body;
    
    if (!apiKey || apiKey === "dummy_key") {
        return res.status(500).json({ reply: "API Key missing. Check Railway Variables." });
    }

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
        fs.appendFileSync(logPath, `[${new Date().toISOString()}]\nQ: ${message}\nA: ${aiResponse}\n---\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("GEMINI API ERROR:", error);
        res.status(500).json({ reply: "Connection error with AI service. Check logs." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server active on port ${PORT}`));
