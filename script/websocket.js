/**
 * websocket.js
 *
 * Responsabilidade: manter o dashboard atualizado em tempo real,
 * conectando ao broker STOMP exposto pelo backend (WebSocketConfig.java,
 * endpoint "/ws") e escutando o tópico "/topic/dashboard/{slug}" do
 * quiz ativo.
 *
 * O tópico usa o SLUG do quiz, o mesmo identificador usado pela API:
 *
 * POST /analytics/{slug}/dashboard
 *
 * Quando uma mensagem DASHBOARD_REFRESH chega pelo WebSocket,
 * este arquivo dispara "dashboard:reload" em window.
 *
 * Esse mesmo evento já é utilizado pelo dashboard para:
 *
 * - buscar os dados novamente na API
 * - renderizar os cards
 * - renderizar o funil
 *
 * O WebSocket apenas informa que os dados mudaram.
 * Ele não controla o DOM e não recarrega a página.
 *
 * Depende de:
 * - SockJS + StompJS carregados antes deste arquivo
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

  /**
   * Inscreve no tópico do quiz atualmente selecionado.
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

        /*
         * Não faz reload da página.
         *
         * Apenas avisa o dashboard que novos dados
         * precisam ser buscados.
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
        console.log("ERRO NA CONEXÃO WEBSOCKET");

        isConnecting = false;

        currentSubscription = null;

        setTimeout(connect, RECONNECT_DELAY_MS);
      },
    );

    socket.onclose = function () {
      console.log("WEBSOCKET DESCONECTADO");

      isConnecting = false;

      currentSubscription = null;

      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }

  /*
   * Reutiliza o evento existente.
   *
   * Casos:
   *
   * 1 - Primeira carga
   *     quiz-list resolve o quiz ativo.
   *
   * 2 - Troca de quiz
   *     muda inscrição para outro slug.
   *
   * 3 - Atualização via WebSocket
   *     busca novamente os dados.
   */
  window.addEventListener("dashboard:reload", subscribeToActiveQuiz);

  document.addEventListener("DOMContentLoaded", connect);

  window.QuizWebSocket = {
    connect: connect,
  };
})();
