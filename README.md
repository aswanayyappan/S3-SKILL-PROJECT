# S-3 IOT: Firebase Realtime Database & Groq AI Dashboard

Interactive IoT monitoring and Groq AI intelligence web dashboard.

## Overview
- **Firebase Database**: Connected to `https://s3-skills-default-rtdb.firebaseio.com/`
  - **Current 1 (`current1`)**: Monitors the **LED Fixture**
  - **Current 2 & Voltage 2 (`current2`, `voltage2`)**: Monitors the **Water Pump**
- **AI Intelligence**: Integrated with **Groq AI** (`llama-3.3-70b-versatile`) with direct live telemetry context injection.
- **Frontend**: Responsive UI with live gauges, auto-refresh every 3s, testing simulator, and chat interface.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Groq API Key**
   Copy `.env.example` to `.env` and fill in your Groq key:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ```
   *(Note: You can also enter the Groq Key directly in the web browser UI via the "Groq Key" button).*

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Open in Browser**
   Navigate to: [http://localhost:3000](http://localhost:3000)

