const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const getWsUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Replace http/https with ws/wss
    return process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws');
  }
  if (typeof window !== 'undefined') {
    return `ws://${window.location.hostname}:8000`;
  }
  return 'ws://localhost:8000';
};

export const API_BASE_URL = getBaseUrl();
export const WS_BASE_URL = getWsUrl();
