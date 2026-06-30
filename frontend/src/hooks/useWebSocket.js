import { useCallback, useEffect, useRef, useState } from "react";

const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL?.trim() || "ws://localhost:8080";

const getWebSocketUrl = () => {
  let normalizedBaseUrl = wsBaseUrl;

  if (normalizedBaseUrl.startsWith("http://")) {
    normalizedBaseUrl = `ws://${normalizedBaseUrl.slice(7)}`;
  } else if (normalizedBaseUrl.startsWith("https://")) {
    normalizedBaseUrl = `wss://${normalizedBaseUrl.slice(8)}`;
  }

  return new URL("/ws/transcribe", normalizedBaseUrl).toString();
};

/**
 * WebSocket connection hook with reconnection and heartbeat logic
 */
export const useWebSocket = ({ 
  sessionId, 
  selectedLanguage, 
  translateToEnglish,
  onMessage,
  enabled = false
}) => {
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  
  const socketRef = useRef(null);
  const intentionalStopRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongTimeoutRef = useRef(null);

  const stopHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
  }, []);

  const setupWebSocket = useCallback((isReconnect = false) => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn("Error closing old socket:", e);
      }
    }

    const socket = new WebSocket(getWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptRef.current = 0;
      stopHeartbeat();

      const config = {
        type: isReconnect ? "resume_session" : "config",
        session_id: sessionId,
        sample_rate: 16000,
        fast_delay_ms: 240,
        slow_delay_ms: 2400,
        chunk_duration_ms: 10,
        target_language: selectedLanguage,
        translate_to_english: translateToEnglish,
      };

      socket.send(JSON.stringify(config));

      // Setup Ping/Pong Heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));

          pongTimeoutRef.current = setTimeout(() => {
            console.warn("WebSocket heartbeat timed out. Closing socket.");
            socket.close();
          }, 30000);
        }
      }, 10000);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "pong") {
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          return;
        }

        onMessage?.(message);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    socket.onclose = () => {
      stopHeartbeat();
      if (!intentionalStopRef.current) {
        setConnectionStatus("reconnecting");
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptRef.current += 1;
          console.log(`Reconnecting attempt ${reconnectAttemptRef.current}...`);
          setupWebSocket(true);
        }, delay);
      } else {
        setConnectionStatus("disconnected");
      }
    };

    socket.onerror = () => {
      if (intentionalStopRef.current) {
        setConnectionStatus("error");
      }
    };

    return socket;
  }, [sessionId, selectedLanguage, translateToEnglish, stopHeartbeat, onMessage]);

  const sendData = useCallback((data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(data);
      return true;
    }
    return false;
  }, []);

  const close = useCallback(() => {
    intentionalStopRef.current = true;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send("stop");
    }

    stopHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.warn("Error closing socket:", e);
      }
      socketRef.current = null;
    }
  }, [stopHeartbeat]);

  useEffect(() => {
    if (enabled) {
      intentionalStopRef.current = false;
      reconnectAttemptRef.current = 0;
      setupWebSocket(false);
    }

    return () => {
      close();
    };
  }, [enabled, setupWebSocket, close]);

  return {
    connectionStatus,
    sendData,
    close,
  };
};
