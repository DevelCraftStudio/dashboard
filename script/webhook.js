/**
 * webhook.js
 *
 * Responsabilidade: buscar e exibir, no header, o link de webhook do
 * quiz ativo — com botão de copiar (mesmo padrão visual e de UX do
 * botão de copiar slug em quiz-list.js).
 *
 * Consome GET .../link/{slug}/webhook, que retorna { url }.
 *
 * Depende de:
 * - window.QuizList.getSelectedQuiz()
 * - evento "dashboard:reload" (já disparado sempre que o quiz ativo
 *   muda, seja na carga inicial, na troca pelo dropdown ou na criação
 *   de um quiz novo — então não precisa de nenhum evento próprio)
 */

const WEBHOOK_LINK_BASE_URL =
  "https://quiz-api-production-3617.up.railway.app/link";

const WEBHOOK_COPY_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 8.5H2A1.5 1.5 0 0 1 0.5 7V2A1.5 1.5 0 0 1 2 0.5H7A1.5 1.5 0 0 1 8.5 2V2.5" stroke="currentColor" stroke-width="1.3"/></svg>`;
const WEBHOOK_CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 7L5 9.5L10.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * Busca o link de webhook de um quiz.
 * Formato esperado: { url: string }
 */
async function fetchWebhookLink(slug) {
  const res = await fetch(`${WEBHOOK_LINK_BASE_URL}/${slug}/webhook`);
  if (!res.ok) {
    throw new Error(`Falha ao carregar webhook (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Controla o bloco de webhook do header: busca o link do quiz ativo
 * sempre que ele muda, exibe (truncado, com título completo no hover
 * via atributo title) e trata o botão de copiar.
 */
function initWebhookLink() {
  const label = document.getElementById("webhookUrlLabel");
  const copyBtn = document.getElementById("webhookCopyBtn");

  // quantos caracteres mostrar antes de cortar com ".."
  const MAX_LABEL_LENGTH = 26;

  let currentSlug = null;
  let currentUrl = null;

  function truncateUrl(url) {
    if (url.length <= MAX_LABEL_LENGTH) return url;
    return `${url.slice(0, MAX_LABEL_LENGTH)}..`;
  }

  function setLabel(text, fullTextForTitle) {
    label.textContent = text;
    label.title = fullTextForTitle ?? text;
  }

  async function loadWebhook() {
    const quiz =
      window.QuizList && typeof window.QuizList.getSelectedQuiz === "function"
        ? window.QuizList.getSelectedQuiz()
        : null;

    if (!quiz) {
      currentSlug = null;
      currentUrl = null;
      copyBtn.disabled = true;
      setLabel("Nenhum quiz selecionado");
      return;
    }

    // evita refetch desnecessário quando "dashboard:reload" dispara
    // por troca de período (o quiz ativo não mudou)
    if (quiz.slug === currentSlug) return;

    currentSlug = quiz.slug;
    copyBtn.disabled = true;
    setLabel("Carregando link…");

    try {
      const { url } = await fetchWebhookLink(quiz.slug);
      currentUrl = url;
      setLabel(truncateUrl(url), url);
      copyBtn.disabled = false;
    } catch (err) {
      console.error(err);
      currentUrl = null;
      setLabel("Erro ao carregar link");
      copyBtn.disabled = true;
    }
  }

  copyBtn.addEventListener("click", () => {
    if (!currentUrl) return;

    navigator.clipboard
      .writeText(currentUrl)
      .then(() => {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = WEBHOOK_CHECK_ICON;
        copyBtn.classList.add("is-copied");

        setTimeout(() => {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove("is-copied");
        }, 1400);
      })
      .catch((err) => {
        console.error("Não foi possível copiar o link do webhook.", err);
      });
  });

  window.addEventListener("dashboard:reload", loadWebhook);

  loadWebhook();
}

window.WebhookLink = { init: initWebhookLink };