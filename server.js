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

// Ensure logs folder exists for your data collection
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Path to your manual in the data2 folder
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
const manualContent = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : "Manual content not found.";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a technical assistant. Use ONLY this text: "${manualContent}". 
    Rules: 
    1. Do not use outside knowledge. 
    2. Use short, clear sentences to minimize cognitive load. 
    3. Use bullet points for steps. 
    4. If the user is confused, simplify the explanation further. 
    5. Do not complete the task for the user; guide them.`
});

// Serve the main interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat Logic
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
        const response = await result.response;
        const aiResponse = response.text();
        
        // Log interaction for research analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        const logEntry = `[${new Date().toISOString()}]\nUSER: ${message}\nAI: ${aiResponse}\n---\n`;
        fs.appendFileSync(logPath, logEntry);
        
        // Send back 'reply' key for frontend
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ reply: "I'm sorry, I'm having trouble connecting to my brain right now." });
    }
});

// Feedback Logic
app.post('/feedback', (req, res) => {
    const { sessionId, feedback, lastMessage } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: Participant marked last response as: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
