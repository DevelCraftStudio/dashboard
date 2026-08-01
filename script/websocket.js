/**
 * websocket.js
 *
 * Responsabilidade: manter o dashboard atualizado em tempo real,
 * conectando ao broker STOMP exposto pelo backend (WebSocketConfig.java,
 * endpoint "/ws") e escutando o tópico "/topic/dashboard/{slug}" do
 * quiz ativo.
 *
 * IMPORTANTE: o tópico usa o SLUG do quiz (mesmo identificador usado
 * em toda a API — POST /analytics/{slug}/dashboard), não um id
 * numérico. Isso exige que AnalyticsWebSocketPublisher.java publique
 * em "/topic/dashboard/" + slug em vez de "/topic/dashboard/" + quizId.
 *
 * Toda vez que chega uma mensagem DASHBOARD_REFRESH nesse tópico,
 * este arquivo dispara "dashboard:reload" em window — o mesmo evento
 * que quiz-list.js já dispara ao trocar de quiz, e que javascript.js
 * já escuta pra chamar loadDashboardData() + renderDashboard().
 *
 * Depende de:
 * - SockJS + StompJS (carregados via CDN no index.html, ANTES deste
 *   arquivo)
 * - window.QuizList.getSelectedQuiz() (definido em quiz-list.js) pra
 *   saber qual é o slug do quiz ativo no momento
 *
 * Não depende de nenhum evento novo: reaproveita o "dashboard:reload"
 * que já é disparado sempre que o quiz ativo muda (activateQuiz em
 * quiz-list.js) ou o período muda (dashboard.js) — nessas horas, além
 * de recarregar os dados, também garante que a inscrição no WebSocket
 * está apontando pro quiz certo.
 */

(function () {
  "use strict";

  var WS_BASE_URL = "https://quiz-api-production-3617.up.railway.app/ws";
  var RECONNECT_DELAY_MS = 5000;

  var stompClient = null;
  var currentSubscription = null;
  var currentSlug = null;
  var isConnecting = false;

  function getActiveSlug() {
    var quiz =
      window.QuizList && typeof window.QuizList.getSelectedQuiz === "function"
        ? window.QuizList.getSelectedQuiz()
        : null;
    return quiz ? quiz.slug : null;
  }

  /**
   * Garante que a inscrição do WebSocket está no tópico do quiz
   * ativo. Não faz nada se já estiver inscrito no slug certo, se
   * ainda não houver conexão aberta, ou se não houver quiz ativo.
   */
  function subscribeToActiveQuiz() {
    var slug = getActiveSlug();

    console.log("SLUG ATIVO:", slug);

    if (!stompClient || !stompClient.connected) {
      console.log("WEBSOCKET NÃO CONECTADO");
      return;
    }

    if (!slug) {
      console.log("NENHUM QUIZ SELECIONADO");
      return;
    }

    if (slug === currentSlug) {
      console.log("JÁ INSCRITO NO SLUG:", slug);
      return;
    }

    if (currentSubscription) {
      currentSubscription.unsubscribe();
      currentSubscription = null;
    }

    console.log("ASSINANDO TÓPICO:", "/topic/dashboard/" + slug);

    currentSlug = slug;

    currentSubscription = stompClient.subscribe(
      "/topic/dashboard/" + slug,
      function (message) {
        console.log("WEBSOCKET RECEBIDO:", message.body);

        location.reload(); // força recarregar a página inteira
      },
    );
  }
  function connect() {
    if (isConnecting || (stompClient && stompClient.connected)) return;
    isConnecting = true;

    var socket = new SockJS(WS_BASE_URL);
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // silencia logs verbosos no console

    stompClient.connect(
      {},
      function onConnected() {
        console.log("WEBSOCKET CONECTADO");

        isConnecting = false;
        currentSubscription = null;
        currentSlug = null;

        subscribeToActiveQuiz();
      },
      function onError() {
        isConnecting = false;
        currentSubscription = null;
        setTimeout(connect, RECONNECT_DELAY_MS);
      },
    );

    socket.onclose = function () {
      isConnecting = false;
      currentSubscription = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }

  // Cobre três casos de uma vez, sem precisar de evento novo:
  // 1) primeira carga (quiz-list.js dispara dashboard:reload assim
  //    que resolve o quiz ativo, mesmo antes do WebSocket conectar —
  //    subscribeToActiveQuiz() simplesmente não faz nada até
  //    stompClient.connected ficar true, e o onConnected() acima
  //    tenta de novo)
  // 2) troca de quiz no dropdown
  // 3) qualquer outro dashboard:reload (ex.: troca de período) — aqui
  //    o slug não muda, então a função só confirma que a inscrição
  //    já está correta
  window.addEventListener("dashboard:reload", subscribeToActiveQuiz);

  document.addEventListener("DOMContentLoaded", connect);

  window.QuizWebSocket = { connect: connect };
})();
