require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Make sure you have 'cors' in your package.json

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Allow all origins for the research tool
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 2. Manual Loading
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded.");
}

// 3. Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY });

app.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: `Technical Assistant. Use ONLY: ${manualContent}. Be forgiving of typos.` },
                ...(history || []).map(h => ({ 
                    role: h.role === 'user' ? 'user' : 'assistant', 
                    content: h.content 
                })),
                { role: "user", content: message }
            ],
            model: "llama3-8b-8192", 
        });

        res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
        console.error("SERVER ERROR:", error.message);
        res.status(500).json({ reply: "The server encountered an error. Check Railway logs." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
