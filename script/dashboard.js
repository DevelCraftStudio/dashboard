/**
 * dashboard.js
 *
 * Responsabilidades:
 *
 * 1. Comunicação HTTP com API
 *    -> fetchDashboard(slug, body)
 *
 * 2. Montagem do request
 *    -> buildDashboardRequest()
 *
 * 3. Controle do período
 *    -> initDashboardPeriod()
 *
 * 4. Atualização via WebSocket
 *    -> escuta dashboard:reload
 *    -> busca dados novamente
 *    -> dispara dashboard:updated
 *
 * Depende apenas de:
 *
 * - window.DashboardStorage
 * - window.QuizList.getSelectedQuiz()
 */

const DASHBOARD_API_BASE_URL =
  "https://quiz-api-production-3617.up.railway.app/analytics";

// ---------------------------------------------------------------------
// MOCK TEMPORÁRIO
// ---------------------------------------------------------------------

const MOCK_DASHBOARD_RESPONSE = {
  summary: {
    metrics: {
      started: 12500,
      viewLanding: 12100,
      completed: 8400,
      viewedResult: 8000,
      clickedResult: 3500,
      viewedOffer: 6200,
      clickedOffer: 1800,
      paid: 900,
    },

    questions: [],
  },

  funnel: {
    events: [],
    questions: [],
  },
};

// ---------------------------------------------------------------------
// 1) API
// ---------------------------------------------------------------------

async function fetchDashboard(slug, body) {
  const response = await fetch(`${DASHBOARD_API_BASE_URL}/${slug}/dashboard`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar dashboard HTTP ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------
// 2) REQUEST
// ---------------------------------------------------------------------

function buildDashboardRequest() {
  const period = DashboardStorage.getSelectedPeriod() || "LAST_7_DAYS";

  const request = {
    period,
  };

  if (period === "SPECIFIC_DAY") {
    const date = DashboardStorage.getSpecificDate();

    if (date) {
      request.date = date;
    }
  }

  return request;
}

async function loadDashboardData(slug) {
  const body = buildDashboardRequest();

  try {
    return await fetchDashboard(slug, body);
  } catch (error) {
    console.warn("API indisponível, usando mock", error);

    return MOCK_DASHBOARD_RESPONSE;
  }
}

// ---------------------------------------------------------------------
// 3) PERIOD
// ---------------------------------------------------------------------

const PERIOD_LABELS = {
  TODAY: "Hoje",

  LAST_7_DAYS: "Últimos 7 dias",

  LAST_30_DAYS: "Últimos 30 dias",
};

function formatDateLabel(date) {
  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
}

function initDashboardPeriod() {
  const buttons = document.querySelectorAll(".period-switch__btn");

  const dateInput = document.getElementById("specificDateInput");

  const eyebrow = document.getElementById("periodEyebrow");

  function updateEyebrow(period) {
    if (!eyebrow) return;

    if (period === "SPECIFIC_DAY") {
      const date = DashboardStorage.getSpecificDate();

      eyebrow.textContent = date ? formatDateLabel(date) : "Dia específico";
    } else {
      eyebrow.textContent = PERIOD_LABELS[period] || PERIOD_LABELS.LAST_7_DAYS;
    }
  }

  function setActiveButton(period) {
    buttons.forEach((button) => {
      button.classList.toggle(
        "is-active",

        button.dataset.period === period,
      );
    });
  }

  function toggleDate(period) {
    dateInput.classList.toggle(
      "is-visible",

      period === "SPECIFIC_DAY",
    );
  }

  function applyPeriod(period) {
    setActiveButton(period);

    toggleDate(period);

    DashboardStorage.saveSelectedPeriod(period);

    updateEyebrow(period);
  }

  function restoreState() {
    const period = DashboardStorage.getSelectedPeriod() || "LAST_7_DAYS";

    const date = DashboardStorage.getSpecificDate();

    if (date) {
      dateInput.value = date;
    }

    applyPeriod(period);
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      applyPeriod(button.dataset.period);

      window.dispatchEvent(new Event("dashboard:reload"));
    });
  });

  dateInput.addEventListener("change", () => {
    DashboardStorage.saveSpecificDate(dateInput.value);

    updateEyebrow("SPECIFIC_DAY");

    window.dispatchEvent(new Event("dashboard:reload"));
  });

  restoreState();
}

// ---------------------------------------------------------------------
// 4) WEBSOCKET INTEGRATION
// ---------------------------------------------------------------------

window.addEventListener("dashboard:reload", async () => {
  const quiz =
    window.QuizList && typeof window.QuizList.getSelectedQuiz === "function"
      ? window.QuizList.getSelectedQuiz()
      : null;

  if (!quiz) {
    console.log("Nenhum quiz selecionado");

    return;
  }

  const dashboard = await loadDashboardData(quiz.slug);

  window.dispatchEvent(
    new CustomEvent(
      "dashboard:updated",

      {
        detail: dashboard,
      },
    ),
  );
});

// inicialização do seletor
document.addEventListener("DOMContentLoaded", initDashboardPeriod);