# Turagsoy AI 🤙

Ang pinakabag-ong AI nga Bisaya kaayo. A Bisaya-first AI chatbot built with React, Firebase, and Groq.

## Features

- 3 chat modes: Ka-Storya, Coding, Tutor
- Real-time streaming responses
- Firebase authentication (Google + Email/Password)
- Chat history saved to Firestore
- Starred messages with jump-to navigation
- Dark / light theme
- Voice input, image attachments
- Export chat as .txt
- Mobile responsive

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Firebase (Auth + Firestore)
- Groq API (`llama-3.3-70b-versatile`)

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_GROQ_API_KEY` | Your Groq API key from [console.groq.com](https://console.groq.com) |
| `VITE_GEMINI_API_KEY` | Optional — Gemini API key (not currently used) |
