require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Updated model string to use the latest alias for better compatibility
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    systemInstruction: `You are a Technical Assistant for a research study. 
    SOURCE: "${manualContent}"
    RULES: 
    1. Be highly forgiving of typos and broad phrasing.
    2. Break steps into sequential, plain-language actions.
    3. Refer ONLY to the manual content provided. 
    4. If intent is unclear, ask for clarification based on the manual chapters.`
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
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "I understood your request, but I'm having trouble connecting to my data. Please try again." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Forgiving Server active on ${PORT}`));
