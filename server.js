require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Manual Loading
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
}

// Initialize AI using the Railway environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", 
    systemInstruction: `Technical Assistant. Use ONLY: ${manualContent}. Be forgiving of typos.`
});

app.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    try {
        const chat = model.startChat({
            history: (history || []).map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
            })),
        });
        const result = await chat.sendMessage(message);
        res.json({ reply: result.response.text() });
    } catch (error) {
        console.error("LOGGING ERROR:", error.message);
        res.status(500).json({ reply: "Connection error. The API key may be restricted." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));
