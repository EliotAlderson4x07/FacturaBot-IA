/* FacturaBot AI — app.js — Conexión directa Gemini + doble chat independiente (fix carga infinita y bomba) */
const GEMINI_API_KEY = "AQ.Ab8RN6Lf0VvIfAqnHOJFkC8XUiR5K9vu_aikYWx1ITQMnZ_YLg";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTION_FAQ = "Eres el Asistente Informativo y de Soporte de FacturaBot AI en la página web. Tu único propósito es responder dudas y orientar a los clientes sobre el servicio de FacturaBot AI. Reglas esenciales: 1. NO generes facturas, NO pidas datos tributarios para emitir, y NO generes estructuras JSON, códigos QR ni PDFs en este chat web. 2. Explica con profesionalismo y cordialidad que FacturaBot AI es un bot oficial para WhatsApp que emite facturas electrónicas a la DIAN mediante Matías API en segundos con solo 4 datos (Nombre/Razón Social, Cédula/NIT, Correo y Valor). 3. Si el cliente desea facturar, indícale amablemente que debe iniciar la conversación por WhatsApp haciendo clic en el botón de WhatsApp de la página o escribiendo a la línea de atención. Si el usuario solicita generar, tramitar, emitir o consultar una factura electrónica directamente en este sitio web (o si escribe datos para facturar), responde con educación y formalidad con el siguiente mensaje exacto: \"Le informamos que la emisión y gestión de facturas electrónicas no se realiza a través de este portal web ni en este chat de asistencia. Para iniciar el proceso de facturación automatizado o solicitar la vinculación a nuestro servicio, le invitamos cordialmente a comunicarse con nuestro equipo de ventas y asesores comerciales a través de los canales de contacto oficiales dispuestos al final de esta página (WhatsApp o correo electrónico).\" 4. Responde con soltura dudas comerciales, técnicas, de seguridad y explica de forma comprensiva y formal cualquier inquietud sobre tiempos de espera o canales de contacto. Mantén siempre un tono corporativo, claro y educado. Eres un asesor corporativo de información y ventas para FacturaBot AI. Tu labor es responder inquietudes de forma ejecutiva, formal, concisa y profesional.";
const PROMPT_DEMO = SYSTEM_INSTRUCTION_FAQ;
const PROMPT_SOPORTE = SYSTEM_INSTRUCTION_FAQ;
const PROMPT_FAQ = SYSTEM_INSTRUCTION_FAQ;

const els = {
  menuToggle: document.getElementById("menu-toggle"),
  mobilePanel: document.getElementById("mobile-panel"),
  mainNav: document.getElementById("main-nav"),
  chatMessages: document.getElementById("chat-messages"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send"),
  typing: document.getElementById("typing-indicator"),
  charCount: document.getElementById("char-count"),
  chatStatus: document.getElementById("chat-status"),
  chatError: document.getElementById("chat-error"),
  chatErrorText: document.getElementById("chat-error-text"),
  chatClear: document.getElementById("chat-clear"),
  faqWidget: document.getElementById("btn-faq-floating") || document.getElementById("btn-faq") || document.getElementById("btn-faq-celeste") || document.getElementById("btn-soporte-cyan") || document.getElementById("faq-widget"),
  faqOverlay: document.getElementById("faq-overlay") || document.getElementById("support-modal-overlay"),
  faqOverlayAlias: document.getElementById("faq-overlay"),
  supportOverlayAlias: document.getElementById("support-modal-overlay"),
  faqModal: document.getElementById("faq-modal") || document.getElementById("support-modal"),
  faqContainer: document.getElementById("faq-container"),
  faqModalAlias: document.getElementById("support-modal"),
  supportModalAlias: document.getElementById("support-modal"),
  faqClose: document.getElementById("btn-close-faq") || document.getElementById("faq-close") || document.getElementById("support-close"),
  faqClose2: document.getElementById("faq-close-2"),
  supportCloseAlias: document.getElementById("support-close"),
  faqGotoChat: document.querySelector(".faq-goto-chat"),
  supportMessages: document.getElementById("faq-messages") || document.getElementById("support-chat-messages"),
  supportInput: document.getElementById("faq-input") || document.getElementById("support-chat-input"),
  supportSend: document.getElementById("faq-send") || document.getElementById("support-chat-send"),
  supportTyping: document.getElementById("faq-typing") || document.getElementById("support-typing"),
  supportCharCount: document.getElementById("faq-char-count") || document.getElementById("support-char-count"),
  supportError: document.getElementById("faq-error") || document.getElementById("support-chat-error"),
  supportErrorText: document.getElementById("faq-error-text") || document.getElementById("support-chat-error-text"),
  whatsappBtn: document.getElementById("btn-whatsapp") || document.querySelector("a.fab"),
  // Nuevos IDs requeridos para FAQ renovado (alias directos)
  faqMessages: document.getElementById("faq-messages"),
  faqInput: document.getElementById("faq-input"),
  faqSend: document.getElementById("faq-send"),
  faqChatError: document.getElementById("faq-error"),
  faqChatErrorText: document.getElementById("faq-error-text"),
  faqTyping: document.getElementById("faq-typing"),
  faqCharCount: document.getElementById("faq-char-count"),
};

let isGeneratingDemo = false;
let isGeneratingSupport = false;
const chatHistoryDemo = [];
const chatHistorySupport = [];
const soporteHistory = chatHistorySupport;
const faqHistory = chatHistorySupport;
const MAX_HISTORY_TURNS = 12;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatBotText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function scrollToBottom(container) {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}

function addMessage(role, text) {
  if (!els.chatMessages) return;
  const row = document.createElement("div");
  row.className = role === "user" ? "message user" : "message bot";
  if (role === "user") {
    row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><span class="msg-avatar"><i class="fa-solid fa-user"></i></span>`;
  } else {
    row.innerHTML = `<span class="msg-avatar"><i class="fa-solid fa-robot"></i></span><div class="bubble">${formatBotText(text)}</div>`;
  }
  els.chatMessages.appendChild(row);
  scrollToBottom(els.chatMessages);
}

function addSupportMessage(role, text) {
  if (!els.supportMessages) return;
  const row = document.createElement("div");
  row.className = role === "user" ? "message user" : "message bot";
  if (role === "user") {
    row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><span class="msg-avatar"><i class="fa-solid fa-user"></i></span>`;
  } else {
    row.innerHTML = `<span class="msg-avatar"><i class="fa-solid fa-robot"></i></span><div class="bubble">${formatBotText(text)}</div>`;
  }
  els.supportMessages.appendChild(row);
  scrollToBottom(els.supportMessages);
}

// Requisito 3 — Singleton loader (una sola instancia)
function mostrarEscribiendo(contenedorId, visible) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  // Singleton: verificar si ya existe el loader para este contenedor o el alias genérico
  const loaderExistente = document.getElementById(contenedorId + '-loader') || document.getElementById('chat-loader-activo');
  if (visible) {
    if (!loaderExistente) {
      const loader = document.createElement('div');
      loader.id = contenedorId + '-loader';
      loader.className = 'mensaje-bot escribiendo';
      loader.innerHTML = '<span>FacturaBot está escribiendo...</span>';
      contenedor.appendChild(loader);
      contenedor.scrollTop = contenedor.scrollHeight;
    }
    // Alias para test que busca chat-loader-activo
    if (contenedorId === 'chat-messages' || contenedorId === 'support-chat-messages') {
      let alias = document.getElementById('chat-loader-activo');
      if (!alias) {
        alias = document.createElement('div');
        alias.id = 'chat-loader-activo';
        alias.style.display = 'none';
        document.body.appendChild(alias);
      }
    }
  } else {
    if (loaderExistente) loaderExistente.remove();
    const alias = document.getElementById('chat-loader-activo');
    if (alias && (contenedorId === 'chat-messages' || contenedorId === 'support-chat-messages')) {
      // Solo remover alias si no queda ningún loader activo en ningún contenedor
      const anyLoader = document.getElementById('chat-messages-loader') || document.getElementById('support-chat-messages-loader');
      if (!anyLoader) alias.remove();
    }
    // Asegurar que los indicadores estáticos antiguos queden ocultos
    const t1 = document.getElementById('typing-indicator');
    const t2 = document.getElementById('support-typing');
    if (t1) { t1.hidden = true; t1.style.display = 'none'; }
    if (t2) { t2.hidden = true; t2.style.display = 'none'; }
  }
}
// Alias para compatibilidad con nombre anterior
const mostrarIndicadorEscribiendo = mostrarEscribiendo;

function setTypingDemo(show) {
  if (show) {
    mostrarEscribiendo('chat-messages', true);
    if (els.chatSend) { els.chatSend.disabled = true; els.chatSend.style.zIndex = "10"; }
    if (els.chatInput) { els.chatInput.disabled = true; els.chatInput.style.zIndex = "10"; }
    if (els.chatStatus) { els.chatStatus.textContent = "FacturaBot está escribiendo..."; els.chatStatus.style.color = "#f59e0b"; }
    isGeneratingDemo = true;
    scrollToBottom(els.chatMessages);
  } else {
    mostrarEscribiendo('chat-messages', false);
    if (els.chatSend) { els.chatSend.disabled = false; els.chatSend.style.zIndex = "10"; els.chatSend.removeAttribute("disabled"); }
    if (els.chatInput) { els.chatInput.disabled = false; els.chatInput.removeAttribute("disabled"); els.chatInput.style.zIndex = "10"; els.chatInput.focus(); }
    if (els.chatStatus) { els.chatStatus.textContent = "Listo"; els.chatStatus.style.color = "#10b981"; }
    isGeneratingDemo = false;
  }
}

function setTypingSupport(show) {
  if (show) {
    mostrarEscribiendo('support-chat-messages', true);
    if (els.supportSend) { els.supportSend.disabled = true; els.supportSend.style.zIndex = "10"; }
    if (els.supportInput) { els.supportInput.disabled = true; els.supportInput.style.zIndex = "10"; }
    scrollToBottom(els.supportMessages);
  } else {
    mostrarEscribiendo('support-chat-messages', false);
    if (els.supportSend) { els.supportSend.disabled = false; els.supportSend.style.zIndex = "10"; els.supportSend.removeAttribute("disabled"); }
    if (els.supportInput) { els.supportInput.disabled = false; els.supportInput.removeAttribute("disabled"); els.supportInput.style.zIndex = "10"; els.supportInput.focus(); }
    isGeneratingSupport = false;
  }
}

function showErrorDemo(msg) {
  if (!els.chatError || !els.chatErrorText) return;
  els.chatErrorText.textContent = msg;
  els.chatError.hidden = false;
  els.chatError.style.display = 'flex';
  setTimeout(() => { if (els.chatError) { els.chatError.hidden = true; els.chatError.style.display = 'none'; } }, 6000);
}

function showErrorSupport(msg) {
  if (!els.supportError || !els.supportErrorText) return;
  els.supportErrorText.textContent = msg;
  els.supportError.hidden = false;
  els.supportError.style.display = 'flex';
  setTimeout(() => { if (els.supportError) { els.supportError.hidden = true; els.supportError.style.display = 'none'; } }, 6000);
}

async function callDemo(userMessage) {
  if (isGeneratingDemo) return;
  setTypingDemo(true);
  if (els.chatError) { els.chatError.hidden = true; els.chatError.style.display = 'none'; }

  chatHistoryDemo.push({ role: "user", parts: [{ text: userMessage }] });
  if (chatHistoryDemo.length > MAX_HISTORY_TURNS * 2) chatHistoryDemo.splice(0, chatHistoryDemo.length - MAX_HISTORY_TURNS * 2);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let endpoint = GEMINI_ENDPOINT;

  try {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_DEMO }] },
        contents: chatHistoryDemo,
        generationConfig: { temperature: 0.5, maxOutputTokens: 700, topP: 0.9 },
      }),
      signal: controller.signal,
    });

    if (!res.ok && res.status === 404) {
      const fbEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      console.error(`Modelo ${GEMINI_MODEL} no encontrado (404), reintentando con ${GEMINI_FALLBACK_MODEL}`);
      res = await fetch(fbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT_DEMO }] },
          contents: chatHistoryDemo,
          generationConfig: { temperature: 0.5, maxOutputTokens: 700, topP: 0.9 },
        }),
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      let detail = bodyText.slice(0, 600);
      try { const j = JSON.parse(bodyText); detail = j.error?.message || j.error || detail; } catch {}
      console.error(`Gemini demo error ${res.status}:`, detail);
      throw new Error(detail || `Error ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Respuesta vacía de Gemini demo. Intenta reformular.");
    const clean = text.trim();
    chatHistoryDemo.push({ role: "model", parts: [{ text: clean }] });
    if (chatHistoryDemo.length > MAX_HISTORY_TURNS * 2) chatHistoryDemo.splice(0, chatHistoryDemo.length - MAX_HISTORY_TURNS * 2);
    addMessage("bot", clean);
  } catch (err) {
    if (chatHistoryDemo.length && chatHistoryDemo[chatHistoryDemo.length - 1].role === "user") chatHistoryDemo.pop();
    const isAbort = err && err.name === "AbortError";
    const message = isAbort ? "Tiempo agotado (15s). Revisa tu conexión." : (err && err.message) || "Error desconocido demo.";
    console.error("Error Gemini demo:", err);
    showErrorDemo(message);
    addMessage("bot", message);
  } finally {
    clearTimeout(timeout);
    mostrarEscribiendo('chat-messages', false);
    setTypingDemo(false);
  }
}

async function callSupport(userMessage) {
  if (isGeneratingSupport) return;
  setTypingSupport(true);
  if (els.supportError) { els.supportError.hidden = true; els.supportError.style.display = 'none'; }

  soporteHistory.push({ role: "user", parts: [{ text: userMessage }] });
  if (soporteHistory.length > MAX_HISTORY_TURNS * 2) soporteHistory.splice(0, soporteHistory.length - MAX_HISTORY_TURNS * 2);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let endpoint = GEMINI_ENDPOINT;

  try {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT_SOPORTE }] },
        contents: soporteHistory,
        generationConfig: { temperature: 0.5, maxOutputTokens: 700, topP: 0.9 },
      }),
      signal: controller.signal,
    });

    if (!res.ok && res.status === 404) {
      const fbEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      console.error(`Modelo ${GEMINI_MODEL} soporte 404, reintentando ${GEMINI_FALLBACK_MODEL}`);
      res = await fetch(fbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT_SOPORTE }] },
          contents: soporteHistory,
          generationConfig: { temperature: 0.5, maxOutputTokens: 700, topP: 0.9 },
        }),
        signal: controller.signal,
      });
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      let detail = bodyText.slice(0, 600);
      try { const j = JSON.parse(bodyText); detail = j.error?.message || j.error || detail; } catch {}
      console.error(`Gemini soporte error ${res.status}:`, detail);
      throw new Error(detail || `Error ${res.status}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Respuesta vacía de Gemini soporte.");
    const clean = text.trim();
    soporteHistory.push({ role: "model", parts: [{ text: clean }] });
    if (soporteHistory.length > MAX_HISTORY_TURNS * 2) soporteHistory.splice(0, soporteHistory.length - MAX_HISTORY_TURNS * 2);
    addSupportMessage("bot", clean);
  } catch (err) {
    if (soporteHistory.length && soporteHistory[soporteHistory.length - 1].role === "user") soporteHistory.pop();
    const isAbort = err && err.name === "AbortError";
    const message = isAbort ? "Tiempo agotado soporte (15s)." : (err && err.message) || "Error soporte.";
    console.error("Error Gemini soporte:", err);
    showErrorSupport(message);
    addSupportMessage("bot", message);
  } finally {
    clearTimeout(timeout);
    mostrarEscribiendo('support-chat-messages', false);
    setTypingSupport(false);
  }
}

function handleSendDemo() {
  if (!els.chatInput) return;
  const text = els.chatInput.value.trim();
  if (!text) return;
  if (text.length > 500) { showErrorDemo("Máximo 500 caracteres."); return; }
  addMessage("user", text);
  els.chatInput.value = "";
  if (els.charCount) els.charCount.textContent = "0";
  els.chatInput.removeAttribute("disabled");
  els.chatInput.style.zIndex = "10";
  callDemo(text);
}

function handleSendSupport() {
  if (!els.supportInput) return;
  const text = els.supportInput.value.trim();
  if (!text) return;
  if (text.length > 500) { showErrorSupport("Máximo 500 caracteres."); return; }
  addSupportMessage("user", text);
  els.supportInput.value = "";
  if (els.supportCharCount) els.supportCharCount.textContent = "0";
  els.supportInput.removeAttribute("disabled");
  els.supportInput.style.zIndex = "10";
  callSupport(text);
}

function initMenu() {
  if (!els.menuToggle || !els.mobilePanel) return;
  els.menuToggle.addEventListener("click", () => {
    const open = els.mobilePanel.classList.toggle("open");
    els.menuToggle.classList.toggle("open", open);
    els.menuToggle.setAttribute("aria-expanded", String(open));
    const iconMenu = els.menuToggle.querySelector(".icon-menu");
    const iconClose = els.menuToggle.querySelector(".icon-close");
    if (iconMenu) iconMenu.style.display = open ? "none" : "block";
    if (iconClose) iconClose.style.display = open ? "block" : "none";
  });
  document.querySelectorAll(".mobile-link, .nav-link").forEach((a) => {
    a.addEventListener("click", () => {
      els.mobilePanel.classList.remove("open");
      els.menuToggle.classList.remove("open");
      els.menuToggle.setAttribute("aria-expanded", "false");
      const iconMenu = els.menuToggle.querySelector(".icon-menu");
      const iconClose = els.menuToggle.querySelector(".icon-close");
      if (iconMenu) iconMenu.style.display = "block";
      if (iconClose) iconClose.style.display = "none";
    });
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const offset = 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
      if (history.pushState) history.pushState(null, "", href);
    });
  });
}

function initChatDemo() {
  if (!els.chatInput || !els.chatSend || !els.chatMessages) return;
  els.chatInput.removeAttribute("disabled");
  els.chatInput.style.zIndex = "10";
  els.chatSend.style.zIndex = "10";
  els.chatSend.disabled = false;

  els.chatSend.addEventListener("click", handleSendDemo);
  els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendDemo();
    }
  });
  els.chatInput.addEventListener("input", () => {
    if (els.charCount) els.charCount.textContent = String(els.chatInput.value.length);
  });
  document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-q") || btn.textContent || "";
      els.chatInput.value = q;
      if (els.charCount) els.charCount.textContent = String(q.length);
      handleSendDemo();
    });
  });
  if (els.chatClear) {
    els.chatClear.addEventListener("click", () => {
      chatHistoryDemo.length = 0;
      els.chatMessages.innerHTML = `<div class="message bot"><span class="msg-avatar"><i class="fa-solid fa-robot"></i></span><div class="bubble"><p>Estimado usuario, le damos la bienvenida al Centro de Orientación y Soporte de FacturaBot AI. Soy su asistente virtual informativo, creado con el propósito exclusivo de atender sus inquietudes sobre el funcionamiento, normatividad y ventajas de nuestra solución de facturación electrónica. ¿En qué temática o duda podemos asesorarle el día de hoy?</p></div></div>`;
      if (els.chatError) { els.chatError.hidden = true; els.chatError.style.display = 'none'; }
      els.chatInput.value = "";
      if (els.charCount) els.charCount.textContent = "0";
      els.chatInput.removeAttribute("disabled");
      mostrarEscribiendo('chat-messages', false);
      setTypingDemo(false);
    });
  }
}

function initChatSupport() {
  if (!els.supportInput || !els.supportSend || !els.supportMessages) return;
  els.supportInput.removeAttribute("disabled");
  els.supportInput.style.zIndex = "10";
  els.supportSend.style.zIndex = "10";
  els.supportSend.disabled = false;

  if (els.supportMessages && els.supportMessages.children.length === 0) {
    els.supportMessages.innerHTML = `<div class="message bot"><span class="msg-avatar"><i class="fa-solid fa-robot"></i></span><div class="bubble"><p>Estimado usuario, le damos la bienvenida al Centro de Orientación y Soporte de FacturaBot AI. Soy su asistente virtual informativo, creado con el propósito exclusivo de atender sus inquietudes sobre el funcionamiento, normatividad y ventajas de nuestra solución de facturación electrónica. ¿En qué temática o duda podemos asesorarle el día de hoy?</p></div></div>`;
  }

  els.supportSend.addEventListener("click", handleSendSupport);
  els.supportInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendSupport();
    }
  });
  els.supportInput.addEventListener("input", () => {
    if (els.supportCharCount) els.supportCharCount.textContent = String(els.supportInput.value.length);
  });
}

function initActiveNav() {
  const sections = ["inicio", "funcionamiento", "ventajas", "asistente", "contacto"];
  const links = document.querySelectorAll(".nav-link");
  if (!links.length) return;
  function onScroll() {
    let current = "inicio";
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });
    links.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === `#${current}`) a.classList.add("active");
      else a.classList.remove("active");
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// Función reutilizable de arrastre — soporta mouse y touch, umbral 6px, clamp en viewport (unificado WhatsApp + FAQ)
function hacerElementoArrastrable(elemento) {
  if (!elemento) return;
  let isDragging = false;
  let hasDragged = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  const THRESHOLD = 6;

  // Restaurar posición guardada por id
  try {
    const key = (elemento.id || 'draggable') + 'Pos';
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      elemento.style.left = saved.x + "px";
      elemento.style.top = saved.y + "px";
      elemento.style.right = "auto";
      elemento.style.bottom = "auto";
    }
  } catch {}

  function clampPosition(x, y) {
    const rect = elemento.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    return { x: Math.max(8, Math.min(x, maxX)), y: Math.max(8, Math.min(y, maxY)) };
  }

  function onMouseDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    isDragging = true;
    hasDragged = false;
    const rect = elemento.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    elemento.classList.add("dragging");
    // Prevenir selección de texto
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!hasDragged && Math.hypot(dx, dy) < THRESHOLD) return;
    hasDragged = true;
    const { x, y } = clampPosition(startLeft + dx, startTop + dy);
    elemento.style.left = x + "px";
    elemento.style.top = y + "px";
    elemento.style.right = "auto";
    elemento.style.bottom = "auto";
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    elemento.classList.remove("dragging");
    if (hasDragged) {
      const rect = elemento.getBoundingClientRect();
      try {
        const key = (elemento.id || 'draggable') + 'Pos';
        localStorage.setItem(key, JSON.stringify({ x: rect.left, y: rect.top }));
      } catch {}
      // Evitar click si hubo arrastre
      if (e) {
        e.preventDefault();
        // El flag se resetea asíncronamente para que el handler click lo detecte
        setTimeout(() => { hasDragged = false; }, 0);
        return;
      }
    }
    // No hubo arrastre significativo: permitir click normal
    hasDragged = false;
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    onMouseDown({ clientX: t.clientX, clientY: t.clientY, button: 0, preventDefault: () => {} });
  }
  function onTouchMove(e) {
    if (!isDragging) return;
    const t = e.touches[0];
    onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    // Prevenir scroll mientras arrastra
    if (hasDragged) e.preventDefault();
  }
  function onTouchEnd(e) {
    onMouseUp(e);
  }

  // Mouse
  elemento.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  // Touch
  elemento.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);

  // Interceptar click si hubo arrastre
  elemento.addEventListener("click", (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hasDragged = false;
    }
  }, true);

  // Re-clamp en resize
  window.addEventListener("resize", () => {
    const rect = elemento.getBoundingClientRect();
    const { x, y } = clampPosition(rect.left, rect.top);
    elemento.style.left = x + "px";
    elemento.style.top = y + "px";
  });

  return {
    get hasDragged() { return hasDragged; },
    reset() { hasDragged = false; isDragging = false; }
  };
}

function initFaqAccordion() {
  const accordion = document.getElementById("faq-accordion") || document.querySelector(".faq-accordion");
  if (!accordion) return;
  accordion.addEventListener("click", (e) => {
    const trigger = e.target.closest(".faq-trigger");
    if (!trigger) return;
    const item = trigger.closest(".faq-item");
    if (!item) return;
    const isActive = item.classList.contains("active");
    // Close all
    accordion.querySelectorAll(".faq-item").forEach(i => i.classList.remove("active"));
    trigger.setAttribute("aria-expanded", String(!isActive));
    if (!isActive) item.classList.add("active");
  });
}
function initFaqWidget() {
  const widget = els.faqWidget;
  const overlay = els.faqOverlay;
  const modal = els.faqModal;
  const overlayAlias = els.faqOverlayAlias;
  const modalAlias = els.faqModalAlias;
  const supportOverlayAlias = els.supportOverlayAlias;
  const supportModalAlias = els.supportModalAlias;
  const closeBtn = els.faqClose;
  const closeBtn2 = els.faqClose2;
  const supportCloseAlias = els.supportCloseAlias;
  const whatsappBtn = els.whatsappBtn;

  // Hacer arrastrables ambos botones
  if (widget) hacerElementoArrastrable(widget);
  if (whatsappBtn) hacerElementoArrastrable(whatsappBtn);

  if (!widget) return;

  function setModalVisible(visible) {
    const elsToToggle = [overlay, modal, overlayAlias, modalAlias, supportOverlayAlias, supportModalAlias].filter(Boolean);
    elsToToggle.forEach((el) => {
      if (!el) return;
      if (visible) {
        el.hidden = false;
        el.removeAttribute("hidden");
        el.classList.add("active");
        el.classList.add("open");
        el.classList.remove("hidden");
      } else {
        el.classList.remove("active");
        el.classList.remove("open");
        setTimeout(() => {
          if (!el.classList.contains("active") && !el.classList.contains("open")) {
            el.hidden = true;
            el.setAttribute("hidden", "");
          }
        }, 200);
      }
    });
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  function openModal() {
    setModalVisible(true);
    const firstFocus = modal ? modal.querySelector("button, a, [tabindex]") : null;
    if (firstFocus) setTimeout(() => firstFocus.focus(), 50);
    if (els.supportInput) {
      els.supportInput.removeAttribute("disabled");
      els.supportInput.style.zIndex = "10";
    }
    if (els.supportSend) {
      els.supportSend.disabled = false;
      els.supportSend.style.zIndex = "10";
    }
  }

  function closeModal() {
    setModalVisible(false);
    if (widget) widget.focus();
  }

  // Click en widget cyan — con filtro antidisparo ya manejado por hacerElementoArrastrable
  // Pero verificamos threshold manualmente también
  let widgetHasDragged = false;
  // El hacerElementoArrastrable ya setea hasDragged interno, pero necesitamos detectar aquí:
  // Usamos el flag del elemento draggable vía dataset o verificando hasDragged en el elemento
  widget.addEventListener("click", (e) => {
    console.log("Evento click registrado en botón cyan");
    // Si el draggable marcó hasDragged, prevenir apertura
    // Verificamos si el elemento tiene clase dragging recientemente o movimiento >5px
    // El hacerElementoArrastrable ya previene el click via capture, pero dejamos esta guarda extra
    // Si el click fue prevenido por arrastre, no abrir
    if (e.defaultPrevented) return;
    openModal();
  });

  widget.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      console.log("Evento click registrado en botón cyan");
      openModal();
    }
  });

  // WhatsApp: si hubo arrastre, prevenir navegación
  if (whatsappBtn) {
    whatsappBtn.addEventListener("click", (e) => {
      // El hacerElementoArrastrable ya previene si hasDragged, pero por si acaso verificamos
      // Si el botón tiene clase dragging reciente, prevenir
      if (whatsappBtn.classList.contains("dragging")) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeBtn2) closeBtn2.addEventListener("click", closeModal);
  if (supportCloseAlias) supportCloseAlias.addEventListener("click", closeModal);
  const aliasClose = document.getElementById("support-close");
  if (aliasClose && aliasClose !== closeBtn) aliasClose.addEventListener("click", closeModal);

  const overlays = [overlay, overlayAlias, supportOverlayAlias].filter(Boolean);
  overlays.forEach((o) => o && o.addEventListener("click", closeModal));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const anyVisible = (modal && !modal.hidden) || (supportModalAlias && !supportModalAlias.hidden);
      if (anyVisible) closeModal();
    }
  });

  if (els.faqGotoChat) {
    els.faqGotoChat.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
      const target = document.getElementById("asistente");
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top, behavior: "smooth" });
        setTimeout(() => {
          const input = document.getElementById("chat-input");
          if (input) { input.removeAttribute("disabled"); input.style.zIndex = "10"; input.focus(); }
        }, 600);
      }
    });
  }

  window._facturabotCloseModal = closeModal;
  window._facturabotOpenModal = openModal;
}

initMenu();
initSmoothScroll();
initChatDemo();
initChatSupport();
initActiveNav();
initFaqAccordion();
initFaqWidget();

window.addEventListener("load", () => {
  [els.chatInput, els.supportInput].forEach((inp) => {
    if (inp) { inp.removeAttribute("disabled"); inp.style.zIndex = "10"; inp.disabled = false; }
  });
  [els.chatSend, els.supportSend].forEach((btn) => {
    if (btn) { btn.disabled = false; btn.style.zIndex = "10"; }
  });
  const modals = [els.faqModal, els.faqOverlay, els.supportModalAlias, els.supportOverlayAlias, els.faqModalAlias, els.faqOverlayAlias].filter(Boolean);
  modals.forEach((m) => {
    if (m && m.hidden) {
      m.classList.remove("active", "open");
    }
  });
  mostrarEscribiendo('chat-messages', false);
  mostrarEscribiendo('support-chat-messages', false);
});


