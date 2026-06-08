import { createContext, useContext, useState, useCallback } from "react";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kyc_wallet") || "[]"); }
    catch { return []; }
  });

  const [spendProfile, setSpendProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kyc_spend_profile") || "{}"); }
    catch { return {}; }
  });

  const [purchaseLog, setPurchaseLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kyc_purchase_log") || "[]"); }
    catch { return []; }
  });

  const persistWallet = useCallback((cards) => {
    localStorage.setItem("kyc_wallet", JSON.stringify(cards));
  }, []);

  const addCard = useCallback((card) => {
    setWallet((prev) => {
      if (prev.find((c) => c.id === card.id)) return prev;
      const next = [...prev, card];
      persistWallet(next);
      return next;
    });
  }, [persistWallet]);

  const removeCard = useCallback((cardId) => {
    setWallet((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      persistWallet(next);
      return next;
    });
  }, [persistWallet]);

  const updateSpendProfile = useCallback((profile) => {
    setSpendProfile(profile);
    localStorage.setItem("kyc_spend_profile", JSON.stringify(profile));
  }, []);

  const logPurchase = useCallback((entry) => {
    setPurchaseLog((prev) => {
      const next = [{ ...entry, id: Date.now(), timestamp: new Date().toISOString() }, ...prev];
      localStorage.setItem("kyc_purchase_log", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        spendProfile,
        purchaseLog,
        addCard,
        removeCard,
        updateSpendProfile,
        logPurchase,
        walletCardIds: wallet.map((c) => c.id),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
