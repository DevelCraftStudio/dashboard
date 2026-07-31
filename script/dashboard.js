/**
 * dashboard.js
 *
 * Junta as três responsabilidades que antes ficavam separadas em
 * dashboard-api.js, dashboard-request.js e dashboard-period.js:
 *
 *   1. Comunicação HTTP com a API   -> fetchDashboard(slug, body)
 *   2. Montagem do body a partir do LocalStorage -> buildDashboardRequest()
 *   3. Comportamento do seletor de período -> initDashboardPeriod()
 *
 * Continua dependendo apenas de window.DashboardStorage (storage.js) —
 * não conhece o resto da aplicação além disso.
 *
 * FALLBACK TEMPORÁRIO: enquanto o endpoint real estiver com erro no
 * servidor, loadDashboardData() cai automaticamente para
 * MOCK_DASHBOARD_RESPONSE quando o POST falha, só pra manter o front
 * testável. Assim que o backend for corrigido, é só remover o
 * try/catch de loadDashboardData (fetchDashboard já lança o erro certo).
 */

const DASHBOARD_API_BASE_URL = "https://quiz-api-production-3617.up.railway.app/analytics";

const MOCK_DASHBOARD_RESPONSE = {
  summary: {
    metrics: {
      entered: 12500,
      completed: 8400,
      viewedResult: 8000,
      clickedResult: 3500,
      viewedOffer: 6200,
      clickedOffer: 1800,
    },
    questions: [
      {
        questionNumber: 1,
        totalAnswers: 12500,
        options: [
          { option: "A", totalAnswers: 4500, percentage: 36.0 },
          { option: "B", totalAnswers: 5200, percentage: 41.6 },
          { option: "C", totalAnswers: 1600, percentage: 12.8 },
          { option: "D", totalAnswers: 1200, percentage: 9.6 },
        ],
      },
      {
        questionNumber: 2,
        totalAnswers: 12000,
        options: [
          { option: "A", totalAnswers: 5000, percentage: 41.7 },
          { option: "B", totalAnswers: 4000, percentage: 33.3 },
          { option: "C", totalAnswers: 2000, percentage: 16.7 },
          { option: "D", totalAnswers: 1000, percentage: 8.3 },
        ],
      },
    ],
  },
  funnel: {
    events: [
      { step: "START", total: 12500, valueRate: 100.0, dropRate: 0.0 },
      { step: "RESULT_VIEW", total: 8000, valueRate: 64.0, dropRate: 36.0 },
      { step: "OFFER_CLICK", total: 1800, valueRate: 14.4, dropRate: 77.5 },
    ],
    questions: [
      { question: 1, total: 12000, valueRate: 96.0, dropRate: 4.0 },
      { question: 2, total: 11400, valueRate: 91.2, dropRate: 5.0 },
    ],
  },
};

// ---------------------------------------------------------------------
// 1) API — comunicação HTTP
// ---------------------------------------------------------------------

/**
 * Envia o POST para o endpoint de dashboard de um quiz e retorna o
 * JSON da resposta. Lança um erro quando a resposta não é OK.
 */
async function fetchDashboard(slug, body) {
  const res = await fetch(`${DASHBOARD_API_BASE_URL}/${slug}/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Falha ao buscar dashboard (HTTP ${res.status})`);
  }

  return res.json();
}

// ---------------------------------------------------------------------
// 2) Request — monta o body a partir do LocalStorage
// ---------------------------------------------------------------------

/**
 * TODAY / LAST_7_DAYS / LAST_30_DAYS -> { period }
 * SPECIFIC_DAY                       -> { period, date }
 */
function buildDashboardRequest() {
  const period = DashboardStorage.getSelectedPeriod() || "LAST_7_DAYS";

  const request = { period };

  if (period === "SPECIFIC_DAY") {
    const date = DashboardStorage.getSpecificDate();
    if (date) {
      request.date = date;
    }
  }

  return request;
}

/**
 * Monta o request e faz o POST. Se o servidor falhar, cai para os
 * dados falsos (MOCK_DASHBOARD_RESPONSE) — ver nota no topo do arquivo.
 */
async function loadDashboardData(slug) {
  const body = buildDashboardRequest();

  try {
    return await fetchDashboard(slug, body);
  } catch (err) {
    console.warn(
      "Falha ao buscar dashboard real (servidor com erro) — usando dados falsos temporariamente.",
      err,
    );
    return MOCK_DASHBOARD_RESPONSE;
  }
}

// ---------------------------------------------------------------------
// 3) Period — comportamento do seletor de período
// ---------------------------------------------------------------------

// Rótulo mostrado no eyebrow (acima do nome do quiz) pra cada período.
// SPECIFIC_DAY não entra aqui porque o texto depende da data escolhida
// (ver formatDateLabel/updateEyebrow).
const PERIOD_LABELS = {
  TODAY: "Hoje",
  LAST_7_DAYS: "Últimos 7 dias",
  LAST_30_DAYS: "Últimos 30 dias",
};

function formatDateLabel(isoDate) {
  const [year, month, day] = isoDate.split("-");
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
    buttons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.period === period);
    });
  }

  function toggleDateVisibility(period) {
    dateInput.classList.toggle("is-visible", period === "SPECIFIC_DAY");
  }

  function ensureDateHasValue() {
    if (!dateInput.value) {
      dateInput.valueAsDate = new Date();
    }
    DashboardStorage.saveSpecificDate(dateInput.value);
  }

  function applyPeriod(period) {
    setActiveButton(period);
    toggleDateVisibility(period);
    DashboardStorage.saveSelectedPeriod(period);

    if (period === "SPECIFIC_DAY") {
      ensureDateHasValue();
    }

    updateEyebrow(period);
  }

  function restoreState() {
    const savedPeriod = DashboardStorage.getSelectedPeriod() || "LAST_7_DAYS";
    const savedDate = DashboardStorage.getSpecificDate();

    if (savedDate) {
      dateInput.value = savedDate;
    }

    // aplica sem disparar reload: a primeira carga do dashboard é
    // disparada pelo quiz-list.js assim que o quiz ativo é resolvido
    applyPeriod(savedPeriod);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyPeriod(btn.dataset.period);
      window.dispatchEvent(new CustomEvent("dashboard:reload"));
    });
  });

  dateInput.addEventListener("change", () => {
    DashboardStorage.saveSpecificDate(dateInput.value);
    updateEyebrow("SPECIFIC_DAY");
    window.dispatchEvent(new CustomEvent("dashboard:reload"));
  });

  restoreState();
}