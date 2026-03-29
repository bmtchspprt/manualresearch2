require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pathing for your manual
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
}

// Initializing the Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// CRITICAL FIX: Ensure the model string is exactly "gemini-1.5-flash" 
// without "models/" or "latest" if you are seeing 404s/500s.
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    systemInstruction: `You are a Technical Assistant. Use this manual: ${manualContent}. 
    Be forgiving of typos and use plain language.`
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
        console.error("API Error:", error);
        // This is the message you are currently seeing
        res.status(500).json({ reply: "I understood your request, but I'm having trouble connecting to the data. Please try once more." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
