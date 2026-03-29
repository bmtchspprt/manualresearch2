require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
// Railway automatically assigns a port; 8080 is our fallback
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure logs directory exists for your qualitative research data
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Load your manual from the data2 folder
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded.");
}

// Initialize Gemini using the secure Service Variable from Railway
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Using 'gemini-1.5-flash-latest' to stop the 404 errors
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest", 
    systemInstruction: `You are a Technical Assistant for a research study on Cognitive Load. 
    SOURCE MATERIAL: "${manualContent}"
    
    ADAPTIVE LAYER RULES (Condition C):
    1. FORGIVING SEARCH: Map typos (e.g., 'instull', 'binventroy') to the correct manual terms.
    2. REDUCE LOAD: Use bullet points and clear, sequential steps.
    3. SCOPE: Only answer based on the provided manual.`
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
        
        // Save chat logs for your SPCH 860 analysis
        const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER: ${message} | AI: ${aiResponse}\n`);
        
        res.json({ reply: aiResponse });
    } catch (error) {
        // Detailed logging to catch any remaining API issues
        console.error("API Error Detail:", error);
        res.status(500).json({ reply: "I understood your request, but I'm having trouble connecting to the data. Please try once more." });
    }
});

app.post('/feedback', (req, res) => {
    const { sessionId, feedback } = req.body;
    const logPath = path.join(__dirname, 'logs', `session-${sessionId}.txt`);
    fs.appendFileSync(logPath, `[FEEDBACK]: ${feedback.toUpperCase()}\n`);
    res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Adaptive Research Server active on ${PORT}`));
