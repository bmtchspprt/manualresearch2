require('dotenv').config();
const express = require('express');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors()); // Prevents "Connection Error" in browsers
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load Manual Content
const manualPath = path.join(__dirname, 'data2', 'Binventory.txt');
let manualContent = "Manual content missing.";
if (fs.existsSync(manualPath)) {
    manualContent = fs.readFileSync(manualPath, 'utf8');
    console.log("SUCCESS: Manual loaded into memory.");
} else {
    console.error("ERROR: Manual file not found at data2/Binventory.txt");
}

// Initialize Groq - replace GEMINI_API_KEY in Railway with your Groq key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY });

app.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: `You are a Technical Assistant. Use ONLY the following manual content to answer: ${manualContent}. Be forgiving of typos. If the answer isn't in the manual, say you don't know.` 
                },
                ...(history || []).map(h => ({ 
                    role: h.role === 'user' ? 'user' : 'assistant', 
                    content: h.content 
                })),
                { role: "user", content: message }
            ],
            model: "llama3-8b-8192", 
        });

        const reply = completion.choices[0]?.message?.content || "I couldn't generate a response.";
        res.json({ reply: reply });
    } catch (error) {
        console.error("DETAILED SERVER ERROR:", error.message);
        res.status(500).json({ reply: "Connection error. Please check Railway logs." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));
