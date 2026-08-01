/**
 * websocket.js
 *
 * Responsabilidade:
 * Manter o dashboard sincronizado em tempo real.
 *
 * O WebSocket conecta no broker STOMP do backend
 * (WebSocketConfig.java endpoint "/ws")
 * e escuta:
 *
 * /topic/dashboard/{slug}
 *
 * O slug é o mesmo usado pela API:
 *
 * POST /analytics/{slug}/dashboard
 *
 * Quando o backend envia DASHBOARD_REFRESH,
 * este arquivo dispara o evento "dashboard:reload".
 *
 * O dashboard é responsável por:
 *
 * - buscar os dados atualizados na API
 * - atualizar os cards
 * - atualizar gráficos/funil
 *
 * O WebSocket não controla DOM e não recarrega página.
 *
 * Depende de:
 *
 * - SockJS carregado
 * - StompJS carregado
 * - window.QuizList.getSelectedQuiz()
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

    console.log("ASSINANDO:", "/topic/dashboard/" + slug);

    currentSlug = slug;

    currentSubscription = stompClient.subscribe(
      "/topic/dashboard/" + slug,

      function (message) {
        console.log("ATUALIZAÇÃO RECEBIDA:", message.body);

        /*
         * O backend avisou que os dados mudaram.
         *
         * O dashboard vai buscar novamente:
         *
         * POST /analytics/{slug}/dashboard
         *
         * Sem reload de página.
         */

        window.dispatchEvent(new Event("dashboard:reload"));
      },
    );
  }

  function connect() {
    if (isConnecting || (stompClient && stompClient.connected)) {
      return;
    }

    isConnecting = true;

    var socket = new SockJS(WS_BASE_URL);

    stompClient = Stomp.over(socket);

    // remove logs internos do STOMP
    stompClient.debug = null;

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
        console.log("ERRO WEBSOCKET");

        isConnecting = false;

        currentSubscription = null;

        setTimeout(connect, RECONNECT_DELAY_MS);
      },
    );

    socket.onclose = function () {
      console.log("WEBSOCKET DESCONECTADO");

      isConnecting = false;

      currentSubscription = null;
      currentSlug = null;

      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }

  /*
   * O mesmo evento serve para:
   *
   * 1 - carregamento inicial
   * 2 - troca de quiz
   * 3 - atualização recebida pelo WebSocket
   */

  window.addEventListener("dashboard:reload", subscribeToActiveQuiz);

  document.addEventListener("DOMContentLoaded", connect);

  window.QuizWebSocket = {
    connect: connect,
  };
})();
