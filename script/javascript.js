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

  try {
    const response = await loadDashboardData(slug);

    renderDashboard(response);
  } catch (error) {
    console.error("Erro ao atualizar dashboard:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  /*
   * Escuta:
   *
   * - troca de quiz
   * - troca de período
   * - atualização recebida pelo WebSocket
   */
  window.addEventListener(DASHBOARD_RELOAD_EVENT, handleDashboardReload);

  /*
   * Inicializa o seletor de período.
   * Definido em dashboard.js.
   */
  initDashboardPeriod();

  /*
   * Inicializa lista de quizzes.
   * Definido em quiz-list.js.
   *
   * Ao resolver o quiz ativo, ele dispara:
   *
   * dashboard:reload
   */
  QuizList.init();

  /*
   * Inicializa modal de criação de quiz.
   * Definido em novo-quiz.js.
   */
  initNewQuizModal();
});