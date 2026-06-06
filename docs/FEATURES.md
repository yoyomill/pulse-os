# Feature map

This build removes all developer/debug/internal wording from the visible UI and replaces it with exchange-style modules.

Visible modules:

- Header live ticker
- Market Watch
- Quick Trade
- Chart
- Order Book
- Recent Trades
- Portfolio
- Top Movers
- Heatmap
- Screener
- Market Pulse
- Alerts
- Trader Tools
- Order History
- Auto Briefing

Data strategy:

- Live spot market data
- Live kline chart data
- Live depth data when available
- Live recent trades when available
- Alternative public market feed when primary feed is unreachable
- Clear error state if all live feeds are unreachable
