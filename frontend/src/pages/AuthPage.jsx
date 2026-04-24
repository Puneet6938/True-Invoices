import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

const registerInitial = {
  name: "",
  email: "",
  phone: "",
  password: "",
  firmName: "",
  gstNumber: "",
  address: "",
  mobileNumber: "",
};

export function AuthPage() {
  const navigate = useNavigate();
  const { saveSession } = useAuth();
  const googleButtonRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [loginData, setLoginData] = useState({ identity: "", password: "" });
  const [registerData, setRegisterData] = useState(registerInitial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!googleClientId || mode !== "login") {
      return undefined;
    }

    let cancelled = false;
    let script = document.querySelector('script[data-google-identity="true"]');

    async function handleGoogleLogin(credential) {
      setError("");
      setLoading(true);
      try {
        const data = await apiRequest("/auth/google", {
          method: "POST",
          body: JSON.stringify({ credential }),
        });
        saveSession(data);
        navigate("/");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    function renderGoogleButton() {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => handleGoogleLogin(response.credential),
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 320,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener("load", renderGoogleButton, { once: true });
    } else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = renderGoogleButton;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, mode, navigate, saveSession]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginData),
      });
      saveSession(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(registerData),
      });
      saveSession(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <span className="eyebrow">True Invoices Billing Suite</span>
        <h1>Billing built for Indian businesses that need speed, GST detail, and follow-ups.</h1>
        <p>Create invoices, collect payments, print bills, and send WhatsApp reminders from one dashboard.</p>
      </div>

      <div className="auth-panel">
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        {mode === "login" ? (
          <div className="auth-form">
            <form className="auth-form" onSubmit={handleLogin}>
              <input
                placeholder="Email or phone"
                value={loginData.identity}
                onChange={(event) => setLoginData({ ...loginData, identity: event.target.value })}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
              />
              <button className="primary-button" disabled={loading}>
                {loading ? "Please wait..." : "Login"}
              </button>
            </form>

            {googleClientId ? (
              <>
                <div className="auth-divider">
                  <span>or</span>
                </div>
                <div className="google-signin-wrap">
                  <div ref={googleButtonRef} />
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <form className="auth-form auth-grid" onSubmit={handleRegister}>
            <input
              placeholder="Owner name"
              value={registerData.name}
              onChange={(event) => setRegisterData({ ...registerData, name: event.target.value })}
            />
            <input
              placeholder="Email"
              value={registerData.email}
              onChange={(event) => setRegisterData({ ...registerData, email: event.target.value })}
            />
            <input
              placeholder="Phone"
              value={registerData.phone}
              onChange={(event) => setRegisterData({ ...registerData, phone: event.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={registerData.password}
              onChange={(event) => setRegisterData({ ...registerData, password: event.target.value })}
            />
            <input
              placeholder="Firm name"
              value={registerData.firmName}
              onChange={(event) => setRegisterData({ ...registerData, firmName: event.target.value })}
            />
            <input
              placeholder="GST number (optional)"
              value={registerData.gstNumber}
              onChange={(event) => setRegisterData({ ...registerData, gstNumber: event.target.value })}
            />
            <input
              placeholder="Firm mobile number"
              value={registerData.mobileNumber}
              onChange={(event) => setRegisterData({ ...registerData, mobileNumber: event.target.value })}
            />
            <textarea
              placeholder="Firm address"
              value={registerData.address}
              onChange={(event) => setRegisterData({ ...registerData, address: event.target.value })}
            />
            <button className="primary-button full-span" disabled={loading}>
              {loading ? "Please wait..." : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
