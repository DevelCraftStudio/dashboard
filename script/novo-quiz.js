/**
 * novo-quiz.js
 *
 * Responsabilidade: criação de um novo quiz — modal de formulário,
 * geração automática de slug a partir do nome digitado (com garantia
 * de unicidade contra os quizzes já carregados) e envio do POST pro
 * backend.
 *
 * Depende de `window.QuizList` (definido em quiz-list.js) pra:
 *   - ler os quizzes já carregados e checar colisão de slug;
 *   - inserir o quiz recém-criado na lista/dropdown já selecionando-o
 *     (o que, por sua vez, persiste o slug e dispara "dashboard:reload").
 */

const QUIZ_CREATE_URL = "https://quiz-api-production-3617.up.railway.app/quiz"; // POST { name, slug }

/**
 * Cria um novo quiz.
 * Envia { name, slug } — o slug já vem calculado do front, mas o
 * backend é a fonte da verdade final sobre o formato salvo.
 */
async function createQuiz(name, slug) {
  const res = await fetch(QUIZ_CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });

  if (!res.ok) {
    let message = `Falha ao criar quiz (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch (_) {
      /* resposta sem corpo JSON, mantém mensagem padrão */
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Gera um slug a partir de um nome: remove acentos, deixa tudo minúsculo,
 * troca espaços (e qualquer sequência de caracteres não alfanuméricos)
 * por um único "-", e tira "-" nas pontas.
 * Ex.: "  Horinha da Leitura!! " -> "horinha-da-leitura"
 */
function slugify(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // qualquer coisa que não é letra/número vira "-"
    .replace(/^-+|-+$/g, ""); // tira "-" do começo/fim
}

/**
 * Gera um código aleatório de 4 caracteres (letras minúsculas + dígitos)
 * usado como sufixo de desempate quando o slug gerado a partir do nome
 * já existe.
 */
function randomSlugCode(length = 4) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Garante um slug único: se `baseSlug` já existe entre os quizzes
 * carregados (via QuizList.getQuizzes(), ignorando `excludeSlug` — útil
 * se um dia isso servir também pra edição), anexa "-XXXX" (4 caracteres
 * aleatórios) e tenta de novo até achar um livre.
 */
function ensureUniqueSlug(baseSlug, excludeSlug = null) {
  if (!baseSlug) return baseSlug;

  const isTaken = (slug) =>
    QuizList.getQuizzes().some(
      (q) => q.slug === slug && q.slug !== excludeSlug,
    );

  if (!isTaken(baseSlug)) return baseSlug;

  let candidate = baseSlug;
  let guard = 0;
  while (isTaken(candidate) && guard < 25) {
    candidate = `${baseSlug}-${randomSlugCode(4)}`;
    guard++;
  }
  return candidate;
}

/**
 * Controla o modal de criação de quiz: abre/fecha por cima de tudo,
 * gera o slug em tempo real a partir do nome digitado, valida que o
 * slug não colide com nenhum já existente, envia o POST e, no sucesso,
 * injeta o novo quiz na lista/dropdown (via QuizList) já selecionando-o.
 */
function initNewQuizModal() {
  const openBtn = document.getElementById("newQuizBtn");
  const overlay = document.getElementById("newQuizOverlay");
  const closeBtn = document.getElementById("newQuizClose");
  const cancelBtn = document.getElementById("newQuizCancel");
  const form = document.getElementById("newQuizForm");
  const nameInput = document.getElementById("newQuizName");
  const slugInput = document.getElementById("newQuizSlug");
  const errorEl = document.getElementById("newQuizError");
  const slugHint = document.getElementById("newQuizSlugHint");
  const submitBtn = document.getElementById("newQuizSubmit");

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  function showSlugHint(message) {
    slugHint.textContent = message;
    slugHint.hidden = false;
  }

  function hideSlugHint() {
    slugHint.hidden = true;
    slugHint.textContent = "";
  }

  /**
   * Reavalia o estado do form toda vez que o nome muda: gera o slug base
   * a partir do nome e, se ele já existir, anexa um código de 4
   * caracteres pra garantir unicidade automaticamente (sem bloquear
   * o envio).
   */
  function syncSlugAndValidation() {
    const baseSlug = slugify(nameInput.value);

    if (!nameInput.value.trim()) {
      slugInput.value = "";
      hideError();
      hideSlugHint();
      submitBtn.disabled = true;
      return;
    }

    if (!baseSlug) {
      slugInput.value = "";
      showError("Digite um nome com pelo menos uma letra ou número.");
      hideSlugHint();
      submitBtn.disabled = true;
      return;
    }

    const finalSlug = ensureUniqueSlug(baseSlug);
    slugInput.value = finalSlug;

    if (finalSlug !== baseSlug) {
      showSlugHint(
        `Já existia um quiz com o slug "${baseSlug}" — foi adicionado um código para diferenciar.`,
      );
    } else {
      hideSlugHint();
    }

    hideError();
    submitBtn.disabled = false;
  }

  function openModal() {
    if (openBtn.disabled) return;
    form.reset();
    slugInput.value = "";
    hideError();
    hideSlugHint();
    submitBtn.disabled = true;
    overlay.classList.add("is-open");
    // dá tempo do overlay ficar visível antes de focar (evita scroll jump)
    requestAnimationFrame(() => nameInput.focus());
  }

  function closeModal() {
    overlay.classList.remove("is-open");
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) {
      closeModal();
    }
  });

  nameInput.addEventListener("input", syncSlugAndValidation);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    // recalcula na hora do envio: a lista pode ter mudado enquanto o
    // modal estava aberto (outra aba, outro usuário criando ao mesmo
    // tempo, etc.) — se colidir de novo, gera outro código de 4 chars.
    const baseSlug = slugify(name);
    const slug = ensureUniqueSlug(baseSlug);
    slugInput.value = slug;
    if (slug !== baseSlug) {
      showSlugHint(
        `Já existia um quiz com o slug "${baseSlug}" — foi adicionado um código para diferenciar.`,
      );
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Adicionando…";

    try {
      const created = await createQuiz(name, slug);

      QuizList.addQuiz(created);
      QuizList.selectQuizBySlug(created.slug);

      closeModal();
    } catch (err) {
      console.error(err);
      showError(
        err.message || "Não foi possível criar o quiz. Tente novamente.",
      );
      submitBtn.disabled = false;
    } finally {
      submitBtn.textContent = "Adicionar quiz";
    }
  });
}