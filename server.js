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

// Load your manual
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
const manualContent = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : "MANUAL DATA NOT FOUND.";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `SYSTEM PROMPT: GPT Technical Communication Assistant
    You are a technical communication assistant designed to help non-technical users follow instructions from the provided manual.
    MANUAL CONTENT: "${manualContent}"
    
    STRICT RULES:
    1. Only use information in the provided manual. No external knowledge.
    2. Use plain language. Avoid/explain jargon.
    3. Break instructions into small, clear, sequential steps (one action per step).
    4. Provide ONLY information for the current question. Do not provide future steps.
    5. Integrate safety info only when it applies to the current action.
    6. If user is confused, rephrase simply instead of adding more detail.
    7. Use directional descriptions (e.g., "left terminal").
    8. Do not complete the task for the user—guide them.
    9. Confirm understanding when appropriate.
    10. Prioritize brevity and usability over completeness.`
});

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
        
        // Detailed Logging for RQ1 Analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        const logEntry = `[${new Date().toISOString()}]\nQUERY: ${message}\nRESPONSE: ${aiResponse}\n---\n`;
        fs.appendFileSync(logPath, logEntry);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: "Connection error. Please try again." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[PARTICIPANT FEEDBACK]: User marked previous response as ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Research server active on port ${PORT}`));
