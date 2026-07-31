/**
 * quiz-list.js
 *
 * Responsabilidade: listar os quizzes existentes e controlar o seletor
 * de quiz do header (dropdown com nome + slug + copiar slug, seleção do
 * quiz ativo).
 *
 * Consome GET http://localhost:8080/quiz, que retorna uma lista no
 * formato [{ name, slug, totalQuestions, link }, ...]. O dropdown é
 * renderizado em loop, então já está preparado pra receber quantos
 * quizzes vierem.
 *
 * Expõe `window.QuizList` como API pública pra outros arquivos (ex.:
 * novo-quiz.js) conseguirem ler a lista de quizzes carregada, inserir um
 * quiz recém-criado e selecioná-lo — sem precisar acessar o estado
 * interno (quizzes/selectedQuiz) diretamente.
 *
 * Sempre que o quiz ativo muda (seleção inicial restaurada, escolha no
 * dropdown ou criação de um novo quiz), o slug é salvo em
 * window.DashboardStorage e "dashboard:reload" é disparado — é assim
 * que o Dashboard sabe que precisa buscar dados novos.
 */

const QUIZ_LIST_URL = "https://quiz-api-production-3617.up.railway.app/quiz";

const COPY_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 8.5H2A1.5 1.5 0 0 1 0.5 7V2A1.5 1.5 0 0 1 2 0.5H7A1.5 1.5 0 0 1 8.5 2V2.5" stroke="currentColor" stroke-width="1.3"/></svg>`;
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 7L5 9.5L10.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let quizzes = [];
let selectedQuiz = null;

/**
 * Busca a lista de quizzes disponíveis.
 * Formato esperado: [{ name: string, slug: string, totalQuestions: number, link: string|null }, ...]
 */
async function fetchQuizzes() {
  const res = await fetch(QUIZ_LIST_URL);
  if (!res.ok)
    throw new Error(`Falha ao carregar quizzes (HTTP ${res.status})`);
  return res.json();
}

/**
 * API pública consumida por outros arquivos (ex.: novo-quiz.js), que
 * precisa checar colisão de slug contra os quizzes já carregados e,
 * após criar um quiz novo, inseri-lo na lista/dropdown já selecionando-o.
 *
 * `_renderQuizList` e `_selectQuizBySlug` são preenchidos por
 * `initQuizPicker()` (mais abaixo) e reaproveitam a mesma lógica de
 * render/seleção usada pelo dropdown, sem duplicação.
 */
const QuizList = {
  getQuizzes() {
    return quizzes;
  },
  getSelectedQuiz() {
    return selectedQuiz;
  },
  addQuiz(quiz) {
    quizzes.push(quiz);
    if (this._renderQuizList) this._renderQuizList();
  },
  selectQuizBySlug(slug) {
    if (this._selectQuizBySlug) this._selectQuizBySlug(slug);
  },
  init: null, // atribuído a initQuizPicker logo abaixo
};

window.QuizList = QuizList;

/**
 * Persiste o slug do quiz ativo e avisa o resto da aplicação que o
 * Dashboard precisa recarregar.
 */
function activateQuiz(quiz) {
  selectedQuiz = quiz;
  DashboardStorage.saveSelectedQuiz(quiz.slug);
  window.dispatchEvent(new CustomEvent("dashboard:reload"));
}

/**
 * Controla o dropdown do seletor de quiz: busca a lista, renderiza os
 * itens (nome + slug + botão de copiar) e trata seleção/abertura/fechamento.
 */
function initQuizPicker() {
  const btn = document.getElementById("quizPickerBtn");
  const dropdown = document.getElementById("quizDropdown");
  const list = document.getElementById("quizDropdownList");
  const label = document.getElementById("currentQuizName");
  const title = document.getElementById("dashboardQuizName");
  const newQuizBtn = document.getElementById("newQuizBtn");

  function setActiveQuizName(name) {
    label.textContent = name;
    title.textContent = name;
  }

  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    const isOpen = dropdown.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      closeDropdown();
    }
  });

  list.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".quiz-dropdown__copy");
    if (copyBtn) {
      e.stopPropagation();
      copySlug(copyBtn);
      return;
    }

    const item = e.target.closest(".quiz-dropdown__item");
    if (item) {
      selectQuiz(item.dataset.slug);
    }
  });

  function closeDropdown() {
    dropdown.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  }

  function selectQuiz(slug) {
    const quiz = quizzes.find((q) => q.slug === slug);
    if (!quiz) return;

    setActiveQuizName(quiz.name);

    list.querySelectorAll(".quiz-dropdown__item").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.slug === slug);
    });

    closeDropdown();

    activateQuiz(quiz);
  }

  function copySlug(copyBtn) {
    const slug = copyBtn.dataset.slug;

    navigator.clipboard
      .writeText(slug)
      .then(() => {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = CHECK_ICON;
        copyBtn.classList.add("is-copied");

        setTimeout(() => {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove("is-copied");
        }, 1400);
      })
      .catch((err) => {
        console.error("Não foi possível copiar o slug.", err);
      });
  }

  function renderQuizList() {
    list.innerHTML = "";

    if (!quizzes.length) {
      const empty = document.createElement("li");
      empty.className = "quiz-dropdown__empty";
      empty.textContent = "Nenhum quiz encontrado.";
      list.appendChild(empty);
      return;
    }

    quizzes.forEach((quiz) => {
      const item = document.createElement("li");
      item.className = "quiz-dropdown__item";
      item.dataset.slug = quiz.slug;
      item.setAttribute("role", "option");
      if (selectedQuiz && quiz.slug === selectedQuiz.slug) {
        item.classList.add("is-active");
      }

      const info = document.createElement("span");
      info.className = "quiz-dropdown__info";

      const name = document.createElement("span");
      name.className = "quiz-dropdown__name";
      name.textContent = quiz.name;

      const slugEl = document.createElement("span");
      slugEl.className = "quiz-dropdown__slug";
      slugEl.textContent = quiz.slug;

      info.append(name, slugEl);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "quiz-dropdown__copy";
      copyBtn.dataset.slug = quiz.slug;
      copyBtn.title = "Copiar slug";
      copyBtn.setAttribute("aria-label", "Copiar slug");
      copyBtn.innerHTML = COPY_ICON;

      item.append(info, copyBtn);
      list.appendChild(item);
    });
  }

  /**
   * Escolhe o quiz ativo na carga da página: usa o slug salvo no
   * LocalStorage se ele ainda existir na lista recebida; caso
   * contrário, cai para o primeiro quiz da lista.
   */
  function resolveInitialQuiz() {
    const savedSlug = DashboardStorage.getSelectedQuiz();
    const savedQuiz = savedSlug
      ? quizzes.find((q) => q.slug === savedSlug)
      : null;

    return savedQuiz || quizzes[0];
  }

  async function loadQuizzes() {
    list.innerHTML = "";
    const loadingItem = document.createElement("li");
    loadingItem.className = "quiz-dropdown__loading";
    loadingItem.textContent = "Carregando…";
    list.appendChild(loadingItem);

    try {
      quizzes = await fetchQuizzes();

      if (quizzes.length) {
        selectedQuiz = resolveInitialQuiz();
        setActiveQuizName(selectedQuiz.name);
        renderQuizList();
        activateQuiz(selectedQuiz);
      } else {
        setActiveQuizName("Nenhum quiz encontrado");
        renderQuizList();
      }

      btn.disabled = false;
      newQuizBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setActiveQuizName("Erro ao carregar quizzes");
      list.innerHTML = "";
      const errorItem = document.createElement("li");
      errorItem.className = "quiz-dropdown__empty";
      errorItem.textContent = "Não foi possível carregar os quizzes.";
      list.appendChild(errorItem);
    }
  }

  // conecta a API pública (window.QuizList) à lógica interna de
  // render/seleção, pra novo-quiz.js poder reaproveitá-la
  QuizList._renderQuizList = renderQuizList;
  QuizList._selectQuizBySlug = selectQuiz;

  loadQuizzes();
}

QuizList.init = initQuizPicker;