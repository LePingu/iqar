# Trading Dashboard

A modern, dark-themed trading dashboard built with React, TypeScript, Vite, and Framer Motion. This application connects to the Kraken Pro API to display your last 10 trades alongside current market prices, showing profit/loss percentages with smooth animations.

## 🚀 Quick Start - Demo Mode

**Try the demo immediately without any setup:**

1. ```bash
   npm install && npm run dev
   ```
2. Open http://localhost:5173
3. Click **"🎯 Try Demo Mode"** to see the interface with sample trading data

## Features

- 🌙 **Dark Theme**: Modern dark UI design
- 📊 **Live Trading Data**: Fetches your last 10 trades from Kraken Pro API
- 💰 **Profit/Loss Tracking**: Shows current prices vs trade prices with percentage changes
- 🎭 **Smooth Animations**: Beautiful Framer Motion animations
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🔒 **Secure**: API credentials stored in environment variables
- 🎯 **Demo Mode**: Explore the interface with realistic sample data

## ⚠️ CORS Limitation & Solutions

**Important:** Direct browser requests to Kraken API are blocked by CORS (Cross-Origin Resource Sharing) security policy.

### 🎯 Solution 1: Demo Mode (Immediate)
- Click the **"Demo Mode"** button to explore the full interface
- Uses realistic sample trading data
- Shows all features and animations
- Perfect for testing and demonstration

### 🏗️ Solution 2: Production Backend (Recommended)
For a production application, implement a backend server:

```javascript
// Example Express.js backend proxy
app.post('/api/kraken/*', async (req, res) => {
  // Forward request to Kraken API with proper authentication
  // Handle CORS headers
  // Return response to frontend
});
```

### 🔧 Solution 3: Development Workaround
For development/testing with real API:
1. Install a CORS browser extension (e.g., "CORS Unblock")
2. Temporarily disable CORS for localhost
3. **Note:** Never disable CORS in production!

## Prerequisites

- Node.js (v16 or higher)
- A Kraken account with API access (for real data)
- Kraken API key with "Orders and trades - Query closed orders & trades" permissions

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Demo Mode (No API Required)

```bash
npm run dev
```
Open http://localhost:5173 and click **"Demo Mode"**

### 3. Real API Setup (Backend Required)

1. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Add your Kraken API credentials:
   ```env
   VITE_KRAKEN_API_KEY=your_api_key_here
   VITE_KRAKEN_API_SECRET=your_private_key_here
   ```

3. Set up a backend proxy server to handle API requests

4. Update the `baseUrl` in `src/services/krakenApi.ts` to point to your backend

## API Endpoints Used

This application uses the following Kraken API endpoints:

- **Private API**:
  - `/private/TradesHistory` - Fetches your trading history
- **Public API**:
  - `/public/Ticker` - Gets current market prices for asset pairs

## Project Structure

```
src/
├── components/          # React components
│   ├── TradingDashboard.tsx  # Main dashboard
│   ├── TradeCard.tsx         # Individual trade display
│   ├── LoadingSpinner.tsx    # Loading animation
│   └── ErrorDisplay.tsx      # Error handling
├── hooks/              # Custom React hooks
│   └── useTradingData.ts     # Data fetching logic
├── services/           # API services
│   └── krakenApi.ts          # Kraken API integration
├── types/              # TypeScript type definitions
│   └── trading.ts            # Trading data types
├── utils/              # Utility functions
│   └── trading.ts            # Price calculations
├── data/               # Mock data
│   └── mockTrades.ts         # Demo mode data
└── main.tsx           # Application entry point
```

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Framer Motion** - Animations
- **Tailwind CSS** - Styling
- **Crypto-JS** - API authentication

## Demo Data

The demo mode includes realistic trading data showing:
- Various cryptocurrency pairs (BTC, ETH, ADA, XRP, LTC, DOT, XLM)
- Mix of profitable and losing trades
- Different order types (market, limit)
- Realistic timestamps and fee structures
- Current price comparisons with percentage changes

## Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure and never share them
- The API key should only have the minimum required permissions
- Consider using read-only API keys when possible
- Implement proper backend authentication in production

## Troubleshooting

### Demo Mode Not Working
1. Ensure you have the latest code
2. Check browser console for errors
3. Try refreshing the page

### CORS Errors
This is expected behavior for browser security. Use:
1. **Demo Mode** for immediate testing
2. **Backend proxy** for production
3. **CORS extension** for development only

### API Credentials Not Working
1. Verify your API key and secret are correct
2. Ensure the API key has the required permissions
3. Implement a backend proxy to avoid CORS issues
4. Check that the keys are properly set in your `.env` file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with demo mode
5. Submit a pull request

## License

MIT License - see LICENSE file for details
