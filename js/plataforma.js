// Camada de plataforma do SIDAM: login Google, Firestore e download de arquivos.
// Se o Firebase não estiver configurado, o sistema funciona em modo local (histórico no navegador).
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const configurado = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("COLE");

function baixar({ filename, data }) {
  const tipos = { pdf: "application/pdf", html: "text/html;charset=utf-8", json: "application/json;charset=utf-8" };
  const ext = filename.split(".").pop().toLowerCase();
  const blob = data instanceof Blob ? data : new Blob([data], { type: tipos[ext] || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return Promise.resolve({ status: "saved" });
}

const providers = { downloads: { save: baixar }, db: null, user: null };
window.claude = { use: async (n) => providers[n] ?? null };

const authBox = () => document.getElementById("auth");
function desenhaAuth(html, acao) {
  const box = authBox(); if (!box) return;
  box.innerHTML = html;
  box.querySelector("button")?.addEventListener("click", acao);
}

let pronto;
const corpo = document.body;
function mostrarApp() { corpo.classList.remove("carregando", "deslogado"); const e = document.getElementById("entrada"); if (e) e.hidden = true; }
function mostrarEntrada() { corpo.classList.remove("carregando"); corpo.classList.add("deslogado"); const e = document.getElementById("entrada"); if (e) e.hidden = false; }
function msgEntrada(t) { const m = document.getElementById("ent-msg"); if (m) m.textContent = t; }
window.SIDAM_PLATAFORMA = new Promise((r) => (pronto = r));

if (!configurado) {
  desenhaAuth(`<span class="authinfo">Modo local</span>`);
  mostrarApp();
  pronto();
} else {
  try {
    const { initializeApp } = await import(FB + "firebase-app.js");
    const A = await import(FB + "firebase-auth.js");
    const F = await import(FB + "firebase-firestore.js");
    const app = initializeApp(firebaseConfig);
    const auth = A.getAuth(app);
    const fs = F.getFirestore(app);

    const snapDoc = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data() });
    const wrapDoc = (path) => ({
      id: path.split("/").pop(), path,
      get: async () => snapDoc(await F.getDoc(F.doc(fs, path))),
      set: (d) => F.setDoc(F.doc(fs, path), d),
      update: (d) => F.updateDoc(F.doc(fs, path), d),
      delete: () => F.deleteDoc(F.doc(fs, path)),
      onSnapshot: (ok, erro) => F.onSnapshot(F.doc(fs, path), (s) => ok(snapDoc(s)), erro),
    });
    const db = {
      doc: wrapDoc,
      collection: (path) => ({
        path,
        doc: (id) => wrapDoc(path + "/" + id),
        onSnapshot: (ok, erro) => F.onSnapshot(F.collection(fs, path), (s) => ok({ docs: s.docs.map(snapDoc), size: s.size, empty: s.empty }), erro),
      }),
    };
    providers.db = db;

    const provedor = new A.GoogleAuthProvider();
    provedor.setCustomParameters({ prompt: "select_account" });
    try { await A.getRedirectResult(auth); } catch (e) { msgEntrada("Não foi possível concluir o login. Tente novamente."); }
    const entrar = async () => {
      const b = document.getElementById("ent-google");
      if (b) b.disabled = true;
      msgEntrada("");
      try { await A.signInWithPopup(auth, provedor); location.reload(); }
      catch (e) {
        const c = e?.code || "";
        if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") { await A.signInWithRedirect(auth, provedor); return; }
        if (c === "auth/unauthorized-domain") msgEntrada("Este endereço não está autorizado no Firebase. Adicione o domínio em Authentication › Configurações › Domínios autorizados.");
        else if (c !== "auth/popup-closed-by-user" && c !== "auth/cancelled-popup-request") msgEntrada("Não foi possível entrar com o Google. Verifique a conexão e tente novamente.");
        if (b) b.disabled = false;
      }
    };
    document.getElementById("ent-google")?.addEventListener("click", entrar);
    const sair = async () => { await A.signOut(auth); location.reload(); };

    A.onAuthStateChanged(auth, async (u) => {
      if (u) {
        let admin = false;
        try {
          const cfg = await F.getDoc(F.doc(fs, "config/admins"));
          const lista = (cfg.exists() && cfg.data().emails) || [];
          admin = lista.map((x) => String(x).toLowerCase()).includes(String(u.email).toLowerCase());
        } catch (e) { admin = false; }
        providers.user = {
          id: async () => u.uid,
          canEdit: async () => admin,
          isOwner: async () => admin,
          me: async () => ({ id: u.uid, name: u.displayName || "", email: u.email }),
        };
        desenhaAuth(`<span class="authinfo">${(u.displayName || u.email || "").replace(/[<>&"]/g, "")}${admin ? " · administrador" : ""}</span><button type="button" class="authbtn">Sair</button>`, sair);
        mostrarApp();
      } else {
        providers.user = null;
        desenhaAuth("");
        mostrarEntrada();
      }
      pronto();
    });
  } catch (e) {
    console.error("Firebase indisponível:", e);
    desenhaAuth(`<span class="authinfo">Modo local</span>`);
    mostrarApp();
    pronto();
  }
}
