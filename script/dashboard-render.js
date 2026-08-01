/**
 * dashboard-render.js
 *
 * Responsabilidade: pegar a resposta do dashboard (já no formato real
 * de DashboardResponse) e desenhar na tela: os 4 cards de resumo e o
 * funil (etapas + perguntas com distribuição de respostas).
 *
 * NÃO faz fetch e NÃO acessa o LocalStorage — só recebe o objeto já
 * pronto via renderDashboard(response) e mexe no DOM.
 *
 * Formato esperado (response):
 *   {
 *     summary: {
 *       metrics: { entered, completed, viewedResult, clickedResult, viewedOffer, clickedOffer },
 *       questions: [{ questionNumber, totalAnswers, options: [{ option, totalAnswers, percentage }] }]
 *     },
 *     funnel: {
 *       events: [{ step, total, valueRate, dropRate }],
 *       questions: [{ question, total, valueRate, dropRate }]
 *     }
 *   }
 */

// Paleta das respostas (A/B/C/D...): tons neutros/frios, longe do
// vermelho (queda) e do verde (retenção), pra não confundir o
// significado das cores no funil.
const ANSWER_PALETTE = [
  { bg: "#3E7CB1", text: "#FFFFFF" }, // azul
  { bg: "#7C6FAD", text: "#FFFFFF" }, // violeta
  { bg: "#C68A3D", text: "#10141F" }, // âmbar
  { bg: "#5B6478", text: "#FFFFFF" }, // slate
  { bg: "#4FA0A0", text: "#FFFFFF" }, // teal
];

// Rótulos amigáveis pros steps conhecidos do funil. Qualquer step novo
// que o backend mandar sem estar aqui cai no humanizeStep() (fallback).
const FUNNEL_STEP_LABELS = {
  VIEW_LANDING: "Visualizou",
  VIEW_RESULT: "Visualizou resultado",
  CLICK_RESULT: "Clicou no resultado",
  VIEW_OFFER: "Visualizou oferta",
  CLICK_OFFER: "Clicou na oferta",
};

function humanizeStep(step) {
  return step
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatNumber(n) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function percentOf(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function roundPct(value) {
  return Math.round((value || 0) * 10) / 10;
}

// ---------------------------------------------------------------------
// Cards de resumo
// ---------------------------------------------------------------------

function renderCards(metrics) {
  const entered = metrics.entered || 0;

  const hints = {
    entered: () => "100% da base",
    completed: (v) => `${percentOf(v, entered)}% dos que entraram`,
    viewedOffer: (v) => `${percentOf(v, entered)}% dos que entraram`,
    clickedOffer: (v) => `${percentOf(v, entered)}% dos que entraram`,
  };

  document.querySelectorAll("[data-metric]").forEach((card) => {
    const metric = card.dataset.metric;
    const value = metrics[metric] ?? 0;
    const pct = percentOf(value, entered);

    card.querySelector("[data-value]").textContent = formatNumber(value);

    const fillEl = card.querySelector("[data-fill]");
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
    }

    const hintEl = card.querySelector("[data-hint]");
    if (hintEl && hints[metric]) {
      hintEl.textContent = hints[metric](value);
    }
  });
}

// ---------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------

/**
 * Monta a barra de retenção + percentual (valueRate) de uma linha.
 */
function buildBar(valueRate) {
  const bar = document.createElement("div");
  bar.className = "funnel-row__bar";

  const track = document.createElement("span");
  track.className = "funnel-row__track";

  const fill = document.createElement("span");
  fill.className = "funnel-row__fill";
  fill.style.width = "0%"; // anima de 0 até o valor real após montar no DOM

  track.appendChild(fill);

  const pct = document.createElement("span");
  pct.className = "funnel-row__pct";
  pct.textContent = `${roundPct(valueRate)}%`;

  bar.append(track, pct);

  requestAnimationFrame(() => {
    fill.style.width = `${valueRate}%`;
  });

  return bar;
}

/**
 * Monta a pill de queda (dropRate) ou o travessão neutro quando não há
 * queda na etapa.
 */
function buildDrop(dropRate) {
  const hasDrop = (dropRate || 0) > 0;
  const drop = document.createElement("span");
  drop.className = hasDrop
    ? "funnel-row__drop"
    : "funnel-row__drop funnel-row__drop--none";
  drop.textContent = hasDrop ? `−${roundPct(dropRate)}%` : "—";
  return drop;
}

/**
 * Monta a distribuição de respostas de uma pergunta (summary.questions[i].options):
 * barra segmentada (sem texto dentro) + legenda abaixo com cor, opção e percentual.
 */
function buildAnswers(options) {
  const wrap = document.createElement("div");
  wrap.className = "funnel-row__answers";

  const bar = document.createElement("div");
  bar.className = "answer-bar";

  const legend = document.createElement("div");
  legend.className = "answer-legend";

  options.forEach((opt, i) => {
    const palette = ANSWER_PALETTE[i % ANSWER_PALETTE.length];

    const seg = document.createElement("span");
    seg.className = "answer-bar__seg";
    seg.style.flexBasis = "0%";
    seg.style.background = palette.bg;
    seg.title = `${opt.option} · ${roundPct(opt.percentage)}%`;
    bar.appendChild(seg);

    requestAnimationFrame(() => {
      seg.style.flexBasis = `${opt.percentage}%`;
    });

    const item = document.createElement("span");
    item.className = "answer-legend__item";

    const swatch = document.createElement("span");
    swatch.className = "answer-legend__swatch";
    swatch.style.background = palette.bg;

    const text = document.createElement("span");
    text.textContent = `${opt.option} `;

    const value = document.createElement("span");
    value.className = "answer-legend__value";
    value.textContent = `${roundPct(opt.percentage)}%`;

    text.appendChild(value);
    item.append(swatch, text);
    legend.appendChild(item);
  });

  wrap.append(bar, legend);
  return wrap;
}

/**
 * Monta uma linha do funil (etapa comum ou pergunta).
 */
function buildFunnelRow({
  label,
  total,
  valueRate,
  dropRate,
  isQuestion,
  options,
}) {
  const row = document.createElement("div");
  row.className = "funnel-row";
  if (isQuestion) row.classList.add("funnel-row--question");

  const rail = document.createElement("div");
  rail.className = "funnel-row__rail";
  const dot = document.createElement("span");
  dot.className = "funnel-row__dot";
  rail.appendChild(dot);

  const content = document.createElement("div");
  content.className = "funnel-row__content";

  const top = document.createElement("div");
  top.className = "funnel-row__top";

  const labelEl = document.createElement("span");
  labelEl.className = "funnel-row__label";
  labelEl.textContent = label;

  const countEl = document.createElement("span");
  countEl.className = "funnel-row__count";
  countEl.textContent = formatNumber(total);

  top.append(labelEl, buildBar(valueRate), countEl, buildDrop(dropRate));
  content.appendChild(top);

  if (isQuestion && Array.isArray(options) && options.length) {
    content.appendChild(buildAnswers(options));
  }

  row.append(rail, content);
  return row;
}

/**
 * Renderiza o funil inteiro. O evento genérico "VIEW_QUESTION" (a
 * transição da landing pra dentro do quiz) é substituído pelas linhas
 * de cada pergunta — retenção vem de funnel.questions, distribuição de
 * resposta vem de summary.questions (casadas pelo número da pergunta).
 */
function renderFunnel(funnel, summaryQuestions) {
  const container = document.getElementById("funnelList");
  container.innerHTML = "";

  const answersByQuestion = new Map(
    (summaryQuestions || []).map((q) => [q.questionNumber, q.options]),
  );

  (funnel.events || []).forEach((event) => {
    if (event.step === "VIEW_QUESTION") {
      (funnel.questions || []).forEach((q) => {
        container.appendChild(
          buildFunnelRow({
            label: `Pergunta ${q.question}`,
            total: q.total,
            valueRate: q.valueRate,
            dropRate: q.dropRate,
            isQuestion: true,
            options: answersByQuestion.get(q.question),
          }),
        );
      });
      return;
    }

    container.appendChild(
      buildFunnelRow({
        label: FUNNEL_STEP_LABELS[event.step] || humanizeStep(event.step),
        total: event.total,
        valueRate: event.valueRate,
        dropRate: event.dropRate,
        isQuestion: false,
      }),
    );
  });
}

// ---------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------

function renderDashboard(response) {
  renderCards(response.summary.metrics);
  renderFunnel(response.funnel, response.summary.questions);
}

// ---------------------------------------------------------------------
// Atualização automática via WebSocket
// ---------------------------------------------------------------------

window.addEventListener("dashboard:updated", (event) => {
  const response = event.detail;

  if (!response) {
    return;
  }

  renderDashboard(response);
});
