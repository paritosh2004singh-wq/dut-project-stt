import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8080";

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

const getApiErrorMessage = (error, fallbackMessage) => {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const searchTranscripts = async (query) => {
  try {
    const response = await apiClient.get("/api/search", {
      params: { q: query },
    });
    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Unable to search transcripts right now."),
      { cause: error }
    );
  }
};

export const fetchSessions = async () => {
  try {
    const response = await apiClient.get("/api/sessions");
    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Unable to load recent sessions right now."),
      { cause: error }
    );
  }
};

export const fetchSessionDetail = async (sessionId) => {
  try {
    const response = await apiClient.get(`/api/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    throw new Error(
      getApiErrorMessage(error, "Unable to load the selected session."),
      { cause: error }
    );
  }
};

export { apiClient };
