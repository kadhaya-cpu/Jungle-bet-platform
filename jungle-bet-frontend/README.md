# RUSH HOUR BET — Optical Traffic Telemetry Betting Platform

RUSH HOUR BET is a real-time optical computer-vision telemetry betting platform powered by a **Vite + React 18 + TypeScript** frontend and a **FastAPI + YOLOv8 + PostgreSQL + Redis** backend.

---

## 1. Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + Headless UI (`@headlessui/react`) + Framer Motion (`framer-motion`)
- **State Management**: Zustand (`useAuthStore`, `useWalletStore`, `useBettingStore`) + TanStack React Query (`@tanstack/react-query`)
- **Routing**: React Router v6 (`react-router-dom`) with Protected & Admin (`user.role === 'admin'`) route guards
- **HTTP Client**: Axios (`src/services/api.ts`) with JWT Bearer attachment & automatic 401 token refresh queue
- **Icons**: Lucide React (`lucide-react`)
- **Charts**: Recharts (`recharts`) for Admin GGR & turnover analytics
- **Maps**: `react-simple-maps` + `d3-geo` for the Interactive Europe & Global Telemetry Map
- **Video**: `react-player` + native HTML5 low-latency proxy player with superimposed YOLOv8 **Optical Green Line** & WebSocket counter (`/ws/count/{feed_id}`)

---

## 2. Project Structure

```text
/src
  /components
    /common       (Button.tsx, Input.tsx, Modal.tsx, Loader.tsx)
    /layout       (Header.tsx, Footer.tsx, Sidebar.tsx)
    /betting      (GameCard.tsx, OddsDisplay.tsx, BetSlip.tsx)
    /wallet       (DepositForm.tsx, WithdrawForm.tsx, BalanceCard.tsx)
    /map          (InteractiveEuropeMap.tsx, CityPin.tsx, VideoPlayer.tsx)
    /admin        (Dashboard.tsx, UserTable.tsx, PayoutQueue.tsx)
  /pages
    Home.tsx
    Login.tsx
    Register.tsx
    Betting.tsx
    Wallet.tsx
    Profile.tsx
    Admin.tsx
  /services
    api.ts        (Axios instance with base URL and JWT auto-refresh interceptors)
    auth.ts       (login, register, token refresh, profile hydration)
    wallet.ts     (deposit, withdraw, balance, transactions)
    betting.ts    (place bet, get games, get results, admin & treasury APIs)
  /store
    useAuthStore.ts    (user, token, refreshToken, isAuthenticated, theme, language)
    useWalletStore.ts  (balance, preferredCurrency, transactions)
    useBettingStore.ts (games, activeBets, odds, history, liveVehicleCount)
  /utils
    formatCurrency.ts  (multi-currency formatting & FX spread preview helpers)
    validateForm.ts    (form validators for auth, deposit, withdraw, bet slip)
    constants.ts       (modular API endpoints, min amounts, currencies, i18n dictionary)
  App.tsx
  main.tsx
  index.css
```

---

## 3. Setup & Development Instructions

### Environment Configuration
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set `VITE_API_BASE_URL`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

### Install & Build
```bash
npm install
npm run dev
npm run build
```
