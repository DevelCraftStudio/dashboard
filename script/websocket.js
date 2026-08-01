/*
  websocket.js
  ------------
  Conecta ao broker STOMP exposto pelo backend (WebSocketConfig.java,
  endpoint "/ws") e escuta o tópico "/topic/dashboard/{quizId}".

  Toda vez que o backend publica uma mensagem DASHBOARD_REFRESH
  (AnalyticsWebSocketPublisher.sendDashboardRefresh), este arquivo
  dispara o evento "dashboard:reload" no documento — o mesmo evento
  que quiz-list.js já dispara ao trocar de quiz. Quem escuta esse
  evento e redesenha a tela é o javascript.js.

  Depende de:
  - SockJS + StompJS (carregados via CDN no index.html, ANTES deste
    arquivo)
  - window.QuizList (definido em quiz-list.js) para saber qual é o
    quiz ativo no momento

  AJUSTE: os pontos abaixo assumem um contrato para quiz-list.js.
  Troque se o real for diferente:
    1) getActiveQuizId() assume window.QuizList.getActiveQuizId()
       OU window.QuizList.activeQuiz.id
    2) troca de quiz assume um evento "quiz:changed" com
       event.detail.id
*/

(function () {
  "use strict";

  var WS_BASE_URL = "https://quiz-api-production-3617.up.railway.app/ws";
  var RECONNECT_DELAY_MS = 5000;
  var POLL_INTERVAL_MS = 500;
  var POLL_MAX_TRIES = 20;

  var stompClient = null;
  var currentSubscription = null;
  var currentQuizId = null;
  var isConnecting = false;

  function getActiveQuizId() {
    // AJUSTE: troque por como quiz-list.js realmente expõe o quiz ativo.
    if (
      window.QuizList &&
      typeof window.QuizList.getActiveQuizId === "function"
    ) {
      return window.QuizList.getActiveQuizId();
    }
    if (
      window.QuizList &&
      window.QuizList.activeQuiz &&
      window.QuizList.activeQuiz.id != null
    ) {
      return window.QuizList.activeQuiz.id;
    }
    return null;
  }

  function subscribeToQuiz(quizId) {
    if (!stompClient || !stompClient.connected || quizId == null) return;

    if (currentSubscription) {
      currentSubscription.unsubscribe();
      currentSubscription = null;
    }

    currentQuizId = quizId;
    currentSubscription = stompClient.subscribe(
      "/topic/dashboard/" + quizId,
      function () {
        // Mensagem DASHBOARD_REFRESH recebida: pede pro resto da app
        // recarregar os dados do dashboard.
        document.dispatchEvent(new CustomEvent("dashboard:reload"));
      }
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
        isConnecting = false;
        var quizId = getActiveQuizId();
        if (quizId != null) {
          subscribeToQuiz(quizId);
        }
      },
      function onError() {
        isConnecting = false;
        currentSubscription = null;
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    );

    socket.onclose = function () {
      isConnecting = false;
      currentSubscription = null;
      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }

  // AJUSTE: nome/formato do evento disparado por quiz-list.js ao
  // trocar o quiz selecionado no dropdown.
  document.addEventListener("quiz:changed", function (event) {
    var quizId = (event.detail && event.detail.id) || getActiveQuizId();
    if (quizId != null && quizId !== currentQuizId) {
      subscribeToQuiz(quizId);
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    connect();

    // O GET /quiz que popula o dropdown é assíncrono, então o quiz
    // ativo pode não existir ainda no momento do connect(). Faz um
    // polling curto até conseguir se inscrever.
    var tries = 0;
    var waitForQuiz = setInterval(function () {
      tries++;
      var quizId = getActiveQuizId();
      if (quizId != null && quizId !== currentQuizId) {
        subscribeToQuiz(quizId);
        clearInterval(waitForQuiz);
      } else if (tries >= POLL_MAX_TRIES) {
        clearInterval(waitForQuiz);
      }
    }, POLL_INTERVAL_MS);
  });

  // Exposto caso outro script precise forçar reconexão/inscrição
  // manualmente (ex: novo-quiz.js após criar um quiz).
  window.QuizWebSocket = {
    connect: connect,
    subscribeToQuiz: subscribeToQuiz,
  };
})();