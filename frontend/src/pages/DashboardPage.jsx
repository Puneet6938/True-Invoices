import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { InvoicePrint } from "../components/InvoicePrint";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../context/AuthContext";

const customerInitial = { name: "", email: "", phone: "", gstNumber: "", address: "" };
const productInitial = { name: "", sku: "", unit: "pcs", price: "", gstRate: "18", description: "" };
const paymentInitial = {
  invoiceId: "",
  amount: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  method: "upi",
  note: "",
};

function createAccountForm(user) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  };
}

function createEmptyInvoiceForm() {
  return {
    customerId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    notes: "",
    items: [{ productId: "", name: "", quantity: 1, unitPrice: "", gstRate: 18 }],
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getRoundedBillAmounts(invoiceLike) {
  const totalAmount = Number(invoiceLike?.totalAmount || 0);
  const roundOff = typeof invoiceLike?.roundOff === "number" ? invoiceLike.roundOff : 0;

  return {
    roundOff,
    finalTotal: Number((totalAmount + roundOff).toFixed(2)),
  };
}

function getSpeechRecognitionErrorMessage(errorCode) {
  switch (errorCode) {
    case "aborted":
      return "Voice capture was stopped before speech was recorded";
    case "audio-capture":
      return "No microphone was found. Check your microphone connection and browser device access.";
    case "network":
      return "Speech recognition could not reach the browser speech service. Check your internet connection and try Chrome or Edge.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was denied. Allow mic access in the browser and try again.";
    case "no-speech":
      return "No speech was detected. Click voice input again and start speaking right away.";
    case "language-not-supported":
      return "This browser does not support the selected speech language.";
    default:
      return errorCode ? `Voice input failed: ${errorCode}` : "Could not capture voice command";
  }
}

export function DashboardPage() {
  const { auth, logout, setAuth } = useAuth();
  const speechRecognitionRef = useRef(null);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [customerForm, setCustomerForm] = useState(customerInitial);
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [productForm, setProductForm] = useState(productInitial);
  const [editingProductId, setEditingProductId] = useState("");
  const [paymentForm, setPaymentForm] = useState(paymentInitial);
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [invoiceForm, setInvoiceForm] = useState(createEmptyInvoiceForm);
  const [editingInvoiceId, setEditingInvoiceId] = useState("");
  const [voiceCommand, setVoiceCommand] = useState("");
  const [voiceDraftWarnings, setVoiceDraftWarnings] = useState([]);
  const [voiceDraftSummary, setVoiceDraftSummary] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [accountForm, setAccountForm] = useState(createAccountForm(auth.user));
  const [firmForm, setFirmForm] = useState({
    firmName: auth.firm?.firmName || "",
    gstNumber: auth.firm?.gstNumber || "",
    address: auth.firm?.address || "",
    mobileNumber: auth.firm?.mobileNumber || "",
    signatureName: auth.firm?.signatureName || "",
    signatureLabel: auth.firm?.signatureLabel || "Authorized Signatory",
    showSignature: auth.firm?.showSignature || false,
    showPaidStamp: auth.firm?.showPaidStamp ?? true,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      const [overviewData, customersData, productsData, invoicesData, paymentsData, firmData] = await Promise.all([
        apiRequest("/invoices/stats/overview"),
        apiRequest("/customers"),
        apiRequest("/products"),
        apiRequest("/invoices"),
        apiRequest("/payments"),
        apiRequest("/firm"),
      ]);

      setOverview(overviewData);
      setCustomers(customersData);
      setProducts(productsData);
      setInvoices(invoicesData);
      setPayments(paymentsData);
      setAccountForm(createAccountForm(auth.user));
      setFirmForm({
        firmName: firmData?.firmName || "",
        gstNumber: firmData?.gstNumber || "",
        address: firmData?.address || "",
        mobileNumber: firmData?.mobileNumber || "",
        signatureName: firmData?.signatureName || "",
        signatureLabel: firmData?.signatureLabel || "Authorized Signatory",
        showSignature: firmData?.showSignature || false,
        showPaidStamp: firmData?.showPaidStamp ?? true,
      });
      setAuth((current) => ({ ...current, firm: firmData }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    setAccountForm(createAccountForm(auth.user));
  }, [auth.user]);

  const invoicePreviewTotals = (() => {
    const subtotal = invoiceForm.items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0
    );
    const total = invoiceForm.items.reduce((sum, item) => {
      const base = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return sum + base + (base * Number(item.gstRate || 0)) / 100;
    }, 0);
    const roundedTotal = Math.round(total);

    return {
      subtotal,
      total,
      roundOff: Number((roundedTotal - total).toFixed(2)),
      finalTotal: roundedTotal,
      tax: total - subtotal,
    };
  })();

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function resetCustomerForm() {
    setCustomerForm(customerInitial);
    setEditingCustomerId("");
  }

  function resetProductForm() {
    setProductForm(productInitial);
    setEditingProductId("");
  }

  function resetPaymentForm(invoiceId = "") {
    setPaymentForm({
      ...paymentInitial,
      invoiceId,
    });
    setEditingPaymentId("");
  }

  function resetInvoiceForm() {
    setInvoiceForm(createEmptyInvoiceForm());
    setEditingInvoiceId("");
    setVoiceDraftWarnings([]);
    setVoiceDraftSummary(null);
  }

  async function handleSaveFirm(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const firm = await apiRequest("/firm", {
        method: "PUT",
        body: JSON.stringify(firmForm),
      });
      setAuth((current) => ({ ...current, firm }));
      setMessage("Firm profile updated");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveAccount(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const result = await apiRequest("/auth/me", {
        method: "PUT",
        body: JSON.stringify(accountForm),
      });
      setAuth((current) => ({ ...current, user: result.user }));
      setMessage("User details updated");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCustomerSubmit(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const path = editingCustomerId ? `/customers/${editingCustomerId}` : "/customers";
      const method = editingCustomerId ? "PUT" : "POST";
      await apiRequest(path, {
        method,
        body: JSON.stringify(customerForm),
      });
      resetCustomerForm();
      setMessage(editingCustomerId ? "Customer updated" : "Customer added");
      loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditCustomer(customer) {
    setCustomerForm({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      gstNumber: customer.gstNumber || "",
      address: customer.address || "",
    });
    setEditingCustomerId(customer._id);
    setActiveSection("customers");
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const path = editingProductId ? `/products/${editingProductId}` : "/products";
      const method = editingProductId ? "PUT" : "POST";
      await apiRequest(path, {
        method,
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
          gstRate: Number(productForm.gstRate),
        }),
      });
      resetProductForm();
      setMessage(editingProductId ? "Product updated" : "Product added");
      loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditProduct(product) {
    setProductForm({
      name: product.name || "",
      sku: product.sku || "",
      unit: product.unit || "pcs",
      price: String(product.price ?? ""),
      gstRate: String(product.gstRate ?? "18"),
      description: product.description || "",
    });
    setEditingProductId(product._id);
    setActiveSection("products");
  }

  async function handleInvoiceSubmit(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const path = editingInvoiceId ? `/invoices/${editingInvoiceId}` : "/invoices";
      const method = editingInvoiceId ? "PUT" : "POST";
      const savedInvoice = await apiRequest(path, {
        method,
        body: JSON.stringify({
          ...invoiceForm,
          items: invoiceForm.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            gstRate: Number(item.gstRate),
          })),
        }),
      });
      resetInvoiceForm();
      setMessage(editingInvoiceId ? "Bill updated" : "Bill generated");
      await loadDashboard();
      if (savedInvoice?._id) {
        openInvoice(savedInvoice._id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateVoiceDraft() {
    clearFeedback();

    if (!voiceCommand.trim()) {
      setError("Enter or speak a billing command first");
      return;
    }

    setIsParsingVoice(true);

    try {
      const result = await apiRequest("/invoices/voice-draft", {
        method: "POST",
        body: JSON.stringify({ command: voiceCommand }),
      });

      setVoiceDraftWarnings(result.warnings || []);
      setVoiceDraftSummary(result.extracted || null);
      setInvoiceForm((current) => ({
        ...current,
        customerId: result.draft?.customerId || "",
        issueDate: result.draft?.issueDate || current.issueDate,
        dueDate: result.draft?.dueDate || current.dueDate,
        notes: result.draft?.notes || current.notes,
        items: (result.draft?.items || []).length > 0 ? result.draft.items : current.items,
      }));
      setMessage("Voice command converted into a bill draft");
      setActiveSection("bills");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsingVoice(false);
    }
  }

  function handleStartListening() {
    clearFeedback();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge, or type the command manually.");
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setError("Voice input needs a secure site (HTTPS) or localhost.");
      return;
    }

    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setVoiceCommand(transcript);
      setMessage("Voice captured. Review it, then generate the draft.");
    };

    recognition.onerror = (event) => {
      setError(getSpeechRecognitionErrorMessage(event.error));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }

  function handleStopListening() {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
    setIsListening(false);
  }

  async function openInvoice(invoiceId) {
    try {
      const data = await apiRequest(`/invoices/${invoiceId}`);
      setSelectedInvoice(data.invoice);
      setInvoicePayments(data.payments);
      resetPaymentForm(invoiceId);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditInvoice(invoice) {
    setInvoiceForm({
      customerId: invoice.customer?._id || "",
      issueDate: new Date(invoice.issueDate).toISOString().slice(0, 10),
      dueDate: new Date(invoice.dueDate).toISOString().slice(0, 10),
      notes: invoice.notes || "",
      items: invoice.items.map((item) => ({
        productId: item.product || "",
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
      })),
    });
    setEditingInvoiceId(invoice._id);
    setActiveSection("bills");
  }

  async function handleDeleteInvoice(invoiceId) {
    if (!window.confirm("Delete this bill and its payments?")) {
      return;
    }

    clearFeedback();
    try {
      await apiRequest(`/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (selectedInvoice?._id === invoiceId) {
        setSelectedInvoice(null);
        setInvoicePayments([]);
        resetPaymentForm();
      }
      if (editingInvoiceId === invoiceId) {
        resetInvoiceForm();
      }
      setMessage("Bill deleted");
      loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    clearFeedback();
    try {
      const path = editingPaymentId ? `/payments/${editingPaymentId}` : "/payments";
      const method = editingPaymentId ? "PUT" : "POST";
      const data = await apiRequest(path, {
        method,
        body: JSON.stringify({
          ...paymentForm,
          amount: Number(paymentForm.amount),
        }),
      });

      setMessage(editingPaymentId ? "Payment updated" : "Payment received");
      resetPaymentForm(data.invoice._id);
      await loadDashboard();
      openInvoice(data.invoice._id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditPayment(payment) {
    setPaymentForm({
      invoiceId: payment.invoice?._id || "",
      amount: String(payment.amount ?? ""),
      paymentDate: new Date(payment.paymentDate).toISOString().slice(0, 10),
      method: payment.method || "upi",
      note: payment.note || "",
    });
    setEditingPaymentId(payment._id);
    setActiveSection("payments");
  }

  async function handleReminder(invoiceId) {
    clearFeedback();
    try {
      const result = await apiRequest(`/reminders/${invoiceId}/whatsapp`, {
        method: "POST",
      });
      window.open(result.url, "_blank");
      setMessage("WhatsApp reminder link opened");
      loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleProductSelect(index, productId) {
    const product = products.find((item) => item._id === productId);
    const items = [...invoiceForm.items];
    items[index] = {
      ...items[index],
      productId,
      name: product?.name || "",
      unitPrice: product?.price || "",
      gstRate: product?.gstRate || 18,
    };
    setInvoiceForm({ ...invoiceForm, items });
  }

  function handlePrint() {
    window.print();
  }

  const sidebarItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "customers", label: "Customers" },
    { id: "products", label: "Products" },
    { id: "bills", label: "Bills" },
    { id: "payments", label: "Payments" },
  ];

  const recentInvoices = invoices.slice(0, 6);

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <span className="eyebrow">True Invoices</span>
            <h1>{auth.firm?.firmName || "Billing Dashboard"}</h1>
            <p>{auth.user?.name}</p>
          </div>

          <nav className="sidebar-nav">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                className={`sidebar-link ${activeSection === item.id ? "active" : ""}`}
                onClick={() => setActiveSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <button className="ghost-button sidebar-logout" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <h2>{activeSection === "dashboard" ? "Business dashboard" : sidebarItems.find((item) => item.id === activeSection)?.label}</h2>
            <p>
              {activeSection === "dashboard"
                ? "Firm details, bill visibility, and revenue are front and center."
                : "Manage your billing workflow from the left sidebar."}
            </p>
          </div>
          <button className="primary-button" onClick={handlePrint} disabled={!selectedInvoice}>
            Print selected bill
          </button>
        </header>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        {activeSection === "dashboard" ? (
          <>
            <div className="stats-grid compact-stats">
              <StatCard label="Revenue" value={formatCurrency(overview?.totalRevenue)} />
              <StatCard label="Collected" value={formatCurrency(overview?.totalCollected)} tone="success" />
              <StatCard label="Pending" value={formatCurrency(overview?.totalPending)} tone="warning" />
            </div>

            <div className="content-grid">
              <SectionCard title="User Details">
                <form className="form-grid" onSubmit={handleSaveAccount}>
                  <input
                    placeholder="Owner name"
                    value={accountForm.name}
                    onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
                  />
                  <input
                    placeholder="Email"
                    value={accountForm.email}
                    onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                  />
                  <input
                    placeholder="Phone"
                    value={accountForm.phone}
                    onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })}
                  />
                  <div className="profile-card full-span">
                    <span className="eyebrow">Account Snapshot</span>
                    <strong>{auth.user?.name || "Business owner"}</strong>
                    <p>{auth.user?.email || "No email added"}</p>
                    <p>{auth.user?.phone || "No phone added"}</p>
                  </div>
                  <button className="primary-button">Save user details</button>
                </form>
              </SectionCard>

              <SectionCard title="Firm And Print Settings">
                <form className="form-grid" onSubmit={handleSaveFirm}>
                  <input
                    placeholder="Firm name"
                    value={firmForm.firmName}
                    onChange={(event) => setFirmForm({ ...firmForm, firmName: event.target.value })}
                  />
                  <input
                    placeholder="GST number (optional)"
                    value={firmForm.gstNumber}
                    onChange={(event) => setFirmForm({ ...firmForm, gstNumber: event.target.value })}
                  />
                  <input
                    placeholder="Mobile number"
                    value={firmForm.mobileNumber}
                    onChange={(event) => setFirmForm({ ...firmForm, mobileNumber: event.target.value })}
                  />
                  <input
                    placeholder="Signature name"
                    value={firmForm.signatureName}
                    onChange={(event) => setFirmForm({ ...firmForm, signatureName: event.target.value })}
                  />
                  <input
                    placeholder="Signature label"
                    value={firmForm.signatureLabel}
                    onChange={(event) => setFirmForm({ ...firmForm, signatureLabel: event.target.value })}
                  />
                  <textarea
                    placeholder="Address"
                    value={firmForm.address}
                    onChange={(event) => setFirmForm({ ...firmForm, address: event.target.value })}
                  />
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={firmForm.showSignature}
                      onChange={(event) => setFirmForm({ ...firmForm, showSignature: event.target.checked })}
                    />
                    <span>Show signature on printed bill</span>
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={firmForm.showPaidStamp}
                      onChange={(event) => setFirmForm({ ...firmForm, showPaidStamp: event.target.checked })}
                    />
                    <span>Show paid stamp on fully paid bills</span>
                  </label>
                  <button className="primary-button">Save firm details</button>
                </form>
              </SectionCard>

              <SectionCard title="Latest Bills">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill No.</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((invoice) => (
                        <tr key={invoice._id}>
                          <td>
                            <button className="link-button" onClick={() => openInvoice(invoice._id)}>
                              {invoice.invoiceNumber}
                            </button>
                          </td>
                          <td>{invoice.customer?.name}</td>
                          <td>
                            <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
                          </td>
                          <td>{formatCurrency(getRoundedBillAmounts(invoice).finalTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </>
        ) : null}

        {activeSection === "customers" ? (
          <div className="content-grid">
            <SectionCard
              title={editingCustomerId ? "Edit Customer" : "Add Customer"}
              action={
                editingCustomerId ? (
                  <button className="ghost-button small" onClick={resetCustomerForm}>
                    Cancel edit
                  </button>
                ) : null
              }
            >
              <form className="form-grid" onSubmit={handleCustomerSubmit}>
                <input
                  placeholder="Customer name"
                  value={customerForm.name}
                  onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
                />
                <input
                  placeholder="Phone"
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })}
                />
                <input
                  placeholder="Email"
                  value={customerForm.email}
                  onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                />
                <input
                  placeholder="GST number (optional)"
                  value={customerForm.gstNumber}
                  onChange={(event) => setCustomerForm({ ...customerForm, gstNumber: event.target.value })}
                />
                <textarea
                  placeholder="Address"
                  value={customerForm.address}
                  onChange={(event) => setCustomerForm({ ...customerForm, address: event.target.value })}
                />
                <button className="primary-button">{editingCustomerId ? "Update customer" : "Add customer"}</button>
              </form>
            </SectionCard>

            <SectionCard title="Customer List">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer._id}>
                        <td>{customer.name}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.email || "-"}</td>
                        <td>
                          <button className="ghost-button small" onClick={() => startEditCustomer(customer)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeSection === "products" ? (
          <div className="content-grid">
            <SectionCard
              title={editingProductId ? "Edit Product" : "Add Product"}
              action={
                editingProductId ? (
                  <button className="ghost-button small" onClick={resetProductForm}>
                    Cancel edit
                  </button>
                ) : null
              }
            >
              <form className="form-grid" onSubmit={handleCreateProduct}>
                <input
                  placeholder="Product name"
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                />
                <input
                  placeholder="SKU"
                  value={productForm.sku}
                  onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
                />
                <input
                  placeholder="Unit"
                  value={productForm.unit}
                  onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  value={productForm.price}
                  onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="GST %"
                  value={productForm.gstRate}
                  onChange={(event) => setProductForm({ ...productForm, gstRate: event.target.value })}
                />
                <textarea
                  placeholder="Description"
                  value={productForm.description}
                  onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                />
                <button className="primary-button">{editingProductId ? "Update product" : "Add product"}</button>
              </form>
            </SectionCard>

            <SectionCard title="Product List">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th>Price</th>
                      <th>GST %</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product._id}>
                        <td>{product.name}</td>
                        <td>{product.sku || "-"}</td>
                        <td>{product.unit || "-"}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>{product.gstRate}</td>
                        <td>
                          <button className="ghost-button small" onClick={() => startEditProduct(product)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeSection === "bills" ? (
          <div className="stack-grid">
            <SectionCard title="Voice Bill Assistant">
              <div className="voice-assistant">
                <p className="voice-helper">
                  Speak or type a command like <strong>Give 2 shirts to Ramesh for 800</strong> and we&apos;ll prepare the bill form for you.
                </p>
                <p className="muted-text">Best support is in Chrome or Edge with microphone permission enabled.</p>

                <textarea
                  placeholder="Example: Give 2 shirts to Ramesh for 800"
                  value={voiceCommand}
                  onChange={(event) => setVoiceCommand(event.target.value)}
                />

                <div className="toolbar-row">
                  {speechSupported ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={isListening ? handleStopListening : handleStartListening}
                    >
                      {isListening ? "Stop listening" : "Start voice input"}
                    </button>
                  ) : (
                    <span className="muted-text">Voice input is not supported in this browser, but text commands still work.</span>
                  )}

                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleGenerateVoiceDraft}
                    disabled={isParsingVoice}
                  >
                    {isParsingVoice ? "Generating draft..." : "Generate draft from command"}
                  </button>
                </div>

                {voiceDraftSummary ? (
                  <div className="voice-summary">
                    <span>Customer: {voiceDraftSummary.matchedCustomer?.name || voiceDraftSummary.customerName || "Needs review"}</span>
                    <span>Item: {voiceDraftSummary.matchedProduct?.name || voiceDraftSummary.itemName || "Needs review"}</span>
                    <span>Qty: {voiceDraftSummary.quantity || 1}</span>
                    <span>
                      Amount: {voiceDraftSummary.totalAmount !== null ? formatCurrency(voiceDraftSummary.totalAmount) : "Needs review"}
                    </span>
                  </div>
                ) : null}

                {voiceDraftWarnings.length > 0 ? (
                  <div className="voice-warnings">
                    {voiceDraftWarnings.map((warning) => (
                      <span key={warning} className="badge badge-overdue">
                        {warning}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title={editingInvoiceId ? "Edit Bill" : "Generate Bill"}
              action={
                editingInvoiceId ? (
                  <button className="ghost-button small" onClick={resetInvoiceForm}>
                    Cancel edit
                  </button>
                ) : null
              }
            >
              <form className="form-grid" onSubmit={handleInvoiceSubmit}>
                <select
                  value={invoiceForm.customerId}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, customerId: event.target.value })}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, issueDate: event.target.value })}
                />
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })}
                />

                {invoiceForm.items.map((item, index) => (
                  <div className="invoice-line" key={index}>
                    <select value={item.productId} onChange={(event) => handleProductSelect(index, event.target.value)}>
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(event) => {
                        const items = [...invoiceForm.items];
                        items[index].name = event.target.value;
                        setInvoiceForm({ ...invoiceForm, items });
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(event) => {
                        const items = [...invoiceForm.items];
                        items[index].quantity = event.target.value;
                        setInvoiceForm({ ...invoiceForm, items });
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={item.unitPrice}
                      onChange={(event) => {
                        const items = [...invoiceForm.items];
                        items[index].unitPrice = event.target.value;
                        setInvoiceForm({ ...invoiceForm, items });
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="GST %"
                      value={item.gstRate}
                      onChange={(event) => {
                        const items = [...invoiceForm.items];
                        items[index].gstRate = event.target.value;
                        setInvoiceForm({ ...invoiceForm, items });
                      }}
                    />
                  </div>
                ))}

                <div className="toolbar-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setInvoiceForm({
                        ...invoiceForm,
                        items: [...invoiceForm.items, { productId: "", name: "", quantity: 1, unitPrice: "", gstRate: 18 }],
                      })
                    }
                  >
                    Add line item
                  </button>
                  {invoiceForm.items.length > 1 ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        setInvoiceForm({
                          ...invoiceForm,
                          items: invoiceForm.items.slice(0, -1),
                        })
                      }
                    >
                      Remove last line
                    </button>
                  ) : null}
                </div>

                <textarea
                  placeholder="Invoice notes"
                  value={invoiceForm.notes}
                  onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })}
                />

                <div className="invoice-summary">
                  <span>Subtotal: {formatCurrency(invoicePreviewTotals.subtotal)}</span>
                  <span>Tax: {formatCurrency(invoicePreviewTotals.tax)}</span>
                  <span>Round Off: {formatCurrency(invoicePreviewTotals.roundOff)}</span>
                  <strong>Final Total: {formatCurrency(invoicePreviewTotals.finalTotal)}</strong>
                </div>

                <button className="primary-button">{editingInvoiceId ? "Update bill" : "Generate bill"}</button>
              </form>
            </SectionCard>

            <SectionCard title="All Bills">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bill No.</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice._id}>
                        <td>
                          <button className="link-button" onClick={() => openInvoice(invoice._id)}>
                            {invoice.invoiceNumber}
                          </button>
                        </td>
                        <td>{invoice.customer?.name}</td>
                        <td>{formatCurrency(getRoundedBillAmounts(invoice).finalTotal)}</td>
                        <td>
                          <span className={`badge badge-${invoice.status}`}>{invoice.status}</span>
                        </td>
                        <td>
                          <div className="inline-actions">
                            <button className="ghost-button small" onClick={() => startEditInvoice(invoice)}>
                              Edit
                            </button>
                            <button className="ghost-button small" onClick={() => handleReminder(invoice._id)}>
                              WhatsApp
                            </button>
                            <button className="ghost-button small danger-button" onClick={() => handleDeleteInvoice(invoice._id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeSection === "payments" ? (
          <div className="content-grid">
            <SectionCard
              title={editingPaymentId ? "Edit Payment" : "Receive Payment"}
              action={
                editingPaymentId ? (
                  <button className="ghost-button small" onClick={() => resetPaymentForm(paymentForm.invoiceId)}>
                    Cancel edit
                  </button>
                ) : null
              }
            >
              <form className="form-grid" onSubmit={handlePaymentSubmit}>
                <select
                  value={paymentForm.invoiceId}
                  onChange={(event) => setPaymentForm({ ...paymentForm, invoiceId: event.target.value })}
                  disabled={Boolean(editingPaymentId)}
                >
                  <option value="">Select bill</option>
                  {invoices.map((invoice) => (
                    <option key={invoice._id} value={invoice._id}>
                      {invoice.invoiceNumber} - {invoice.customer?.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Payment amount"
                  value={paymentForm.amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })}
                />
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })}
                />
                <select
                  value={paymentForm.method}
                  onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank-transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
                <textarea
                  placeholder="Note"
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })}
                />
                <button className="primary-button">{editingPaymentId ? "Update payment" : "Receive payment"}</button>
              </form>
            </SectionCard>

            <SectionCard title="Payment History">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bill</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{new Date(payment.paymentDate).toLocaleDateString("en-IN")}</td>
                        <td>{payment.invoice?.invoiceNumber}</td>
                        <td>{payment.method}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>
                          <button className="ghost-button small" onClick={() => startEditPayment(payment)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {selectedInvoice ? (
          <div className="detail-grid">
            <SectionCard title={`Bill ${selectedInvoice.invoiceNumber}`}>
              <div className="invoice-detail">
                <p>Customer: {selectedInvoice.customer?.name}</p>
                <p>Status: {selectedInvoice.status}</p>
                <p>Total: {formatCurrency(getRoundedBillAmounts(selectedInvoice).finalTotal)}</p>
                <p>Paid: {formatCurrency(selectedInvoice.amountPaid)}</p>
                <p>Balance: {formatCurrency(selectedInvoice.balanceDue)}</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePayments.map((payment) => (
                      <tr key={payment._id}>
                        <td>{new Date(payment.paymentDate).toLocaleDateString("en-IN")}</td>
                        <td>{payment.method}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Print Preview">
              <InvoicePrint invoice={selectedInvoice} firm={auth.firm} user={auth.user} />
            </SectionCard>
          </div>
        ) : null}
      </main>
    </div>
  );
}
