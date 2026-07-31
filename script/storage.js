/**
 * storage.js
 *
 * Responsabilidade: encapsular o acesso ao LocalStorage usado pelo
 * Dashboard (quiz selecionado, período selecionado e data específica).
 *
 * Este arquivo NÃO conhece o DOM, NÃO faz fetch e NÃO importa nada.
 * É a única camada que sabe onde e como esses dados são persistidos —
 * o resto da aplicação só deve ler/escrever esse estado através das
 * funções expostas aqui (via window.DashboardStorage).
 */

const STORAGE_KEYS = {
  QUIZ_SLUG: "selectedQuizSlug",
  PERIOD: "selectedPeriod",
  SPECIFIC_DATE: "specificDate",
};

function saveSelectedQuiz(slug) {
  localStorage.setItem(STORAGE_KEYS.QUIZ_SLUG, slug);
}

function getSelectedQuiz() {
  return localStorage.getItem(STORAGE_KEYS.QUIZ_SLUG);
}

function saveSelectedPeriod(period) {
  localStorage.setItem(STORAGE_KEYS.PERIOD, period);
}

function getSelectedPeriod() {
  return localStorage.getItem(STORAGE_KEYS.PERIOD);
}

function saveSpecificDate(date) {
  localStorage.setItem(STORAGE_KEYS.SPECIFIC_DATE, date);
}

function getSpecificDate() {
  return localStorage.getItem(STORAGE_KEYS.SPECIFIC_DATE);
}

function clearDashboardState() {
  localStorage.removeItem(STORAGE_KEYS.QUIZ_SLUG);
  localStorage.removeItem(STORAGE_KEYS.PERIOD);
  localStorage.removeItem(STORAGE_KEYS.SPECIFIC_DATE);
}

window.DashboardStorage = {
  saveSelectedQuiz,
  getSelectedQuiz,
  saveSelectedPeriod,
  getSelectedPeriod,
  saveSpecificDate,
  getSpecificDate,
  clearDashboardState,
};