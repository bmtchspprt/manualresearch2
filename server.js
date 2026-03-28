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

// Robust File Loading
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content is currently unavailable.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a Technical Communication Assistant. 
    CONTEXT: "${manualContent}"
    
    FORGIVING SEARCH RULES:
    1. Interpret user intent broadly. If they misspell terms or use synonyms (e.g., "hook up" instead of "wire"), refer to the relevant section of the manual.
    2. If a query is vague, ask a clarifying question based on the manual's chapters.
    3. Use ONLY the provided context. Do not invent procedures.
    
    COMMUNICATION RULES (RQ1 Compliance):
    - Use plain language and minimal jargon.
    - Break instructions into small, sequential steps.
    - Limit responses to the current task phase only.`
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
        
        // Research Logging
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ reply: "I understood your request, but I'm having trouble connecting to my data. Please try once more." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Forgiving Research Server live on ${PORT}`));
