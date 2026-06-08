import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import { ToastProvider } from "./context/ToastContext";
import Toast from "./components/shared/Toast";
import Home from "./pages/Home";
import Vault from "./pages/Vault";
import Optimizer from "./pages/Optimizer";
import Insights from "./pages/Insights";
import "./index.css";

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-logo">KYC</span>
        <span className="nav-tagline">Know Your Card</span>
      </div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Home
        </NavLink>
        <NavLink to="/vault" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Vault
        </NavLink>
        <NavLink to="/optimizer" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Optimizer
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          Insights
        </NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <BrowserRouter>
          <Nav />
          <main className="main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/optimizer" element={<Optimizer />} />
              <Route path="/insights" element={<Insights />} />
            </Routes>
          </main>
          <Toast />
        </BrowserRouter>
      </WalletProvider>
    </ToastProvider>
  );
}
