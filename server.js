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

// Robust Pathing for data2
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Using 'gemini-1.5-flash-latest' to resolve the 404 error
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    systemInstruction: `You are a Technical Communication Assistant for Condition C.
    
    PRIMARY SOURCE: "${manualContent}"
    
    FORGIVING SEARCH RULES:
    1. Handle misspellings (e.g., 'binventroy', 'instull') by mapping to the closest manual term.
    2. Interpret broad phrasing (e.g., 'how do I start' means the first installation step).
    3. Use ONLY the provided manual. Do not invent steps.
    4. Provide answers in short, sequential bullet points to reduce cognitive load.`
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
        
        // Log for Research Analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("API Error Detail:", error);
        res.status(500).json({ reply: "I understood your request, but I'm having trouble connecting to my data. Please try rephrasing." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Research Server live on ${PORT}`));
