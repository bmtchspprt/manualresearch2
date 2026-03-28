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

// Load manual from data2 as per GitHub structure
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual not found.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a Technical Communication Assistant for a research study. 
    Use ONLY: "${manualContent}". 
    Strict Rules: 1. Plain language. 2. Discrete steps. 3. No outside info. 4. Minimize cognitive load.`
});

app.post('/chat', async (req, res) => {
    const { message, sessionId, history } = req.body;
    
    // Safety check for API Key
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ reply: "Internal Error: API Key missing in Railway." });
    }

    try {
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
            })),
        });

        // Use a timeout to prevent hanging connections
        const result = await Promise.race([
            chat.sendMessage(message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);

        const aiResponse = result.response.text();
        
        // Interaction Logging for RQ1 Analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("Critical API Error:", error);
        res.status(500).json({ reply: "The system is processing. Please try rephrasing for clarity." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: Participant marked as ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Research Server live on ${PORT}`));
