/**
 * javascript.js
 *
 * Responsabilidade: orquestrar a inicialização dos demais módulos e
 * reagir ao evento "dashboard:reload" chamando a API de analytics e
 * mandando renderizar o resultado.
 *
 * NÃO conhece detalhes internos de storage.js, dashboard.js,
 * dashboard-render.js, quiz-list.js ou novo-quiz.js — apenas os aciona.
 */

const DASHBOARD_RELOAD_EVENT = "dashboard:reload";

/**
 * Recupera o quiz ativo, busca o dashboard (dashboard.js cuida de
 * montar o request e de cair para dados falsos se o servidor falhar)
 * e manda renderizar (dashboard-render.js).
 */
async function handleDashboardReload() {
  const slug = DashboardStorage.getSelectedQuiz();

  if (!slug) {
    console.warn("Nenhum quiz selecionado — dashboard não será carregado.");
    return;
  }

  const response = await loadDashboardData(slug);
  renderDashboard(response);
}

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener(DASHBOARD_RELOAD_EVENT, handleDashboardReload);

  initDashboardPeriod(); // definido em dashboard.js
  QuizList.init(); // definido em quiz-list.js (dispara o primeiro reload assim que o quiz ativo é resolvido)
  initNewQuizModal(); // definido em novo-quiz.js
});