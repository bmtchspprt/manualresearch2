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

// Manual Loading - Ensuring data2/Binventory.txt is found
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded into memory.");
} else {
    console.warn("WARNING: Manual file NOT found at:", manualPath);
}

// Initialize AI using the Railway environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash", 
    systemInstruction: `You are a Technical Assistant. Use ONLY the following manual content to answer: ${manualContent}. Be forgiving of typos. If the answer isn't in the manual, say you don't know.`
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
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
    } catch (error) {
        // This will show up in your Railway "Deploy Logs"
        console.error("DETAILED API ERROR:", error.message);
        res.status(500).json({ reply: "Connection error. Please check Railway logs for details." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
