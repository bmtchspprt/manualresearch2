require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Railway often defaults to 8080 as seen in your logs
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Load manual from data2 folder as shown in your GitHub
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Error: Binventory.txt content could not be loaded.";

if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded for research.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `SYSTEM PROMPT: Technical Communication Assistant
    PURPOSE: Reduce confusion/cognitive overload for non-technical users.
    CONTENT: "${manualContent}"
    RULES (Strict Compliance Required):
    1. Use ONLY provided manual content. No outside info.
    2. Use plain language. Avoid/briefly explain jargon.
    3. Discrete, sequential steps (one action per step).
    4. Provide only task-relevant info for the current question.
    5. Integrate safety info ONLY when contextually necessary.
    6. Rephrase simply if user is confused; do not add complexity.
    7. Use directional/visual descriptions (e.g., "left terminal").
    8. Do NOT complete the task—guide the user.
    9. Confirm understanding when appropriate.
    10. Prioritize clarity and brevity over completeness.`
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
        
        // Log interaction for multi-layered view of cognitive processing
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ reply: "Connection timeout. Please rephrase your question." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Research Server Active on Port ${PORT}`));
